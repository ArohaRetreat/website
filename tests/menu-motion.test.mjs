import test from "node:test";
import assert from "node:assert/strict";
import { createMenuMotion } from "../website/menu-motion.mjs";

function fixture(enabled = () => true) {
  const effects = [];
  const animate = () => {
    let resolve, reject;
    const a = {
      currentTime: 140,
      finished: new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      }),
      cancel() {
        reject(new Error("cancelled"));
      },
      updatePlaybackRate(rate) {
        this.rate = rate;
      },
      play() {},
      finish() {
        resolve();
      },
    };
    effects.push(a);
    return a;
  };
  const dialog = {
    dataset: {},
    animate,
    querySelectorAll: () => [{ animate }, { animate }],
  };
  return {
    effects,
    dialog,
    scene: createMenuMotion(dialog, {
      enabled,
      styles: () => ({ getPropertyValue: () => "" }),
    }),
  };
}
const flush = async () => {
  await new Promise((resolve) => setImmediate(resolve));
};

test("closing an opening menu reverses current effects and waits before releasing its modal", async () => {
  const f = fixture();
  f.scene.enter();
  let closed = 0;
  f.scene.exit(() => closed++);
  f.scene.exit(() => (closed += 100));
  assert.equal(closed, 0);
  assert.equal(f.dialog.dataset.menuPhase, "closing");
  assert.ok(f.effects.every((a) => a.rate < 0 && a.currentTime === 140));
  f.effects[0].finish();
  await flush();
  assert.equal(closed, 0);
  f.effects.forEach((a) => a.finish());
  await flush();
  assert.equal(closed, 1);
  assert.equal(f.dialog.dataset.menuPhase, undefined);
});

test("a new entrance or destroyed controller cannot execute stale close actions", async () => {
  for (const action of ["enter", "destroy"]) {
    const f = fixture();
    f.scene.enter();
    let closed = false;
    f.scene.exit(() => {
      closed = true;
    });
    f.scene[action]();
    f.effects.forEach((a) => a.finish());
    await flush();
    assert.equal(closed, false, action);
    f.scene.destroy();
  }
  await flush();
});

test("static and keyboard closes do not wait; reduced motion can finish a pending exit", async () => {
  let enabled = false;
  const f = fixture(() => enabled);
  f.scene.enter();
  assert.equal(f.effects.length, 0);
  let closed = 0;
  f.scene.exit(() => closed++);
  assert.equal(closed, 1);
  enabled = true;
  f.scene.enter();
  f.scene.exit(() => closed++, true);
  assert.equal(closed, 2);
  f.scene.enter();
  f.scene.exit(() => closed++);
  enabled = false;
  f.scene.finish();
  assert.equal(closed, 3);
  await flush();
  assert.equal(closed, 3);
});
