import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
process.env.AROHA_ENVIRONMENT = "pre-prod";
process.env.MAIL_ENABLED = "true";
Object.assign(process.env, {
  MAIL_FROM: "preprod@notify.example.test",
  MAIL_REPLY_TO: "owner@example.test",
  MAIL_HOST_TO: "host@example.test",
  MAIL_TEST_RECIPIENT: "owner@example.test",
  BILLING_DISPLAY_NAME: "Aroha Retreat",
});
const { environmentProfile } = await import(
  "../functions/environment-profile.mjs"
);
const { environment, collectionName, isTester } = await import(
  "../functions/environment.mjs"
);
const { mailSettings } = await import("../functions/email/config.mjs");
const {
  invoiceSnapshot,
  invoiceYear,
  queueNotifications,
  mailCollection,
  invoiceCollection,
} = await import("../functions/email/jobs.mjs");
const { deliverEmail } = await import("../functions/email/delivery.mjs");
const { captureEmailWebhook } = await import("../functions/email/webhook.mjs");
const { renderInvoicePdf } = await import("../functions/email/invoice-pdf.mjs");
const {
  validateObservabilityConfig,
  publicObservabilityConfig,
  refreshTelemetryConfig,
} = await import("../functions/observability-config.mjs");
const { RuntimeExporter } = await import("../functions/runtime-exporter.mjs");
const { FieldValue } = await import(
  "../functions/node_modules/firebase-admin/lib/firestore/index.js"
);
const { readFile } = await import("node:fs/promises");
function fakeDB() {
  const data = new Map();
  let chain = Promise.resolve();
  const snapshot = (ref) => ({
    id: ref.id,
    ref,
    exists: data.has(ref.path),
    data: () => structuredClone(data.get(ref.path)),
  });
  const apply = (map, path, patch, replace = false) => {
    const row = replace ? {} : { ...map.get(path) };
    for (const [k, v] of Object.entries(patch)) {
      if (v?.isEqual?.(FieldValue.delete())) delete row[k];
      else row[k] = structuredClone(v);
    }
    map.set(path, row);
  };
  const collection = (name) => {
    const ref = (path) => ({
      path,
      id: path.split("/").at(-1),
      get: async () => snapshot(ref(path)),
      update: async (patch) => apply(data, path, patch),
      set: async (patch) => apply(data, path, patch, true),
    });
    const query = (filters = [], cap = 100) => ({
      where: (key, op, value) => query([...filters, [key, op, value]], cap),
      orderBy: () => query(filters, cap),
      limit: (n) => query(filters, n),
      get: async () => ({
        docs: [...data.keys()]
          .filter(
            (path) =>
              path.startsWith(name + "/") &&
              filters.every(([key, op, value]) =>
                op === "=="
                  ? data.get(path)[key] === value
                  : data.get(path)[key] <= value,
              ),
          )
          .slice(0, cap)
          .map((path) => snapshot(ref(path))),
      }),
    });
    return { doc: (id) => ref(name + "/" + id), ...query() };
  };
  return {
    data,
    collection,
    runTransaction(fn) {
      const run = chain.then(async () => {
        const writes = [];
        const result = await fn({
          get: async (ref) => {
            if (writes.length) throw Error("READ_AFTER_WRITE");
            return ref.get();
          },
          create: (ref, v) => writes.push(["create", ref, v]),
          set: (ref, v) => writes.push(["set", ref, v]),
          update: (ref, v) => writes.push(["update", ref, v]),
        });
        const next = new Map(data);
        for (const [k, ref, v] of writes) {
          if (k === "create" && next.has(ref.path)) throw Error("DUPLICATE");
          apply(next, ref.path, v, k !== "update");
        }
        data.clear();
        for (const [k, v] of next) data.set(k, v);
        return result;
      });
      chain = run.catch(() => {});
      return run;
    },
  };
}
const booking = {
  id: "booking-test",
  owner: "guest-test",
  reference: "AR-TESTONLY",
  kind: "private",
  arrival: "2026-12-01",
  departure: "2026-12-03",
  status: "pending_approval",
  version: 1,
  guests: 2,
  lineItems: [{ label: "Cottage x2 nights", amount: 1200000 }],
  subtotal: 1200000,
  discount: 0,
  total: 1200000,
};
const profile = {
  email: "guest@example.test",
  contact: { name: "Synthetic guest", phone: "+12025550123" },
};
async function queue(db, type = "booking.requested") {
  await db
    .collection(collectionName("bookings"))
    .doc(booking.id)
    .set({
      ...booking,
      status: type === "booking.requested" ? "pending_approval" : "confirmed",
      ...(type === "booking.requested"
        ? {}
        : { invoiceId: booking.id + "-v1" }),
    });
  let ids;
  await db.runTransaction((tx) => {
    ids = queueNotifications(tx, db, {
      event: { type, eventId: type + "-test", actor: "guest-test" },
      booking,
      profile,
      config: mailSettings(),
      ...(type !== "booking.requested"
        ? { invoice: invoiceSnapshot(booking, profile, 1, mailSettings()) }
        : {}),
    });
  });
  return ids;
}
test("environment identity is validated and isolates every booking namespace while tester access requires verified Google identity", () => {
  assert.equal(environment.name, "pre-prod");
  assert.equal(collectionName("bookings"), "aroha_preprod_bookings");
  assert.equal(environment.serviceSuffix, "-pre-prod");
  assert.throws(() => environmentProfile("preprod"));
  assert.equal(environmentProfile("production").prefix, "aroha_");
  process.env.PREPROD_TESTER_EMAILS = "owner@example.test";
  assert.equal(
    isTester({
      email: "owner@example.test",
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    }),
    true,
  );
  assert.equal(
    isTester({
      email: "guest@example.test",
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    }),
    false,
  );
  assert.equal(
    isTester({ email: "owner@example.test", email_verified: false }),
    false,
  );
  assert.throws(() =>
    mailSettings({ ...process.env, MAIL_TEST_RECIPIENT: "" }),
  );
  assert.throws(() =>
    mailSettings(
      { ...process.env, BILLING_ADDRESS: "", BILLING_PAYMENT_INSTRUCTIONS: "" },
      environmentProfile("production"),
    ),
  );
});
test("runtime metadata projects only the matching RUM tag and switches all exporter transports without changing environment identity", async () => {
  const cfg = JSON.parse(
    await readFile(
      new URL("../config/observability-runtime.json", import.meta.url),
    ),
  );
  const pub = publicObservabilityConfig(cfg);
  assert.match(pub.rumScriptUrl, /a3e7eb9a9573a1c9/);
  assert.deepEqual(Object.keys(pub).sort(), [
    "configVersion",
    "environment",
    "rumScriptUrl",
  ]);
  const bad = structuredClone(cfg);
  bad.environments["pre-prod"].rumScriptUrl =
    bad.environments.production.rumScriptUrl;
  assert.throws(() => validateObservabilityConfig(bad));
  const db = fakeDB();
  await db.collection("aroha_runtime_config").doc("observability").set(cfg);
  process.env.DT_EXPORT_ENABLED = "true";
  await refreshTelemetryConfig(db, {
    now: 1000,
    loadSecret: async () => "synthetic-one",
  });
  const destinations = [];
  const exporter = new RuntimeExporter(
    (opts) => ({
      export(v, cb) {
        destinations.push({ url: opts.url, auth: opts.headers.Authorization });
        cb({ code: 0 });
      },
      shutdown: async () => {},
    }),
    "/v1/traces",
    {},
  );
  exporter.export([], () => {});
  const next = structuredClone(cfg);
  next.version++;
  next.environments["pre-prod"].otlpEndpoint =
    "https://another-tenant.live.dynatrace.com/api/v2/otlp";
  next.environments["pre-prod"].businessEventsEndpoint =
    "https://another-tenant.live.dynatrace.com/api/v2/bizevents/ingest";
  await db.collection("aroha_runtime_config").doc("observability").set(next);
  await refreshTelemetryConfig(db, {
    now: 62000,
    loadSecret: async () => "synthetic-two",
  });
  exporter.export([], () => {});
  assert.match(destinations[0].url, /indiacs/);
  assert.match(destinations[1].url, /another-tenant/);
  assert.equal(destinations[1].auth, "Bearer synthetic-two");
  await exporter.shutdown();
  process.env.DT_EXPORT_ENABLED = "false";
});
test("invoice snapshots reconcile integer amounts, preserve version history and render Kannada with embedded fonts", async () => {
  assert.equal(invoiceYear(Date.parse("2026-12-31T20:00:00Z")), 2027);
  const one = invoiceSnapshot(booking, profile, 1, mailSettings(), Date.now());
  const two = invoiceSnapshot(
    { ...booking, version: 2, total: 1100000, discount: 100000 },
    profile,
    2,
    mailSettings(),
    Date.now(),
    one,
  );
  assert.equal(one.id, "booking-test-v1");
  assert.equal(two.id, "booking-test-v2");
  assert.equal(two.supersedes, one.id);
  assert.equal(two.balanceDue, 1100000);
  assert.equal(one.balanceDue, 1200000);
  assert.throws(() =>
    invoiceSnapshot({ ...booking, total: 1 }, profile, 1, mailSettings()),
  );
  const pdf = await renderInvoicePdf({ ...one, guestName: "ಪರೀಕ್ಷಾ ಅತಿಥಿ" });
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 5000 && pdf.length < 1048576);
});
test("atomic request jobs route guest and host messages only to the approved test inbox and retries do not double-send", async () => {
  const db = fakeDB(),
    ids = await queue(db);
  assert.equal(ids.length, 2);
  for (const id of ids) {
    const j = (await mailCollection(db).doc(id).get()).data();
    assert.equal(j.to, "owner@example.test");
    assert.equal(j.environment, "pre-prod");
    assert.match(j.subjectPrefix, /PRE-PROD TEST/);
  }
  let calls = 0;
  const send = async (body) => {
    calls++;
    assert.deepEqual(body.to, ["owner@example.test"]);
    assert.match(body.subject, /PRE-PROD TEST/);
    return { data: { id: "message-test" }, error: null };
  };
  const ref = mailCollection(db).doc(ids[0]);
  await deliverEmail(db, ref, send);
  await deliverEmail(db, ref, send);
  assert.equal(calls, 1);
  assert.equal((await ref.get()).data().status, "accepted");
  const events = [...db.data.entries()]
    .filter(([k]) => k.startsWith("aroha_preprod_observability_outbox/"))
    .map(([, v]) => v.event);
  assert.ok(
    events.every((e) => e["deployment.environment.name"] === "pre-prod"),
  );
  assert.ok(!JSON.stringify(events).includes("guest@example.test"));
  assert.ok([...db.data.keys()].every((k) => !k.startsWith("aroha_bookings/")));
});
test("provider rate limits retain retry state and old uncertain sends require reconciliation instead of a new send", async () => {
  const db = fakeDB(),
    [id] = await queue(db),
    ref = mailCollection(db).doc(id),
    now = Date.now();
  await deliverEmail(
    db,
    ref,
    async () => ({
      error: { statusCode: 429, message: "PRIVATE_PROVIDER_MESSAGE" },
      headers: { "retry-after": "120" },
    }),
    { now },
  );
  let j = (await ref.get()).data();
  assert.equal(j.status, "retry");
  assert.ok(j.nextAttemptAt >= now + 120000);
  assert.ok(
    !JSON.stringify([...db.data.values()]).includes("PRIVATE_PROVIDER_MESSAGE"),
  );
  await ref.update({
    nextAttemptAt: now,
    firstAttemptAt: now - 24 * 3600000,
    uncertain: true,
  });
  let calls = 0;
  await deliverEmail(
    db,
    ref,
    async () => {
      calls++;
    },
    { now },
  );
  assert.equal(calls, 0);
  assert.equal((await ref.get()).data().status, "needs_reconciliation");
  const uncertainDb = fakeDB(),
    [uncertainId] = await queue(uncertainDb),
    uncertainRef = mailCollection(uncertainDb).doc(uncertainId);
  await uncertainRef.update({ nextAttemptAt: now });
  await deliverEmail(uncertainDb, uncertainRef, async () => ({ error: {} }), {
    now,
  });
  assert.equal((await uncertainRef.get()).data().uncertain, true);
  await uncertainRef.update({ nextAttemptAt: now });
  await deliverEmail(
    uncertainDb,
    uncertainRef,
    async () => ({ error: { statusCode: 400 } }),
    { now },
  );
  assert.equal(
    (await uncertainRef.get()).data().uncertain,
    true,
    "A later rejection cannot erase an earlier uncertain acceptance",
  );
  const conflictDb = fakeDB(),
    [conflictId] = await queue(conflictDb),
    conflictRef = mailCollection(conflictDb).doc(conflictId);
  await conflictRef.update({ nextAttemptAt: now });
  await deliverEmail(
    conflictDb,
    conflictRef,
    async () => ({ error: { statusCode: 409 } }),
    { now },
  );
  assert.equal((await conflictRef.get()).data().status, "needs_reconciliation");
  assert.equal((await conflictRef.get()).data().nextAttemptAt, undefined);
});
test("confirmation attaches its own private invoice and a cancelled booking suppresses stale confirmation", async () => {
  const db = fakeDB(),
    invoice = invoiceSnapshot(booking, profile, 1, mailSettings());
  await invoiceCollection(db).doc(invoice.id).set(invoice);
  const [id] = await queue(db, "booking.confirmed");
  let attached = false;
  await deliverEmail(
    db,
    mailCollection(db).doc(id),
    async (b) => {
      attached = b.attachments?.[0]?.content?.toString() === "PDF-BYTES";
      return { data: { id: "confirm-message" }, error: null };
    },
    {
      makePdf: async () => ({
        buffer: Buffer.from("PDF-BYTES"),
        object: "private-test-object",
      }),
    },
  );
  assert.equal(attached, true);
  assert.equal(
    (await invoiceCollection(db).doc(invoice.id).get()).data().documentStatus,
    "ready",
  );
  const other = fakeDB(),
    [j] = await queue(other, "booking.confirmed");
  await other
    .collection(collectionName("bookings"))
    .doc(booking.id)
    .update({ status: "cancelled" });
  await deliverEmail(other, mailCollection(other).doc(j), async () => {
    throw Error("MUST_NOT_SEND");
  });
  assert.equal(
    (await mailCollection(other).doc(j).get()).data().status,
    "suppressed",
  );
});
test("replaced invoice confirmations are suppressed before provider submission", async () => {
  const db = fakeDB(),
    [id] = await queue(db, "booking.confirmed");
  await db
    .collection(collectionName("bookings"))
    .doc(booking.id)
    .update({ invoiceId: booking.id + "-v2" });
  let sends = 0;
  await deliverEmail(db, mailCollection(db).doc(id), async () => {
    sends++;
  });
  assert.equal(sends, 0);
  assert.equal(
    (await mailCollection(db).doc(id).get()).data().status,
    "suppressed",
  );
  const race = fakeDB(),
    invoice = invoiceSnapshot(booking, profile, 1, mailSettings()),
    [raceId] = await queue(race, "booking.confirmed");
  await invoiceCollection(race).doc(invoice.id).set(invoice);
  await deliverEmail(
    race,
    mailCollection(race).doc(raceId),
    async () => {
      sends++;
    },
    {
      makePdf: async () => {
        await race
          .collection(collectionName("bookings"))
          .doc(booking.id)
          .update({ invoiceId: booking.id + "-v2" });
        return {
          buffer: Buffer.from("PDF-BYTES"),
          object: "private-race-test",
        };
      },
    },
  );
  assert.equal(sends, 0);
  assert.equal(
    (await mailCollection(race).doc(raceId).get()).data().status,
    "suppressed",
  );
});
test("signed webhooks are replay-safe, reject tampering, and cannot downgrade delivery or cross environments", async () => {
  const db = fakeDB(),
    [id] = await queue(db),
    key = randomBytes(32),
    secret = "whsec_" + key.toString("base64");
  await mailCollection(db)
    .doc(id)
    .update({ status: "accepted", providerMessageId: "message-signed" });
  const request = (type, svixId, env = "pre-prod") => {
    const rawBody = Buffer.from(
        JSON.stringify({
          type,
          data: {
            email_id: "message-signed",
            to: ["owner@example.test"],
            tags: { environment: env, job_id: id },
          },
        }),
      ),
      ts = String(Math.floor(Date.now() / 1000)),
      sig = createHmac("sha256", key)
        .update(svixId + "." + ts + "." + rawBody)
        .digest("base64"),
      headers = {
        "svix-id": svixId,
        "svix-timestamp": ts,
        "svix-signature": "v1," + sig,
      };
    return { rawBody, get: (n) => headers[n] };
  };
  const delivered = request("email.delivered", "msg_delivered");
  await captureEmailWebhook(db, delivered, secret);
  await captureEmailWebhook(db, delivered, secret);
  assert.equal(
    (await mailCollection(db).doc(id).get()).data().status,
    "delivered",
  );
  await captureEmailWebhook(db, request("email.sent", "msg_sent"), secret);
  assert.equal(
    (await mailCollection(db).doc(id).get()).data().status,
    "delivered",
  );
  assert.equal(
    [...db.data.keys()].filter((k) =>
      k.startsWith("aroha_preprod_email_webhooks/"),
    ).length,
    2,
  );
  await captureEmailWebhook(
    db,
    request("email.failed", "msg_late_failed"),
    secret,
  );
  assert.equal(
    (await mailCollection(db).doc(id).get()).data().status,
    "delivered",
  );
  const bad = request("email.bounced", "msg_bad");
  bad.rawBody = Buffer.from("{}");
  await assert.rejects(
    () => captureEmailWebhook(db, bad, secret),
    /INVALID_WEBHOOK_SIGNATURE/,
  );
  await assert.rejects(
    () =>
      captureEmailWebhook(
        db,
        request("email.bounced", "msg_cross", "production"),
        secret,
      ),
    /ENVIRONMENT_MISMATCH/,
  );
});
