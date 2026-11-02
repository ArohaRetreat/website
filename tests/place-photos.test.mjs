import test from "node:test";
import assert from "node:assert/strict";
import { placePhoto, createPlacePhotos } from "../website/place-photos.mjs";
import { validateTour } from "../functions/domain.mjs";
import { readFile } from "node:fs/promises";
const tour = JSON.parse(
  await readFile(new URL("../website/tour-content.json", import.meta.url)),
);
test("day/night photo fields are optional, preserve day, and validate descriptions and trusted URLs", () => {
  const old = structuredClone(tour);
  old.stops.forEach((s) => {
    delete s.eveningImage;
    delete s.eveningImageAlt;
  });
  validateTour(old);
  validateTour(tour);
  const s = tour.stops.find((s) => s.id === "meditation");
  assert.equal(placePhoto(s, "day").image, s.image);
  assert.equal(placePhoto(s, "evening").image, s.eveningImage);
  const bad = structuredClone(tour);
  bad.stops[0].eveningImage = "https://evil.test/photo.webp";
  assert.throws(() => validateTour(bad));
  bad.stops[0].eveningImage = "/assets/retreat/night.webp";
  assert.throws(() => validateTour(bad));
});
test("sunset switches lazily, restores day on error, and removes listeners on disposal", () => {
  let mode = "evening",
    change,
    removed = 0;
  const handlers = {};
  const img = {
    dataset: {
      photoDay: "/day.webp",
      photoDayAlt: "Day",
      photoEvening: "/night.webp",
      photoEveningAlt: "Night",
      orbitSrc: "/day.webp",
    },
    attrs: {},
    hasAttribute(k) {
      return k in this.attrs;
    },
    getAttribute(k) {
      return this.attrs[k] || null;
    },
    set src(v) {
      this.attrs.src = v;
    },
    closest() {
      return null;
    },
    parentElement: null,
    addEventListener(k, fn) {
      handlers[k] = fn;
    },
    removeEventListener() {
      removed++;
    },
  };
  const root = { querySelectorAll: () => [img] };
  const c = createPlacePhotos(root, {
    mode: () => mode,
    watch: (fn) => {
      change = fn;
      return () => removed++;
    },
  });
  assert.equal(img.dataset.orbitSrc, "/night.webp");
  assert.equal(img.getAttribute("src"), null);
  img.src = img.dataset.orbitSrc;
  handlers.error();
  assert.equal(img.getAttribute("src"), "/day.webp");
  assert.equal(img.dataset.photoState, "fallback");
  mode = "day";
  change();
  assert.equal(img.alt, "Day");
  mode = "evening";
  change();
  assert.equal(img.getAttribute("src"), "/night.webp");
  c.destroy();
  assert.equal(removed, 2);
});
