import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { visitDateLabel } from "../website/booking-visit-label.mjs";
import { JSDOM } from "jsdom";
import {
  initialState,
  mutate,
  availability,
  tier,
  addDays,
  todayIST,
} from "../functions/booking/domain.mjs";
const guest = { id: "ui-guest", name: "Review guest", role: "guest" },
  host = { id: "ui-host", name: "Review host", role: "host", bookingAccess: "manager" };
async function mount(s, role = "guest", hash = "") {
  const actor = role === "host" ? host : guest,
    dom = new JSDOM(
      '<div id="app"></div><div id="toast"></div><dialog id="detail"></dialog>',
      {
        url:
          "https://aroharetreat.com/" +
          (role === "host" ? "admin/bookings/" : "book/") +
          hash,
        runScripts: "outside-only",
      },
    ),
    w = dom.window;
  w.scrollTo = () => {};
  w.testVisitDateLabel = visitDateLabel;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new w.Event("close"));
  };
  w.testBookingApi = async (op, body) => {
    if (op === "state")
      return structuredClone({
        actor,
        profile: s.uiProfile || {
          name: actor.name,
          phone: "+12025550123",
          email: "guest@example.test",
          version: 0,
        },
        settings: s.settings,
        units: s.units,
        bookings: s.bookings,
        loyalty: tier(s, actor.id),
        users: [guest],
        promos: s.promos,
        blocks: s.blocks,
        audit: s.audit,
      });
    if (op === "availability") return availability(s, body);
    if (op === "profile") {
      s.uiProfile = {
        name: body.name,
        phone: body.phone,
        email: "guest@example.test",
        version: body.expectedVersion + 1,
      };
      return structuredClone(s.uiProfile);
    }
    if (op === "create") s.lastContact = body.contact;
    return structuredClone(mutate(s, actor, op, body));
  };
  const feedback = (await readFile(new URL("../website/studio-feedback.mjs", import.meta.url), "utf8")).replaceAll("export ", "");
  const source = (
    await readFile(new URL("../website/booking.mjs", import.meta.url), "utf8")
  )
    .replace(/^import .*studio-feedback\.mjs.*;$/m, feedback)
    .replace(/import \{visitDateLabel\} from "\.\/booking-visit-label.mjs";/, "const visitDateLabel=window.testVisitDateLabel;")
    .replace(/import \{[^\n]+\} from ['"]\.\/material-controls.mjs['"];/, 'const installMaterialControls=()=>{},confirmMaterial=async()=>window.confirm();')
    .replace(/^import .* from ["']\.\/frontdesk\.mjs["'];$/m,`const hostShell=({content})=>'<button data-host-tab="calendar">Calendar</button>'+content,mountFrontDesk=async()=>{},hostTabAllowed=()=>true,hostDestinations=()=>[],openStudioBooking=({id})=>detail(id),mountStudioDashboard=async()=>{};`)
    .replace(/^import .* from ["']\.\/(?:studio-views|booking-documents|guest-dialogs)\.mjs["'];$/gm, "").replace("const hostShell=", "const applyStudioAppearance=()=>{},studioInitials=()=>'';const hostShell=").replace(/import \{mountHostOperations,openManualBooking\} from '\.\/host-operations.mjs';/, 'const mountHostOperations=async()=>{},openManualBooking=()=>{};').replace(/import \{auth\} from '\.\/firebase-auth.mjs';/, 'const auth={currentUser:null};').replace(/import \{mountStayPanel\} from '\.\/stay-panel.mjs';/, "").replace(
      /import \{\s*journeyStep\s*\} from "\.\/booking-journey.mjs";/,
      "const journeyStep=()=>{};",
    )
    .replace(
      /import \{ bookingApi \} from "\.\/booking-api.mjs";/,
      "const bookingApi=window.testBookingApi; const mountStayPanel=async()=>{};",
    );
  await w.eval("(async()=>{" + source + "})()");
  const wait = async () => {
    for (let i = 0; i < 100 && w.document.querySelector("#app[aria-busy]"); i++)
      await new Promise((r) => setTimeout(r, 3));
  };
  return { w, d: w.document, wait, close: () => w.close() };
}
for (const [kind, adults, kids, total] of [
  ["day", 3, [4, 9], 500000],
  ["individual", 2, [], 1400000],
  ["event", 2, [], 6000000],
])
  test(
    "guest " +
      kind +
      " flow uses relevant fields, server total and host approval",
    async () => {
      const s = initialState(),
        ui = await mount(s);
      try {
        const { w, d, wait } = ui,
          radio = d.querySelector(`[name="bookingKind"][value="${kind}"]`);
        radio.checked = true;
        radio.dispatchEvent(new w.Event("change", { bubbles: true }));
        let f = d.querySelector("#search-form");
        f.elements.adults.value = adults;
        f.elements.childCount.value = kids.length;
        f.elements.childCount.dispatchEvent(
          new w.Event("change", { bubbles: true }),
        );
        f = d.querySelector("#search-form");
        d.querySelectorAll('[name="childAge"]').forEach(
          (el, i) => (el.value = kids[i]),
        );
        assert.equal(
          !!(f.elements.departure || f.elements.eventEnd),
          ["individual", "event"].includes(kind),
        );
        f.dispatchEvent(
          new w.Event("submit", { bubbles: true, cancelable: true }),
        );
        await wait();
        assert.ok(d.querySelector("#request-form"));
        assert.equal(d.querySelectorAll("[data-room]").length, 0);
        if (total !== null)
          assert.match(
            d.querySelector(".summary .total").textContent,
            new RegExp((total / 100).toLocaleString("en-IN")),
          );
        else assert.match(d.querySelector(".summary").textContent, /host/i);
        d.querySelector("#terms").checked = true;
        d.querySelector("#request-form").dispatchEvent(
          new w.Event("submit", { bubbles: true, cancelable: true }),
        );
        await wait();
        assert.equal(s.bookings.length, 1);
        assert.equal(s.bookings[0].kind, kind);
        assert.equal(s.bookings[0].total, total);
        assert.equal(s.bookings[0].status, "pending_approval");
        assert.equal(s.bookings[0].children, kids.length);
        if (kind === "event")
          assert.match(d.querySelector("#detail").textContent, /held until/);
      } finally {
        ui.close();
      }
    },
  );
test("legacy host offer and owner acceptance remain separate visible event actions", async () => {
  const s = initialState(),
    arrival = addDays(todayIST(), 5),
    q = mutate(s, guest, "quote", {
      kind: "event",
      arrival,
      departure: addDays(arrival, 1),
      adults: 20,
      childrenAges: [],
      guests: 20,
      units: [],
    }),
    b = mutate(s, guest, "create", { quoteId: q.id });
  delete b.pricingVersion; b.total=null; b.subtotal=null; b.quoteAccepted=false; b.lineItems=[];
  let ui = await mount(s, "host");
  try {
    ui.d.querySelector('[data-host-tab="calendar"]').click();
    ui.d.querySelector(`[data-booking="${b.id}"]`).click();
    await ui.wait();
    assert.ok(ui.d.querySelector('[data-action="approve"]').disabled);
    const form = ui.d.querySelector("#event-offer");
    form.elements.amount.value = 50000;
    form.dispatchEvent(
      new ui.w.Event("submit", { bubbles: true, cancelable: true }),
    );
    await ui.wait();
    assert.equal(b.total, 5000000);
    assert.equal(b.quoteAccepted, false);
    assert.equal(s.blocks.length, 1);
  } finally {
    ui.close();
  }
  ui = await mount(s, "guest", "#visits");
  try {
    ui.d.querySelector(`[data-booking="${b.id}"]`).click();
    await ui.wait();
    const accept = [...ui.d.querySelectorAll("#detail button")].find((x) =>
      x.textContent.startsWith("Accept "),
    );
    assert.ok(accept);
    accept.click();
    await ui.wait();
    assert.equal(b.quoteAccepted, true);
    assert.equal(b.status, "pending_approval");
  } finally {
    ui.close();
  }
});

test("profile saves prefill review while booking-specific contact stays independent", async () => {
  const s = initialState();
  s.uiProfile = {
    name: "Saved Contact",
    phone: "+12025550123",
    email: "guest@example.test",
    version: 0,
  };
  const profile = await mount(s, "guest", "#profile");
  try {
    const { w, d, wait } = profile;
    d.querySelector('[name="contactName"]').value = "Updated Contact";
    d.querySelector('[name="contactPhone"]').value = "+12025550124";
    d.querySelector("#profile-form").dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    );
    await wait();
    assert.equal(s.uiProfile.version, 1);
    assert.equal(
      d.querySelector('[name="contactPhone"]').value,
      "+12025550124",
    );
  } finally {
    profile.close();
  }
  const booking = await mount(s);
  try {
    const { w, d, wait } = booking;
    d.querySelector("#search-form").dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    );
    await wait();
    d.querySelector('[data-room="cottage-1"]').click();
    d.querySelector("#review").click();
    await wait();
    assert.equal(
      d.querySelector('[name="contactName"]').value,
      "Updated Contact",
    );
    assert.equal(
      d.querySelector('[name="contactPhone"]').value,
      "+12025550124",
    );
    assert.equal(d.querySelector('input[type="email"]').readOnly, true);
    d.querySelector('[name="contactName"]').value = "Booking Contact";
    d.querySelector("#terms").checked = true;
    d.querySelector("#request-form").dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    );
    await wait();
    assert.equal(s.lastContact.name, "Booking Contact");
    assert.equal(s.uiProfile.name, "Updated Contact");
  } finally {
    booking.close();
  }
});
test("exclusive event end date is inclusive in the UI and exclusive in the API", async () => {
  const s = initialState(),
    ui = await mount(s);
  try {
    const { w, d, wait } = ui;
    const option = d.querySelector('[name="bookingKind"][value="event"]');
    option.checked = true;
    option.dispatchEvent(new w.Event("change", { bubbles: true }));
    const f = d.querySelector("#search-form"),
      start = addDays(todayIST(), 8),
      last = addDays(start, 2);
    f.elements.arrival.value = start;
    f.elements.eventEnd.value = last;
    f.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await wait();
    assert.equal(s.quotes.at(-1).departure, addDays(last, 1));
    assert.ok(d.querySelector("#request-form"));
    assert.match(d.querySelector(".terms").textContent, /Exclusive range/);
  } finally {
    ui.close();
  }
});
