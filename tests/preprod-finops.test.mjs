import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runPreprodMaintenance } from "../functions/booking/preprod-maintenance.mjs";
import { assertShellBudget, mediaObject, mediaUrl, verifyLiveMedia } from "../scripts/preprod-media.mjs";

test("an unavailable destination does not starve the other maintenance queue", async () => {
  const runs = [];
  await assert.rejects(runPreprodMaintenance({
    drainMail: async () => { runs.push("mail"); throw Error("mail unavailable"); },
    drainTelemetry: async () => { runs.push("telemetry"); },
  }), AggregateError);
  assert.deepEqual(runs, ["mail", "telemetry"]);
});

test("a media file or excess static bytes fails the pre-production shell budget", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aroha-shell-"));
  try {
    await writeFile(join(dir, "index.html"), Buffer.alloc(3_000_001));
    await assert.rejects(assertShellBudget(dir), /TOO_LARGE/);
    await writeFile(join(dir, "index.html"), "tiny");
    await writeFile(join(dir, "forgotten.mp4"), "binary");
    await assert.rejects(assertShellBudget(dir), /MEDIA_IN_PREPROD/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("media verification rejects a provider returning a full body for a one-byte read", async () => {
  const names = ["hero-mobile.webp", "hrudhi-gate-mobile-v2.mp4", "hrudhi-gate-desktop-v2.mp4"];
  const sha256 = "a".repeat(64);
  const assets = Object.fromEntries(names.map(name => [name, { bytes: 17, sha256 }]));
  await assert.rejects(verifyLiveMedia("https://preprod.example", assets, async url => {
    if (url.startsWith("https://preprod.example")) return new Response(null, {
      status: 302, headers: { location: mediaUrl(url.split("/").at(-1), sha256) },
    });
    return new Response(Buffer.alloc(17), { status: 200 });
  }), /RANGE_OR_CACHE_FAILED/);
  assert.throws(() => mediaObject("../private.mp4", sha256), /INVALID_PREPROD_MEDIA_IDENTITY/);
});
