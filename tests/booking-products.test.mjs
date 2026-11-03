import test from "node:test";
import assert from "node:assert/strict";
import { initialState, mutate, addDays } from "../functions/booking/domain.mjs";
import {
  productAvailability,
  calendarSummary,
  interval,
} from "../functions/booking/products.mjs";
import { validateBookingOperation } from "../functions/booking/store.mjs";
const now = Date.parse("2026-11-03T03:00:00Z"),
  guest = { id: "guest", role: "guest" },
  host = { id: "host", role: "host" };
const input = (kind, adults = 2, kids = [], more = {}) => ({
  kind,
  arrival: "2026-11-07",
  departure: kind === "day" || kind === "event" ? "2026-11-08" : "2026-11-09",
  adults,
  childrenAges: kids,
  guests: adults + kids.length,
  units: kind === "private" ? ["cottage-1"] : [],
  ...more,
});
const reserve = (s, kind, adults = 2, kids = [], more = {}, actor = guest) => {
  const q = mutate(s, actor, "quote", input(kind, adults, kids, more), now);
  return mutate(s, actor, "create", { quoteId: q.id, note: "" }, now);
};
const action = (s, b, act, actor = host, more = {}, at = now) =>
  mutate(
    s,
    actor,
    "booking-action",
    { id: b.id, expectedVersion: b.version, action: act, ...more },
    at,
  );
test("published day rates and adult-only quota allow children beyond35 total heads", () => {
  const s = initialState(),
    b = reserve(s, "day", 35, [1, 3, 9]);
  assert.equal(b.total, 4410000);
  assert.equal(b.children, 3);
  assert.equal(calendarSummary(s, b.arrival, now).adults, 35);
  assert.equal(calendarSummary(s, b.arrival, now).children, 3);
  assert.throws(
    () => reserve(s, "day", 1),
    (e) => e.code === "AVAILABILITY_CHANGED",
  );
  action(s, b, "cancel", guest);
  assert.equal(reserve(s, "day", 1).total, 120000);
});
test("private room base includes2 occupants; extra children and per-room adult/child limits are enforced", () => {
  for (const [adults, kids, total] of [
    [2, [], 1200000],
    [1, [4], 1200000],
    [1, [4, 8], 1500000],
    [2, [4], 1500000],
    [2, [4, 8], 1800000],
  ]) {
    const s = initialState(),
      q = mutate(s, guest, "quote", input("private", adults, kids), now);
    assert.equal(q.total, total);
    assert.equal(q.allocations[0].adults, adults);
    assert.equal(q.allocations[0].children, kids.length);
  }
  for (const [a, k] of [
    [3, []],
    [2, [1, 2, 3]],
  ])
    assert.throws(
      () => reserve(initialState(), "private", a, k),
      (e) => e.code === "ROOM_PARTY_LIMIT",
    );
  assert.throws(
    () => reserve(initialState(), "private", 2, [10]),
    (e) => e.code === "INVALID_CHILD_AGE",
  );
});
test("two rooms can hold4 adults and2 children at15000 per night", () => {
  const s = initialState(),
    b = reserve(s, "private", 4, [3, 7], { units: ["cottage-1", "cottage-2"] });
  assert.equal(b.total, 3000000);
  assert.equal(b.allocations.length, 2);
  assert.ok(b.allocations.every((x) => x.adults <= 2 && x.children <= 2));
});
test("shared sleeping places pack into rooms and cannot coexist with private allocation", () => {
  const s = initialState(),
    a = reserve(s, "individual", 1),
    b = reserve(s, "individual", 1, [], {}, { id: "other", role: "guest" });
  assert.equal(a.total, 700000);
  assert.equal(a.units[0], b.units[0]);
  assert.equal(a.allocations[0].adults, 1);
  assert.throws(
    () => reserve(s, "private", 1, [], { units: a.units }),
    (e) => e.code === "AVAILABILITY_CHANGED",
  );
  const remaining = productAvailability(s, input("individual", 6), now);
  assert.equal(remaining.available, true);
  assert.equal(
    productAvailability(s, input("individual", 9), now).available,
    false,
  );
  assert.throws(
    () => reserve(initialState(), "individual", 1, [5]),
    (e) => e.code === "CHILDREN_REQUIRE_PRIVATE_ROOM",
  );
});
test("day admission checks previous-night departure morning while stay turnover is half-open11AM", () => {
  const s = initialState(),
    b = reserve(s, "private", 2, [], {
      arrival: "2026-11-06",
      departure: "2026-11-07",
    });
  assert.equal(new Date(b.endsAt).toISOString(), "2026-11-07T05:30:00.000Z");
  assert.equal(productAvailability(s, input("day", 34), now).available, false);
  assert.equal(productAvailability(s, input("day", 33), now).available, true);
  assert.equal(
    productAvailability(s, input("private", 2), now).units.find(
      (u) => u.id === "cottage-1",
    ).available,
    true,
  );
});
test("day and shared stays consume the same adult capacity at concurrent times", () => {
  const s = initialState();
  reserve(s, "day", 30);
  assert.equal(
    productAvailability(s, input("individual", 6), now).available,
    false,
  );
  assert.equal(
    productAvailability(s, input("individual", 5), now).available,
    true,
  );
});
test("event enquiry holds no inventory; accepted host offer is required and approval rechecks exclusivity", () => {
  const s = initialState(),
    e = reserve(s, "event", 20);
  assert.equal(e.total, null);
  assert.equal(productAvailability(s, input("day", 35), now).available, true);
  assert.throws(
    () => action(s, e, "approve"),
    (x) => x.code === "EVENT_QUOTE_REQUIRED",
  );
  action(s, e, "offer_event", host, { amount: 5000000 });
  action(s, e, "accept_event", guest);
  const d = reserve(s, "day", 1, [], {}, { id: "other", role: "guest" });
  assert.throws(
    () => action(s, e, "approve"),
    (x) => x.code === "AVAILABILITY_CHANGED",
  );
  action(s, d, "cancel", { id: "other", role: "guest" });
  action(s, e, "approve");
  assert.equal(e.total, 5000000);
  assert.equal(productAvailability(s, input("day", 1), now).available, false);
  action(s, e, "cancel", guest);
  assert.equal(productAvailability(s, input("day", 35), now).available, true);
});
test("quote and hold expiry cannot reserve capacity forever", () => {
  const s = initialState(),
    b = reserve(s, "day", 35);
  assert.equal(
    productAvailability(s, input("day", 1), b.expiresAt + 1).available,
    true,
  );
});
test("legacy reservation price/time survive new types and new day quota includes them", () => {
  const s = initialState(),
    q = mutate(
      s,
      guest,
      "quote",
      {
        arrival: "2026-11-06",
        departure: "2026-11-07",
        guests: 2,
        units: ["cottage-1"],
      },
      now,
    ),
    b = mutate(s, guest, "create", { quoteId: q.id }, now);
  assert.equal(b.total, null);
  assert.equal(
    new Date(interval(b, s).start).toISOString(),
    "2026-11-06T08:30:00.000Z",
  );
  assert.equal(productAvailability(s, input("day", 34), now).available, false);
  assert.equal(b.total, null);
});
test("overdue checked-in adults remain capacity until host records departure", () => {
  const s = initialState(),
    b = reserve(s, "individual", 2);
  action(s, b, "approve");
  action(s, b, "checkin", host, {}, b.startsAt);
  const late = b.endsAt + 3600000,
    selection = input("day", 34, [], {
      arrival: "2026-11-09",
      departure: "2026-11-10",
    });
  assert.equal(productAvailability(s, selection, late).available, false);
  action(s, b, "complete", host, {}, late);
  assert.equal(productAvailability(s, selection, late).available, true);
});
test("turnover readiness is a separate host check-in control and shared assignment obeys inventory", () => {
  const s = initialState(),
    b = reserve(s, "individual", 1);
  action(s, b, "assign_rooms", host, { units: ["tree-1"] });
  assert.deepEqual(b.units, ["tree-1"]);
  action(s, b, "approve");
  const u = s.units.find((u) => u.id === "tree-1");
  mutate(
    s,
    host,
    "readiness",
    { id: u.id, expectedVersion: u.version, ready: false },
    now,
  );
  assert.throws(
    () => action(s, b, "checkin", host, {}, b.startsAt),
    (e) => e.code === "ROOM_TURNOVER_REQUIRED",
  );
  mutate(
    s,
    host,
    "readiness",
    { id: u.id, expectedVersion: u.version, ready: true },
    now,
  );
  action(s, b, "checkin", host, {}, b.startsAt);
  action(s, b, "complete", host, {}, b.endsAt);
  assert.equal(u.ready, false);
});
test("strict contract rejects forged allocation/prices and validates child age and new host actions", () => {
  const good = input("private", 2, [4]);
  validateBookingOperation("quote", good);
  assert.throws(() => validateBookingOperation("quote", { ...good, total: 1 }));
  assert.throws(() =>
    validateBookingOperation("quote", { ...good, allocations: [] }),
  );
  assert.throws(() =>
    validateBookingOperation("quote", { ...good, childrenAges: [10] }),
  );
  validateBookingOperation("readiness", {
    id: "cottage-1",
    expectedVersion: 1,
    ready: true,
  });
});

test("site closures and expiring exclusive offers block all other booking kinds atomically", () => {
  const s = initialState();
  mutate(
    s,
    host,
    "block",
    {
      arrival: "2026-11-07",
      departure: "2026-11-08",
      unitId: "site",
      reason: "Host closure",
    },
    now,
  );
  assert.equal(productAvailability(s, input("day", 1), now).available, false);
  s.blocks = [];
  const b = reserve(s, "event", 20);
  action(s, b, "offer_event", host, { amount: 5000000, holdHours: 2 });
  assert.equal(productAvailability(s, input("day", 1), now).available, false);
  assert.equal(
    productAvailability(s, input("day", 1), now + 3 * 3600000).available,
    true,
  );
  action(s, b, "accept_event", guest);
  action(s, b, "approve");
  assert.equal(s.blocks.length, 0);
  assert.equal(productAvailability(s, input("day", 1), now).available, false);
});

test("confirmed event date changes require a fresh accepted host offer", () => {
  const s = initialState(),
    b = reserve(s, "event", 20);
  action(s, b, "offer_event", host, { amount: 2000000 });
  action(s, b, "accept_event", guest);
  action(s, b, "approve");
  assert.throws(
    () =>
      mutate(
        s,
        guest,
        "change-quote",
        {
          id: b.id,
          expectedVersion: b.version,
          arrival: "2026-11-10",
          departure: "2026-11-11",
        },
        now,
      ),
    (e) => e.code === "EVENT_CHANGE_REQUIRES_NEW_REQUEST",
  );
  assert.equal(b.total, 2000000);
});
test("event offers respect the bounded site-block configuration", () => {
  const s = initialState(),
    b = reserve(s, "event", 20);
  s.blocks = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    unitId: "site",
    arrival: "2026-12-01",
    departure: "2026-12-02",
    reason: "Maintenance",
  }));
  assert.throws(
    () => action(s, b, "offer_event", host, { amount: 2000000, holdHours: 24 }),
    (e) => e.code === "BLOCK_LIMIT",
  );
});
