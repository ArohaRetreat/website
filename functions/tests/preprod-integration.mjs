import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID, createHmac } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  !process.env.FIREBASE_STORAGE_EMULATOR_HOST
)
  throw Error("EMULATORS_REQUIRED");
const project = "demo-aroha",
  base = `http://127.0.0.1:5001/${project}/asia-south2/arohaApi/api/v1`,
  db = getFirestore(initializeApp({ projectId: project }, "preprod-test"));
async function google(email) {
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: email,
        email,
        email_verified: true,
        iss: "https://accounts.google.com",
        aud: project,
      }),
    ).toString("base64url"),
    "",
  ].join(".");
  const r = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: "id_token=" + jwt + "&providerId=google.com",
        requestUri: "http://localhost",
        returnSecureToken: true,
      }),
    },
  );
  assert.ok(r.ok);
  return r.json();
}
async function call(
  user,
  path,
  body,
  { admin = false, key = randomUUID() } = {},
) {
  const r = await fetch(base + path + (admin ? "?admin=1" : ""), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": key,
      ...(user ? { Authorization: "Bearer " + user.idToken } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  return { httpStatus: r.status, ...(await r.json()) };
}
async function until(check) {
  const end = Date.now() + 40000;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.fail("Timed out waiting for emulator email dispatch");
}
test("pre-prod HTTP booking, approval, private invoice and webhook stay inside test inventory and recipient boundaries", async () => {
  const messages = [];
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const v = JSON.parse(raw);
    messages.push(v);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: { id: randomUUID() }, error: null }));
  });
  await new Promise((r) => server.listen(17881, "127.0.0.1", r));
  try {
    const owner = await google("owner@example.test"),
      guest = await google("guest@example.test"),
      other = await google("other@example.test"),
      outsider = await google("outsider@example.test");
    await db
      .collection("aroha_members")
      .doc(owner.localId)
      .set({ role: "superadmin", active: true, email: "owner@example.test" });
    const canary = { marker: "DO_NOT_CHANGE", version: 99 };
    await db.collection("aroha_booking_config").doc("settings").set(canary);
    await db.collection("aroha_bookings").doc("canary").set(canary);
    assert.equal((await call(outsider, "/booking/state")).httpStatus, 403);
    const metadata = await call(null, "/runtime-config");
    assert.equal(metadata.environment, "pre-prod");
    assert.ok(!JSON.stringify(metadata).includes("tokenSecretVersion"));
    const session = await call(owner, "/session", {});
    assert.equal(session.httpStatus, 200, JSON.stringify(session));
    assert.equal((await call(owner, "/draft", {})).httpStatus, 403);
    const arrival = new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .slice(0, 10),
      departure = new Date(Date.parse(arrival) + 86400000)
        .toISOString()
        .slice(0, 10);
    const quote = await call(guest, "/booking/quote", {
      kind: "day",
      arrival,
      departure,
      adults: 2,
      childrenAges: [],
      guests: 2,
      units: [],
    });
    assert.equal(quote.httpStatus, 200, JSON.stringify(quote));
    const request = {
        quoteId: quote.id,
        note: "PRIVATE_TEST_NOTE",
        contact: { name: "Synthetic Guest", phone: "+12025550123" },
      },
      key = randomUUID();
    const booking = await call(guest, "/booking/create", request, { key });
    assert.equal(booking.httpStatus, 200, JSON.stringify(booking));
    assert.equal(
      (await call(guest, "/booking/create", request, { key })).id,
      booking.id,
    );
    await until(() => messages.length === 2);
    const approved = await call(
      owner,
      "/booking/booking-action",
      { id: booking.id, action: "approve", expectedVersion: 1 },
      { admin: true },
    );
    assert.equal(approved.httpStatus, 200, JSON.stringify(approved));
    await until(() => messages.length === 3);
    assert.ok(
      messages.every(
        (m) =>
          m.body.to.length === 1 &&
          m.body.to[0] === "owner@example.test" &&
          m.body.subject.startsWith("[PRE-PROD TEST]"),
      ),
    );
    assert.equal(
      new Set(messages.map((m) => m.options.idempotencyKey)).size,
      3,
    );
    const confirmation = messages.find((m) => m.body.attachments);
    assert.equal(confirmation.body.attachments.length, 1);
    const communications = await call(guest, "/booking/communications", {
      id: booking.id,
    });
    assert.equal(
      communications.httpStatus,
      200,
      JSON.stringify(communications),
    );
    const stored = (
      await db.collection("aroha_preprod_bookings").doc(booking.id).get()
    ).data();
    assert.ok(stored.invoiceId);
    const pdf = await call(guest, "/booking/invoice-download", {
      id: booking.id,
    });
    assert.equal(pdf.httpStatus, 200, JSON.stringify(pdf));
    assert.ok(JSON.stringify(pdf).includes("JVBER"));
    assert.equal(
      (await call(other, "/booking/invoice-download", { id: booking.id }))
        .httpStatus,
      404,
    );
    const jobs = await db.collection("aroha_preprod_notifications").get(),
      job = jobs.docs
        .find((d) => d.data().channel === "guest_confirmation")
        .data();
    const event = {
        type: "email.delivered",
        data: {
          email_id: job.providerMessageId,
          to: ["owner@example.test"],
          tags: { environment: "pre-prod", job_id: job.id },
        },
      },
      raw = JSON.stringify(event),
      id = "msg_" + randomUUID(),
      timestamp = String(Math.floor(Date.now() / 1000)),
      signature = createHmac("sha256", Buffer.from("synthetic-webhook-secret"))
        .update(id + "." + timestamp + "." + raw)
        .digest("base64");
    async function webhook(sig) {
      return fetch(base + "/email/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": id,
          "svix-timestamp": timestamp,
          "svix-signature": sig,
        },
        body: raw,
      });
    }
    assert.equal((await webhook("v1,invalid")).status, 400);
    assert.equal((await webhook("v1," + signature)).status, 200);
    assert.equal((await webhook("v1," + signature)).status, 200);
    assert.equal(
      (
        await db.collection("aroha_preprod_notifications").doc(job.id).get()
      ).data().status,
      "delivered",
    );
    assert.equal(
      (await db.collection("aroha_preprod_email_webhooks").get()).size,
      1,
    );
    const privateInvoice = (
      await db.collection("aroha_preprod_invoices").doc(stored.invoiceId).get()
    ).data();
    for (const token of [null, guest.idToken]) {
      const direct = await fetch(
        `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/demo-aroha.appspot.com/o/${encodeURIComponent(privateInvoice.object)}?alt=media`,
        { headers: token ? { Authorization: "Bearer " + token } : {} },
      );
      assert.equal(
        direct.status,
        403,
        "Invoice Storage objects must not be public or directly guest-readable",
      );
    }
    const newArrival = new Date(Date.parse(arrival) + 3 * 86400000)
        .toISOString()
        .slice(0, 10),
      newDeparture = new Date(Date.parse(departure) + 3 * 86400000)
        .toISOString()
        .slice(0, 10);
    const changedQuote = await call(guest, "/booking/change-quote", {
      id: booking.id,
      expectedVersion: 2,
      kind: "day",
      arrival: newArrival,
      departure: newDeparture,
      adults: 2,
      childrenAges: [],
      guests: 2,
    });
    assert.equal(changedQuote.httpStatus, 200, JSON.stringify(changedQuote));
    const change = await call(guest, "/booking/change-request", {
      id: booking.id,
      expectedVersion: 2,
      quoteId: changedQuote.id,
    });
    assert.equal(change.httpStatus, 200, JSON.stringify(change));
    const amended = await call(
      owner,
      "/booking/booking-action",
      { id: booking.id, expectedVersion: 3, action: "approve_change" },
      { admin: true },
    );
    assert.equal(amended.httpStatus, 200, JSON.stringify(amended));
    await until(() => messages.length === 4);
    const current = (
      await db.collection("aroha_preprod_bookings").doc(booking.id).get()
    ).data();
    assert.equal(current.invoiceId, booking.id + "-v2");
    assert.equal(
      (
        await db
          .collection("aroha_preprod_invoices")
          .doc(stored.invoiceId)
          .get()
      ).data().status,
      "superseded",
    );
    const revision = (
      await db.collection("aroha_preprod_invoices").doc(current.invoiceId).get()
    ).data();
    assert.equal(
      revision.number,
      "TEST-AR-" + new Date(Date.now() + 19800000).getUTCFullYear() + "-000002",
    );
    assert.ok(messages.at(-1).body.subject.includes("updated"));
    assert.ok(messages.every((m) => m.body.to[0] === "owner@example.test"));
    const cancelled = await call(guest, "/booking/booking-action", {
      id: booking.id,
      expectedVersion: 4,
      action: "cancel",
    });
    assert.equal(cancelled.httpStatus, 200, JSON.stringify(cancelled));
    assert.equal(
      (
        await db
          .collection("aroha_preprod_invoices")
          .doc(current.invoiceId)
          .get()
      ).data().status,
      "void",
    );
    assert.equal(
      (await call(guest, "/booking/invoice-download", { id: booking.id }))
        .httpStatus,
      409,
    );
    const events = await db
      .collection("aroha_preprod_observability_outbox")
      .get();
    assert.ok(
      events.docs.every(
        (d) => d.data().event["deployment.environment.name"] === "pre-prod",
      ),
    );
    assert.deepEqual(
      (
        await db.collection("aroha_booking_config").doc("settings").get()
      ).data(),
      canary,
    );
    assert.deepEqual(
      (await db.collection("aroha_bookings").doc("canary").get()).data(),
      canary,
    );
    assert.equal((await db.collection("aroha_bookings").get()).size, 1);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
