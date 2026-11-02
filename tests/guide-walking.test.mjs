import test from "node:test";
import assert from "node:assert/strict";
import {
  walkingDirection,
  sampleGuidePath,
} from "../website/guide-walking.mjs";
test("map headings follow front, back, right and left travel with diagonal hysteresis", () => {
  assert.equal(walkingDirection(0, -10), "north");
  assert.equal(walkingDirection(0, 10), "south");
  assert.equal(walkingDirection(10, 0), "east");
  assert.equal(walkingDirection(-10, 0), "west");
  assert.equal(walkingDirection(10, 9, "east"), "east");
  assert.equal(walkingDirection(0, 0, "west"), "west");
});
test("path stepping follows every bend and reverses rather than cutting diagonally", () => {
  const path = [
    { x: 0, y: 100 },
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ];
  assert.deepEqual(sampleGuidePath(path, 50).point, { x: 0, y: 50 });
  assert.deepEqual(sampleGuidePath(path, 150).point, { x: 50, y: 0 });
  assert.equal(sampleGuidePath(path, 200).done, true);
  const reverse = [...path].reverse();
  assert.deepEqual(sampleGuidePath(reverse, 150).point, { x: 0, y: 50 });
});

test("gait advances with travel, pauses without a jump, and cancels on disposal", async () => {
  const original = Object.fromEntries(
    ["requestAnimationFrame", "cancelAnimationFrame"].map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  );
  let nextId = 0;
  const frames = new Map();
  globalThis.requestAnimationFrame = (fn) => {
    frames.set(++nextId, fn);
    return nextId;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const style = {
    values: {},
    setProperty(k, v) {
      this.values[k] = v;
    },
  };
  const classes = new Set();
  const traveller = { style: {} },
    viewport = { clientHeight: 80 },
    sheet = {
      dataset: { src: "/sheet.webp" },
      getAttribute() {
        return this.src;
      },
      decode: async () => {},
    };
  const rail = {
    dataset: {},
    style,
    classList: {
      add: (v) => classes.add(v),
      remove: (v) => classes.delete(v),
      toggle(v, on) {
        on ? classes.add(v) : classes.delete(v);
      },
    },
    querySelector: (s) =>
      s.includes("traveller")
        ? traveller
        : s.includes("sheet")
          ? sheet
          : viewport,
  };
  function tick(t) {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((fn) => fn(t));
  }
  try {
    const { createGuideWalker } = await import("../website/guide-walking.mjs");
    const walker = createGuideWalker(rail, {
      transform: (p) => `${p.x},${p.y}`,
    });
    await walker.walk([{ x: 100, y: 0 }]);
    tick(100);
    tick(150);
    assert.equal(walker.position.x, 5);
    assert.equal(rail.dataset.direction, "east");
    walker.pause(true);
    const phase = style.values["--guide-frame-x"];
    tick(10000);
    assert.equal(walker.position.x, 5);
    assert.equal(style.values["--guide-frame-x"], phase);
    walker.pause(false);
    tick(11000);
    assert.equal(walker.position.x, 5);
    tick(11050);
    assert.equal(walker.position.x, 10);
    await walker.walk([{ x: 0, y: 0 }]);
    tick(11100);
    assert.equal(rail.dataset.direction, "west");
    walker.destroy();
    assert.equal(frames.size, 0);
    assert.equal(walker.walking, false);
  } finally {
    for (const [k, v] of Object.entries(original)) {
      if (v) Object.defineProperty(globalThis, k, v);
      else delete globalThis[k];
    }
  }
});
