import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyMp4, verifyBundledFilms } from "../scripts/media-integrity.mjs";
test("all shipped films contain real, complete MP4 media containers", async () => {
  assert.ok(
    (await verifyBundledFilms(
      new URL("../website/assets/retreat/", import.meta.url),
    )) > 20,
  );
});
test("metadata JSON and truncated video cannot be published as MP4", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aroha-media-"));
  try {
    const file = join(dir, "phone.mp4");
    await writeFile(file, JSON.stringify({ export: "metadata", frames: 480 }));
    await assert.rejects(verifyMp4(file), /INVALID_MP4_CONTAINER/);
    const header = Buffer.alloc(16);
    header.writeUInt32BE(1024, 0);
    header.write("ftyp", 4);
    await writeFile(file, header);
    await assert.rejects(verifyMp4(file), /INVALID_MP4_CONTAINER/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("gate asset manifest describes the actual exported bytes", async () => {
  const { readFile } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  const manifest = JSON.parse(
    await readFile(
      new URL("../docs/hrudhi-gate-assets.json", import.meta.url),
      "utf8",
    ),
  );
  assert.ok(
    manifest.assets.some((asset) => asset.path.endsWith("mobile-v2.mp4")),
  );
  for (const asset of manifest.assets) {
    const bytes = await readFile(new URL("../" + asset.path, import.meta.url));
    assert.equal(bytes.length, asset.bytes, asset.path);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      asset.sha256,
      asset.path,
    );
  }
});
