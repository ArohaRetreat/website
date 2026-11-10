import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { initialState, addDays, todayIST } from "../booking/domain.mjs";
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.GCLOUD_PROJECT !== "demo-aroha"
)
  throw Error("ISOLATED_EMULATORS_REQUIRED");
const db = getFirestore(
  initializeApp({ projectId: "demo-aroha" }, "external-tests"),
);
const base = "http://127.0.0.1:5001/demo-aroha/asia-south2/arohaApi";
const json = async (url, options = {}) => {
  const r = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
  });
  return {
    status: r.status,
    data: await r.json(),
    etag: r.headers.get("etag"),
  };
};
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
        aud: "demo-aroha",
      }),
    ).toString("base64url"),
    "",
  ].join(".");
  const r = await json(
    "http://" +
      process.env.FIREBASE_AUTH_EMULATOR_HOST +
      "/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-api-key",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        postBody: "id_token=" + jwt + "&providerId=google.com",
        requestUri: "http://localhost",
        returnSecureToken: true,
      }),
    },
  );
  assert.equal(r.status, 200);
  return r.data;
}
async function call(
  bearer,
  path,
  { method = "GET", body, key, etag, external = true } = {},
) {
  return json(base + (external ? "/api/external/v1" : "/api/v1") + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + bearer,
      ...(key ? { "Idempotency-Key": key } : {}),
      ...(etag ? { "If-Match": etag } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
test("scoped external HTTP contract: own/all, CRUD parity, read purity, revocation and environment denial", async () => {
  const owner = await google("owner@example.test"),
    guest = await google("guest@example.test"),
    other = await google("other@example.test");
  await db
    .collection("aroha_members")
    .doc(owner.localId)
    .set({ active: true, role: "superadmin" });
  const state = initialState();
  await db.collection("aroha_preprod_booking_config").doc("site").set({
    settings: state.settings,
    units: state.units,
    promos: [],
    blocks: [],
    guardVersion: 1,
  });
  await db
    .collection("aroha_preprod_public")
    .doc("site")
    .set({ version: 8, content: { brand: { name: "Synthetic preprod" } } });
  const mint = async (
    user,
    name,
    scopes,
    purpose = "integration",
    rowAccess = "own",
    expiresInHours = 24,
  ) => {
    const r = await call(user.idToken, "/integration-tokens", {
      external: false,
      method: "POST",
      key: name + "-key-0001",
      body: { name, scopes, purpose, rowAccess, expiresInHours },
    });
    assert.equal(r.status, 200, "scoped token creation");
    assert.ok(r.data.token);
    return r.data;
  };
  const read = await mint(
    guest,
    "guest-reader",
    [
      "runtime:read",
      "availability:read",
      "calendar:read",
      "reservations:read",
      "inventory:read",
      "content:published:read",
      "communications:read",
    ],
    "mcp-readonly",
    "own",
    null,
  );
  const manager = await mint(
    owner,
    "booking-manager",
    [
      "runtime:read",
      "reservations:read",
      "reservations:approve",
      "stays:operate",
      "contacts:read",
      "inventory:read",
      "inventory:write",
    ],
    "integration",
    "all",
  );
  const write = await mint(guest, "guest-writer", [
    "quotes:create",
    "reservations:create",
    "reservations:cancel",
    "reservations:read",
  ]);
  const otherRead = await mint(other, "other-reader", ["reservations:read"]);
  const runtime = await call(read.token, "/runtime");
  assert.equal(runtime.status, 200);
  assert.ok(runtime.data.capabilities.includes("getAvailability"));
  assert.ok(!runtime.data.capabilities.includes("createReservation"));
  const stored = (
    await db.collection("aroha_preprod_integration_tokens").doc(read.id).get()
  ).data();
  assert.ok(stored.secretHash && !JSON.stringify(stored).includes(read.token));
  assert.equal(read.expiresAt, null);
  assert.equal(stored.expiresAt, null);
  assert.ok(!("expireAt" in stored));
  const listed = await call(guest.idToken, "/integration-tokens", { external: false });
  assert.equal(listed.data.items.find(t => t.id === read.id).expiresAt, null);
  assert.ok(manager.expiresAt > Date.now() + 23 * 3600000);
  const defaultExpiry = await call(owner.idToken, "/integration-tokens", {
    external: false, method: "POST", key: "default-expiry-0001",
    body: { name: "default-expiry", scopes: ["runtime:read"] },
  });
  assert.equal(defaultExpiry.status, 200);
  assert.ok(defaultExpiry.data.expiresAt > Date.now() + 23 * 3600000);
  assert.ok(defaultExpiry.data.expiresAt <= Date.now() + 24 * 3600000);
  for (const [index, value] of [0, 169, "never", false].entries()) {
    const invalid = await call(guest.idToken, "/integration-tokens", {
      external: false, method: "POST", key: "invalid-expiry-000" + index,
      body: { name: "invalid-expiry", scopes: ["runtime:read"], expiresInHours: value },
    });
    assert.equal(invalid.status, 422);
  }
  const finite = await mint(guest, "finite-reader", ["runtime:read"], "mcp-readonly", "own", 1);
  assert.ok(Number.isSafeInteger(finite.expiresAt));
  const finiteRef = db.collection("aroha_preprod_integration_tokens").doc(finite.id);
  await finiteRef.update({ expiresAt: Date.now() - 1 });
  assert.equal((await call(finite.token, "/runtime")).status, 403);
  const date = addDays(todayIST(), 14),
    departure = addDays(date, 1),
    beforeConfig = JSON.stringify(
      (
        await db.collection("aroha_preprod_booking_config").doc("site").get()
      ).data(),
    );
  const beforeProfiles = (
    await db.collection("aroha_preprod_booking_profiles").get()
  ).size;
  const avail = await call(
    read.token,
    `/availability?kind=day&arrival=${date}&departure=${departure}&adults=2&childrenAges=7`,
  );
  assert.equal(avail.status, 200);
  assert.equal(avail.data.available, true);
  const cal = await call(
    read.token,
    `/calendar?arrival=${date}&departure=${departure}`,
  );
  assert.equal(cal.status, 200);
  assert.equal(
    JSON.stringify(
      (
        await db.collection("aroha_preprod_booking_config").doc("site").get()
      ).data(),
    ),
    beforeConfig,
  );
  assert.equal(
    (await db.collection("aroha_preprod_booking_profiles").get()).size,
    beforeProfiles,
  );
  const denied = await call(read.token, "/quotes", {
    method: "POST",
    key: "read-only-test",
    body: {},
  });
  assert.equal(denied.status, 403);
  const allDenied = await call(guest.idToken, "/integration-tokens", {
    external: false,
    method: "POST",
    key: "guest-all-test",
    body: {
      name: "Invalid all grant",
      scopes: ["reservations:read"],
      rowAccess: "all",
    },
  });
  assert.equal(allDenied.status, 403);
  const wrongEnv = await call(read.token.replace("_ppr_", "_prd_"), "/runtime");
  assert.equal(wrongEnv.status, 401);
  const quote = await call(write.token, "/quotes", {
    method: "POST",
    key: "day-quote-0001",
    body: {
      kind: "day",
      arrival: date,
      departure,
      adults: 2,
      childrenAges: [7],
      units: [],
    },
  });
  assert.equal(quote.status, 201);
  assert.equal(quote.data.total, 310000);
  const createBody = {
    quoteId: quote.data.id,
    contact: { name: "Synthetic Guest", phone: "+919999999999" },
  };
  const created = await call(write.token, "/reservations", {
    method: "POST",
    key: "day-create-0001",
    body: createBody,
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.status, "pending_approval");
  assert.ok(!JSON.stringify(created.data).includes("Synthetic Guest"));
  const replay = await call(write.token, "/reservations", {
    method: "POST",
    key: "day-create-0001",
    body: createBody,
  });
  assert.equal(replay.data.id, created.data.id);
  const conflict = await call(write.token, "/reservations", {
    method: "POST",
    key: "day-create-0001",
    body: {
      ...createBody,
      contact: { name: "Changed Guest", phone: "+919999999999" },
    },
  });
  assert.equal(conflict.status, 409);
  const id = created.data.id;
  const own = await call(read.token, "/reservations/" + id);
  assert.equal(own.status, 200);
  assert.ok(own.etag);
  const forbidden = await call(otherRead.token, "/reservations/" + id);
  assert.equal(forbidden.status, 404);
  const host = await call(manager.token, "/reservations/" + id);
  assert.equal(host.status, 200);
  const sensitive = await call(
    manager.token,
    "/reservations/" + id + "/contact",
  );
  assert.equal(sensitive.status, 200);
  assert.equal(sensitive.data.verifiedEmail, "guest@example.test");
  const deniedContact = await call(
    read.token,
    "/reservations/" + id + "/contact",
  );
  assert.equal(deniedContact.status, 403);
  await db
    .collection("aroha_preprod_bookings")
    .doc("synthetic-imported-private")
    .set({
      id: "synthetic-imported-private",
      owner: "external-unregistered",
      status: "cancelled",
      contact: { name: "Synthetic imported guest", phone: "" },
    });
  const imported = await call(
    manager.token,
    "/reservations/synthetic-imported-private/contact",
  );
  assert.equal(imported.status, 200);
  assert.equal(imported.data.verifiedEmail, "");
  const audits = await db
    .collection("aroha_preprod_audit")
    .where("operation", "==", "integration.reservation.contact.read")
    .get();
  assert.equal(audits.size, 2);

  const stale = await call(
    manager.token,
    "/reservations/" + id + "/actions/approve",
    {
      method: "POST",
      key: "host-approve-0001",
      etag: '"reservation:' + id + ':999"',
      body: {},
    },
  );
  assert.equal(stale.status, 412);
  const approved = await call(
    manager.token,
    "/reservations/" + id + "/actions/approve",
    { method: "POST", key: "host-approve-0002", etag: host.etag, body: {} },
  );
  assert.equal(approved.status, 200);
  assert.equal(approved.data.status, "confirmed");
  const cancel = await call(write.token, "/reservations/" + id, {
    method: "DELETE",
    key: "guest-cancel-0001",
    etag: approved.etag,
    body: { reason: "Synthetic cleanup" },
  });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.data.status, "cancelled");
  const earlyId = "synthetic-scoped-early-checkout", now = Date.now();
  const earlyBooking = {
    id: earlyId, reference: "AR-EXTERNAL-EARLY", owner: guest.localId, kind: "day",
    status: "checked_in", version: 1, history: [], arrival: todayIST(now),
    departure: addDays(todayIST(now), 1), startsAt: now - 60000, checkedInAt: now - 60000,
    endsAt: now + 3600000, guests: 1, adults: 1, children: 0, units: [], allocations: [],
    subtotal: 120000, discount: 0, total: 120000, createdAt: now - 60000,
  };
  await db.collection("aroha_preprod_bookings").doc(earlyId).set(earlyBooking);
  const earlyPath = "/reservations/" + earlyId + "/actions/complete";
  const earlyOptions = {
    method: "POST", key: "early-checkout-0001", etag: '"reservation:' + earlyId + ':1"',
    body: { earlyCheckout: true },
  };
  assert.equal((await call(read.token, earlyPath, earlyOptions)).status, 403);
  assert.equal((await call(manager.token, earlyPath, { ...earlyOptions, body: {} })).status, 409);
  const completedEarly = await call(manager.token, earlyPath, earlyOptions);
  assert.equal(completedEarly.status, 200, JSON.stringify(completedEarly));
  assert.equal(completedEarly.data.status, "completed");
  assert.deepEqual(await call(manager.token, earlyPath, earlyOptions), completedEarly);
  const list = await call(read.token, "/reservations?limit=1");
  assert.equal(list.status, 200);
  assert.ok(
    list.data.items.every(
      (b) => !("contact" in b) && !("owner" in b) && !("note" in b),
    ),
  );
  await call(guest.idToken, "/integration-tokens/" + read.id, {
    external: false,
    method: "DELETE",
    body: {},
  });
  assert.equal((await call(read.token, "/runtime")).status, 403);
  const unknown = await call(write.token, "/payments", {
    method: "POST",
    key: "not-supported-0001",
    body: {},
  });
  assert.equal(unknown.status, 404);
  // Non-expiring grants consume the same active-grant budget as finite grants.
  for (let n = 0; n < 19; n++)
    await mint(other, "permanent-" + n, ["runtime:read"], "mcp-readonly", "own", null);
  const overLimit = await call(other.idToken, "/integration-tokens", {
    external: false, method: "POST", key: "permanent-over-limit-0001",
    body: { name: "permanent-over-limit", scopes: ["runtime:read"], expiresInHours: null },
  });
  assert.equal(overLimit.status, 409);
  assert.equal(overLimit.data.error.code, "TOKEN_LIMIT");
  assert.equal((await db.collection("aroha_bookings").get()).size, 0);
});
