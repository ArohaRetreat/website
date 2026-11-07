import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { visitDateLabel } from "../website/booking-visit-label.mjs";
import { JSDOM } from "jsdom";
import { initialState, tier } from "../functions/booking/domain.mjs";
async function mount(reduced = false) {
  const dom = new JSDOM(
    '<div id="app"></div><div id="toast"></div><dialog id="detail"></dialog>',
    {
      url: "https://aroharetreat.com/book/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  const w = dom.window,
    d = w.document,
    s = initialState(),
    animations = [];
  w.scrollTo = () => {};
  w.testVisitDateLabel = visitDateLabel;
  const media = new w.EventTarget();
  media.matches = reduced;
  w.matchMedia = () => media;
  w.Element.prototype.animate = function (frames, options) {
    let resolve, reject;
    const finished = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    const a = {
      element: this,
      frames,
      options,
      finished,
      cancelled: false,
      cancel() {
        this.cancelled = true;
        reject(new Error("cancelled"));
      },
      finish: resolve,
    };
    animations.push(a);
    return a;
  };
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new w.Event("close"));
  };
  w.testBookingApi = async () =>
    structuredClone({
      actor: null,
      settings: s.settings,
      units: s.units,
      bookings: [],
      promos: [],
      blocks: [],
      users: [],
      audit: [],
      loyalty: tier(s, "guest"),
    });
  const source = (
    await readFile(new URL("../website/booking.mjs", import.meta.url), "utf8")
  )
    .replace(/import \{visitDateLabel\} from "\.\/booking-visit-label.mjs";/, "const visitDateLabel=window.testVisitDateLabel;")
    .replace(/import \{[^\n]+\} from ['"]\.\/material-controls.mjs['"];/, 'const installMaterialControls=()=>{},confirmMaterial=async()=>window.confirm();')
    .replace(/import \{hostShell,mountFrontDesk\} from '\.\/frontdesk.mjs';/,'const hostShell=({content})=>content,mountFrontDesk=async()=>{};').replace(/import \{mountHostOperations,mountHostSummary,openManualBooking\} from '\.\/host-operations.mjs';/, 'const mountHostOperations=async()=>{},mountHostSummary=async()=>{},openManualBooking=()=>{};').replace(/import \{auth\} from '\.\/firebase-auth.mjs';/, 'const auth={currentUser:null};').replace(/import \{mountStayPanel\} from '\.\/stay-panel.mjs';/, "").replace(
      /import \{\s*journeyStep\s*\} from "\.\/booking-journey.mjs";/,
      "const journeyStep=()=>{};",
    )
    .replace(
      /import \{ bookingApi \} from "\.\/booking-api.mjs";/,
      "const bookingApi=window.testBookingApi; const mountStayPanel=async()=>{};",
    );
  await w.eval("(async()=>{" + source + "})()");
  await new Promise((r) => setTimeout(r, 5));
  for (const a of animations) a.finish();
  return {
    w,
    d,
    media,
    animations,
    flush: async () => {
      await Promise.resolve();
      await Promise.resolve();
    },
    close: () => w.close(),
  };
}
test("calendar changes cancel interrupted motion, preserve focus and selected dates", async () => {
  const ui = await mount();
  try {
    const { d, animations, flush } = ui;
    const before = d.querySelector('[name="arrival"]').value;
    const next = d.querySelector('[data-month="1"]');
    next.focus();
    next.click();
    const a = animations.at(-1);
    assert.equal(a.element.className, "month-grid");
    d.querySelector('[data-month="1"]').click();
    assert.equal(a.cancelled, true);
    assert.equal(d.activeElement.dataset.month, "1");
    assert.equal(d.querySelector('[name="arrival"]').value, before);
    animations.at(-1).finish();
    await flush();
  } finally {
    ui.close();
  }
});
test("dialog exit can be interrupted by a replacement without closing it; native close restores focus", async () => {
  const ui = await mount();
  try {
    const { d, animations, flush } = ui;
    const account = d.querySelector("#account");
    account.focus();
    account.click();
    const dialog = d.querySelector("dialog");
    assert.equal(dialog.open, true);
    d.querySelector("[data-close]").click();
    const exit = animations.at(-1);
    assert.equal(dialog.open, true);
    account.click();
    assert.equal(exit.cancelled, true);
    await flush();
    assert.equal(dialog.open, true);
    d.querySelector("[data-close]").click();
    animations.at(-1).finish();
    await flush();
    assert.equal(dialog.open, false);
    assert.equal(d.activeElement, account);
  } finally {
    ui.close();
  }
});
test("reduced motion and keyboard actions are immediate; preference change and pagehide clean up animation", async () => {
  const ui = await mount(true);
  try {
    const { w, d, media, animations, flush } = ui;
    d.querySelector("#account").click();
    d.querySelector("[data-close]").click();
    assert.equal(d.querySelector("dialog").open, false);
    assert.equal(animations.length, 0);
    media.matches = false;
    w.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter" }));
    d.querySelector('[data-month="1"]').click();
    assert.equal(animations.length, 0);
    w.dispatchEvent(new w.Event("pointerdown"));
    d.querySelector("#account").click();
    assert.ok(animations.length);
    d.querySelector("[data-close]").click();
    const exit = animations.at(-1);
    media.matches = true;
    media.dispatchEvent(
      Object.assign(new w.Event("change"), { matches: true }),
    );
    await flush();
    assert.equal(exit.cancelled, true);
    assert.equal(d.querySelector("dialog").open, false);
    media.matches = false;
    d.querySelector("#account").click();
    const entrance = animations.at(-1);
    w.dispatchEvent(new w.Event("pagehide"));
    assert.equal(entrance.cancelled, true);
  } finally {
    ui.close();
  }
});
test("day and sunset text/action pairs meet AA contrast using the stylesheet palette", async () => {
  const css = await readFile(
    new URL("../website/booking.css", import.meta.url),
    "utf8",
  );
  const dom = new JSDOM("<style>" + css + "</style>");
  try {
    const rules = [...dom.window.document.styleSheets[0].cssRules];
    const tokens = (selector, base = {}) => {
      const out = { ...base };
      for (const r of rules.filter((r) => r.selectorText === selector))
        for (let i = 0; i < r.style.length; i++) {
          const k = r.style[i];
          if (k.startsWith("--")) out[k] = r.style.getPropertyValue(k).trim();
        }
      return out;
    };
    const lum = (hex) => {
      const a = hex
        .slice(1)
        .match(/../g)
        .map((h) => parseInt(h, 16) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    };
    const day = tokens(":root");
    for (const [name, p] of [
      ["day", day],
      ["sunset", tokens('html[data-atmosphere="sunset"]', day)],
    ])
      for (const [fg, bg] of [
        ["--ink", "--ground"],
        ["--ink", "--paper"],
        ["--muted", "--paper"],
        ["--muted", "--field"],
        ["--muted", "--raised"],
        ["--control-line", "--field"],
        ["--accent", "--soft"],
        ["--action-ink", "--action"],
      ]) {
        const a = lum(p[fg]),
          b = lum(p[bg]),
          ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        assert.ok(
          ratio >= (fg === "--control-line" ? 3 : 4.5),
          `${name} ${fg}/${bg}: ${ratio}`,
        );
      }
  } finally {
    dom.window.close();
  }
});
