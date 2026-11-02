import test from "node:test";
import assert from "node:assert/strict";
import {
  makeGuideNetwork,
  guideRoute,
  guideDestination,
} from "../website/map-guide-route.mjs";
import { renderMap } from "../website/map-render.mjs";
import { readFile } from "node:fs/promises";
test("guide returns from side paths through the trunk instead of cutting across the map", () => {
  const trunk = [
    { x: 0, y: 100 },
    { x: 0, y: 50 },
    { x: 0, y: 0 },
  ];
  const network = makeGuideNetwork([
    trunk,
    [
      { x: 0, y: 100 },
      { x: 50, y: 100 },
    ],
    [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ],
  ]);
  const route = guideRoute(network, { x: 50, y: 100 }, { x: 50, y: 0 });
  assert.ok(route.some((p) => p.x === 0 && p.y === 50));
  assert.equal(route.at(-1).x, 50);
  assert.equal(route.at(-1).y, 0);
  const reverse = guideRoute(network, { x: 50, y: 0 }, { x: 50, y: 100 });
  assert.ok(reverse.some((p) => p.x === 0 && p.y === 50));
});
test("interrupted walking resumes from the current position onto the nearest route", () => {
  const network = makeGuideNetwork([
    [
      { x: 0, y: 0 },
      { x: 0, y: 25 },
      { x: 0, y: 50 },
      { x: 0, y: 100 },
    ],
  ]);
  const route = guideRoute(network, { x: 0, y: 27 }, { x: 0, y: 100 });
  assert.deepEqual(route[0], { x: 0, y: 27 });
  assert.equal(route.at(-1).y, 100);
});
test("map guide is inside the physical map, decorative and has no Meet Hrudhi control", async () => {
  const content = JSON.parse(
    await readFile(new URL("../website/content.json", import.meta.url), "utf8"),
  );
  const html = renderMap(content);
  assert.ok(!html.includes("map-meet-hrudhi"));
  assert.ok(!html.includes("Meet Hrudhi"));
  const start = html.indexOf('class="farm-map-plane"'),
    guide = html.indexOf('data-hrudhi-guide="map"');
  assert.ok(guide > start);
  assert.match(html.slice(guide, guide + 50), /aria-hidden="true"/);
  assert.ok(html.includes('data-guide-path="main"'));
});

test("guide rests with her full body clear of place labels", () => {
  const nodes = [
    { x: 100, y: 100 },
    { x: 100, y: 30 },
    { x: 180, y: 100 },
  ];
  const target = guideDestination(
    nodes,
    { x: 100, y: 100 },
    [{ left: 80, right: 120, top: 80, bottom: 120 }],
    { width: 40, height: 60 },
  );
  assert.notDeepEqual(target, { x: 100, y: 100 });
  assert.deepEqual(target, { x: 100, y: 30 });
});
