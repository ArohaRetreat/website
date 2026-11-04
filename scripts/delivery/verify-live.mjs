import { ADDITIONAL_MEDIA } from "../content/farm-media-refresh.mjs";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const sha = (b) => createHash("sha256").update(b).digest("hex");
export async function verifyLive(
  root,
  expected,
  {
    fetchImpl = fetch,
    origin = "https://aroharetreat.com",
    directory = "dist",
    includeDesign = true,
  } = {},
) {
  const paths = [
    "/",
    "/map/",
    "/book/",
    "/admin/bookings/",
    "/assets/booking.js",
    "/assets/booking.css",
    "/assets/calendar-leaf.svg",
    "/admin/",
    "/admin/modules/website/",
    "/admin/modules/bookings/",
    "/assets/studio.js",
    "/assets/studio.css",
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
    "/assets/brand/favicon.svg",
    "/assets/brand/favicon-light.svg",
    "/assets/brand/favicon-dark.svg",
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
  const bookingDocument = await readFile(
    root + directory + "/book/index.html",
    "utf8",
  );
  if (bookingDocument.includes("/assets/booking-concierge.js"))
    paths.push("/assets/booking-concierge.js", "/assets/booking-concierge.css");
  paths.push(
    "/assets/retreat/pool-completion-impression-v1.webp",
    "/assets/retreat/library-impression-v1.webp",
    ...new Set(
      ADDITIONAL_MEDIA.flatMap((m) => [m.image, ...(m.src ? [m.src] : [])]),
    ),
  );
  for (const name of await readdir(root + directory + "/assets/chunks"))
    paths.push("/assets/chunks/" + name);
  const checks = [];
  for (const path of paths.filter(
    (p) => includeDesign || !p.startsWith("/design/"),
  )) {
    const response = await fetchImpl(origin + path, {
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error("LIVE_HTTP_FAILED");
    const actual = Buffer.from(await response.arrayBuffer()),
      local = await readFile(
        root + directory + (path.endsWith("/") ? path + "index.html" : path),
      );
    if (sha(actual) !== sha(local)) throw Error("LIVE_HASH_MISMATCH");
    checks.push({ path, status: response.status, sha256: sha(actual) });
  }
  const release = JSON.parse(
    await readFile(root + directory + "/website-release.json", "utf8"),
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
  const bookingDenied = await fetchImpl(origin + "/api/v1/booking/state", {
    headers: { Origin: origin },
    signal: AbortSignal.timeout(15000),
  });
  if (bookingDenied.status !== 401)
    throw Error("LIVE_BOOKING_ACCESS_CHECK_FAILED");
  if (!includeDesign) {
    const booking = await (
      await fetchImpl(origin + "/api/v1/booking/public", {
        signal: AbortSignal.timeout(15000),
      })
    ).json();
    const runtime = await (
      await fetchImpl(origin + "/api/v1/runtime-config", {
        signal: AbortSignal.timeout(15000),
      })
    ).json();
    if (
      booking.environment !== "pre-prod" ||
      !/^0\.7\.\d+$/.test(booking.apiVersion) ||
      booking.delivery !== "email_enabled" ||
      runtime.environment !== "pre-prod" ||
      !Number.isSafeInteger(runtime.configVersion) ||
      runtime.configVersion < 1 ||
      !runtime.rumScriptUrl ||
      runtime.rumScriptUrl.includes("224aa943b980c761")
    )
      throw Error("LIVE_PREPROD_RUNTIME_MISMATCH");
  }
  return {
    status: "verified",
    verifiedAt: new Date().toISOString(),
    release,
    hashMatchedFiles: checks.length,
    checks,
    protectedDraftStatus: denied.status,
  };
}
