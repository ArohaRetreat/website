import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  refreshFarmMedia,
  ADDITIONAL_MEDIA,
} from "../scripts/content/farm-media-refresh.mjs";
import { albumPage } from "../website/album.mjs";
const read = async (name) =>
  JSON.parse(await readFile(new URL("../website/" + name, import.meta.url)));
test("media refresh preserves host edits, is repeatable, removes interior and connects farm photos/films", async () => {
  const c = await read("content.json");
  c.tour = await read("tour-content.json");
  c.storyMap = await read("map-content.json");
  c.brand.welcome = "Owner-edited welcome";
  c.tour.stops.find((s) => s.id === "kitchen").name = "Guest Dining";
  const before = structuredClone(c);
  const next = refreshFarmMedia(c);
  assert.deepEqual(c, before);
  assert.equal(next.brand.welcome, "Owner-edited welcome");
  assert.equal(
    next.tour.stops.find((s) => s.id === "kitchen").name,
    "Guest Dining",
  );
  assert.deepEqual(refreshFarmMedia(next), next);
  assert.ok(!next.tour.media.some((m) => m.image.endsWith("DSC_3815.webp")));
  for (const m of ADDITIONAL_MEDIA)
    assert.equal(next.tour.media.filter((x) => x.id === m.id).length, 1);
  const farm = albumPage(next.tour.media, "farm");
  assert.ok(farm.total > 10);
  assert.ok(farm.items.every((m) => m.stop === "farm"));
  assert.ok(farm.ids.includes("v-farm-campfire"));
});

test("pool completion is disclosed and uses a bundled generated image rather than unrelated greenery", async () => {
  const c = await read("content.json");
  c.tour = await read("tour-content.json");
  c.storyMap = await read("map-content.json");
  const n = refreshFarmMedia(c);
  const s = n.tour.stops.find((s) => s.id === "pool");
  assert.equal(s.image, "/assets/retreat/pool-completion-impression-v1.webp");
  assert.match(s.imageAlt, /AI-generated.*construction footage/);
  assert.match(
    n.storyMap.places.find((p) => p.id === "pool").caption,
    /Artistic impression.*construction footage/,
  );
  const { access } = await import("node:fs/promises");
  await access(new URL("../website" + s.image, import.meta.url));
});
