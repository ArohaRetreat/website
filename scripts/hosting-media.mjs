import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

export const mediaBucket = "aroha-retreat.firebasestorage.app";
export const shellByteLimit = 3_000_000;
export const excludedRetreatMedia = new Set([
  "hrudhi-cancelled-v1.png",
  "hrudhi-gate-desktop-v1.mp4",
  "hrudhi-gate-mobile-v1.mp4",
]);
const filenamePattern = /^[A-Za-z0-9._-]+\.(?:webp|mp4)$/;

export function mediaObject(name, sha256) {
  if (!filenamePattern.test(name) || !/^[a-f0-9]{64}$/.test(sha256))
    throw Error("INVALID_PUBLIC_MEDIA_IDENTITY");
  // The production catalog reuses the tested, immutable objects by digest.
  return "media/preprod-finops-" + sha256 + name.slice(name.lastIndexOf("."));
}

export function mediaUrl(name, sha256) {
  const object = mediaObject(name, sha256);
  return "https://firebasestorage.googleapis.com/v0/b/" + mediaBucket + "/o/" +
    encodeURIComponent(object) + "?alt=media";
}

export async function readMediaManifest(root) {
  const { version, assets } = JSON.parse(await readFile(resolve(root, "config/public-media.json"), "utf8"));
  if (version !== 1 || !assets || Object.keys(assets).length === 0)
    throw Error("INVALID_PUBLIC_MEDIA_MANIFEST");
  for (const [name, meta] of Object.entries(assets)) {
    mediaObject(name, meta.sha256);
    if (!Number.isSafeInteger(meta.bytes) || meta.bytes < 1 || excludedRetreatMedia.has(name))
      throw Error("INVALID_PUBLIC_MEDIA_ENTRY:" + name);
  }
  return assets;
}

export async function assertRetreatInventory(root, assets) {
  const names = await readdir(resolve(root, "website/assets/retreat"));
  const expected = names.filter(name => !name.startsWith(".") && !excludedRetreatMedia.has(name)).sort();
  if (JSON.stringify(expected) !== JSON.stringify(Object.keys(assets).sort()))
    throw Error("PUBLIC_MEDIA_MANIFEST_MUST_COVER_RETREAT_ASSETS");
}

export async function rewriteStaticMedia(directory, assets) {
  const files = await readdir(directory, { recursive: true, withFileTypes: true });
  for (const entry of files) {
    if (!entry.isFile() || !/\.(?:html|css)$/.test(entry.name)) continue;
    const path = resolve(entry.parentPath, entry.name);
    const original = await readFile(path, "utf8");
    const updated = original.replace(/(?<![\w:/])(?:https:\/\/aroharetreat\.com)?\/assets\/retreat\/([\w.-]+\.(?:webp|mp4))(?![\w.-])/g,
      (match, file) => {
        if (!assets[file]) throw Error("STATIC_MEDIA_NOT_IN_MANIFEST:" + file);
        return mediaUrl(file, assets[file].sha256);
      });
    if (updated !== original) await writeFile(path, updated);
  }
}

export async function assertShellBudget(directory, { includeDesign = false } = {}) {
  const files = await readdir(directory, { recursive: true, withFileTypes: true });
  let bytes = 0;
  for (const entry of files) {
    if (!entry.isFile()) continue;
    const section = relative(resolve(directory), entry.parentPath).split(sep)[0];
    if (includeDesign && section === "design") continue;
    if (/\.(?:mp4|webm|webp|jpe?g|png|avif)$/i.test(entry.name))
      throw Error("MEDIA_IN_HOSTING_SHELL:" + entry.name);
    bytes += (await stat(resolve(entry.parentPath, entry.name))).size;
  }
  if (bytes > shellByteLimit) throw Error("HOSTING_SHELL_TOO_LARGE:" + bytes);
  return bytes;
}

export async function writeMediaHostingConfig(root, assets, environment) {
  if (!["production", "pre-prod"].includes(environment)) throw Error("EXPLICIT_HOSTING_ENVIRONMENT_REQUIRED");
  const preprod = environment === "pre-prod";
  const config = JSON.parse(await readFile(resolve(root, preprod ? "firebase.preprod.json" : "firebase.json"), "utf8"));
  if (config.hosting.site !== (preprod ? "aroha-retreat-preprod" : "aroha-retreat") ||
      config.hosting.public !== (preprod ? "dist-preprod" : "dist"))
    throw Error("MEDIA_HOSTING_TARGET_MISMATCH");
  config.hosting.redirects = [
    ...Object.entries(assets).map(([name, meta]) => ({
      source: "/assets/retreat/" + name,
      destination: mediaUrl(name, meta.sha256),
      type: 302,
    })),
    ...(config.hosting.redirects || []),
  ];
  // Firebase resolves public/source paths relative to the config location.
  const path = preprod ? ".preprod-media.firebase.json" : ".production-media.firebase.json";
  await writeFile(resolve(root, path), JSON.stringify(config, null, 2));
  return path;
}

export const mediaSha256 = bytes => createHash("sha256").update(bytes).digest("hex");

export async function verifyMediaMetadata(assets, fetchImpl = fetch) {
  const names = Object.keys(assets);
  const batch = 24;
  for (let i = 0; i < names.length; i += batch) {
    await Promise.all(names.slice(i, i + batch).map(async name => {
      const expected = assets[name];
      const url = new URL(mediaUrl(name, expected.sha256));
      url.search = "";
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw Error("PUBLIC_MEDIA_NOT_AVAILABLE:" + name);
      const body = await response.json();
      const type = name.endsWith(".mp4") ? "video/mp4" : "image/webp";
      if (body.name !== mediaObject(name, expected.sha256) ||
          Number(body.size) !== expected.bytes || body.contentType !== type ||
          body.metadata?.sha256 !== expected.sha256 ||
          body.cacheControl !== "public,max-age=31536000,immutable")
        throw Error("PUBLIC_MEDIA_METADATA_MISMATCH:" + name);
    }));
  }
  return names.length;
}

export async function verifyLiveMedia(origin, assets, fetchImpl = fetch) {
  const names = ["hero-mobile.webp", "hrudhi-gate-mobile-v2.mp4", "hrudhi-gate-desktop-v2.mp4"];
  for (const name of names) {
    const entry = assets[name], url = mediaUrl(name, entry.sha256);
    const old = await fetchImpl(origin + "/assets/retreat/" + name, {
      redirect: "manual", signal: AbortSignal.timeout(10_000),
    });
    const location = old.headers.get("location");
    await old.body?.cancel();
    if (old.status !== 302 || location !== url)
      throw Error("PUBLIC_MEDIA_LEGACY_PATH_FAILED:" + name);
    const response = await fetchImpl(url, {
      headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(10_000),
    });
    const range = response.headers.get("content-range");
    const type = response.headers.get("content-type");
    const cache = response.headers.get("cache-control") || "";
    if (response.status !== 206 || range !== "bytes 0-0/" + entry.bytes ||
        type !== (name.endsWith(".mp4") ? "video/mp4" : "image/webp") ||
        !cache.includes("max-age=31536000") || !cache.includes("immutable")) {
      await response.body?.cancel();
      throw Error("PUBLIC_MEDIA_RANGE_OR_CACHE_FAILED:" + name);
    }
    if ((await response.arrayBuffer()).byteLength !== 1)
      throw Error("PUBLIC_MEDIA_RANGE_BODY_FAILED:" + name);
  }
  return names.length;
}
