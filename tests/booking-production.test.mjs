import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initialState, mutate, tier } from "../functions/booking/domain.mjs";
const now = Date.parse("2026-11-03T05:00:00Z"),
  guest = { id: "verified-guest", role: "guest" },
  host = { id: "verified-host", role: "host" };
const selection = {
  arrival: "2026-11-07",
  departure: "2026-11-09",
  guests: 2,
  units: ["cottage-1"],
  promo: "",
};
test("production starts with real inventory and no demo reservations or tariffs", () => {
  const s = initialState();
  assert.equal(s.bookings.length, 0);
  assert.equal(s.users.length, 0);
  assert.equal(s.promos.length, 0);
  assert.equal(s.units.filter((u) => u.active).length, 5);
  assert.equal(s.settings.capacity, 10);
  assert.ok(s.units.every((u) => u.rate === null));
  const q = mutate(s, guest, "quote", selection, now);
  assert.equal(q.total, null);
  assert.equal(q.subtotal, null);
  assert.equal(q.discount, 0);
  const b = mutate(s, guest, "create", { quoteId: q.id, note: "" }, now);
  assert.match(b.reference, /^AR-/);
  assert.equal(b.status, "pending_approval");
  assert.equal(b.cancelHours, 0);
});
test("production stays use authoritative completion credits and no assumed benefits", () => {
  const s = initialState();
  s.stats[guest.id] = 6;
  assert.equal(tier(s, guest.id).name, "Friend");
  assert.equal(tier(s, guest.id).discount, 0);
  s.stats[guest.id] = 10;
  assert.equal(tier(s, guest.id).name, "Family");
});
test("future rooms require explicit readiness and actual names before activation", () => {
  const s = initialState();
  assert.throws(
    () =>
      mutate(
        s,
        host,
        "unit",
        {
          id: "future-1",
          expectedVersion: 1,
          rate: null,
          capacity: 5,
          active: true,
        },
        now,
      ),
    (e) => e.code === "ROOM_NOT_READY",
  );
  assert.throws(
    () =>
      mutate(
        s,
        host,
        "unit",
        {
          id: "future-1",
          expectedVersion: 1,
          rate: null,
          capacity: 5,
          active: true,
          verified: true,
        },
        now,
      ),
    (e) => e.code === "ROOM_NAME_REQUIRED",
  );
  const u = mutate(
    s,
    host,
    "unit",
    {
      id: "future-1",
      name: "Garden room 01",
      expectedVersion: 1,
      rate: null,
      capacity: 5,
      active: true,
      verified: true,
    },
    now,
  );
  assert.equal(u.active, true);
  assert.equal(u.type, "Room");
  assert.equal(s.settings.capacity, 10);
});
test("unpriced inventory never accepts a promo as a fictional monetary benefit", () => {
  const s = initialState();
  assert.throws(
    () => mutate(s, guest, "quote", { ...selection, promo: "FAKECODE" }, now),
    (e) => e.code === "PRICING_NOT_CONFIGURED",
  );
});
test("production frontend uses verified Firebase transport and contains no demo account controls", async () => {
  const app = await readFile(
      new URL("../website/booking.mjs", import.meta.url),
      "utf8",
    ),
    adapter = await readFile(
      new URL("../website/booking-api.mjs", import.meta.url),
      "utf8",
    );
  assert.doesNotMatch(
    app,
    /data-persona|guest-1|guest-2|DEMO-|real Google account is not connected/,
  );
  assert.match(app, /Continue with Google/);
  assert.match(app, /\/admin\/bookings\//);
  assert.match(adapter, /getIdToken/);
  assert.match(adapter, /\/api\/v1\/booking\//);
  assert.doesNotMatch(adapter, /localStorage|prototype-api/);
});

test("production guest UI presents published private-room pricing without sample history", async () => {
  const { JSDOM } = await import("jsdom");
  const s = initialState();
  let actor = null;
  const html =
    '<div id="app"></div><div id="toast" role="status"></div><dialog id="detail"></dialog>';
  const dom = new JSDOM(html, {
      url: "https://aroharetreat.com/book/",
      runScripts: "outside-only",
    }),
    w = dom.window;
  w.scrollTo = () => {};
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new w.Event("close"));
  };
  w.testBookingApi = async (op, body) => {
    if (op === "session") {
      actor = { id: "google-test-uid", name: "Verified guest", role: "guest" };
      return {};
    }
    if (op === "state")
      return {
        actor,
        settings: s.settings,
        units: s.units,
        bookings: s.bookings,
        loyalty: actor ? tier(s, actor.id) : null,
        users: [],
        promos: [],
        blocks: [],
        audit: [],
      };
    if (op === "availability") {
      const { availability } = await import("../functions/booking/domain.mjs");
      return availability(s, body);
    }
    return mutate(s, actor, op, body);
  };
  let source = await readFile(
    new URL("../website/booking.mjs", import.meta.url),
    "utf8",
  );
  source = source.replace(/import \{mountStayPanel\} from '\.\/stay-panel.mjs';/, "").replace(
    /import \{ bookingApi \} from "\.\/booking-api.mjs";/,
    "const bookingApi=window.testBookingApi; const mountStayPanel=async()=>{};",
  );
  const wait = async () => {
    for (let i = 0; i < 200 && w.document.querySelector("#app[aria-busy]"); i++)
      await new Promise((r) => setTimeout(r, 5));
  };
  try {
    await w.eval(
      "(async()=>{" +
        source.replace(
          /import \{\s*journeyStep\s*\} from "\.\/booking-journey.mjs";/,
          "const journeyStep=()=>{};",
        ) +
        "})()",
    );
    assert.match(w.document.body.textContent, /Sign in/);
    assert.doesNotMatch(
      w.document.body.textContent,
      /sample guest|DEMO-|SLOWDAYS/,
    );
    w.document.querySelector("#account").click();
    w.document.querySelector("#google-booking-login").click();
    await wait();
    w.document
      .querySelector("#search-form")
      .dispatchEvent(
        new w.Event("submit", { bubbles: true, cancelable: true }),
      );
    await wait();
    assert.match(w.document.querySelector(".room-price").textContent, /6,000/);
    w.document.querySelector('[data-room="cottage-1"]').click();
    w.document.querySelector("#review").click();
    await wait();
    assert.match(
      w.document.querySelector(".summary .total").textContent,
      /12,000/,
    );
    w.document.querySelector("#terms").checked = true;
    w.document
      .querySelector("#request-form")
      .dispatchEvent(
        new w.Event("submit", { bubbles: true, cancelable: true }),
      );
    await wait();
    assert.equal(s.bookings.length, 1);
    assert.equal(s.bookings[0].total, 1200000);
    assert.match(s.bookings[0].reference, /^AR-/);
    assert.match(
      w.document.querySelector("#detail").textContent,
      /Your request is with your hosts/,
    );
    assert.doesNotMatch(
      w.document.querySelector("#detail").textContent,
      /prototype|sample/,
    );
  } finally {
    dom.window.close();
  }
});
