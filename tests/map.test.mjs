import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateContent, validateStoryMap } from "../functions/domain.mjs";
import {
  renderMap,
  mapContent,
  mapMedia,
  mapDefaults,
} from "../website/map-render.mjs";
import {
  placeFromHash,
  adjacentPlace,
  treeDescent,
} from "../website/map-state.mjs";
const read = async (p) =>
  JSON.parse(await readFile(new URL(p, import.meta.url)));
const seed = await read("../website/content.json"),
  tour = await read("../website/tour-content.json");
const content = () => ({
  ...structuredClone(seed),
  tour: structuredClone(tour),
  storyMap: structuredClone(mapDefaults),
});
test("legacy publications work without storyMap and expose all eleven seed stories", () => {
  validateContent(structuredClone(seed));
  assert.equal(mapContent(seed).places.length, 11);
  assert.equal(mapContent(seed).chapters.length, 4);
});
test("map copy is validated with its existing tour and survives the content contract", () => {
  const c = content();
  assert.equal(validateContent(c).storyMap.places[2].id, "pond");
  assert.equal(validateStoryMap(c.storyMap, c.tour), c.storyMap);
});
test("dangling chapter, stop and wrong-place media references are rejected", () => {
  for (const mutation of [
    (c) => (c.storyMap.places[0].chapter = "missing"),
    (c) => (c.storyMap.places[0].id = "missing"),
    (c) => (c.storyMap.places[0].media = "v-092325"),
    (c) => delete c.tour,
  ]) {
    const c = content();
    mutation(c);
    assert.throws(() => validateContent(c), /INVALID_MAP_REFERENCE/);
  }
});
test("map rejects executable fields, duplicate places, oversized copy and empty chapters", () => {
  for (const mutation of [
    (c) => (c.storyMap.chapters = null),
    (c) => (c.storyMap.places = null),
    (c) => (c.storyMap.script = "alert(1)"),
    (c) => c.storyMap.places.push({ ...c.storyMap.places[0] }),
    (c) => (c.storyMap.places[0].paragraphs = ["x".repeat(2501)]),
    (c) =>
      c.storyMap.chapters.push({
        id: "empty",
        title: "",
        invitation: "",
        description: "",
      }),
    (c) => (c.storyMap.places[0].paragraphs = []),
  ]) {
    const c = content();
    mutation(c);
    assert.throws(() => validateContent(c));
  }
});
test("rendered reading document includes all place anchors, captions and escaped CMS copy", () => {
  const c = content();
  c.storyMap.places[0].title = "<script>alert(1)</script>";
  c.storyMap.places[0].paragraphs = ["A <b>book</b> & a walk"];
  const html = renderMap(c);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>alert"));
  assert.ok(html.includes("A &lt;b&gt;book&lt;/b&gt; &amp; a walk"));
  for (const p of c.storyMap.places) {
    assert.ok(html.includes(`id="${p.id}"`));
    assert.ok(html.includes(p.caption));
  }
  assert.equal((html.match(/data-story=/g) || []).length, 11);
});
test("media selections resolve only to matching places; legacy custom tours omit unavailable default stories", () => {
  const p = mapDefaults.places.find((p) => p.id === "pond");
  assert.equal(mapMedia(p, tour).kind, "video");
  const c = {
    ...seed,
    tour: { ...tour, stops: tour.stops.filter((s) => s.id !== "pond") },
  };
  assert.ok(!mapContent(c).places.some((p) => p.id === "pond"));
  assert.equal(mapMedia({ ...p, media: "v-095746" }, tour).kind, "photo");
});
test("deep links accept known IDs and handle malformed or unrelated fragments safely", () => {
  assert.equal(placeFromHash("#pond", mapDefaults.places), "pond");
  assert.equal(placeFromHash("#%70ond", mapDefaults.places), "pond");
  for (const h of ["#%E0%A4", "#unknown", "#<script>"])
    assert.equal(placeFromHash(h, mapDefaults.places), null);
  assert.equal(adjacentPlace(mapDefaults.places, "arrival", -1), "arrival");
  assert.equal(adjacentPlace(mapDefaults.places, "farm", 1), "farm");
  assert.equal(adjacentPlace(mapDefaults.places, "pond", 1), "house");
});
test("native-scroll camera progress remains bounded and reverses", () => {
  assert.equal(treeDescent(900, 1000, 800), 0);
  assert.equal(treeDescent(-2000, 1000, 800), 1);
  assert.ok(treeDescent(-500, 1000, 800) > treeDescent(0, 1000, 800));
});

test("physical map reuses homepage tour coordinates rather than placing destinations on decorative roots", () => {
  const c = content(),
    html = renderMap(c);
  for (const stop of c.tour.stops)
    assert.ok(
      html.includes(`style="left:${stop.mapX}%;top:${stop.mapY}%"`),
      stop.id,
    );
  assert.ok(html.includes('class="farm-map-plane"'));
  assert.ok(!html.includes('class="root-marker"'));
  assert.ok(html.includes("Relative layout from the hosts"));
});
