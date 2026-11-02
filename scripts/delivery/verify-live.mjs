import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const sha = (b) => createHash("sha256").update(b).digest("hex");
export async function verifyLive(
  root,
  expected,
  { fetchImpl = fetch, origin = "https://aroharetreat.com" } = {},
) {
  const paths = [
    "/",
    "/map/",
    "/admin/",
    "/design/",
    "/website-release.json",
    "/design/release.json",
    "/runtime-config.json",
    "/assets/site.js",
    "/assets/map.js",
    "/assets/admin.js",
    "/assets/site.css",
    "/assets/field.css",
    "/assets/hrudhi-gate.css",
    "/assets/guest-experience.css",
    "/assets/hrudhi-guide.css",
    "/assets/retreat/hrudhi-gate-desktop-v2.mp4",
    "/assets/retreat/hrudhi-gate-mobile-v2.mp4",
    "/assets/retreat/hrudhi-walk-sheet-v1.webp",
    "/assets/retreat/hrudhi-directions-v2.webp",
    "/assets/retreat/hrudhi-gate-desktop-v1.mp4",
    "/assets/retreat/hrudhi-gate-mobile-v1.mp4",
    "/assets/retreat/hrudhi-gate-open-v1.webp",
    "/assets/retreat/hrudhi-gate-closed-v1.webp",
    "/assets/retreat/hrudhi-guide-v1.webp",
    "/assets/map.css",
    "/assets/navigation.css",
    "/assets/page-transitions.css",
    "/assets/sunset.css",
    "/assets/footer.css",
  ];
  for (const name of await readdir(root + "dist/assets/chunks"))
    paths.push("/assets/chunks/" + name);
  const checks = [];
  for (const path of paths) {
    const response = await fetchImpl(origin + path, {
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error("LIVE_HTTP_FAILED");
    const actual = Buffer.from(await response.arrayBuffer()),
      local = await readFile(
        root + "dist" + (path.endsWith("/") ? path + "index.html" : path),
      );
    if (sha(actual) !== sha(local)) throw Error("LIVE_HASH_MISMATCH");
    checks.push({ path, status: response.status, sha256: sha(actual) });
  }
  const release = JSON.parse(
    await readFile(root + "dist/website-release.json", "utf8"),
  );
  if (
    release.revision !== expected.revision ||
    release.version !== expected.version
  )
    throw Error("LIVE_REVISION_MISMATCH");
  const denied = await fetchImpl(origin + "/api/v1/draft", {
    headers: { Origin: origin },
    signal: AbortSignal.timeout(15000),
  });
  if (denied.status !== 401) throw Error("LIVE_ACCESS_CHECK_FAILED");
  return {
    status: "verified",
    verifiedAt: new Date().toISOString(),
    release,
    hashMatchedFiles: checks.length,
    checks,
    protectedDraftStatus: 401,
  };
}
