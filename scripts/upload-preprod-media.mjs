import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { firebaseClient } from "./delivery/credentials.mjs";
import { assertRetreatInventory, mediaBucket, mediaObject, mediaSha256, readMediaManifest } from "./preprod-media.mjs";

if (!process.argv.includes("--pre-prod") || !process.argv.includes("--apply"))
  throw Error("EXPLICIT_PREPROD_UPLOAD_REQUIRED");
const assets = await readMediaManifest(process.cwd());
await assertRetreatInventory(process.cwd(), assets);
const pilot = new Set([
  "hero-mobile.webp", "hrudhi-gate-mobile-v2.mp4", "DSC_3916.webp",
  "20261028_093813.webp", "20261028_093817.webp", "20261028_093825.webp",
]);
const names = Object.keys(assets).filter(name => !process.argv.includes("--pilot") || pilot.has(name));
if (!names.length) throw Error("EMPTY_PREPROD_UPLOAD");
const Client = await firebaseClient();
const storage = new Client({ urlPrefix: "https://storage.googleapis.com", apiVersion: "storage/v1", auth: true });
const upload = new Client({ urlPrefix: "https://storage.googleapis.com", apiVersion: "upload/storage/v1", auth: true });
const base = "/b/" + mediaBucket + "/o";
const cacheControl = "public,max-age=31536000,immutable";
let created = 0, reused = 0;

async function publish(name) {
  const entry = assets[name], bytes = await readFile("local/finops/media/" + name);
  if (entry.bytes !== bytes.length || entry.sha256 !== mediaSha256(bytes))
    throw Error("STAGED_MEDIA_HASH_MISMATCH:" + name);
  const object = mediaObject(name, entry.sha256), path = base + "/" + encodeURIComponent(object);
  const contentType = name.endsWith(".mp4") ? "video/mp4" : "image/webp";
  const md5Hash = createHash("md5").update(bytes).digest("base64");
  const metadata = { name: object, contentType, cacheControl, md5Hash, metadata: { sha256: entry.sha256 } };
  let result;
  try {
    result = (await storage.get(path)).body;
    reused++;
  } catch (e) {
    if (e.status !== 404) throw e;
    const boundary = "aroha-" + randomUUID();
    const body = Buffer.concat([
      Buffer.from("--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) + "\r\n--" + boundary + "\r\nContent-Type: " + contentType + "\r\n\r\n"),
      bytes,
      Buffer.from("\r\n--" + boundary + "--\r\n"),
    ]);
    result = (await upload.post(base, body, {
      queryParams: { uploadType: "multipart", ifGenerationMatch: "0" },
      headers: { "Content-Type": "multipart/related; boundary=" + boundary },
      skipLog: { body: true },
    })).body;
    created++;
  }
  if (result.name !== object || Number(result.size) !== entry.bytes || result.md5Hash !== md5Hash ||
      result.metadata?.sha256 !== entry.sha256 || result.cacheControl !== cacheControl ||
      result.contentType !== contentType)
    throw Error("STORAGE_MEDIA_METADATA_MISMATCH:" + name);
}

for (let i = 0; i < names.length; i += 4)
  await Promise.all(names.slice(i, i + 4).map(publish));
console.log(JSON.stringify({ count: names.length, created, reused, bytes: names.reduce((n, name) => n + assets[name].bytes, 0) }));
