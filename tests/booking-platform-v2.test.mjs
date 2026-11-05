import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initialState, mutate } from "../functions/booking/domain.mjs";
import { productAvailability } from "../functions/booking/products.mjs";
import { contactDetails } from "../functions/booking/contact.mjs";
import { studioAccess, validModuleAccess } from "../functions/access.mjs";
import {
  bookingEvent,
  captureJourney,
  queueEvent,
  drainEvents,
  captureResponse,
} from "../functions/booking/observability.mjs";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const { FieldValue } = require("firebase-admin/firestore");
const now = Date.parse("2026-11-03T03:00:00Z"),
  guest = { id: "guest", role: "guest" },
  host = { id: "host", role: "host" };
const eventInput = {
  kind: "event",
  arrival: "2026-11-08",
  departure: "2026-11-11",
  adults: 20,
  childrenAges: [],
  guests: 20,
  units: [],
};
test("exclusive range spans first morning through last inclusive evening, holds intervening nights and preserves snapshot", () => {
  const s = initialState(),
    q = mutate(s, guest, "quote", eventInput, now),
    b = mutate(s, guest, "create", { quoteId: q.id, note: "" }, now);
  assert.equal(new Date(b.startsAt).toISOString(), "2026-11-08T00:30:00.000Z");
  assert.equal(new Date(b.endsAt).toISOString(), "2026-11-10T12:30:00.000Z");
  const action = (action, extra = {}, actor = host) =>
    mutate(
      s,
      actor,
      "booking-action",
      { id: b.id, expectedVersion: b.version, action, ...extra },
      now,
    );
  assert.equal(b.total,9000000);
  assert.equal(b.quoteAccepted,true);
  assert.throws(
    () =>
      productAvailability(
        s,
        {
          kind: "private",
          arrival: "2026-11-09",
          departure: "2026-11-10",
          adults: 2,
          childrenAges: [],
          guests: 2,
          units: ["cottage-1"],
        },
        now,
      ),
    (e) => e.code === "AVAILABILITY_CHANGED",
  );
  s.settings.products.stayStart = "18:00";
  const afterEvent = {kind:"private",arrival:"2026-11-10",departure:"2026-11-11",adults:2,childrenAges:[],guests:2,units:["cottage-1"]};
  assert.equal(productAvailability(s,afterEvent,now).available,true,"an exclusive offer ends at18:00, not the following midnight");
  s.settings.products.stayStart = "11:00";

  action("approve");
  assert.equal(
    productAvailability(
      s,
      {
        kind: "day",
        arrival: "2026-11-10",
        departure: "2026-11-11",
        adults: 1,
        childrenAges: [],
        guests: 1,
        units: [],
      },
      now,
    ).available,
    false,
  );
  assert.equal(
    productAvailability(
      s,
      {
        kind: "day",
        arrival: "2026-11-11",
        departure: "2026-11-12",
        adults: 1,
        childrenAges: [],
        guests: 1,
        units: [],
      },
      now,
    ).available,
    true,
  );
  const ends = b.endsAt;
  s.settings.products.dayEnd = "17:00";
  assert.equal(b.endsAt, ends);
});
test("contact validation normalises international phone and rejects unknown/private-field injection", () => {
  assert.deepEqual(
    contactDetails({ name: " Guest Example ", phone: "+1 (202) 555-0123" }),
    { name: "Guest Example", phone: "+12025550123" },
  );
  for (const value of [
    { name: "A", phone: "+12025550123" },
    { name: "Guest", phone: "9876543210" },
    { name: "Guest", phone: "+12025550123", email: "injected@example.test" },
    { name: "Guest\nOther", phone: "+12025550123" },
  ])
    assert.throws(
      () => contactDetails(value),
      (e) => e.code === "INVALID_CONTACT",
    );
});
test("legacy access defaults stay intact while module permissions remain independent of CMS roles", () => {
  assert.deepEqual(studioAccess({ active: true, role: "admin" }), {
    website: true,
    bookings: "manager",
    access: true,
  });
  assert.deepEqual(
    studioAccess({
      active: true,
      role: "editor",
      websiteAccess: false,
      bookingAccess: "manager",
    }),
    { website: false, bookings: "manager", access: false },
  );
  assert.equal(
    studioAccess({ active: false, role: "admin", bookingAccess: "manager" })
      .bookings,
    "none",
  );
  assert.equal(studioAccess({ active: true, role: "viewer" }).bookings, "none");
  assert.equal(validModuleAccess({ bookingAccess: "superadmin" }), false);
  assert.equal(
    studioAccess({
      active: true,
      role: "superadmin",
      websiteAccess: false,
      bookingAccess: "none",
    }).bookings,
    "manager",
  );
});
function fakeDB() {
  const data = new Map();
  const ref = (id) => ({
    id,
    async get() {
      return snap(id);
    },
  });
  const snap = (id) => ({
    id,
    ref: ref(id),
    exists: data.has(id),
    data: () => structuredClone(data.get(id)),
  });
  const db = {
    data,
    collection: () => ({
      doc: ref,
      where: () => ({
        orderBy: () => ({
          limit: (n) => ({
            get: async () => ({
              docs: [...data.keys()]
                .filter((k) => data.get(k).nextAttemptAt <= Date.now())
                .slice(0, n)
                .map(snap),
            }),
          }),
        }),
      }),
    }),
    async runTransaction(fn) {
      return fn({
        get: (r) => r.get(),
        create(r, v) {
          if (data.has(r.id)) throw Error("already exists");
          data.set(r.id, structuredClone(v));
        },
        update(r, v) {
          const row = data.get(r.id);
          for (const [k, x] of Object.entries(v))
            if (x?.isEqual?.(FieldValue.delete())) delete row[k];
            else row[k] = x;
        },
      });
    },
  };
  return db;
}
test("business event extraction includes authorised validated phone but excludes names/email/notes/ages and rejects browser phone fields", async () => {
  const e = bookingEvent({
    type: "booking.api_response",
    authority: "server-observed",
    actor: "user",
    phone: "+12025550123",
    operation: "create",
    status: 409,
    outcome: "failed",
    errorCode: "AVAILABILITY_CHANGED",
    note: "SECRET_NOTE",
    email: "private@example.test",
    name: "SECRET_NAME",
    childrenAges: [4],
  });
  assert.equal(e["contact.phone"], "+12025550123");
  assert.equal(e["http.response.status_code"], 409);
  assert.doesNotMatch(
    JSON.stringify(e),
    /SECRET_|private@example|childrenAges/,
  );
  assert.equal(
    bookingEvent({ type: "x", phone: "not-phone" })["contact.phone"],
    undefined,
  );
  await assert.rejects(
    () =>
      captureJourney(
        fakeDB(),
        null,
        {
          eventId: randomUUID(),
          journeyId: randomUUID(),
          step: "review",
          outcome: "viewed",
          phone: "+12025550123",
        },
        randomUUID(),
      ),
    (e) => e.code === "INVALID_JOURNEY_EVENT",
  );
});
test("durable event deduplication, full acceptance, failed delivery and expired lease ownership are independent", async () => {
  const db = fakeDB(),
    e = bookingEvent({
      id: "stable-test",
      type: "booking.api_response",
      authority: "server-observed",
      operation: "create",
      outcome: "succeeded",
    });
  await queueEvent(db, e);
  await queueEvent(db, e);
  assert.equal(db.data.size, 1);
  const failed = await drainEvents(db, async () => ({
    status: 429,
    headers: { get: () => "3600" },
  }));
  assert.equal(failed.failed, 1);
  let row = [...db.data.values()][0];
  assert.equal(row.status, "pending");
  assert.ok(row.nextAttemptAt >= Date.now() + 3599000);
  row.nextAttemptAt = 0;
  const stale = await drainEvents(db, async () => {
    row.lease = "new-owner";
    return { status: 202 };
  });
  assert.equal(stale.delivered, 0);
  assert.equal(row.lease, "new-owner");
  row.nextAttemptAt = 0;
  const partial = await drainEvents(db, async () => ({ status: 200 }));
  assert.equal(partial.failed, 1);
  assert.equal(row.status, "pending");
  row.nextAttemptAt = 0;
  const accepted = await drainEvents(db, async () => ({ status: 202 }));
  assert.equal(accepted.delivered, 1);
  assert.equal(row.status, "delivered");
  assert.equal(row.nextAttemptAt, undefined);
  assert.ok(row.expireAt instanceof Date);
});

test("response events have a bounded direct fallback when database capture fails", async () => {
  let captured;
  const db = {
    collection() {
      throw Error("database unavailable");
    },
  };
  const r = await captureResponse(
    db,
    {
      id: "failure-probe",
      type: "booking.api_response",
      authority: "server-observed",
      status: 503,
      operation: "create",
      outcome: "failed",
      errorCode: "DEPENDENCY_UNAVAILABLE",
    },
    {
      fallback: async (event) => {
        captured = event;
        return { status: 202 };
      },
    },
  );
  assert.equal(r.fallbackAccepted, true);
  assert.equal(captured["http.response.status_code"], 503);
  assert.equal(captured["contact.phone"], undefined);
  const timeout = await captureResponse(
    fakeDB(),
    {
      id: "timeout-probe",
      type: "booking.api_response",
      authority: "server-observed",
    },
    {
      phoneLookup: () => new Promise(() => {}),
      fallback: async () => ({ status: 202 }),
      timeoutMs: 5,
    },
  );
  assert.equal(timeout.fallbackAccepted, true);
});
