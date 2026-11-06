import test from "node:test";
import assert from "node:assert/strict";
import {
  walletSnapshot,
  creditLevel,
  eligibleNightDates,
  commitLoyalty,
} from "../functions/booking/loyalty.mjs";
import { initialState, mutate } from "../functions/booking/domain.mjs";
const now = Date.parse("2026-11-06T06:00:00Z");
test("expired credit holds release spendable balance by server time without TTL deletion", () => {
  const w = {
    balance: 800,
    version: 4,
    holds: {
      active: { credits: 200, expiresAt: now + 1000 },
      expired: { credits: 300, expiresAt: now - 1 },
    },
  };
  assert.deepEqual(walletSnapshot(w, now), {
    balance: 800,
    reserved: 200,
    available: 600,
    version: 4,
  });
  assert.deepEqual(walletSnapshot(w, now + 1001), {
    balance: 800,
    reserved: 0,
    available: 800,
    version: 4,
  });
  assert.throws(() => walletSnapshot({ ...w, balance: 100 }, now), {
    code: "LOYALTY_RECONCILIATION_REQUIRED",
  });
});
test("tiers preserve qualifying visit thresholds and earn 100, 200 and 300 per night", () => {
  const s = initialState().settings;
  assert.deepEqual(
    [0, 5, 6, 9, 10, 100].map((n) => creditLevel(n, s) * 100),
    [100, 100, 200, 200, 300, 300],
  );
});
test("earned nights intersect actual IST occupancy with the contracted booking interval", () => {
  const b = {
    kind: "individual",
    arrival: "2026-11-08",
    departure: "2026-11-10",
    checkedInAt: Date.parse("2026-11-08T23:00:00+05:30"),
  };
  assert.deepEqual(
    eligibleNightDates(b, Date.parse("2026-11-10T11:00:00+05:30")),
    ["2026-11-08", "2026-11-09"],
  );
  assert.deepEqual(
    eligibleNightDates(
      { ...b, checkedInAt: Date.parse("2026-11-09T14:00:00+05:30") },
      Date.parse("2026-11-12T11:00:00+05:30"),
    ),
    ["2026-11-09"],
  );
  assert.deepEqual(
    eligibleNightDates(b, Date.parse("2026-11-08T23:30:00+05:30")),
    [],
  );
  assert.deepEqual(
    eligibleNightDates(
      { ...b, kind: "day" },
      Date.parse("2026-11-10T11:00:00+05:30"),
    ),
    [],
  );
});
test("redemption may cover the whole payable amount but cannot exceed price or available credits", () => {
  const s = initialState(),
    guest = { id: "guest", role: "guest" },
    input = {
      kind: "individual",
      arrival: "2026-11-08",
      departure: "2026-11-10",
      adults: 1,
      guests: 1,
      childrenAges: [],
      units: [],
    };
  const base = mutate(s, guest, "quote", input, now);
  const credits = Math.floor(base.total / 100);
  s.loyaltyBalances = { guest: credits + 100 };
  const q = mutate(
    s,
    guest,
    "quote",
    { ...input, redeemCredits: credits },
    now,
  );
  assert.equal(q.total, base.total - credits * 100);
  assert.equal(q.loyaltyDiscount, credits * 100);
  assert.equal(q.loyaltyCredits, credits);
  assert.throws(
    () =>
      mutate(s, guest, "quote", { ...input, redeemCredits: credits + 1 }, now),
    { code: "CREDITS_EXCEED_PAYABLE" },
  );
  s.loyaltyBalances.guest = credits - 1;
  assert.throws(
    () => mutate(s, guest, "quote", { ...input, redeemCredits: credits }, now),
    { code: "INSUFFICIENT_LOYALTY_CREDITS" },
  );
});
test("confirmation consumes an exact hold and cancellation restores the original wallet allocations", () => {
  const writes = [],
    tx = {
      create: (ref, v) => writes.push({ ref, v }),
      set: (ref, v) => writes.push({ ref, v }),
    },
    db = { collection: (name) => ({ doc: (id) => ({ name, id }) }) };
  const row = {
      owner: "guest",
      balance: 1000,
      version: 1,
      holds: { b: { credits: 600, expiresAt: now + 1000 } },
    },
    wallets = new Map([["guest", { ref: { id: "guest" }, row }]]),
    prepared = {
      wallets,
      owner: "guest",
      now,
      nightRows: [],
      summary: { earnCreditsPerNight: 100 },
    };
  const previous = {
      id: "b",
      reference: "AR-SYNTHETIC",
      loyaltyCredits: 600,
      loyaltyRedemptionState: "reserved",
      loyaltyAllocations: [{ owner: "guest", credits: 600 }],
    },
    b = structuredClone(previous);
  commitLoyalty(tx, db, prepared, {
    booking: b,
    previous,
    operation: "booking-action",
    input: { action: "approve" },
  });
  assert.equal(row.balance, 400);
  assert.deepEqual(row.holds, {});
  assert.equal(b.loyaltyRedemptionState, "redeemed");
  commitLoyalty(tx, db, prepared, {
    booking: b,
    previous: structuredClone(b),
    operation: "booking-action",
    input: { action: "cancel" },
  });
  assert.equal(row.balance, 1000);
  assert.equal(b.loyaltyRedemptionState, "released");
  assert.equal(writes.filter((w) => w.v.kind === "restore").length, 1);
});
test("nightly reward uses the check-in rate snapshot and no-show never awards a night or restores a confirmed redemption", () => {
  for (const rate of [100, 200, 300]) {
    const rows = [],
      row = { balance: 1000, version: 0, holds: {} },
      wallets = new Map([["guest", { ref: { id: "guest" }, row }]]),
      prepared = {
        wallets,
        owner: "guest",
        now,
        nightRows: [{ date: "2026-11-04", ref: { id: "night" } }],
        summary: { earnCreditsPerNight: 100 },
      },
      tx = { create: (r, v) => rows.push(v), set: () => {} },
      db = { collection: () => ({ doc: () => ({}) }) };
    const b = {
      id: "b",
      reference: "AR-SYNTHETIC",
      kind: "individual",
      loyaltyEarnRate: rate,
    };
    commitLoyalty(tx, db, prepared, {
      booking: b,
      previous: { ...b },
      operation: "booking-action",
      input: { action: "complete" },
    });
    assert.equal(b.loyaltyEarnedCredits, rate);
    assert.equal(row.balance, 1000 + rate);
    const before = row.balance,
      none = { ...prepared, nightRows: [] },
      confirmed = {
        id: "confirmed",
        loyaltyCredits: 600,
        loyaltyRedemptionState: "redeemed",
        loyaltyAllocations: [{ owner: "guest", credits: 600 }],
      };
    commitLoyalty(tx, db, none, {
      booking: { ...confirmed, status: "no_show" },
      previous: confirmed,
      operation: "booking-action",
      input: { action: "no_show" },
    });
    assert.equal(row.balance, before);
  }
});
