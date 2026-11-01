import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import {
  validateTour,
  validateContent,
  videoUrl,
} from "../functions/domain.mjs";
import { renderSite } from "../website/render.mjs";
import { routeState } from "../website/field-journey.mjs";
const tour = JSON.parse(
  await readFile(new URL("../website/tour-content.json", import.meta.url)),
);
const content = JSON.parse(
  await readFile(new URL("../website/content.json", import.meta.url)),
);
test("the host-described route retains the house relationships and all media", async () => {
  validateTour(tour);
  validateContent({ ...content, tour });
  const byId = Object.fromEntries(tour.stops.map((s) => [s.id, s]));
  assert.ok(byId.pond.mapX > byId.arrival.mapX);
  assert.ok(byId.parking.mapX > byId.arrival.mapX);
  assert.ok(byId.kitchen.mapY > byId.house.mapY);
  assert.ok(byId.library.mapX < byId.house.mapX);
  assert.ok(byId.treehouses.mapX > byId.house.mapX);
  assert.ok(byId.cottages.mapY < byId.treehouses.mapY);
  assert.ok(byId.meditation.mapY < byId.cottages.mapY);
  assert.ok(byId.pool.mapX < byId.meditation.mapX);
  assert.equal(tour.media.filter((m) => m.kind === "photo").length, 35);
  assert.equal(tour.media.filter((m) => m.kind === "video").length, 21);
  await Promise.all(
    tour.media
      .flatMap((m) => [m.image, ...(m.src ? [m.src] : [])])
      .map((path) =>
        access(new URL("../website/" + path.slice(1), import.meta.url)),
      ),
  );
});
test("tour validation rejects cross-reference, executable, position and unbounded payload errors", () => {
  for (const edit of [
    (t) => t.stops[0].nearby.push("missing"),
    (t) => (t.stops[0].film = "missing"),
    (t) => (t.stops[0].walk = [{ name: "Bad", film: "missing" }]),
    (t) => (t.stops[0].mapX = Infinity),
    (t) => (t.media[0].image = "javascript:alert(1)"),
    (t) =>
      (t.media.find((m) => m.kind === "video").src =
        "https://example.org/tracker.mp4"),
    (t) => (t.media[0].kind = "html"),
    (t) => (t.media[0].stop = "missing"),
    (t) => t.stops.push({ ...t.stops[0] }),
    (t) => (t.stops[0].script = "alert(1)"),
  ]) {
    const c = structuredClone(tour);
    edit(c);
    assert.throws(() => validateTour(c));
  }
  const empty = { ...tour, stops: [], media: [] };
  validateTour(empty);
  videoUrl("/assets/retreat/20261028_092325.mp4");
  for (const path of [
    "//evil/a.mp4",
    "/assets/retreat/../x.mp4",
    "data:video/mp4;base64,eA==",
  ])
    assert.throws(() => videoUrl(path));
});
test("published content and media captions stay escaped and videos remain unloaded until selected", () => {
  const c = { ...structuredClone(content), tour: structuredClone(tour) };
  c.tour.stops[0].title = "<img src=x onerror=alert(1)>";
  c.tour.media[0].name = '" onclick="alert(1)';
  const html = renderSite(c);
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("<video src="));
  assert.equal((html.match(/data-media="/g) || []).length, 56);
});
test("native-scroll route progress is reversible, bounded and deterministic at chapter edges", () => {
  for (let i = 0; i < tour.stops.length; i++)
    assert.equal(
      routeState((i + 0.5) / tour.stops.length, tour.stops.length).index,
      i,
    );
  assert.equal(routeState(1, tour.stops.length).index, tour.stops.length - 1);
  assert.equal(routeState(-2, tour.stops.length).index, 0);
  assert.equal(routeState(NaN, tour.stops.length).index, 0);
  const states = [0, 0.2, 0.8, 0.2, 0].map((p) =>
    routeState(p, tour.stops.length),
  );
  assert.deepEqual(states[1], states[3]);
  assert.deepEqual(states[0], states[4]);
});

test("older published records retain custom gallery additions in the new journal", () => {
  const c = structuredClone(content);
  c.gallery.push({
    image: "/assets/retreat/custom.webp",
    imageAlt: "A host-added photograph",
  });
  const html = renderSite(c);
  assert.ok(html.includes('data-media="legacy-0"'));
  assert.ok(html.includes("A host-added photograph"));
});
