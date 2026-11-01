import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  albumPage,
  albumRange,
  renderAlbum,
  createAlbum,
  ALBUM_SIZE,
} from "../website/album.mjs";
import { esc, picture } from "../website/render.mjs";
const tour = JSON.parse(
  await readFile(new URL("../website/tour-content.json", import.meta.url)),
);
test("every supplied moment appears once across bounded album spreads and filters never mix kinds", () => {
  for (const filter of ["all", "photo", "video"]) {
    const all = [];
    const first = albumPage(tour.media, filter);
    for (let p = 0; p < first.pages; p++) {
      const state = albumPage(tour.media, filter, p);
      assert.ok(state.items.length <= ALBUM_SIZE);
      assert.ok(
        state.items.every((m) => filter === "all" || m.kind === filter),
      );
      all.push(...state.items.map((m) => m.id));
    }
    const expected = tour.media
      .filter((m) => filter === "all" || m.kind === filter)
      .map((m) => m.id);
    assert.deepEqual(all, expected);
    assert.equal(new Set(all).size, all.length);
  }
  assert.equal(albumPage(tour.media, "all", Infinity).page, 0);
  assert.equal(albumPage(tour.media, "all", -9).page, 0);
  assert.equal(albumPage(tour.media, "all", 999).items.length, 1);
  assert.equal(albumPage([], "photo", 999).total, 0);
  assert.equal(
    albumRange(albumPage(tour.media, "video", 999)),
    "21 of 21 films",
  );
  assert.equal(albumPage(tour.media, "invalid").filter, "all");
});
test("album SSR retains all media, escapes captions and shows only one spread without loading films", () => {
  const t = structuredClone(tour);
  t.media[0].name = "<img src=x onerror=alert(1)>";
  const html = renderAlbum(t, { esc, picture });
  assert.equal((html.match(/data-media="/g) || []).length, 56);
  assert.equal((html.match(/data-album-slot="/g) || []).length, 5);
  assert.ok(html.includes("&lt;img src=x"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("<video"));
  assert.ok(html.includes("<noscript>"));
});
function fixture() {
  const element = () => ({
    dataset: {},
    attrs: new Map(),
    hidden: false,
    addEventListener(_n, fn) {
      this.click = fn;
    },
    removeEventListener() {
      delete this.click;
    },
    setAttribute(k, v) {
      this.attrs.set(k, v);
    },
  });
  const prints = tour.media.map((m) => ({
    ...element(),
    dataset: { albumId: m.id },
  }));
  const filters = ["all", "photo", "video"].map((kind) => ({
    ...element(),
    dataset: { albumFilter: kind },
  }));
  const previous = element(),
    next = element(),
    range = element(),
    page = element(),
    empty = element();
  const grid = { dataset: {} };
  const section = {
    querySelector(s) {
      return {
        "#album-spread": grid,
        "#album-previous": previous,
        "#album-next": next,
        "#album-range": range,
        "#album-page": page,
        ".album-empty": empty,
      }[s];
    },
    querySelectorAll(s) {
      return s === "[data-album-id]" ? prints : filters;
    },
  };
  return {
    root: {
      querySelector() {
        return section;
      },
    },
    prints,
    filters,
    previous,
    next,
    range,
  };
}
test("filtering resets the spread, navigation bounds remain stable, and repaint resumes the current album", () => {
  const f = fixture();
  const c = createAlbum(f.root, tour.media);
  f.next.click();
  assert.equal(c.state.page, 1);
  assert.match(f.range.textContent, /6–10/);
  f.filters[2].click();
  assert.deepEqual(c.state, { filter: "video", page: 0 });
  assert.equal(c.ids.length, 21);
  for (let i = 0; i < 10; i++) f.next.click();
  assert.equal(c.state.page, 4);
  assert.equal(f.prints.filter((p) => !p.hidden).length, 1);
  const state = c.state;
  c.destroy();
  assert.equal(f.next.click, undefined);
  const restored = createAlbum(f.root, tour.media, { resume: state });
  assert.deepEqual(restored.state, state);
  f.previous.click();
  assert.equal(restored.state.page, 3);
  assert.equal(restored.reveal(tour.media[0].id), true);
  assert.ok(
    f.prints.some((p) => p.dataset.albumId === tour.media[0].id && !p.hidden),
  );
  assert.equal(restored.reveal("removed-id"), false);
  restored.destroy();
});
