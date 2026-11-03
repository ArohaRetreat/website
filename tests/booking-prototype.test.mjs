import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  seed,
  command,
  availability,
  price,
  tier,
  snapshot,
  expire,
  todayIST,
  addDays,
} from "../prototypes/booking/domain.mjs";
import { createPrototypeServer } from "../prototypes/booking/server.mjs";

const now = Date.parse("2026-11-03T04:00:00Z"),
  guest = { id: "guest-1", role: "guest" },
  other = { id: "guest-2", role: "guest" },
  host = { id: "host", role: "host" };
const selection = {
  arrival: "2026-11-06",
  departure: "2026-11-08",
  guests: 2,
  units: ["cottage-1"],
  promo: "",
};
let seq = 0;
const cmd = (s, a, op, b, t = now) =>
  command(s, a, op, b, `test-key-${++seq}`, t);
const create = (s, a = guest, input = selection, time = now) => {
  const q = cmd(s, a, "quote", input, time);
  return cmd(
    s,
    a,
    "create",
    { quoteId: q.id, note: "Quiet arrival, please." },
    time,
  );
};
const rejectsCode = (fn, code) => assert.throws(fn, (e) => e.code === code);

test("inventory preserves ten-person cap and keeps fifth and future rooms closed", () => {
  const s = seed(now);
  assert.equal(s.settings.capacity, 10);
  assert.equal(s.units.filter((u) => u.active).length, 4);
  assert.equal(
    s.units.filter((u) => u.type === "Under construction").length,
    4,
  );
  rejectsCode(
    () =>
      cmd(s, host, "unit", {
        id: "unmapped",
        expectedVersion: 1,
        capacity: 2,
        rate: 400000,
        active: true,
      }),
    "ROOM_NOT_READY",
  );
});
test("pending request blocks overlapping room, but checkout is exclusive", () => {
  const s = seed(now),
    b = create(s);
  assert.equal(b.status, "pending_approval");
  assert.equal(
    availability(s, selection, now).units.find((u) => u.id === "cottage-1")
      .available,
    false,
  );
  rejectsCode(() => price(s, other, selection, now), "AVAILABILITY_CHANGED");
  assert.equal(
    availability(
      s,
      { ...selection, arrival: "2026-11-08", departure: "2026-11-09" },
      now,
    ).units.find((u) => u.id === "cottage-1").available,
    true,
  );
});
test("party capacity applies to units and aggregate occupancy", () => {
  const s = seed(now);
  rejectsCode(
    () => price(s, guest.id, { ...selection, guests: 3 }, now),
    "PARTY_CAPACITY_EXCEEDED",
  );
  s.settings.capacity = 3;
  create(s);
  rejectsCode(
    () => price(s, other.id, { ...selection, units: ["cottage-2"] }, now),
    "AVAILABILITY_CHANGED",
  );
});
test("idempotent retry creates one request and conflicting key is rejected", () => {
  const s = seed(now),
    q = cmd(s, guest, "quote", selection),
    body = { quoteId: q.id, note: "First note" };
  const b = command(s, guest, "create", body, "same-booking-key", now),
    again = command(s, guest, "create", body, "same-booking-key", now);
  assert.equal(b.id, again.id);
  assert.equal(s.bookings.filter((x) => x.id === b.id).length, 1);
  rejectsCode(
    () =>
      command(
        s,
        guest,
        "create",
        { ...body, note: "Changed" },
        "same-booking-key",
        now,
      ),
    "IDEMPOTENCY_CONFLICT",
  );
});
test("guests cannot read or act on another guest booking or admin settings", () => {
  const s = seed(now),
    b = create(s);
  assert.ok(!snapshot(s, other, now).bookings.some((x) => x.id === b.id));
  assert.equal(snapshot(s, null, now).bookings.length, 0);
  rejectsCode(
    () =>
      cmd(s, other, "booking-action", {
        id: b.id,
        action: "cancel",
        expectedVersion: 1,
      }),
    "NOT_FOUND",
  );
  rejectsCode(
    () => cmd(s, guest, "settings", { ...s.settings, expectedVersion: 1 }),
    "FORBIDDEN",
  );
  rejectsCode(
    () =>
      cmd(s, guest, "booking-action", {
        id: b.id,
        action: "approve",
        expectedVersion: 1,
      }),
    "FORBIDDEN",
  );
});
test("approval requires current version and cannot skip lifecycle", () => {
  const s = seed(now),
    b = create(s);
  cmd(s, host, "booking-action", {
    id: b.id,
    action: "approve",
    expectedVersion: 1,
  });
  rejectsCode(
    () =>
      cmd(s, host, "booking-action", {
        id: b.id,
        action: "approve",
        expectedVersion: 1,
      }),
    "VERSION_CONFLICT",
  );
  rejectsCode(
    () =>
      cmd(s, host, "booking-action", {
        id: b.id,
        action: "complete",
        expectedVersion: 2,
      }),
    "INVALID_TRANSITION",
  );
  rejectsCode(
    () =>
      cmd(s, host, "booking-action", {
        id: b.id,
        action: "checkin",
        expectedVersion: 2,
      }),
    "STAY_NOT_STARTED_OR_FINISHED",
  );
});
test("expired pending allocation releases room and cannot later be approved", () => {
  const s = seed(now),
    b = create(s),
    later = now + 86400001;
  expire(s, later);
  assert.equal(b.status, "expired");
  assert.equal(
    availability(s, selection, later).units.find((u) => u.id === "cottage-1")
      .available,
    true,
  );
  rejectsCode(
    () =>
      cmd(
        s,
        host,
        "booking-action",
        { id: b.id, action: "approve", expectedVersion: b.version },
        later,
      ),
    "INVALID_TRANSITION",
  );
});
test("promotion reservations enforce last use and cancellation restores it", () => {
  const s = seed(now);
  s.promos[0].maxUses = 1;
  const b = create(s, guest, { ...selection, promo: "slowdays" });
  rejectsCode(
    () =>
      price(
        s,
        other.id,
        { ...selection, units: ["cottage-2"], promo: "SLOWDAYS" },
        now,
      ),
    "PROMO_EXHAUSTED",
  );
  cmd(s, guest, "booking-action", {
    id: b.id,
    action: "cancel",
    expectedVersion: 1,
  });
  assert.equal(
    price(
      s,
      other.id,
      { ...selection, units: ["cottage-2"], promo: "SLOWDAYS" },
      now,
    ).discount,
    84000,
  );
});
test("configuration and rate changes cannot silently change a quote", () => {
  const s = seed(now),
    q = cmd(s, guest, "quote", selection);
  s.units.find((u) => u.id === "cottage-1").rate += 10000;
  rejectsCode(
    () => cmd(s, guest, "create", { quoteId: q.id }),
    "QUOTE_CHANGED",
  );
});
test("expired quotes never create requests", () => {
  const s = seed(now),
    q = cmd(s, guest, "quote", selection);
  rejectsCode(
    () => cmd(s, guest, "create", { quoteId: q.id }, now + 600001),
    "QUOTE_EXPIRED",
  );
});
test("unit closure, maintenance and capacity reduction reject existing conflicts", () => {
  const s = seed(now);
  create(s);
  rejectsCode(
    () =>
      cmd(s, host, "unit", {
        id: "cottage-1",
        expectedVersion: 1,
        active: false,
        capacity: 2,
        rate: 420000,
      }),
    "EXISTING_BOOKINGS_CONFLICT",
  );
  rejectsCode(
    () =>
      cmd(s, host, "block", {
        ...selection,
        unitId: "cottage-1",
        reason: "Maintenance",
      }),
    "EXISTING_BOOKINGS_CONFLICT",
  );
  rejectsCode(
    () =>
      cmd(s, host, "settings", {
        ...s.settings,
        expectedVersion: 1,
        capacity: 1,
      }),
    "EXISTING_BOOKINGS_CONFLICT",
  );
});
test("maintenance blocks prevent requests until released", () => {
  const s = seed(now),
    b = cmd(s, host, "block", {
      ...selection,
      unitId: "cottage-1",
      reason: "Maintenance",
    });
  rejectsCode(() => price(s, guest.id, selection, now), "AVAILABILITY_CHANGED");
  cmd(s, host, "unblock", { id: b.id });
  assert.ok(price(s, guest.id, selection, now).total > 0);
});
test("loyalty counts completed visits at 5, 6, 9 and 10", () => {
  const s = seed(now);
  assert.equal(tier(s, guest.id).name, "Visitor");
  for (let i = 6; i <= 10; i++) {
    s.bookings.push({ ...s.bookings[0], id: "credit-" + i });
    assert.equal(tier(s, guest.id).name, i < 10 ? "Friend" : "Family");
  }
  s.bookings.at(-1).status = "cancelled";
  assert.equal(tier(s, guest.id).name, "Friend");
});
test("completion grants one loyalty credit, a duplicate action cannot grant another", () => {
  const s = seed(now),
    b = create(s);
  cmd(s, host, "booking-action", {
    id: b.id,
    action: "approve",
    expectedVersion: 1,
  });
  const arrival = Date.parse("2026-11-06T04:00:00Z"),
    departure = Date.parse("2026-11-08T04:00:00Z");
  cmd(
    s,
    host,
    "booking-action",
    { id: b.id, action: "checkin", expectedVersion: 2 },
    arrival,
  );
  cmd(
    s,
    host,
    "booking-action",
    { id: b.id, action: "complete", expectedVersion: 3 },
    departure,
  );
  assert.equal(tier(s, guest.id).stays, 6);
  rejectsCode(
    () =>
      cmd(
        s,
        host,
        "booking-action",
        { id: b.id, action: "complete", expectedVersion: 4 },
        departure,
      ),
    "INVALID_TRANSITION",
  );
  assert.equal(tier(s, guest.id).stays, 6);
});
test("confirmed cancellation keeps the terms accepted at submission", () => {
  const s = seed(now),
    b = create(s);
  cmd(s, host, "booking-action", {
    id: b.id,
    action: "approve",
    expectedVersion: 1,
  });
  s.settings.cancelHours = 0;
  rejectsCode(
    () =>
      cmd(
        s,
        guest,
        "booking-action",
        { id: b.id, action: "cancel", expectedVersion: 2 },
        Date.parse("2026-11-05T04:00:00Z"),
      ),
    "HOST_CANCELLATION_REQUIRED",
  );
  cmd(
    s,
    host,
    "booking-action",
    { id: b.id, action: "cancel", expectedVersion: 2 },
    Date.parse("2026-11-05T04:00:00Z"),
  );
  assert.equal(b.status, "cancelled");
});
test("invalid dates, excessive notes and tier policies are bounded", () => {
  const s = seed(now);
  rejectsCode(
    () => price(s, guest.id, { ...selection, arrival: "2026-02-30" }, now),
    "INVALID_DATE",
  );
  const q = cmd(s, guest, "quote", selection);
  rejectsCode(
    () => cmd(s, guest, "create", { quoteId: q.id, note: "x".repeat(1001) }),
    "INVALID_TEXT",
  );
  rejectsCode(
    () =>
      cmd(s, host, "settings", {
        ...s.settings,
        expectedVersion: 1,
        familyAt: 6,
      }),
    "INVALID_TIER_THRESHOLDS",
  );
});
test("local committed audit/outbox excludes private guest notes", () => {
  const s = seed(now),
    b = create(s);
  assert.ok(s.audit.some((e) => e.type === "booking.requested"));
  assert.ok(!JSON.stringify(s.audit).includes(b.note));
  assert.ok(s.outbox.every((e) => e.delivery === "not_configured"));
});
test("date-change request retains original inventory until conflict-safe host approval", () => {
  const s = seed(now),
    b = create(s);
  cmd(s, host, "booking-action", {
    id: b.id,
    action: "approve",
    expectedVersion: 1,
  });
  const q = cmd(s, guest, "change-quote", {
    id: b.id,
    expectedVersion: 2,
    arrival: "2026-11-09",
    departure: "2026-11-10",
    guests: 2,
    promo: "",
  });
  rejectsCode(
    () => cmd(s, guest, "create", { quoteId: q.id }),
    "QUOTE_EXPIRED",
  );
  cmd(s, guest, "change-request", {
    id: b.id,
    expectedVersion: 2,
    quoteId: q.id,
  });
  assert.equal(b.arrival, selection.arrival);
  assert.equal(b.changeRequest.arrival, "2026-11-09");
  create(s, other, {
    ...selection,
    arrival: "2026-11-09",
    departure: "2026-11-10",
  });
  rejectsCode(
    () =>
      cmd(s, host, "booking-action", {
        id: b.id,
        expectedVersion: 3,
        action: "approve_change",
      }),
    "AVAILABILITY_CHANGED",
  );
  assert.equal(b.arrival, selection.arrival);
  cmd(s, host, "booking-action", {
    id: b.id,
    expectedVersion: 3,
    action: "decline_change",
  });
  assert.ok(!b.changeRequest);
  assert.equal(b.status, "confirmed");
});
test("approved date change replaces the original allocation atomically", () => {
  const s = seed(now),
    b = create(s);
  cmd(s, host, "booking-action", {
    id: b.id,
    action: "approve",
    expectedVersion: 1,
  });
  const q = cmd(s, guest, "change-quote", {
    id: b.id,
    expectedVersion: 2,
    arrival: "2026-11-09",
    departure: "2026-11-10",
    guests: 2,
    promo: "",
  });
  cmd(s, guest, "change-request", {
    id: b.id,
    expectedVersion: 2,
    quoteId: q.id,
  });
  cmd(s, host, "booking-action", {
    id: b.id,
    expectedVersion: 3,
    action: "approve_change",
  });
  assert.equal(b.arrival, "2026-11-09");
  assert.equal(b.total, 420000);
  assert.equal(
    availability(s, selection, now).units.find((u) => u.id === "cottage-1")
      .available,
    true,
  );
});
test("private note edit checks ownership/version and host-created reservation belongs to selected guest", () => {
  const s = seed(now),
    q = cmd(s, host, "quote", { ...selection, guestId: "guest-1" }),
    b = cmd(s, host, "create", { quoteId: q.id, note: "Phone request" });
  assert.equal(b.owner, "guest-1");
  cmd(s, guest, "note", {
    id: b.id,
    expectedVersion: 1,
    note: "Updated request",
  });
  assert.equal(b.note, "Updated request");
  rejectsCode(
    () =>
      cmd(s, other, "note", { id: b.id, expectedVersion: 2, note: "Not mine" }),
    "NOT_FOUND",
  );
});
test("HTTP boundary serialises concurrent creates, enforces ownership, origin and persists restart", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "aroha-booking-test-")),
    file = path.join(folder, "state.json");
  let server;
  const listen = async () => {
    server = await createPrototypeServer({ stateFile: file });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${server.address().port}`;
  };
  const close = () => new Promise((resolve) => server.close(resolve));
  let base = await listen();
  const post = async (
    op,
    body,
    cookie,
    key = "http-key-" + ++seq,
    extra = {},
  ) => {
    const r = await fetch(base + "/prototype-api/v1/" + op, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Prototype-Client": "aroha-review",
        "Idempotency-Key": key,
        ...(cookie ? { Cookie: cookie } : {}),
        ...extra,
      },
      body: JSON.stringify(body),
    });
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  };
  try {
    const a = await post("session", { persona: "guest-1" }),
      b = await post("session", { persona: "guest-2" }),
      arrival = addDays(todayIST(), 3),
      departure = addDays(todayIST(), 5),
      pick = { ...selection, arrival, departure };
    const qa = await post("quote", pick, a.cookie),
      qb = await post("quote", pick, b.cookie);
    assert.equal(qa.status, 200);
    assert.equal(qb.status, 200);
    const created = await Promise.all([
      post(
        "create",
        { quoteId: qa.body.id, note: "Persist this sample note" },
        a.cookie,
      ),
      post("create", { quoteId: qb.body.id }, b.cookie),
    ]);
    assert.deepEqual(created.map((r) => r.status).sort(), [200, 409]);
    const winner = created[0].status === 200 ? created[0] : created[1],
      loserCookie = created[0].status === 200 ? b.cookie : a.cookie;
    const denied = await post(
      "booking-action",
      { id: winner.body.id, action: "cancel", expectedVersion: 1 },
      loserCookie,
    );
    assert.equal(denied.status, 404);
    assert.equal(
      (
        await post(
          "settings",
          { ...a.body.settings, expectedVersion: 1 },
          a.cookie,
        )
      ).status,
      422,
    );
    assert.equal(
      (
        await post(
          "unit",
          {
            id: "cottage-1",
            expectedVersion: 1,
            capacity: 2,
            rate: 420000,
            active: false,
          },
          a.cookie,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await post("session", { persona: "host" }, null, undefined, {
          Origin: "https://evil.test",
        })
      ).status,
      403,
    );
    assert.equal((await post("session", { persona: "real-user" })).status, 422);
    const html = await fetch(base + "/prototype/booking/");
    assert.match(await html.text(), /Nothing is booked at the retreat/);
    await close();
    base = await listen();
    const h = await post("session", { persona: "host" });
    assert.ok(h.body.bookings.some((x) => x.id === winner.body.id));
  } finally {
    await close();
    await rm(folder, { recursive: true, force: true });
  }
});
