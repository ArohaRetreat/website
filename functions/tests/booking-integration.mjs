import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST
)
  throw Error(
    "Booking integration requires emulators; production writes forbidden",
  );
const project = "demo-aroha",
  base = `http://127.0.0.1:5001/${project}/asia-south2/arohaApi/api/v1`,
  db = getFirestore(
    initializeApp({ projectId: project }, "booking-integration"),
  );
async function google(email, verified = true) {
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: email,
        email,
        email_verified: verified,
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
  const data = await r.json();
  assert.ok(r.ok);
  return data;
}
async function call(
  user,
  op,
  body,
  { admin = false, key = randomUUID(), cursor } = {},
) {
  const query = new URLSearchParams();
  if (admin) query.set("admin", "1");
  if (cursor) query.set("cursor", cursor);
  const r = await fetch(
    base + "/booking/" + op + (query.size ? "?" + query : ""),
    {
      method: body === undefined ? "GET" : "POST",
      signal: AbortSignal.timeout(30000),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        ...(user ? { Authorization: "Bearer " + user.idToken } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  return { httpStatus: r.status, ...(await r.json()) };
}
const day = new Date(Date.now() + 19800000 + 4 * 86400000)
    .toISOString()
    .slice(0, 10),
  dep = new Date(Date.parse(day) + 2 * 86400000).toISOString().slice(0, 10);
test("production bookings enforce verified identity, transactional allocation, approval, ownership and cancellation", async () => {
  const anon = await call(null, "public");
  assert.equal(anon.httpStatus, 200);
  assert.equal(anon.bookings.length, 0);
  assert.equal(anon.settings.capacity, 10);
  assert.equal(anon.units.filter((u) => u.active).length, 4);
  assert.equal(anon.units.find((u) => u.id === "cottage-1").rate, null);
  assert.equal((await call(null, "state")).httpStatus, 401);
  const owner = await google("owner@example.test"),
    a = await google("booking-a@example.test"),
    b = await google("booking-b@example.test");
  const admit = await fetch(base + "/session", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + owner.idToken,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(admit.status, 200);
  assert.equal(
    (await call(a, "state", undefined, { admin: true })).httpStatus,
    403,
  );
  const mine = await call(a, "state");
  assert.equal(mine.actor.id, a.localId);
  assert.equal(mine.loyalty.stays, 0);
  const request = {
    arrival: day,
    departure: dep,
    guests: 2,
    units: ["cottage-1"],
    promo: "",
  };
  const qa = await call(a, "quote", request),
    qb = await call(b, "quote", request);
  assert.equal(qa.httpStatus, 200);
  assert.equal(qa.total, null);
  assert.equal(qb.httpStatus, 200);
  const key = randomUUID(),
    creates = await Promise.all([
      call(
        a,
        "create",
        { quoteId: qa.id, note: "Synthetic booking integration note" },
        { key },
      ),
      call(b, "create", { quoteId: qb.id, note: "" }),
    ]);
  assert.deepEqual(creates.map((x) => x.httpStatus).sort(), [200, 409]);
  const winner = creates.find((x) => x.httpStatus === 200),
    winningUser = creates[0].httpStatus === 200 ? a : b,
    loser = creates[0].httpStatus === 200 ? b : a;
  if (winningUser === a) {
    const replay = await call(
      a,
      "create",
      { quoteId: qa.id, note: "Synthetic booking integration note" },
      { key },
    );
    assert.equal(replay.id, winner.id);
    assert.equal(
      (
        await call(
          a,
          "create",
          { quoteId: qa.id, note: "Changed body" },
          { key },
        )
      ).httpStatus,
      409,
    );
  }
  assert.equal(
    (await call(loser, "state")).bookings.some((x) => x.id === winner.id),
    false,
  );
  assert.equal(
    (
      await call(loser, "booking-action", {
        id: winner.id,
        action: "cancel",
        expectedVersion: 1,
      })
    ).httpStatus,
    404,
  );
  assert.equal(
    (
      await call(winningUser, "booking-action", {
        id: winner.id,
        action: "approve",
        expectedVersion: 1,
      })
    ).httpStatus,
    403,
  );
  const approved = await call(
    owner,
    "booking-action",
    { id: winner.id, action: "approve", expectedVersion: 1 },
    { admin: true },
  );
  assert.equal(approved.status, "confirmed");
  const ledger = (
    await db.collection("aroha_booking_days").doc(day).get()
  ).data();
  assert.equal(ledger.entries[winner.id].status, "confirmed");
  assert.equal(
    (
      await call(
        owner,
        "unit",
        {
          id: "cottage-1",
          expectedVersion: 1,
          capacity: 2,
          rate: null,
          active: false,
        },
        { admin: true },
      )
    ).httpStatus,
    409,
  );
  const edited = await call(winningUser, "note", {
    id: winner.id,
    expectedVersion: 2,
    note: "Updated private note",
  });
  assert.equal(edited.version, 3);
  const cancelled = await call(winningUser, "booking-action", {
    id: winner.id,
    action: "cancel",
    expectedVersion: 3,
  });
  assert.equal(cancelled.status, "cancelled");
  assert.ok(
    !(await db.collection("aroha_booking_days").doc(day).get()).data().entries[
      winner.id
    ],
  );
  const audit = await db.collection("aroha_booking_audit").get();
  assert.ok(
    !JSON.stringify(audit.docs.map((d) => d.data())).includes(
      "Updated private note",
    ),
  );
  const host = await call(owner, "state", undefined, { admin: true });
  assert.ok(host.bookings.some((x) => x.id === winner.id));
  assert.ok(!host.bookings.some((x) => x.reference?.startsWith("DEMO")));
  // A revoked host cannot use an earlier valid identity to mutate booking policy.
  const operator = await google("booking-operator@example.test");
  await db.collection("aroha_members").doc(operator.localId).set({
    email: "booking-operator@example.test",
    active: true,
    role: "admin",
  });
  assert.equal(
    (await call(operator, "state", undefined, { admin: true })).actor.role,
    "host",
  );
  await db
    .collection("aroha_members")
    .doc(operator.localId)
    .update({ active: false });
  assert.equal(
    (
      await call(
        operator,
        "unit",
        {
          id: "cottage-2",
          expectedVersion: 1,
          capacity: 2,
          rate: null,
          active: false,
        },
        { admin: true },
      )
    ).httpStatus,
    403,
  );
});

test("production date changes, expiry, loyalty, contact and cursor boundaries use authoritative records", async () => {
  const owner = await google("owner@example.test"),
    guest = await google("booking-change@example.test"),
    peer = await google("booking-peer@example.test");
  await call(guest, "state");
  await call(peer, "state");
  const plus = (date, n) =>
    new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
  const pick = {
    arrival: plus(day, 4),
    departure: plus(day, 6),
    guests: 2,
    units: ["cottage-2"],
    promo: "",
  };
  const q = await call(guest, "quote", pick),
    created = await call(guest, "create", { quoteId: q.id, note: "" });
  assert.equal(created.httpStatus, 200);
  const confirmed = await call(
    owner,
    "booking-action",
    { id: created.id, expectedVersion: 1, action: "approve" },
    { admin: true },
  );
  assert.equal(confirmed.status, "confirmed");
  const changePick = {
    id: created.id,
    expectedVersion: 2,
    arrival: plus(day, 8),
    departure: plus(day, 10),
    guests: 2,
    promo: "",
  };
  const changeQuote = await call(guest, "change-quote", changePick);
  assert.equal(changeQuote.httpStatus, 200);
  const change = await call(guest, "change-request", {
    id: created.id,
    expectedVersion: 2,
    quoteId: changeQuote.id,
  });
  assert.equal(change.arrival, pick.arrival);
  const competing = await call(peer, "quote", {
      ...pick,
      arrival: changePick.arrival,
      departure: changePick.departure,
    }),
    held = await call(peer, "create", { quoteId: competing.id, note: "" });
  assert.equal(held.httpStatus, 200);
  assert.equal(
    (
      await call(
        owner,
        "booking-action",
        { id: created.id, expectedVersion: 3, action: "approve_change" },
        { admin: true },
      )
    ).httpStatus,
    409,
  );
  await call(peer, "booking-action", {
    id: held.id,
    expectedVersion: 1,
    action: "cancel",
  });
  const changed = await call(
    owner,
    "booking-action",
    { id: created.id, expectedVersion: 3, action: "approve_change" },
    { admin: true },
  );
  assert.equal(changed.httpStatus, 200);
  assert.equal(changed.arrival, changePick.arrival);
  assert.ok(
    !(await db.collection("aroha_booking_days").doc(pick.arrival).get()).data()
      .entries[created.id],
  );
  assert.ok(
    (
      await db.collection("aroha_booking_days").doc(changePick.arrival).get()
    ).data().entries[created.id],
  );
  const contact = await call(
    owner,
    "guest-contact",
    { id: created.id },
    { admin: true },
  );
  assert.equal(contact.email, "booking-change@example.test");
  assert.equal(
    (await call(peer, "guest-contact", { id: created.id })).httpStatus,
    403,
  );
  // Delayed housekeeping must never keep an expired pending room occupied.
  const expired = {
    ...created,
    id: randomUUID(),
    owner: peer.localId,
    units: ["cottage-1"],
    status: "pending_approval",
    version: 1,
    expiresAt: Date.now() - 1000,
    createdAt: Date.now(),
    history: [],
  };
  await db.collection("aroha_bookings").doc(expired.id).set(expired);
  for (let d = expired.arrival; d < expired.departure; d = plus(d, 1))
    await db
      .collection("aroha_booking_days")
      .doc(d)
      .set({ date: d, entries: { [expired.id]: expired } });
  assert.equal(
    (
      await call(
        owner,
        "booking-action",
        { id: expired.id, expectedVersion: 1, action: "approve" },
        { admin: true },
      )
    ).httpStatus,
    409,
  );
  const freshQuote = await call(peer, "quote", {
      ...pick,
      units: ["cottage-1"],
    }),
    fresh = await call(peer, "create", { quoteId: freshQuote.id, note: "" });
  assert.equal(fresh.httpStatus, 200);
  assert.ok(
    !(await db.collection("aroha_booking_days").doc(pick.arrival).get()).data()
      .entries[expired.id],
  );
  // Only a committed completion grants the next credit, once.
  const today = new Date(Date.now() + 19800000).toISOString().slice(0, 10),
    past = {
      ...created,
      id: randomUUID(),
      owner: guest.localId,
      arrival: plus(today, -3),
      departure: plus(today, -1),
      status: "checked_in",
      version: 1,
      history: [],
    };
  await db.collection("aroha_bookings").doc(past.id).set(past);
  await db
    .collection("aroha_booking_profiles")
    .doc(guest.localId)
    .update({ completedStays: 5 });
  assert.equal(
    (
      await call(
        owner,
        "booking-action",
        { id: past.id, expectedVersion: 1, action: "complete" },
        { admin: true },
      )
    ).status,
    "completed",
  );
  assert.equal((await call(guest, "state")).loyalty.name, "Friend");
  assert.equal(
    (
      await call(
        owner,
        "booking-action",
        { id: past.id, expectedVersion: 2, action: "complete" },
        { admin: true },
      )
    ).httpStatus,
    409,
  );
  assert.equal(
    (
      await db.collection("aroha_booking_profiles").doc(guest.localId).get()
    ).data().completedStays,
    6,
  );
  const splitId = randomUUID();
  await db
    .collection("aroha_bookings")
    .doc(splitId)
    .set({ ...past, id: splitId, status: "checked_in", version: 1 });
  assert.equal(
    (
      await call(
        owner,
        "booking-action",
        { id: splitId, expectedVersion: 1, action: "complete" },
        { admin: true },
      )
    ).status,
    "completed",
  );
  assert.equal(
    (
      await db.collection("aroha_booking_profiles").doc(guest.localId).get()
    ).data().completedStays,
    6,
    "Splitting one continuous stay cannot earn another credit",
  );
  const batch = db.batch();
  for (let i = 0; i < 27; i++) {
    const id = randomUUID();
    batch.set(db.collection("aroha_bookings").doc(id), {
      ...past,
      id,
      owner: peer.localId,
      status: "completed",
      createdAt: Date.now() + i,
    });
  }
  await batch.commit();
  const page = await call(peer, "state");
  assert.equal(page.bookings.length, 25);
  assert.ok(page.activeBookings.some((b) => b.id === fresh.id));
  assert.ok(page.nextCursor);
  assert.equal(
    (await call(guest, "state", undefined, { cursor: page.nextCursor }))
      .httpStatus,
    422,
  );
  const next = await call(peer, "state", undefined, {
    cursor: page.nextCursor,
  });
  assert.equal(next.httpStatus, 200);
  assert.ok(next.bookings.every((b) => b.owner === peer.localId));
  assert.equal(
    new Set([...page.bookings, ...next.bookings].map((b) => b.id)).size,
    page.bookings.length + next.bookings.length,
  );
});

test("global promo reservation limits and independent Firestore denials hold across different stays", async () => {
  const owner = await google("owner@example.test"),
    a = await google("booking-promo-a@example.test"),
    b = await google("booking-promo-b@example.test"),
    unverified = await google("booking-unverified@example.test", false);
  assert.equal((await call(unverified, "state")).httpStatus, 403);
  const configured = await call(
    owner,
    "unit",
    {
      id: "cottage-1",
      expectedVersion: 1,
      capacity: 2,
      rate: 420000,
      active: true,
    },
    { admin: true },
  );
  assert.equal(configured.httpStatus, 200);
  const plus = (date, n) =>
    new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
  const offer = await call(
    owner,
    "promo",
    {
      code: "GLOBALONE",
      kind: "percent",
      value: 10,
      maxUses: 1,
      from: plus(day, -4),
      until: plus(day, 100),
    },
    { admin: true },
  );
  assert.equal(offer.httpStatus, 200);
  const qa = await call(a, "quote", {
      arrival: plus(day, 20),
      departure: plus(day, 22),
      guests: 2,
      units: ["cottage-1"],
      promo: "GLOBALONE",
    }),
    qb = await call(b, "quote", {
      arrival: plus(day, 30),
      departure: plus(day, 32),
      guests: 2,
      units: ["cottage-1"],
      promo: "GLOBALONE",
    });
  assert.equal(qa.total, 756000);
  assert.equal(qb.httpStatus, 200);
  const first = await call(a, "create", { quoteId: qa.id, note: "" });
  assert.equal(first.httpStatus, 200);
  assert.equal(
    (await call(b, "create", { quoteId: qb.id, note: "" })).httpStatus,
    409,
  );
  await call(a, "booking-action", {
    id: first.id,
    action: "cancel",
    expectedVersion: 1,
  });
  const released = await call(b, "create", { quoteId: qb.id, note: "" });
  assert.equal(released.httpStatus, 200);
  const { initializeTestEnvironment, assertFails } =
      await import("@firebase/rules-unit-testing"),
    { doc, getDoc, setDoc } = await import("firebase/firestore"),
    { readFile } = await import("node:fs/promises");
  const env = await initializeTestEnvironment({
    projectId: project,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: await readFile(
        new URL("../../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
  try {
    const client = env.authenticatedContext(b.localId).firestore();
    await assertFails(getDoc(doc(client, "aroha_bookings", released.id)));
    await assertFails(
      setDoc(doc(client, "aroha_booking_config", "site"), {
        settings: { capacity: 999 },
      }),
    );
  } finally {
    await env.cleanup();
  }
});
