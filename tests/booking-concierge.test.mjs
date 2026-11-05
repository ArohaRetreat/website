import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { availabilityCalendar } from "../functions/booking/products.mjs";
import { recommendPrivate } from "../website/booking-options.mjs";
import {
  initialState,
  mutate,
  availability,
  addDays,
  todayIST,
  tier,
} from "../functions/booking/domain.mjs";
const actor = { id: "concierge-guest", role: "guest", name: "Review Guest" };
const from = addDays(todayIST(), 8),
  until = addDays(from, 1);
const input = (adults, childrenAges = [], kind = "private") => ({
  kind,
  arrival: from,
  departure: until,
  adults,
  childrenAges,
  guests: adults + childrenAges.length,
  units: [],
});
for (const [adults, kids, rooms, total] of [
  [1, [], 1, 600000],
  [2, [], 1, 600000],
  [4, [6, 9], 2, 1500000],
  [1, [5], 1, 600000],
  [1, [4, 9], 1, 750000],
  [2, [4, 9], 1, 900000],
  [10, [], 5, 3000000],
]) {
  test(
    "recommendation agrees with server allocation/price for " +
      adults +
      " adults / " +
      kids.length +
      " children",
    () => {
      const s = initialState(),
        selection = input(adults, kids),
        a = availability(s, selection);
      const fit = recommendPrivate(
        a.units,
        adults,
        kids.length,
        1,
        s.settings.products.extraChildRate,
      );
      assert.equal(fit.units.length, rooms);
      const q = mutate(s, actor, "quote", { ...selection, units: fit.units });
      assert.equal(q.total, total);
      assert.equal(fit.estimate, q.total);
    },
  );
}
test("recommendations respect rates, closed rooms, one-bed capacity, oversized parties and zero extra-child charge", () => {
  const s = initialState();
  s.units[0].rate = 100000;
  s.units[0].capacity = 1;
  s.units[1].active = false;
  const a = availability(s, input(2));
  const fit = recommendPrivate(a.units, 2, 0, 1, 150000);
  assert(!fit.units.includes("tree-2"));
  assert.deepEqual(fit.units, ["cottage-1"]);
  assert.equal(recommendPrivate(a.units, 11, 0, 1, 150000), null);
  const family = availability(s, input(1, [5, 6]));
  const free = recommendPrivate(family.units, 1, 2, 1, 0);
  const q = mutate(s, actor, "quote", {
    ...input(1, [5, 6]),
    units: free.units,
  });
  assert.equal(q.extraChildren, 1);
});
const bundled = await build({
  entryPoints: ["website/booking-concierge.mjs"],
  bundle: true,
  format: "iife",
  globalName: "Concierge",
  write: false,
  target: "es2022",
});
async function mount({
  anonymous = false,
  sessionRedirect = false,
  authEvent = false,
  failCreate = false,
  failStatus = 0,
  quoteStale = false,
  settings = {},
  deferDetail = false,
  failCalendar = false,
  deferCalendar = false,
  environment = "pre-prod",
  serverEnvironment = environment,
} = {}) {
  const s = initialState();
  Object.assign(s.settings.products, settings);
  let signed = !anonymous,
    profile = {
      name: actor.name,
      phone: "+12025550123",
      email: "guest@example.test",
      version: 0,
    },
    detailRelease, calendarRelease,
    createCalls = [];
  const dom = new JSDOM('<div id="app" data-dt-mask></div>', {
      url: "https://aroha-retreat-preprod.web.app/book/",
      runScripts: "outside-only",
    }),
    w = dom.window;
  w.scrollTo = () => {};
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event("close"));
  };
  w.eval(bundled.outputFiles[0].text);
  const steps = [];
  let holdState = false, stateRelease;
  let creates = 0,
    firstBody;
  const operations=[];
  const api = async (op, body, key, opts = {}) => {
    operations.push(op);
    if (op === "state") {
      const snapshot = structuredClone({
        environment: serverEnvironment,
        actor: signed ? actor : null,
        profile: signed ? profile : null,
        settings: s.settings,
        units: s.units,
        bookings: signed ? s.bookings : [],
        loyalty: tier(s, actor.id),
        delivery: "email_enabled",
      });
      if (holdState) { holdState = false; await new Promise(resolve => stateRelease = resolve); }
      return snapshot;
    }
    if (op === "session") {
      signed = true;
      if (authEvent) await portal.identity({ uid: actor.id });
      return sessionRedirect ? {redirecting:true} : {};
    }
    if (op === "logout") {
      signed = false;
      return {};
    }
    if(op === "calendar") {
      if(failCalendar) { failCalendar=false; throw Error("offline"); }
      const result=availabilityCalendar(s,body);
      if(deferCalendar) { deferCalendar=false; await new Promise(r=>calendarRelease=r); }
      return result;
    }
    if (!signed) throw { code: "SIGN_IN_REQUIRED" };
    if (op === "availability") return structuredClone(availability(s, body));
    if (op === "profile") {
      assert.equal(body.expectedVersion, profile.version);
      profile = { ...profile, ...body, version: profile.version + 1 };
      return profile;
    }
    if (op === "reservation-detail") {
      if (deferDetail) await new Promise((r) => (detailRelease = r));
      return structuredClone(s.bookings.find((b) => b.id === body.id));
    }
    if (op === "communications") return { notifications: [], invoice: null };
    if (op === "create") {
      createCalls.push({ body: structuredClone(body), key });
      creates++;
      if (quoteStale) throw { code: "QUOTE_EXPIRED" };
      if (failCreate && creates === 1) {
        firstBody = structuredClone(body);
        if (failStatus) throw { code: "INTERNAL_ERROR", status: failStatus };
        throw Error("network interruption");
      }
      if (firstBody) assert.deepEqual(structuredClone(body), firstBody);
      const b = mutate(s, actor, op, body);
      b.contact = structuredClone(body.contact);
      return structuredClone(b);
    }
    return structuredClone(mutate(s, actor, op, body));
  };
  let portal;
  try { portal = await w.Concierge.startConcierge({
    api,
    journeyStep: (...a) => steps.push(a),
    expectedEnvironment: environment,
  }); } catch(error) { dom.window.close(); throw error; }
  const d = w.document;
  const click = (selector) => {
    const b = d.querySelector(selector);
    assert(b, "missing " + selector);
    b.click();
  };
  const wait = async (
    predicate = () =>
      !d.querySelector("#app[aria-busy]") && !d.querySelector(".loading"),
  ) => {
    for (let i = 0; i < 100; i++) {
      if (
        predicate() &&
        !d.querySelector("#app[aria-busy]") &&
        !d.querySelector(".loading")
      )
        return;
      await new Promise((r) => setTimeout(r, 3));
    }
    assert(predicate(), "UI did not settle");
  };
  const dates = async (kind = "stay") => {
    click(`[data-kind="${kind}"]`);
    click('[data-act="dates"]');
    if(kind!=="day") click('[data-target="a"]');
    await wait(()=>d.querySelector(`[data-day="${from}"]`) && !d.querySelector(`[data-day="${from}"]`).disabled);
    click(`[data-day="${from}"]`);
    await wait(()=>d.querySelector(`[data-day="${until}"]`) && !d.querySelector(`[data-day="${until}"]`).disabled);
    if (kind !== "day") click(`[data-day="${until}"]`);
    click('[data-act="applydates"]');
    click('[data-act="search"]');
    await wait(() => d.querySelector(".offer") || d.querySelector(".empty"));
  };
  const change = (selector, value) => {
    let el = d.querySelector(selector);
    assert(el, selector);
    el.value = value;
    el.dispatchEvent(new w.Event("input", { bubbles: true }));
    el.dispatchEvent(new w.Event("change", { bubbles: true }));
  };
  const terms = () => {
    const b = d.querySelector("#terms");
    assert(b);
    b.checked = true;
    b.dispatchEvent(new w.Event("change", { bubbles: true }));
  };
  return {
    w,
    d,
    s,
    steps,
    portal,
    dates,
    click,
    wait,
    change,
    terms,
    createCalls,
    operations,
    releaseCalendar:()=>calendarRelease?.(),
    setSigned: (v) => (signed = v),
    releaseDetail: () => detailRelease?.(),
    holdNextState: () => { holdState = true; },
    statePending: () => typeof stateRelease === "function",
    releaseState: () => stateRelease?.(),
    close: () => {
      portal.destroy();
      w.close();
    },
  };
}
test("signed-in couple compares live quotes, reviews inherited contact and creates one host-reviewed request", async () => {
  const ui = await mount();
  try {
    await ui.dates();
    assert.match(ui.d.querySelector(".offer").textContent, /₹6,000/);
    assert.match(ui.d.body.textContent, /₹7,000/);
    assert.match(ui.d.body.textContent, /₹1,000 less/);
    ui.click('[data-act="review"]');
    assert.equal(ui.d.querySelector("#phone").value, "+12025550123");
    assert(ui.d.querySelector("#email").readOnly);
    ui.terms();
    ui.click('[data-act="submit"]');
    await ui.wait(
      () =>
        ui.s.bookings.length === 1 && !ui.d.querySelector("#app[aria-busy]"),
    );
    assert.equal(ui.s.bookings[0].status, "pending_approval");
    assert.equal(ui.s.bookings[0].contact.phone, "+12025550123");
    assert.match(ui.d.body.textContent, /Your hosts take it from here/);
    ui.click("#visits");
    await ui.wait();
    ui.click("[data-booking]");
    await ui.wait();
    ui.click('[data-act="cancel"]');
    ui.click('[data-act="confirmcancel"]');
    await ui.wait();
    assert.equal(ui.s.bookings[0].status, "cancelled");
    assert.match(ui.d.body.textContent, /Cancelled/);
  } finally {
    ui.close();
  }
});
test("children recompute a valid private recommendation, preserve dates and exclude shared accommodation", async () => {
  const ui = await mount();
  try {
    await ui.dates();
    ui.click('[data-act="guests"]');
    ui.click('[data-counter="adults:1"]');
    ui.click('[data-counter="adults:1"]');
    ui.click('[data-counter="children:1"]');
    ui.click('[data-counter="children:1"]');
    ui.change('[data-age="0"]', "6");
    ui.change('[data-age="1"]', "9");
    ui.click('[data-act="applyguests"]');
    await ui.wait(() => ui.d.body.textContent.includes("₹15,000"));
    assert.equal(ui.d.querySelector('[data-select="individual"]'), null);
    assert.match(ui.d.querySelector(".quote").textContent, /additional child/);
    assert.match(
      ui.d.querySelector(".tripbar").textContent,
      /4 adults · 2 children/,
    );
  } finally {
    ui.close();
  }
});
for (const kind of ["day", "event"])
  test(
    kind + " flow skips rooms and uses server price/date semantics",
    async () => {
      const ui = await mount({
        settings: { dayAdultRate: 175000, dayStart: "07:00", dayEnd: "17:30" },
      });
      try {
        await ui.dates(kind);
        assert.equal(ui.d.querySelector('[data-act="rooms"]'), null);
        if (kind === "day") {
          assert.match(ui.d.body.textContent, /₹3,500/);
          assert.match(ui.d.body.textContent, /07:00/);
        } else {
          assert.match(ui.d.body.textContent, /₹60,000/);
          assert.match(ui.d.body.textContent, /17:30/);
        }
        ui.click('[data-act="review"]');
        ui.terms();
        ui.click('[data-act="submit"]');
        await ui.wait(() => ui.s.bookings.length === 1);
        const b = ui.s.bookings[0];
        assert.equal(b.kind, kind);
        assert.equal(b.departure, kind === "event" ? addDays(until, 1) : until);
        assert.equal(b.total, kind === "event" ? 6000000 : 350000);
      } finally {
        ui.close();
      }
    },
  );
for (const failStatus of [0, 500])
  test(
    "interrupted submit " +
      failStatus +
      " preserves the original idempotency key and exact contact payload on retry",
    async () => {
      const ui = await mount({ failCreate: true, failStatus });
      try {
        await ui.dates();
        ui.click('[data-act="review"]');
        ui.terms();
        ui.click('[data-act="submit"]');
        await ui.wait(() =>
          ui.d.body.textContent.includes("response was interrupted"),
        );
        assert.match(
          ui.d.querySelector('[data-act="submit"]').textContent,
          /Retry same/,
        );
        assert(ui.d.querySelector("#contact fieldset").disabled);
        ui.click('[data-act="submit"]');
        await ui.wait(() => ui.s.bookings.length === 1);
        assert.equal(ui.createCalls[0].key, ui.createCalls[1].key);
        assert.deepEqual(ui.createCalls[0].body, ui.createCalls[1].body);
      } finally {
        ui.close();
      }
    },
  );
test("expired quote keeps contact and notes and requires refreshed review rather than a silent repricing submit", async () => {
  const ui = await mount({ quoteStale: true });
  try {
    await ui.dates();
    ui.click('[data-act="review"]');
    ui.change("#notes", "Quiet arrival");
    ui.change("#phone", "+12025550124");
    ui.terms();
    ui.click('[data-act="submit"]');
    await ui.wait(() => ui.d.body.textContent.includes("quote expired"));
    assert.equal(ui.s.bookings.length, 0);
    assert.equal(ui.d.querySelector("#phone").value, "+12025550124");
    assert.equal(ui.d.querySelector("#notes").value, "Quiet arrival");
    assert.match(
      ui.d.querySelector('[data-act="submit"]').textContent,
      /Refresh options/,
    );
  } finally {
    ui.close();
  }
});
test("profile saves versioned contact; actor changes mask private UI and reject a delayed booking response", async () => {
  const ui = await mount({ deferDetail: true });
  try {
    await ui.dates();
    ui.click("#profile");
    ui.change("#profile-phone", "+12025550129");
    ui.click('[data-act="saveprofile"]');
    await ui.wait();
    assert.equal(ui.d.querySelector("#profile-phone").value, "+12025550129");
    ui.click("#home");
    await ui.dates();
    ui.click('[data-act="review"]');
    ui.change("#notes", "PRIVATE arrival request");
    ui.terms();
    ui.click('[data-act="submit"]');
    await ui.wait(() => ui.s.bookings.length === 1);
    ui.click("#visits");
    await ui.wait();
    ui.click("[data-booking]");
    ui.setSigned(false);
    await ui.portal.identity(null);
    assert(!ui.d.body.textContent.includes("PRIVATE arrival request"));
    ui.releaseDetail();
    await ui.wait();
    assert(!ui.d.body.textContent.includes("PRIVATE arrival request"));
    assert(!ui.d.body.textContent.includes("+12025550129"));
  } finally {
    ui.close();
  }
});
test("guest concierge contains no fixture service, fixed dates or sample identities", async () => {
  const source = await readFile("website/booking-concierge.mjs", "utf8");
  assert.doesNotMatch(
    source,
    /demo\/options|2026-12-|meera@example|REVIEW-0147|localhost|8898/,
  );
  assert.match(source, /api\("create"/);
  assert.match(source, /getIdentity/);
});

test("named-room override stays uncommitted until a server quote, then updates full price; notes refresh their version", async () => {
  const ui = await mount();
  try {
    ui.s.units.find((u) => u.id === "tree-1").rate = 800000;
    await ui.dates();
    ui.click('[data-act="rooms"]');
    for (const id of ["cottage-1", "tree-1"]) {
      const el = ui.d.querySelector(`[data-room="${id}"]`);
      el.checked = !el.checked;
      el.dispatchEvent(new ui.w.Event("change", { bubbles: true }));
    }
    assert(ui.d.querySelector('[data-act="review"]').disabled);
    ui.click('[data-act="applyrooms"]');
    await ui.wait();
    assert.match(ui.d.querySelector(".quote").textContent, /₹8,000/);
    assert.match(ui.d.querySelector(".quote").textContent, /Tree house 01/);
    ui.click('[data-act="review"]');
    ui.terms();
    ui.click('[data-act="submit"]');
    await ui.wait(() => ui.s.bookings.length === 1);
    ui.click('[data-act="editnote"]');
    ui.change("#booking-note", "A later arrival");
    ui.click('[data-act="savenote"]');
    await ui.wait();
    assert.match(
      ui.d.querySelector(".confirmation").textContent,
      /A later arrival/,
    );
  } finally {
    ui.close();
  }
});

test("first Google-session completion preserves anonymous dates and party planning", async () => {
  const ui = await mount({ anonymous: true, authEvent: true });
  try {
    await ui.dates();
    assert.match(ui.d.querySelector(".tripbar").textContent, /2 adults/);
    assert.match(ui.d.body.textContent, /Here’s what fits your plans/);
    assert.match(ui.d.body.textContent, /₹6,000/);
  } finally {
    ui.close();
  }
});

test("invalid profile and child-age forms emit bounded failure observations without submitting", async () => {
  const ui = await mount();
  try {
    ui.click("#profile");
    ui.change("#profile-phone", "");
    ui.click('[data-act="saveprofile"]');
    assert(
      ui.steps.some(
        ([step, outcome]) => step === "profile" && outcome === "failed",
      ),
    );
    ui.click("#home");
    ui.click('[data-act="guests"]');
    ui.click('[data-counter="children:1"]');
    ui.click('[data-act="applyguests"]');
    assert(
      ui.steps.some(
        ([step, outcome]) => step === "dates" && outcome === "failed",
      ),
    );
    assert.equal(ui.s.bookings.length, 0);
  } finally {
    ui.close();
  }
});

for (const environment of ['production','pre-prod']) {
  test('matching '+environment+' service boots anonymously and continues to real-domain quotes',async()=>{
    const ui=await mount({environment,anonymous:true});
    try{assert.match(ui.d.body.textContent,/Make time/);await ui.dates();assert.match(ui.d.body.textContent,/Here’s what fits your plans/);assert.match(ui.d.body.textContent,/₹6,000/);}finally{ui.close();}
  });
  test(environment+' rejects a response from the opposite booking environment',async()=>{
    await assert.rejects(mount({environment,serverEnvironment:environment==='production'?'pre-prod':'production'}),error=>error.code==='WRONG_ENVIRONMENT');
  });
}

test('account loss clears private account dialogs immediately',async()=>{
  const ui=await mount();
  try{ui.click('#account');assert.match(ui.d.querySelector('#sheet-content').textContent,/guest@example.test/);ui.setSigned(false);await ui.portal.identity(null);assert.equal(ui.d.querySelector('#sheet').open,false);assert(!ui.d.querySelector('#sheet-content').textContent.includes('guest@example.test'));}finally{ui.close();}
});


test('late account-state responses cannot restore a signed-out profile',async()=>{
  const ui=await mount();
  try{ui.holdNextState();ui.click('#visits');for(let i=0;i<50&&!ui.statePending();i++)await new Promise(r=>setTimeout(r,2));assert(ui.statePending());ui.setSigned(false);await ui.portal.identity(null);ui.releaseState();await ui.wait();assert.equal(ui.d.querySelector('#account').textContent,'Sign in');}finally{ui.releaseState();ui.close();}
});

test("calendar fails closed, retries and disables blocked range before submission",async()=>{
 const ui=await mount({failCalendar:true});
 try {
  ui.s.blocks.push({unitId:"site",arrival:from,departure:until});
  ui.click('[data-act="dates"]');
  await ui.wait(()=>ui.d.querySelector('[data-act="retrycalendar"]'));
  assert(ui.d.querySelector(`[data-day="${from}"]`).disabled);
  assert(ui.d.querySelector('[data-act="applydates"]').disabled);
  ui.click('[data-act="retrycalendar"]');
  await ui.wait(()=>!ui.d.querySelector('[data-act="retrycalendar"]') && !ui.d.body.textContent.includes('Checking dates'));
  assert(ui.d.querySelector(`[data-day="${from}"]`).disabled);
  assert(!ui.d.querySelector(`[data-day="${until}"]`).disabled);
  ui.click(`[data-day="${from}"]`);
  assert(ui.d.querySelector('[data-target="a"]').textContent.includes('Choose a date'));
 } finally{ui.close();}
});
test("private exclusive dates show an honest booked marker without exposing customer details",async()=>{
 const ui=await mount();
 try{
  ui.s.bookings.push({id:'private-reservation',owner:'external-private',kind:'event',source:'host_private',status:'confirmed',arrival:from,departure:until,adults:0,guests:0,children:0,units:[],allocations:[],startsAt:Date.parse(from+'T06:00:00+05:30'),endsAt:Date.parse(until+'T18:00:00+05:30')-86400000});
  ui.click('[data-act="dates"]');await ui.wait(()=>!ui.d.body.textContent.includes('Checking dates'));
  const cell=ui.d.querySelector(`[data-day="${from}"]`);assert(cell.disabled);assert.equal(cell.title,'Already booked');assert.ok(cell.classList.contains('booked'));assert.match(cell.textContent,/Booked/);assert.match(cell.getAttribute('aria-label'),/already booked/);assert.ok(!ui.d.body.textContent.includes('external-private'));
 }finally{ui.close();}
});
test("late calendar response cannot reopen a dismissed dialog",async()=>{
 const ui=await mount({deferCalendar:true});
 try{
  ui.click('[data-act="dates"]');ui.d.querySelector('#sheet').close();ui.releaseCalendar();
  await new Promise(r=>setTimeout(r,5));assert.equal(ui.d.querySelector('#sheet').open,false);
 }finally{ui.close();}
});

test("homepage return link is visible and a completed sign-in redirect stops booking work",async()=>{
 const ui=await mount({anonymous:true,sessionRedirect:true});
 try{
  assert.equal(ui.d.querySelector('.website-return a').getAttribute('href'),'/');
  assert.match(ui.d.querySelector('.website-return').textContent,/Back to website/);
  ui.click('[data-act="search"]'); // no dates: date picker first
  await ui.wait(()=>!ui.d.body.textContent.includes('Checking dates'));
  ui.click(`[data-day="${from}"]`);
  await ui.wait(()=>!ui.d.querySelector(`[data-day="${until}"]`).disabled);
  ui.click(`[data-day="${until}"]`);ui.click('[data-act="applydates"]');ui.click('[data-act="search"]');
  await ui.wait(()=>ui.operations.includes('session'));
  assert(!ui.operations.includes('availability'));assert(!ui.operations.includes('quote'));assert.equal(ui.s.bookings.length,0);
 }finally{ui.close();}
});
