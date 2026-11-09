import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { posix, resolve } from "node:path";
import { mediaBucket } from "./preprod-media.mjs";

export const naturaCache = "public,max-age=31536000,immutable";
export const naturaShellLimit = 650_000;
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sameOriginSprite = "/design/assets/farm-atlas/farm-icons.svg";
const mimeTypes = {
  ".json": "application/json",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".psd": "image/vnd.adobe.photoshop",
  ".puppet": "application/octet-stream",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".zip": "application/zip",
};
const firebaseStorage = "https://firebasestorage.googleapis.com/v0/b/" + mediaBucket + "/o/";
const storageUrl = (object) => firebaseStorage + encodeURIComponent(object) + "?alt=media";
const validDigest = /^[a-f0-9]{64}$/;

function typeFor(path) {
  if (path === sameOriginSprite) return;
  const ext = posix.extname(path);
  if (ext === ".json" && !path.startsWith("/design/assets/")) return;
  return mimeTypes[ext];
}

function disposition(path, name) {
  const download = /\.(?:zip|psd|puppet)$/.test(path) ||
    /^\/design\/assets\/(?:logos|icons|illustrations)\//.test(path);
  return (download ? "attachment" : "inline") + '; filename="' + name + '"';
}

export async function readNaturaLayout(root) {
  const [pin, source] = await Promise.all(
    ["natura-export-files.json", "natura-hosting.json"].map(async (file) =>
      JSON.parse(await readFile(resolve(root, "config", file), "utf8"))),
  );
  if (pin.schemaVersion !== 1 || pin.revision !== source.revision || pin.version !== source.version ||
      !/^[a-f0-9]{40}$/.test(pin.revision) || !Array.isArray(pin.files))
    throw Error("NATURA_EXPORT_PIN_MISMATCH");
  const shell = [], media = [], seen = new Set();
  for (const file of pin.files) {
    if (!/^\/design\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/.test(file.path) ||
        file.path.split("/").some(part => part === "." || part === "..") ||
        !validDigest.test(file.sha256) || !validDigest.test(file.hostingHash) || seen.has(file.path))
      throw Error("INVALID_NATURA_EXPORT_FILE");
    seen.add(file.path);
    const contentType = typeFor(file.path);
    if (!contentType) {
      shell.push(file);
      continue;
    }
    const directory = posix.dirname(file.path), name = posix.basename(file.path);
    const prefix = "media/natura-" + pin.revision + "-" + sha256(directory).slice(0, 12) + "-";
    const object = prefix + name;
    media.push({
      ...file, object, url: storageUrl(object), contentType,
      contentDisposition: disposition(file.path, name),
    });
  }
  if (!shell.some(file => file.path === "/design/index.html") || !media.length)
    throw Error("INCOMPLETE_NATURA_LAYOUT");
  const redirects = media.map(file => ({ source: file.path, destination: file.url, type: 302 }));
  return { pin, shell, media, redirects };
}

export function naturaMediaReceipt(layout) {
  return { files: layout.media.length, sha256: sha256(JSON.stringify(layout.media)) };
}

export async function configureNaturaHosting(configPath, layout) {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (!["aroha-retreat", "aroha-retreat-preprod"].includes(config.hosting?.site))
    throw Error("UNEXPECTED_NATURA_HOSTING_TARGET");
  const hosting = config.hosting;
  if (hosting.redirects?.some(rule => rule.source?.startsWith("/design") || rule.regex?.startsWith("^/design")))
    throw Error("DUPLICATE_NATURA_REDIRECTS");
  hosting.redirects = [...layout.redirects, ...(hosting.redirects || [])];
  if (!hosting.rewrites.some(rule => rule.source === "/design/**"))
    hosting.rewrites.push({ source: "/design/**", destination: "/design/index.html" });
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
  return configPath;
}

export function naturaSamples(layout) {
  const onePerType = new Map(layout.media.map(file => [file.contentType, file]));
  const profile = layout.media.find(file => file.path.endsWith("/aroha-profile-2048-transparent.png"));
  if (profile) onePerType.set("profile", profile);
  return [...onePerType.values()];
}

export async function verifyNaturaObject(file, fetchImpl = fetch) {
  const response = await fetchImpl(file.url.split("?")[0], { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw Error("NATURA_STORAGE_NOT_AVAILABLE:" + file.path);
  const metadata = await response.json();
  if (metadata.name !== file.object || metadata.metadata?.sha256 !== file.sha256 ||
      metadata.contentType !== file.contentType || metadata.contentDisposition !== file.contentDisposition ||
      metadata.cacheControl !== naturaCache || !(Number(metadata.size) > 0))
    throw Error("NATURA_STORAGE_METADATA_MISMATCH:" + file.path);
  return Number(metadata.size);
}

export async function verifyNaturaRoutes(origin, layout, fetchImpl = fetch) {
  const samples = naturaSamples(layout);
  await Promise.all(samples.map(async file => {
    const bytes = await verifyNaturaObject(file, fetchImpl);
    const response = await fetchImpl(origin + file.path, {
      redirect: "manual", signal: AbortSignal.timeout(12_000),
    });
    await response.body?.cancel();
    if (response.status !== 302 || response.headers.get("location") !== file.url)
      throw Error("NATURA_REDIRECT_MISMATCH:" + file.path);
    const range = await fetchImpl(file.url, {
      headers: { Origin: origin, Range: "bytes=0-0" }, signal: AbortSignal.timeout(12_000),
    });
    const cors = range.headers.get("access-control-allow-origin");
    if (range.status !== 206 || range.headers.get("content-range") !== "bytes 0-0/" + bytes ||
        range.headers.get("content-type") !== file.contentType || (cors !== origin && cors !== "*")) {
      await range.body?.cancel();
      throw Error("NATURA_STORAGE_RANGE_OR_CORS:" + file.path);
    }
    if ((await range.arrayBuffer()).byteLength !== 1) throw Error("NATURA_STORAGE_RANGE_BYTES:" + file.path);
  }));
  return samples.length;
}
