import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { orbitPose } from "../website/botanical-motion.mjs";
import { startWelcome } from "../website/welcome.mjs";
import { validateContent, validateNature } from "../functions/domain.mjs";
import { renderSite } from "../website/render.mjs";
const read = async (name) =>
  JSON.parse(await readFile(new URL(name, import.meta.url)));
const nature = await read("../website/nature-content.json");
const content = await read("../website/content.json");
const tour = await read("../website/tour-content.json");

test("photographic orbit is reversible, centered, symmetric and bounded across every route stop", () => {
  for (const radius of [281.6, 640, 1100]) {
    for (let i = 0; i < 11; i++) {
      const centered = orbitPose(i, i, { radius });
      assert.equal(centered.x, 0);
      assert.equal(centered.z, 0);
      assert.equal(centered.visible, true);
      const before = orbitPose(i, i - 0.7, { radius });
      const after = orbitPose(i, i + 0.7, { radius });
      assert.ok(Math.abs(before.x + after.x) < 1e-8);
      assert.ok(Math.abs(before.z - after.z) < 1e-8);
      for (let center = -0.4; center <= 10.6; center += 0.1) {
        const pose = orbitPose(i, center, { radius });
        assert.ok(Number.isFinite(pose.x) && Number.isFinite(pose.z));
        assert.ok(Math.abs(pose.x) <= radius);
        assert.ok(pose.z <= 0 && pose.z >= -2 * radius);
      }
      assert.deepEqual(orbitPose(i, i - 0.7, { radius }), before);
    }
  }
  assert.equal(orbitPose(10, 0).visible, false);
});

test("nature settings are additive, escaped, bounded and restricted to allowed media", () => {
  validateContent({ ...content, tour }); // Old records continue to work.
  const c = {
    ...structuredClone(content),
    tour: { ...structuredClone(tour), nature: structuredClone(nature) },
  };
  validateContent(c);
  c.tour.nature.title = '<img src=x onerror="alert(1)">';
  assert.ok(renderSite(c).includes("&lt;img src=x"));
  assert.ok(!renderSite(c).includes("<img src=x"));
  for (const edit of [
    (n) => (n.leafImage = "javascript:alert(1)"),
    (n) => (n.plantImage = "https://unknown.example/tracker.webp"),
    (n) => (n.enabled = "true"),
    (n) => n.items.push(...structuredClone(n.items)),
    (n) => (n.items[0].value = "x".repeat(81)),
    (n) => (n.script = "alert(1)"),
    (n) => (n.heroEveningImage = "https://unknown.example/tracker.webp"),
    (n) => (n.heroEveningAlt = "x".repeat(251)),
  ]) {
    const n = structuredClone(nature);
    edit(n);
    assert.throws(() => validateNature(n));
  }
  c.tour.nature.enabled = false;
  assert.ok(!renderSite(c).includes('class="hero-garden"'));
  assert.ok(!renderSite(c).includes('class="nature-story"'));
});

function welcomeFixture(t, reduced = false) {
  const handlers = new Map(),
    classes = new Set();
  const skip = {};
  const welcome = {
    removed: false,
    inert: false,
    querySelector: () => skip,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
    setAttribute() {},
    addEventListener() {},
    remove() {
      this.removed = true;
    },
  };
  const root = { inert: false, querySelector: () => ({ focus() {} }) };
  const doc = {
    hidden: false,
    activeElement: null,
    getElementById: () => welcome,
    documentElement: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
      },
    },
    addEventListener: (name, fn) => handlers.set(name, fn),
    removeEventListener: (name) => handlers.delete(name),
  };
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const oldMedia = Object.getOwnPropertyDescriptor(globalThis, "matchMedia");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: doc,
  });
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    value: () => ({ matches: reduced }),
  });
  t.after(() => {
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else delete globalThis.document;
    if (oldMedia) Object.defineProperty(globalThis, "matchMedia", oldMedia);
    else delete globalThis.matchMedia;
  });
  return { root, welcome, skip, doc, handlers, classes };
}

test("welcome keeps the grown plant through the reveal, then releases reading exactly once", async (t) => {
  const f = welcomeFixture(t);
  let update,
    endReveal,
    disposed = 0,
    cancelled = 0,
    held = 0;
  const finish = startWelcome(f.root, nature, {
    scenePlayer: (_root, kind, callback) => {
      assert.equal(kind, "seed");
      update = callback;
      return {
        play() {},
        seek(p) {
          assert.equal(p, 1);
          held++;
        },
        dispose() {
          disposed++;
        },
      };
    },
    reveal: () => ({
      finished: new Promise((resolve) => (endReveal = resolve)),
      cancel() {
        cancelled++;
      },
    }),
  });
  update({ state: "complete" });
  assert.equal(f.root.inert, true);
  assert.equal(disposed, 0); // Never reset the visible sprout at the handoff.
  assert.equal(held, 1);
  assert.ok(f.classes.has("arrival-opening"));
  update({ state: "complete" });
  assert.equal(held, 1);
  endReveal();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.root.inert, false);
  assert.equal(disposed, 1);
  assert.equal(cancelled, 1);
  assert.ok(!f.classes.has("arrival-opening"));
  assert.ok(f.classes.has("welcome-complete"));
  assert.equal(f.handlers.size, 0);
  finish();
  finish();
  assert.equal(disposed, 1);
  t.mock.timers.tick(200);
  assert.equal(f.welcome.removed, true);
});

test("welcome fail-open, Skip, tab hiding and reveal failure cannot leave the page inert", async (t) => {
  for (const cause of [
    "skip",
    "opening-skip",
    "timeout",
    "hidden",
    "player-failure",
    "reveal-failure",
  ]) {
    await t.test(cause, async (t) => {
      const f = welcomeFixture(t);
      let update;
      const finish = startWelcome(f.root, nature, {
        scenePlayer: (_root, _kind, callback) => {
          update = callback;
          if (cause === "player-failure") throw Error("Unavailable");
          return { play() {}, seek() {}, dispose() {} };
        },
        reveal: () => {
          if (cause === "reveal-failure") throw Error("Unavailable");
          return { finished: new Promise(() => {}), cancel() {} };
        },
      });
      if (cause === "opening-skip" || cause === "reveal-failure")
        update({ state: "complete" });
      if (cause === "skip" || cause === "opening-skip") f.skip.onclick();
      if (cause === "timeout") {
        t.mock.timers.tick(3200);
        assert.equal(f.root.inert, true);
        t.mock.timers.tick(2900);
      }
      if (cause === "hidden") {
        f.doc.hidden = true;
        f.handlers.get("visibilitychange")();
      }
      assert.equal(f.root.inert, false);
      assert.equal(f.welcome.inert, true);
      assert.equal(f.handlers.size, 0);
      finish();
      t.mock.timers.tick(200);
      assert.equal(f.welcome.removed, true);
    });
  }
});

test("Simple View and reduced motion bypass the welcome without locking the page", async (t) => {
  for (const reduced of [false, true])
    await t.test(String(reduced), (t) => {
      const f = welcomeFixture(t, reduced);
      startWelcome(f.root, nature, {
        enabled: reduced,
        scenePlayer: () => {
          throw Error("must not start");
        },
      });
      assert.equal(f.root.inert, false);
      assert.equal(f.welcome.removed, true);
      assert.equal(f.handlers.size, 0);
    });
});

test("calligraphy is limited to short, escaped invitation lines", async () => {
  const { heroTitle } = await import("../website/nature-render.mjs");
  const { esc } = await import("../website/render.mjs");
  assert.ok(
    heroTitle("Leave the world\nat the gate.", esc).includes(
      "hero-handwritten",
    ),
  );
  assert.ok(
    !heroTitle("An invitation without a line break", esc).includes(
      "hero-handwritten",
    ),
  );
  assert.ok(
    !heroTitle(
      "Heading\nThis is a very long sentence with many words",
      esc,
    ).includes("hero-handwritten"),
  );
  assert.ok(!heroTitle("Heading\n<img src=x>", esc).includes("<img"));
});

test("background arrivals bypass animation instead of waiting unseen", (t) => {
  const f = welcomeFixture(t);
  f.doc.hidden = true;
  startWelcome(f.root, nature, {
    scenePlayer: () => {
      throw Error("must not start");
    },
  });
  assert.equal(f.root.inert, false);
  assert.equal(f.welcome.removed, true);
});
