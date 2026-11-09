import assert from "node:assert/strict";
import { test } from "node:test";
import { readNaturaLayout, naturaSamples } from "../scripts/natura-media.mjs";

test("each pinned Natura media path has one byte-preserving Storage redirect", async () => {
  const layout = await readNaturaLayout(process.cwd());
  const redirects = new Map(layout.redirects.map(rule => [rule.source, rule]));
  assert.equal(layout.pin.files.length, layout.shell.length + layout.media.length);
  assert.equal(redirects.size, layout.media.length);
  for (const file of layout.media) {
    assert.deepEqual(redirects.get(file.path), { source: file.path, destination: file.url, type: 302 });
  }
  for (const file of layout.shell) assert.ok(!redirects.has(file.path), file.path);
  for (const path of ["/design/", "/design/unknown.png", "/design/downloads/unknown.zip", "/assets/retreat/hero-mobile.webp"]) {
    assert.ok(!redirects.has(path), path);
  }
  const sprite = "/design/assets/farm-atlas/farm-icons.svg";
  assert.ok(layout.shell.some(file => file.path === sprite));
  assert.ok(layout.media.filter(file => file.path.endsWith(".zip")).every(file => file.contentDisposition.startsWith("attachment;")));
  assert.equal(new Set(naturaSamples(layout).map(file => file.contentType)).size,
    new Set(layout.media.map(file => file.contentType)).size);
});
