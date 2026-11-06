import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { initialState, addDays, todayIST } from "../booking/domain.mjs";
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.GCLOUD_PROJECT !== "demo-aroha"
)
  throw Error("ISOLATED_EMULATORS_REQUIRED");
const app = initializeApp({ projectId: "demo-aroha" }, "loyalty-tests"),
  db = getFirestore(app),
  auth = getAuth(app),
  base = "http://127.0.0.1:5001/demo-aroha/asia-south2/arohaApi/api/v1";
async function google(email) {
  const jwt = [
    Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url"),
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
  const r = await fetch(
    "http://" +
      process.env.FIREBASE_AUTH_EMULATOR_HOST +
      "/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-api-key",
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
const op = (u, operation, input = {}, options) =>
  call(u, "/platform", { operation, input }, options);
async function until(f) {
  const end = Date.now() + 40000;
  while (Date.now() < end) {
    if (await f()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.fail("LOCAL_EMAIL_TIMEOUT");
}
const okay = (r) => {
  assert.ok(r.httpStatus >= 200 && r.httpStatus < 300, JSON.stringify(r));
  return r;
};

test("manual identity, actual nightly rewards and concurrent redemption use real shared HTTP transactions", async () => {
  const messages = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const b of req) chunks.push(b);
    messages.push(JSON.parse(Buffer.concat(chunks)));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: { id: randomUUID() }, error: null }));
  });
  await new Promise((r) => server.listen(17881, "127.0.0.1", r));
  try {
    const host = await google("owner@example.test"),
      stranger = await google("stranger@example.test");
    await db
      .collection("aroha_members")
      .doc(host.localId)
      .set({ role: "superadmin", active: true, email: "owner@example.test" });
    const s = initialState();
    await db
      .collection("aroha_preprod_booking_config")
      .doc("site")
      .set({
        schemaVersion: 1,
        settings: s.settings,
        units: s.units,
        promos: [],
        blocks: [],
      });
    const arrival = addDays(todayIST(), 3),
      departure = addDays(arrival, 2),
      selection = {
        kind: "individual",
        arrival,
        departure,
        adults: 1,
        childrenAges: [],
        units: [],
        customer: {
          name: "Synthetic Walk-in",
          email: "walkin@example.test",
          phone: "+12025550123",
        },
      };
    const q = okay(await op(host, "quoteManualBooking", selection));
    assert.equal(q.contact.email, "walkin@example.test");
    assert.ok(q.customerId.startsWith("customer-"));
    await assert.rejects(auth.getUserByEmail("walkin@example.test"), {
      code: "auth/user-not-found",
    });
    const key = randomUUID(),
      b = okay(
        await op(host, "createManualBooking", { quoteId: q.id }, { key }),
      );
    assert.equal(b.status, "confirmed");
    assert.equal(b.source, "host_manual");
    assert.equal(b.owner, q.customerId);
    assert.deepEqual(
      b.history.map((h) => h.status),
      ["confirmed"],
    );
    const replay = okay(
      await op(host, "createManualBooking", { quoteId: q.id }, { key }),
    );
    assert.equal(replay.id, b.id);
    assert.equal(
      (await op(host, "createManualBooking", { quoteId: q.id })).httpStatus,
      410,
    );
    await until(() =>
      messages.some((m) => m.body.subject.includes(b.reference)),
    );
    const manualMail = messages.find((m) =>
      m.body.subject.includes(b.reference),
    );
    assert.match(manualMail.body.text, /hosts recorded this booking/);
    assert.equal(
      manualMail.body.attachments.filter((a) => a.filename.endsWith(".pdf"))
        .length,
      1,
    );
    assert.equal(
      (
        await db
          .collection("aroha_preprod_notifications")
          .where("bookingId", "==", b.id)
          .get()
      ).size,
      1,
    );
    const guest = await google("walkin@example.test");
    const claim = okay(await op(guest, "claimMyCustomer"));
    assert.equal(claim.customerId, b.owner);
    assert.equal(claim.linked, true);
    const own = okay(await call(guest, "/booking/state"));
    assert.ok(own.bookings.some((x) => x.id === b.id));
    assert.equal(own.profile.phone, "+12025550123");
    const denied = await op(stranger, "getFinancialSummary", { id: b.id });
    assert.equal(denied.httpStatus, 404);
    okay(await op(stranger, "claimMyCustomer"));
    assert.ok(
      !okay(await call(stranger, "/booking/state")).bookings.some(
        (x) => x.id === b.id,
      ),
    );
    const balance = okay(await op(guest, "getMyLoyalty"));
    assert.equal(balance.creditsAvailable, 0);
    okay(
      await op(host, "adjustCustomerCredits", {
        id: b.owner,
        credits: 10000,
        reason: "Synthetic opening credit",
        expectedVersion: 0,
      }),
    );
    const afterCredit = okay(await op(guest, "getMyLoyalty"));
    assert.equal(afterCredit.creditsAvailable, 10000);
    const future = {
      kind: "individual",
      arrival: addDays(departure, 2),
      departure: addDays(departure, 4),
      adults: 1,
      guests: 1,
      childrenAges: [],
      units: [],
      redeemCredits: 6000,
    };
    const [q1, q2] = await Promise.all([
      call(guest, "/booking/quote", future),
      call(guest, "/booking/quote", {
        ...future,
        arrival: addDays(departure, 5),
        departure: addDays(departure, 7),
      }),
    ]);
    okay(q1);
    okay(q2);
    const attempts = await Promise.all(
      [q1, q2].map((q) =>
        call(guest, "/booking/create", {
          quoteId: q.id,
          contact: { name: "Synthetic Walk-in", phone: "+12025550123" },
        }),
      ),
    );
    assert.equal(
      attempts.filter((r) => r.httpStatus === 200).length,
      1,
      JSON.stringify(attempts),
    );
    assert.equal(
      attempts.find((r) => r.httpStatus !== 200).error.code,
      "INSUFFICIENT_LOYALTY_CREDITS",
    );
    const reserved = attempts.find((r) => r.httpStatus === 200);
    assert.equal(okay(await op(guest, "getMyLoyalty")).creditsReserved, 6000);
    const approved = okay(
      await call(
        host,
        "/booking/booking-action",
        {
          id: reserved.id,
          action: "approve",
          expectedVersion: reserved.version,
        },
        { admin: true },
      ),
    );
    assert.equal(approved.loyaltyRedemptionState, "redeemed");
    const invoice = (
      await db
        .collection("aroha_preprod_invoices")
        .doc(approved.invoiceId)
        .get()
    ).data();
    assert.equal(invoice.documentTemplateVersion, "pdf-v4-loyalty");
    assert.equal(invoice.loyaltyCredits, 6000);
    const cancelled = okay(
      await call(
        host,
        "/booking/booking-action",
        {
          id: approved.id,
          action: "cancel",
          expectedVersion: approved.version,
        },
        { admin: true },
      ),
    );
    assert.equal(cancelled.loyaltyRedemptionState, "released");
    assert.equal(okay(await op(guest, "getMyLoyalty")).creditsAvailable, 10000);
    // Only isolated synthetic clocks change; the production endpoint uses real host actions.
    const lifeId = "synthetic-earned-" + randomUUID(),
      now = Date.now();
    await db
      .collection("aroha_preprod_bookings")
      .doc(lifeId)
      .set({
        id: lifeId,
        reference: "AR-SYNTHETIC-EARN",
        owner: b.owner,
        status: "checked_in",
        kind: "individual",
        arrival: addDays(todayIST(), -2),
        departure: todayIST(),
        checkedInAt: now - 2 * 86400000,
        startsAt: now - 2 * 86400000,
        endsAt: now - 1000,
        adults: 1,
        children: 0,
        guests: 1,
        units: [],
        allocations: [],
        subtotal: 100000,
        discount: 0,
        total: 100000,
        history: [],
        version: 1,
        createdAt: now,
        loyaltyEarnRate: 100,
      });
    const completionKey = randomUUID(),
      complete = okay(
        await call(
          host,
          "/booking/booking-action",
          { id: lifeId, action: "complete", expectedVersion: 1 },
          { admin: true, key: completionKey },
        ),
      );
    assert.equal(complete.loyaltyEarnedCredits, 200);
    okay(
      await call(
        host,
        "/booking/booking-action",
        { id: lifeId, action: "complete", expectedVersion: 1 },
        { admin: true, key: completionKey },
      ),
    );
    assert.equal(okay(await op(guest, "getMyLoyalty")).creditsAvailable, 10200);
    const duplicateId = "synthetic-night-overlap-" + randomUUID();
    await db
      .collection("aroha_preprod_bookings")
      .doc(duplicateId)
      .set({
        ...(
          await db.collection("aroha_preprod_bookings").doc(lifeId).get()
        ).data(),
        id: duplicateId,
        owner: guest.localId,
        status: "checked_in",
        version: 1,
        loyaltyEarnedCredits: 0,
        loyaltyEarnedNights: 0,
      });
    const repeatedNight = okay(
      await call(
        host,
        "/booking/booking-action",
        { id: duplicateId, action: "complete", expectedVersion: 1 },
        { admin: true },
      ),
    );
    assert.equal(repeatedNight.loyaltyEarnedCredits || 0, 0);
    assert.equal(okay(await op(guest, "getMyLoyalty")).creditsAvailable, 10200);
    const note = okay(
      await op(guest, "submitFeedback", {
        id: lifeId,
        rating: 5,
        comment: "Synthetic private feedback",
        consent: true,
      }),
    );
    assert.equal(note.rating, 5);
    assert.equal(
      (await op(stranger, "getReservationFeedback", { id: lifeId })).httpStatus,
      404,
    );
    const review = okay(await op(host, "reviewPrivateFeedback"));
    assert.ok(
      review.items.some((i) => i.bookingReference === "AR-SYNTHETIC-EARN"),
    );
    const entries = okay(await op(guest, "listMyLoyaltyEntries", { limit: 2 }));
    assert.equal(entries.items.length, 2);
    assert.ok(entries.nextCursor);
    assert.equal(
      (
        await op(stranger, "listMyLoyaltyEntries", {
          limit: 2,
          cursor: entries.nextCursor,
        })
      ).httpStatus,
      422,
    );
    const search = okay(
      await op(host, "lookupCustomers", {
        mode: "email",
        search: "walkin@example.test",
      }),
    );
    assert.equal(search.items.length, 1);
    assert.equal(
      (
        await op(stranger, "lookupCustomers", {
          mode: "email",
          search: "walkin@example.test",
        })
      ).httpStatus,
      403,
    );
    assert.equal(
      (await op(guest, "deleteMyProfile", { expectedVersion: 0 })).error.code,
      "ACTIVE_RESERVATIONS_RETAIN_PROFILE",
    );
    const queue = okay(
      await op(host, "listHostReservations", { status: "confirmed", limit: 1 }),
    );
    assert.equal(queue.items.length, 1);
    assert.equal(queue.items[0].id, b.id);
    const totals = okay(await op(host, "getHostBookingSummary"));
    assert.equal(totals.confirmed, 1);
    assert.equal(totals.cancelled, 1);
    assert.equal(totals.completed, 2);
    assert.equal((await op(stranger, "getHostBookingSummary")).httpStatus, 403);
    assert.ok(
      okay(
        await op(host, "listCustomerReservations", { id: b.owner }),
      ).items.some((x) => x.id === lifeId),
    );
    const mint = async (
      user,
      name,
      scopes,
      rowAccess = "own",
      purpose = "mcp",
    ) =>
      okay(
        await call(user, "/integration-tokens", {
          name,
          scopes,
          rowAccess,
          purpose,
          expiresInHours: null,
        }),
      );
    const hostGrant = await mint(
      host,
      "Synthetic host operations",
      [
        "reservations:read",
        "reservations:manual",
        "contacts:read",
        "loyalty:read",
        "loyalty:adjust",
        "payments:read",
        "feedback:read",
      ],
      "all",
    );
    const rest = async (grant, path, body, headers = {}) => {
      const r = await fetch(
        base.replace("/api/v1", "/api/external/v1") + path,
        {
          method: body === undefined ? "GET" : "POST",
          headers: {
            Authorization: "Bearer " + grant.token,
            "Content-Type": "application/json",
            ...(body === undefined ? {} : { "Idempotency-Key": randomUUID() }),
            ...headers,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
      );
      return { httpStatus: r.status, ...(await r.json()) };
    };
    const privateSearch = okay(
      await rest(
        hostGrant,
        "/customers/lookups",
        { mode: "email", search: "walkin@example.test" },
        { "Idempotency-Key": "" },
      ),
    );
    assert.equal(privateSearch.httpStatus, 200);
    assert.equal(privateSearch.items[0].id, b.owner);
    assert.equal(
      okay(await rest(hostGrant, "/host/booking-summary")).confirmed,
      1,
    );
    const restQuote = okay(
      await rest(hostGrant, "/manual-booking-quotes", {
        ...selection,
        arrival: addDays(departure, 12),
        departure: addDays(departure, 13),
      }),
    );
    assert.ok(restQuote.id);
    assert.equal(restQuote.customerId, b.owner);
    assert.equal(restQuote.totalPaise, 350000);
    const manualRest = okay(
      await rest(hostGrant, "/manual-bookings", { quoteId: restQuote.id }),
    );
    assert.equal(manualRest.status, "confirmed");
    assert.equal(manualRest.totalPaise, 350000);
    assert.equal(manualRest.httpStatus, 201);
    okay(
      await call(
        host,
        "/booking/booking-action",
        {
          id: manualRest.id,
          action: "cancel",
          expectedVersion: manualRest.version,
        },
        { admin: true },
      ),
    );
    const ownGrant = await mint(guest, "Synthetic linked guest", [
      "reservations:read",
      "loyalty:read",
      "customers:link",
      "payments:read",
      "documents:read",
    ]);
    assert.equal(okay(await rest(ownGrant, "/reservations/" + b.id)).id, b.id);
    assert.equal(
      okay(await rest(ownGrant, "/me/loyalty")).creditsAvailable,
      10200,
    );
    assert.equal(
      (await rest(ownGrant, "/customers/" + b.owner + "/loyalty")).httpStatus,
      403,
    );
    const legacy = await mint(
      host,
      "Synthetic original MCP",
      ["runtime:read", "reservations:read"],
      "all",
      "mcp-readonly",
    );
    assert.equal((await rest(legacy, "/host/booking-summary")).httpStatus, 403);
    // Erasure retains ownership proof and financial history without silently
    // restoring erased contacts from the Google profile on the next state read.
    const manualCancelled = okay(
      await call(
        host,
        "/booking/booking-action",
        { id: b.id, action: "cancel", expectedVersion: b.version },
        { admin: true },
      ),
    );
    assert.equal(
      okay(await op(guest, "getFinancialSummary", { id: b.id }))
        .balanceDuePaise,
      0,
    );
    const erased = okay(
      await op(guest, "deleteMyProfile", { expectedVersion: 0 }),
    );
    assert.ok(erased.retained.includes("loyalty_ledger_and_account_binding"));
    assert.equal(
      (await op(guest, "claimMyCustomer")).error.code,
      "PROFILE_RECREATE_REQUIRED",
    );
    const erasedState = okay(await call(guest, "/booking/state"));
    assert.equal(erasedState.profile.email, "");
    assert.equal(erasedState.profile.phone, "");
    assert.ok(erasedState.bookings.some((x) => x.id === b.id));
    assert.equal(okay(await op(guest, "getMyLoyalty")).creditsAvailable, 10200);
    assert.equal(
      (
        await db.collection("aroha_preprod_booking_profiles").doc(b.owner).get()
      ).data().contact,
      undefined,
    );
    okay(
      await call(guest, "/booking/profile", {
        name: "Synthetic Recreated",
        phone: "+12025550123",
        expectedVersion: erased.version,
      }),
    );
    okay(await op(guest, "claimMyCustomer"));
    assert.equal(
      okay(await call(guest, "/booking/state")).profile.name,
      "Synthetic Recreated",
    );
    const foundAgain = okay(
      await op(host, "lookupCustomers", {
        mode: "name",
        search: "synthetic recreated",
      }),
    );
    assert.equal(foundAgain.items.length, 1);
    // Current role is rechecked for existing grants, not frozen at token issuance.
    await db
      .collection("aroha_members")
      .doc(host.localId)
      .update({ active: false });
    assert.equal(
      (await rest(hostGrant, "/host/booking-summary")).httpStatus,
      403,
    );
    await db
      .collection("aroha_members")
      .doc(host.localId)
      .update({ active: true });
    if (process.env.AROHA_LOYALTY_SCALE === "1") {
      const started = Date.now(),
        writer = db.bulkWriter({ throttling: false }),
        pending = [];
      for (let i = 0; i < 10000; i++)
        pending.push(
          writer.create(
            db
              .collection("aroha_preprod_booking_profiles")
              .doc("scale-customer-" + i),
            {
              id: "scale-customer-" + i,
              name: "Scale customer " + i,
              email: "scale-" + i + "@example.test",
              searchName: "scale customer " + String(i).padStart(5, "0"),
              searchEmail: "scale-" + i + "@example.test",
              createdAt: now,
            },
          ),
        );
      for (let i = 0; i < 100000; i++)
        pending.push(
          writer.create(
            db.collection("aroha_preprod_bookings").doc("scale-booking-" + i),
            {
              id: "scale-booking-" + i,
              reference: "AR-SCALE-" + i,
              owner: "scale-customer-" + (i % 10000),
              version: 1,
              kind: "individual",
              status: "completed",
              arrival: "2025-01-01",
              departure: "2025-01-02",
              adults: 1,
              children: 0,
              units: [],
              total: 350000,
              createdAt: now - i - 86400000,
            },
          ),
        );
      await writer.close();
      await Promise.all(pending);
      const seededMs = Date.now() - started,
        queryStart = Date.now();
      const customers = okay(
        await op(host, "lookupCustomers", {
          mode: "name",
          search: "scale customer",
          limit: 10,
        }),
      );
      assert.equal(customers.items.length, 10);
      assert.equal(customers.hasMore, true);
      const first = okay(
        await op(host, "listHostReservations", {
          status: "completed",
          limit: 25,
        }),
      );
      assert.equal(first.items.length, 25);
      assert.ok(first.nextCursor);
      const second = okay(
        await op(host, "listHostReservations", {
          status: "completed",
          limit: 25,
          cursor: first.nextCursor,
        }),
      );
      assert.equal(second.items.length, 25);
      assert.ok(
        !second.items.some((b) => first.items.some((a) => a.id === b.id)),
      );
      assert.equal(
        (
          await op(host, "listHostReservations", {
            status: "cancelled",
            limit: 25,
            cursor: first.nextCursor,
          })
        ).error.code,
        "INVALID_CURSOR",
      );
      const count = okay(await op(host, "getHostBookingSummary"));
      assert.equal(count.completed, 100002);
      console.log(
        JSON.stringify({
          fixtureCustomers: 10000,
          fixtureBookings: 100000,
          seededMs,
          boundedQueriesMs: Date.now() - queryStart,
          maximumCustomerPage: 10,
          maximumReservationPage: 25,
          measurement:
            "isolated emulator stored-size fixture; not a concurrency or production latency guarantee",
        }),
      );
    }
  } finally {
    await new Promise((r) => server.close(r));
  }
});
