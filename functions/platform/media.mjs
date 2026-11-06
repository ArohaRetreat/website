import { randomUUID, createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { col, fail, version, queryPage, principal, permit } from "./core.mjs";
import { environment } from "../environment.mjs";
export const mediaTypes = {
  "image/jpeg": ["jpg", 10 * 1024 * 1024],
  "image/png": ["png", 10 * 1024 * 1024],
  "image/webp": ["webp", 10 * 1024 * 1024],
  "image/avif": ["avif", 10 * 1024 * 1024],
  "video/mp4": ["mp4", 40 * 1024 * 1024],
  "video/webm": ["webm", 40 * 1024 * 1024],
};
export function validMediaSignature(bytes, type) {
  if (type === "image/jpeg")
    return bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (type === "image/png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/webp")
    return (
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    );
  if (type === "image/avif" || type === "video/mp4") {
    if (bytes.toString("ascii", 4, 8) !== "ftyp") return false;
    const brands = bytes.toString("ascii", 8, Math.min(bytes.length, 64));
    return type === "image/avif"
      ? /avif|avis/.test(brands)
      : /isom|iso2|mp41|mp42|avc1|M4V /.test(brands) &&
          !/avif|avis/.test(brands);
  }
  return (
    type === "video/webm" &&
    bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))
  );
}
const view = (m) => ({
  id: m.id,
  type: m.type,
  size: m.size,
  sha256: m.sha256,
  status: m.status,
  version: m.version,
  createdAt: m.createdAt,
  ...(m.url ? { url: m.url } : {}),
  ...(m.completedAt ? { completedAt: m.completedAt } : {}),
});
export async function mediaHandler({ tx, db, ctx, input }) {
  const op = ctx.operation;
  if (op === "listMedia")
    return queryPage(tx, db, ctx, op, input, col(db, "media_catalog"), view);
  if (op === "initiateMediaUpload") {
    if (!mediaTypes[input.type] || input.size >= mediaTypes[input.type][1])
      fail("INVALID_MEDIA_SIZE_OR_TYPE");
    const id = randomUUID(),
      m = {
        id,
        owner: ctx.uid,
        type: input.type,
        size: input.size,
        sha256: input.sha256,
        status: "initialized",
        version: 1,
        createdAt: ctx.now,
        staging: `api-staging/${environment.name}/${ctx.uid}/${id}`,
        object: `media/${environment.preprod ? "preprod-" : ""}api-${id}.${mediaTypes[input.type][0]}`,
        expiresAt: ctx.now + 3600000,
      };
    tx.create(col(db, "media_uploads").doc(id), m);
    return { id, status: m.status, version: 1 };
  }
  const ref = col(
      db,
      op === "archiveMedia" ? "media_catalog" : "media_uploads",
    ).doc(input.id),
    m = (await tx.get(ref)).data();
  if (!m) fail("NOT_FOUND", 404);
  if (op === "getMediaUpload") {
    if (m.owner !== ctx.uid) fail("NOT_FOUND", 404);
    return view(m);
  }
  version(m.version, input.expectedVersion);
  if (op === "archiveMedia") {
    const [d, p] = await Promise.all([
      tx.get(col(db, "content").doc("draft")),
      tx.get(col(db, "public").doc("site")),
    ]);
    if (
      [d, p].some(
        (s) => s.exists && JSON.stringify(s.data().content).includes(m.url),
      )
    )
      fail("MEDIA_IN_USE", 409);
    if (m.status === "archived") fail("ALREADY_ARCHIVED", 409);
    const next = {
      ...m,
      status: "archived",
      version: m.version + 1,
      archivedAt: ctx.now,
    };
    tx.set(ref, next);
    return view(next);
  }
  if (m.owner !== ctx.uid) fail("NOT_FOUND", 404);
  if (m.expiresAt <= ctx.now) fail("UPLOAD_EXPIRED", 410);
  if (m.status === "completed") return view(m);
  if (m.status !== "initialized" && m.status !== "finalizing")
    fail("UPLOAD_NOT_FINALIZABLE", 409);
  // A committed intent precedes Storage publication. Replaying the same request resumes it.
  tx.update(ref, { status: "finalizing" });
  return { id: m.id, status: "finalizing", version: m.version };
}
const bucket = () =>
  getStorage().bucket(
    process.env.FUNCTIONS_EMULATOR
      ? "demo-aroha.appspot.com"
      : "aroha-retreat.firebasestorage.app",
  );
export async function settleMedia(
  db,
  token,
  operation,
  result,
  { storage = bucket() } = {},
) {
  if (!["initiateMediaUpload", "finalizeMediaUpload"].includes(operation))
    return result;
  const ref = col(db, "media_uploads").doc(result.id);
  const load = () =>
    db.runTransaction(async (tx) => {
      const ctx = await principal(tx, db, token);
      permit(ctx, "website-edit");
      const m = (await tx.get(ref)).data();
      if (!m || m.owner !== token.uid) fail("NOT_FOUND", 404);
      return m;
    });
  let m = await load();
  if (m.status === "completed") return view(m);
  if (m.expiresAt <= Date.now()) fail("UPLOAD_EXPIRED", 410);
  if (operation === "initiateMediaUpload") {
    if (!m.uploadUrl) {
      const [uploadUrl] = await storage
        .file(m.staging)
        .createResumableUpload({
          metadata: { contentType: m.type },
          preconditionOpts: { ifGenerationMatch: 0 },
        });
      await db.runTransaction(async (tx) => {
        const ctx = await principal(tx, db, token);
        permit(ctx, "website-edit");
        const latest = (await tx.get(ref)).data();
        if (!latest.uploadUrl) tx.update(ref, { uploadUrl });
      });
      m = await load();
    }
    return {
      ...view(m),
      uploadUrl: m.uploadUrl,
      expiresAt: m.expiresAt,
      uploadMethod: "PUT",
      contentType: m.type,
    };
  }
  if (m.status !== "finalizing") fail("UPLOAD_NOT_FINALIZABLE", 409);
  const file = storage.file(m.staging);
  let metadata;
  try {
    [metadata] = await file.getMetadata();
  } catch (e) {
    if (e.code === 404) fail("UPLOAD_NOT_FOUND", 409);
    throw e;
  }
  if (Number(metadata.size) !== m.size || metadata.contentType !== m.type)
    fail("MEDIA_METADATA_MISMATCH", 422);
  const source = storage.file(m.staging, { generation: metadata.generation });
  const hash = createHash("sha256");
  let size = 0,
    head = Buffer.alloc(0);
  for await (const chunk of source.createReadStream({ validation: true })) {
    size += chunk.length;
    if (size > m.size) fail("MEDIA_SIZE_MISMATCH", 422);
    hash.update(chunk);
    if (head.length < 64)
      head = Buffer.concat([head, chunk.subarray(0, 64 - head.length)]);
  }
  if (
    size !== m.size ||
    hash.digest("hex") !== m.sha256 ||
    !validMediaSignature(head, m.type)
  )
    fail("MEDIA_CONTENT_MISMATCH", 422);
  // Copy the immutable generation that was validated; stream hashing uses bounded memory.
  const publicFile = storage.file(m.object),
    downloadToken = m.id;
  try {
    await source.copy(publicFile, {
      preconditionOpts: { ifGenerationMatch: 0 },
      contentType: m.type,
      cacheControl: "public,max-age=31536000,immutable",
      metadata: {
        sha256: m.sha256,
        firebaseStorageDownloadTokens: downloadToken,
      },
    });
  } catch (e) {
    if (![409, 412].includes(Number(e.code))) throw e;
    const [old] = await publicFile.getMetadata();
    if (old.metadata?.sha256 !== m.sha256)
      fail("MEDIA_PUBLICATION_CONFLICT", 409);
  }
  return db.runTransaction(async (tx) => {
    const ctx = await principal(tx, db, token);
    permit(ctx, "website-edit");
    const latest = (await tx.get(ref)).data();
    if (latest.status === "completed") return view(latest);
    if (latest.status !== "finalizing") fail("UPLOAD_NOT_FINALIZABLE", 409);
    const completed = {
      ...latest,
      status: "completed",
      version: latest.version + 1,
      completedAt: Date.now(),
      url: `https://firebasestorage.googleapis.com/v0/b/aroha-retreat.firebasestorage.app/o/${encodeURIComponent(m.object)}?alt=media&token=${downloadToken}`,
    };
    tx.set(ref, completed);
    const { uploadUrl, staging, expiresAt, ...catalog } = completed;
    tx.create(col(db, "media_catalog").doc(m.id), catalog);
    return view(completed);
  });
}
