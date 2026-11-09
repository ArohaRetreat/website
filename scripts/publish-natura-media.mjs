import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { firebaseClient } from "./delivery/credentials.mjs";
import { mediaBucket } from "./preprod-media.mjs";
import { naturaCache, readNaturaLayout, sha256, verifyNaturaObject } from "./natura-media.mjs";
import { restorePinnedExport } from "./restore-pinned-export.mjs";

const args = process.argv.slice(2);
const source = args[args.indexOf("--source") + 1];
if (!args.includes("--pre-prod") || !args.includes("--apply") || !args.includes("--source") ||
    !source || !isAbsolute(source))
  throw Error("USE_PREPROD_UPLOAD_WITH_ABSOLUTE_NATURA_EXPORT");

const layout = await readNaturaLayout(process.cwd());
const pilotPaths = [
  "/design/assets/illustrations/landscape.webp",
  "/design/assets/logos/profile/aroha-profile-2048-transparent.png",
  "/design/assets/icons/full-aroha-icon-colour.svg",
  "/design/assets/hrudhi/videos/explorer-welcome.mp4",
  "/design/assets/fonts/Lora.woff2",
  "/design/downloads/Natura-Service-Icons-v0.3.0.zip",
];
const media = args.includes("--pilot")
  ? pilotPaths.map(path => {
      const file = layout.media.find(entry => entry.path === path);
      if (!file) throw Error("NATURA_PILOT_PATH_MISSING:" + path);
      return file;
    })
  : layout.media;
const staging = resolve("local/natura-media-source");
const Client = await firebaseClient();
const storage = new Client({ urlPrefix: "https://storage.googleapis.com", apiVersion: "storage/v1", auth: true });
const upload = new Client({ urlPrefix: "https://storage.googleapis.com", apiVersion: "upload/storage/v1", auth: true });
const base = "/b/" + mediaBucket + "/o";
let created = 0, reused = 0, bytes = 0;

async function stagedBytes(file) {
  try {
    const data = await readFile(resolve(source, "." + file.path));
    if (sha256(data) === file.sha256) return data;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await restorePinnedExport(staging, { files: [file] });
  return readFile(resolve(staging, "." + file.path));
}

async function publish(file) {
  const path = base + "/" + encodeURIComponent(file.object);
  let result;
  try {
    result = (await storage.get(path, { skipLog: { body: true } })).body;
    reused++;
  } catch (error) {
    if (error.status !== 404) throw error;
    const data = await stagedBytes(file);
    if (sha256(data) !== file.sha256) throw Error("NATURA_SOURCE_HASH_MISMATCH:" + file.path);
    const metadata = {
      name: file.object, contentType: file.contentType, contentDisposition: file.contentDisposition,
      cacheControl: naturaCache, md5Hash: createHash("md5").update(data).digest("base64"),
      metadata: { sha256: file.sha256 },
    };
    const boundary = "aroha-" + randomUUID();
    const body = Buffer.concat([
      Buffer.from("--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) + "\r\n--" + boundary + "\r\nContent-Type: " + file.contentType + "\r\n\r\n"),
      data, Buffer.from("\r\n--" + boundary + "--\r\n"),
    ]);
    try {
      result = (await upload.post(base, body, {
        queryParams: { uploadType: "multipart", ifGenerationMatch: "0" },
        headers: { "Content-Type": "multipart/related; boundary=" + boundary },
        skipLog: { body: true },
      })).body;
      if (result.md5Hash !== metadata.md5Hash || Number(result.size) !== data.length)
        throw Error("NATURA_STORAGE_CHECKSUM_MISMATCH:" + file.path);
      created++;
    } catch (uploadError) {
      if (uploadError.status !== 412) throw uploadError;
      result = (await storage.get(path, { skipLog: { body: true } })).body;
      reused++;
    }
  }
  if (result.name !== file.object || result.metadata?.sha256 !== file.sha256 ||
      result.contentType !== file.contentType || result.contentDisposition !== file.contentDisposition ||
      result.cacheControl !== naturaCache)
    throw Error("NATURA_STORAGE_METADATA_MISMATCH:" + file.path);
  const verifiedBytes = await verifyNaturaObject(file);
  bytes += verifiedBytes;
}
for (let offset = 0; offset < media.length; offset += 8) {
  await Promise.all(media.slice(offset, offset + 8).map(publish));
  if (offset && offset % 160 === 0) console.log("Verified Storage objects:", offset + 8);
}
console.log(JSON.stringify({ verified: media.length, created, reused, bytes }));
