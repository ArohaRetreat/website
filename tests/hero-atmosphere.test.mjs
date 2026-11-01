import test from "node:test";
import assert from "node:assert/strict";
import { createHeroAtmosphere } from "../website/hero-atmosphere.mjs";
function fixture() {
  const attr = () => ({
    values: new Map(),
    setAttribute(k, v) {
      this.values.set(k, v);
    },
    removeAttribute(k) {
      this.values.delete(k);
    },
    getAttribute(k) {
      return this.values.get(k);
    },
  });
  const buttons = ["day", "evening"].map((value) => ({
    ...attr(),
    dataset: { heroMoment: value },
    addEventListener(_t, fn) {
      this.click = () => fn({ currentTarget: this });
    },
    removeEventListener() {
      delete this.click;
    },
  }));
  const classes = new Set();
  const hero = {
    classList: {
      toggle(k, v) {
        if (v) classes.add(k);
        else classes.delete(k);
      },
    },
  };
  const day = attr(),
    night = attr(),
    status = { textContent: "" };
  let decode, reject;
  const image = {
    ...attr(),
    dataset: { src: "/assets/retreat/DSC_3780.webp" },
    decode() {
      return new Promise((a, b) => {
        decode = a;
        reject = b;
      });
    },
    set src(value) {
      this.setAttribute("src", value);
    },
  };
  night.querySelector = () => image;
  const root = {
    querySelector(selector) {
      return {
        ".field-hero": hero,
        ".hero-day": day,
        ".hero-night": night,
        "#hero-moment-status": status,
      }[selector];
    },
    querySelectorAll() {
      return buttons;
    },
  };
  const control = createHeroAtmosphere(root);
  return {
    buttons,
    classes,
    image,
    day,
    night,
    status,
    control,
    loaded() {
      decode();
    },
    failed() {
      reject(Error("network"));
    },
  };
}
test("hero night photo loads on demand and a newer day choice wins the decode race", async () => {
  const f = fixture();
  assert.equal(f.image.getAttribute("src"), undefined);
  const pending = f.buttons[1].click();
  assert.equal(f.image.getAttribute("src"), "/assets/retreat/DSC_3780.webp");
  await f.buttons[0].click();
  f.loaded();
  await pending;
  assert.equal(f.classes.has("is-dusk"), false);
  assert.equal(f.buttons[0].getAttribute("aria-pressed"), "true");
  const next = f.buttons[1].click();
  f.loaded();
  await next;
  assert.ok(f.classes.has("is-dusk"));
  assert.equal(f.night.getAttribute("aria-hidden"), "false");
  assert.equal(f.day.getAttribute("aria-hidden"), "true");
});
test("failed or disposed photo requests retain a working day view without stale mutations", async () => {
  const f = fixture();
  const pending = f.buttons[1].click();
  f.failed();
  await pending;
  assert.equal(f.classes.has("is-dusk"), false);
  assert.match(f.status.textContent, /could not load/);
  assert.equal(f.image.getAttribute("src"), undefined);
  const next = f.buttons[1].click();
  f.control.destroy();
  f.loaded();
  await next;
  assert.equal(f.classes.has("is-dusk"), false);
  assert.equal(f.buttons[1].click, undefined);
});
