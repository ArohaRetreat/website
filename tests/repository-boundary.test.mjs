import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, cp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { composeHosting, verifyHostingComposition } from "../scripts/hosting-composition.mjs";
import { verifyNaturaAssets } from "../scripts/natura-assets.mjs";

const root = new URL("../", import.meta.url);
const revision = "a".repeat(40);
const pin = JSON.parse(await readFile(new URL("config/natura-hosting.json", root)));
const write = async (path, value) => writeFile(path, JSON.stringify(value));
async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), "aroha-hosting-boundary-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const app = join(base, "website"), design = join(base, "natura-export");
  await mkdir(join(app, "dist/admin"), { recursive: true });
  await mkdir(join(app, "config"), { recursive: true });
  await mkdir(design);
  await write(join(app, "config/natura-hosting.json"), pin);
  await write(join(app, "dist/website-release.json"), { name: "Aroha Retreat", version: "0.8.1", revision });
  await writeFile(join(app, "dist/index.html"), "<h1>Website fixture</h1>");
  await writeFile(join(app, "dist/admin/index.html"), "<h1>Host fixture</h1>");
  await write(join(design, "release.json"), { name: "Natura", basePath: "/design/", version: pin.version, revision: pin.revision, status: "release", hrudhiReview: "alpha" });
  await writeFile(join(design, "index.html"), "<h1>Design fixture</h1>");
  return { app, design };
}
test("standalone import retains every authorised media byte and pinned Natura dependency", async () => {
  const provenance = JSON.parse(await readFile(new URL("docs/repository-import.json", root)));
  const media = provenance.files.filter(f => f.path.startsWith("website/assets/"));
  assert.equal(media.length, 90);
  for (const file of media) {
    const bytes = await readFile(new URL(file.path, root));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sourceSha256, file.path);
  }
  const dependency = await verifyNaturaAssets(root);
  assert.equal(dependency.repository, "ArohaRetreat/natura");
  assert.ok(dependency.files.some(f => f.path === "runtime/nature-scenes.js"));
});
test("shared Hosting requires both applications and rejects changed, incomplete or stale artifacts", async t => {
  const { app, design } = await fixture(t);
  await assert.rejects(verifyHostingComposition(app, revision), /ENOENT/);
  await composeHosting(app, design);
  const composition = await verifyHostingComposition(app, revision);
  assert.ok(composition.files.some(f => f.path === "design/index.html"));
  await assert.rejects(verifyHostingComposition(app, "b".repeat(40)), /revision mismatch/);
  await writeFile(join(app, "dist/index.html"), "changed after composition");
  await assert.rejects(verifyHostingComposition(app, revision), /changed after composition/);
  await composeHosting(app, design);
  await rm(join(app, "dist/admin/index.html"));
  await assert.rejects(verifyHostingComposition(app, revision), /incomplete/);
});
test("composition refuses wrong design release, self-copy and symbolic-link escapes", async t => {
  const { app, design } = await fixture(t);
  await assert.rejects(composeHosting(app, join(app, "dist/design")), /independent Natura/);
  const release = JSON.parse(await readFile(join(design, "release.json")));
  await write(join(design, "release.json"), { ...release, revision: "b".repeat(40) });
  await assert.rejects(composeHosting(app, design), /pinned release/);
  await write(join(design, "release.json"), release);
  await symlink(join(app, "dist/index.html"), join(design, "outside.html"));
  await assert.rejects(composeHosting(app, design), /symbolic links/);
});
test("pinned nature dependency fails closed when a vendored runtime is modified", async t => {
  const base = await mkdtemp(join(tmpdir(), "aroha-vendor-boundary-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  await cp(new URL("vendor/natura", root), join(base, "vendor/natura"), { recursive: true });
  await writeFile(join(base, "vendor/natura/runtime/nature-scenes.js"), "changed runtime");
  await assert.rejects(verifyNaturaAssets(pathToFileURL(base + "/")), /Natura asset changed/);
});
