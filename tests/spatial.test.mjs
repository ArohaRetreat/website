import test from "node:test";
import assert from "node:assert/strict";
import { createFarmWorld } from "../website/farm-world.mjs";
import {
  sampleRoute,
  terrainHeight,
  FARM_STOPS,
} from "../website/farm-route.mjs";

test("camera travel is reversible, finite, clear of terrain and opens the gate before crossing", () => {
  const forward = Array.from({ length: 1001 }, (_, i) => {
    const s = sampleRoute(i / 1000);
    assert.ok(s.position.toArray().every(Number.isFinite));
    assert.ok(s.look.toArray().every(Number.isFinite));
    assert.ok(s.position.y - terrainHeight(s.position.x, s.position.z) > 1.5);
    if (s.position.z < 18) assert.ok(s.gate > 0.96);
    return s.position.toArray();
  });
  for (let i = 1000; i >= 0; i--)
    assert.deepEqual(sampleRoute(i / 1000).position.toArray(), forward[i]);
  for (let i = 1; i < forward.length; i++)
    assert.ok(
      Math.hypot(...forward[i].map((n, j) => n - forward[i - 1][j])) < 1.1,
      "no camera teleport",
    );
  assert.equal(sampleRoute(-2).gate, 0);
  assert.equal(sampleRoute(5).gate, 1);
  for (const [i, s] of FARM_STOPS.entries())
    assert.equal(sampleRoute(s.at).stop, i);
});
test("the farm is a connected geometric scene with bounded geometry and disposable resources", () => {
  const world = createFarmWorld();
  let triangles = 0,
    meshes = 0,
    disposed = 0;
  const geometry = new Set();
  world.scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    geometry.add(g);
    const a = g.attributes.position;
    for (const n of a.array) assert.ok(Number.isFinite(n));
    triangles +=
      ((g.index?.count || a.count) / 3) * (o.isInstancedMesh ? o.count : 1);
  });
  assert.ok(world.stats.palms >= 40);
  assert.equal(world.stats.cottages, 3);
  assert.ok(meshes < 75);
  assert.ok(triangles < 350000);
  for (const g of geometry) g.addEventListener("dispose", () => disposed++);
  world.update(2, 1);
  assert.ok(world.gates[0].rotation.y > 1.4);
  assert.ok(world.gates[1].rotation.y < -1.4);
  world.update(2, 0);
  assert.equal(world.gates[0].rotation.y, 0);
  assert.equal(Math.abs(world.gates[1].rotation.y), 0);
  world.setLight(1);
  assert.ok(world.sun.intensity < 1);
  world.setLight(0);
  assert.ok(world.sun.intensity > 3);
  world.dispose();
  assert.equal(disposed, geometry.size);
  world.dispose();
  assert.equal(disposed, geometry.size, "dispose is idempotent");
});
