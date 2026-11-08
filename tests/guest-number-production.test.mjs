import test from "node:test";
import assert from "node:assert/strict";
import { assignGuestNumber } from "../functions/booking/guest-number.mjs";

test("production numbering starts after the first guest is seeded and preserves that guest's number", async () => {
  const counter = "aroha_booking_guest_counters/sequence";
  const first = "aroha_booking_guest_numbers/first";
  const next = "aroha_booking_guest_numbers/next";
  const records = new Map();
  const db = { collection: (name) => ({ doc: (id) => name + "/" + id }) };
  const snapshot = (ref) => ({ data: () => records.get(ref) });
  const tx = {
    get: async (ref) => snapshot(ref),
    getAll: async (...refs) => refs.map(snapshot),
    create: (ref, record) => {
      assert.equal(records.has(ref), false);
      records.set(ref, record);
    },
    set: (ref, record, options) => {
      records.set(ref, options?.merge ? { ...records.get(ref), ...record } : record);
    },
  };
  const assign = (ownerIds, canonicalId) => assignGuestNumber(tx, db, ownerIds, canonicalId, 2);

  assert.equal(await assign(["next"], "next"), null);
  assert.equal(records.size, 0);
  records.set(first, { number: 1, firstCheckInAt: 1 });
  records.set(counter, { last: 1, firstGuestSeeded: true });
  assert.equal(await assign(["first-alias", "first"], "first"), 1);
  assert.equal(await assign(["next"], "next"), 2);
  assert.equal(await assign(["next"], "next"), 2);
  assert.deepEqual(records.get(next), { number: 2, firstCheckInAt: 2 });
  assert.deepEqual(records.get(counter), { last: 2, firstGuestSeeded: true });
});
