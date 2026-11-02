import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  gatePose,
  createGateSeeker,
  renderGateWelcome,
  hrudhiIntroduction,
} from "../website/hrudhi-gate.mjs";
import { natureContent } from "../website/nature-render.mjs";
import { validateNature } from "../functions/domain.mjs";
import { esc, renderSite, picture } from "../website/render.mjs";
const nature = JSON.parse(
  await readFile(new URL("../website/nature-content.json", import.meta.url)),
);
const content = JSON.parse(
  await readFile(new URL("../website/content.json", import.meta.url)),
);
function film() {
  const events = new Map();
  let time = 0;
  const writes = [];
  return {
    duration: 8,
    readyState: 1,
    seeking: false,
    writes,
    get currentTime() {
      return time;
    },
    set currentTime(v) {
      time = v;
      this.seeking = true;
      writes.push(v);
    },
    addEventListener(k, f) {
      events.set(k, f);
    },
    removeEventListener(k) {
      events.delete(k);
    },
    finish() {
      this.seeking = false;
      events.get("seeked")?.();
    },
    event(k) {
      events.get(k)?.();
    },
  };
}
test("gate seeking coalesces fast scroll/reversal into the latest destination", () => {
  const v = film(),
    s = createGateSeeker(v);
  s.seek(4);
  s.seek(7);
  s.seek(1);
  assert.deepEqual(v.writes, [4]);
  v.finish();
  assert.deepEqual(v.writes, [4, 1]);
  v.finish();
  assert.equal(v.writes.length, 2);
  s.block(true);
  s.seek(6);
  assert.equal(v.writes.length, 2);
  s.block(false);
  assert.equal(v.writes.at(-1), 6);
  s.destroy();
  v.finish();
  s.seek(3);
  assert.equal(v.writes.at(-1), 6);
});
test("metadata waits and duration bounds do not seek outside the decoded film", () => {
  const v = film();
  v.readyState = 0;
  const s = createGateSeeker(v);
  s.seek(10);
  assert.equal(v.writes.length, 0);
  v.readyState = 1;
  v.event("loadedmetadata");
  assert.equal(v.writes[0], 8 - 1 / 60);
  s.destroy();
  v.event("loadedmetadata");
  assert.equal(v.writes.length, 1);
  for (const p of [-2, 0, 0.25, 0.5, 1, 5]) {
    const pose = gatePose(p);
    assert.ok(pose.time >= 0 && pose.time < 8);
    assert.ok(pose.x >= 0.14 && pose.x <= 0.46);
  }
});
test("legacy nature data remains valid; Hrudhi fields are bounded and media allowlisted", () => {
  const old = structuredClone(nature);
  delete old.hrudhi;
  validateNature(old);
  assert.equal(natureContent({ nature: old }).hrudhi.film, nature.hrudhi.film);
  validateNature(nature);
  for (const [key, value] of [
    ["film", "https://untrusted.example/film.mp4"],
    ["portrait", "javascript:alert(1)"],
    ["bio", "x".repeat(2001)],
    ["enabled", "yes"],
  ]) {
    const bad = structuredClone(nature);
    bad.hrudhi[key] = value;
    assert.throws(() => validateNature(bad));
  }
});
test("welcome uses no initial film source, escapes CMS prose and preserves bypass/hidden controls", () => {
  const n = structuredClone(nature);
  n.hrudhi.invitation = "<img onerror=alert(1)>";
  const html = renderGateWelcome(n, {}, { esc });
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img onerror"));
  assert.match(html, /<video[^>]*preload="none"[^>]*>/);
  assert.doesNotMatch(html, /<video[^>]*src=/);
  assert.ok(html.includes('href="#journey"'));
  assert.match(html, /class="hrudhi-character"[^>]*hidden/);
  assert.match(html, /src="\/assets\/retreat\/hrudhi-gate-open-v1.webp"/);
  assert.equal(
    renderGateWelcome(
      { ...n, hrudhi: { ...n.hrudhi, enabled: false } },
      {},
      { esc },
    ),
    "",
  );
  const intro = hrudhiIntroduction(
    { ...n.hrudhi, bio: "<script>unsafe</script>" },
    { esc, picture },
  );
  assert.ok(intro.includes("&lt;script&gt;"));
  const home = renderSite(content);
  assert.ok(home.includes('id="hrudhi-welcome"'));
  assert.ok(
    home.indexOf('class="field-tour-stage"') <
      home.indexOf('id="hrudhi-welcome"'),
  );
  assert.ok(
    home.indexOf('id="hrudhi-welcome"') < home.indexOf('id="tour-visual"'),
  );
  assert.ok(
    !/Simple view|view-toggle|data-menu-simple|data-simple-view/i.test(home),
  );
  assert.ok(!home.includes("tour-threshold"));
  const hidden = structuredClone(content);
  hidden.sections.find((s) => s.id === "journey").visible = false;
  assert.ok(!renderSite(hidden).includes('id="hrudhi-welcome"'));
});

test("Disabled motion, reduced motion and Save-Data keep films unfetched and dispose listeners", async () => {
  const { createGateWelcome } = await import("../website/hrudhi-gate.mjs");
  const originals = new Map(
    [
      "matchMedia",
      "navigator",
      "window",
      "document",
      "MutationObserver",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ].map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]),
  );
  try {
    for (const mode of ["simple", "reduced", "data"]) {
      const eventTarget = { addEventListener() {}, removeEventListener() {} };
      for (const [k, v] of Object.entries({
        window: eventTarget,
        document: { ...eventTarget, hidden: false },
        MutationObserver: class {
          observe() {}
          disconnect() {}
        },
        requestAnimationFrame: () => 1,
        cancelAnimationFrame: () => {},
      }))
        Object.defineProperty(globalThis, k, { configurable: true, value: v });
      Object.defineProperty(globalThis, "matchMedia", {
        configurable: true,
        value: () => ({ matches: mode === "reduced" }),
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: { connection: { saveData: mode === "data" } },
      });
      let sources = 0,
        removed = 0;
      const events = new Map();
      const button = {
        addEventListener(k, f) {
          events.set(k, f);
        },
        removeEventListener() {
          removed++;
        },
      };
      const video = {
        pause() {},
        load() {},
        removeAttribute() {},
        set src(v) {
          sources++;
        },
      };
      const section = {
        querySelector: (q) =>
          q === "video"
            ? video
            : q === ".hrudhi-meet" || q === ".hrudhi-character"
              ? button
              : button,
        dataset: {},
      };
      const controller = createGateWelcome(
        {
          querySelector: (q) =>
            q === "#journey"
              ? { insertBefore() {}, querySelector() {} }
              : q === ".field-tour-stage"
                ? { children: [] }
                : section,
          querySelectorAll: () => [],
        },
        nature.hrudhi,
        { motion: mode !== "simple", meet() {} },
      );
      assert.equal(sources, 0);
      assert.equal(section.dataset.gate, mode === "data" ? "still" : "reading");
      controller.destroy();
      assert.equal(sources, 0);
      assert.ok(removed >= 3);
    }
  } finally {
    for (const [k, v] of originals)
      if (v) Object.defineProperty(globalThis, k, v);
      else delete globalThis[k];
  }
});
