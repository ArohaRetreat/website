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
