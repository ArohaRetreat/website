import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { verifyLive } from "../scripts/delivery/verify-live.mjs";
async function fixture(bad = false) {
  const root = await mkdtemp(join(tmpdir(), "aroha-concierge-verifier-"));
  const expected = {
    version: "0.21.0",
    revision: "a".repeat(40),
    environment: "pre-prod",
  };
  await mkdir(join(root, "dist/book"), { recursive: true });
  await mkdir(join(root, "dist/assets/chunks"), { recursive: true });
  await writeFile(
    join(root, "dist/book/index.html"),
    '<script src="/assets/booking-concierge.js"></script>',
  );
  await writeFile(
    join(root, "dist/website-release.json"),
    JSON.stringify(expected),
  );
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/v1/draft" || path === "/api/v1/booking/state")
      return new Response("{}", { status: 401 });
    if (path === "/api/v1/booking/public")
      return new Response(
        JSON.stringify({
          environment: "pre-prod",
          apiVersion: "0.7.0",
          delivery: "email_enabled",
        }),
      );
    if (path === "/api/v1/runtime-config")
      return new Response(
        JSON.stringify({
          environment: "pre-prod",
          configVersion: 1,
          rumScriptUrl: "https://js-cdn.dynatrace.com/jstag/test/preprod.js",
        }),
      );
    const file = join(
      root,
      "dist",
      path + (path.endsWith("/") ? "index.html" : ""),
    );
    let bytes;
    try {
      bytes = await readFile(file);
    } catch {
      bytes = Buffer.from("local immutable " + path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, bytes);
    }
    return new Response(
      bad && path === "/assets/booking-concierge.js"
        ? "stale frontend bytes"
        : bytes,
    );
  };
  return {
    root: root + "/",
    expected,
    fetchImpl,
    close: () => rm(root, { recursive: true, force: true }),
  };
}
test("live verification hashes the selected concierge JS and CSS and protects anonymous access", async () => {
  const f = await fixture();
  try {
    const result = await verifyLive(f.root, f.expected, {
      fetchImpl: f.fetchImpl,
      origin: "https://staging.example.test",
      includeDesign: false,
    });
    assert(
      result.checks.some((c) => c.path === "/assets/booking-concierge.js"),
    );
    assert(
      result.checks.some((c) => c.path === "/assets/booking-concierge.css"),
    );
    assert.equal(result.status, "verified");
    assert.equal(result.protectedDraftStatus, 401);
  } finally {
    await f.close();
  }
});
test("a stale concierge entry fails exact-source verification", async () => {
  const f = await fixture(true);
  try {
    await assert.rejects(
      verifyLive(f.root, f.expected, {
        fetchImpl: f.fetchImpl,
        origin: "https://staging.example.test",
        includeDesign: false,
      }),
      /LIVE_HASH_MISMATCH/,
    );
  } finally {
    await f.close();
  }
});
