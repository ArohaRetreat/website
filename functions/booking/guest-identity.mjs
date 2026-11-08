import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { collectionName, environment, sharedCollectionName } from "../environment.mjs";
import { studioAccess } from "../access.mjs";
import { BookingError } from "./domain.mjs";
import { customerBinding, customerOwnerContext, customerProfiles, normalizedEmail } from "./customers.mjs";
import { readGuestNumber } from "./guest-number.mjs";

export const MAX_ID_BYTES = 1024 * 1024;
export const MAX_ID_REQUEST = Math.ceil(MAX_ID_BYTES / 3) * 4 + 1024;
const DAY = 86400000;
const RETENTION = 90 * DAY;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const validVersion = (value) => typeof value === "string" && uuid.test(value);
const actions = {
  status: [],
  upload: ["version", "consent", "contentType", "contentBase64"],
  preview: ["version"],
  verify: ["version"],
  remove: ["version"],
};
export const isIdentityAction = (action) => Object.hasOwn(actions, action);
const fail = (code, status = 422) => { throw new BookingError(code, status); };
const records = (db) => db.collection(collectionName("booking_guest_ids"));
const files = (db) => db.collection(collectionName("booking_guest_id_files"));
const bucket = () => getStorage().bucket(process.env.FUNCTIONS_EMULATOR
  ? "demo-aroha.appspot.com" : "aroha-retreat.firebasestorage.app");
const object = (store, id) => store.file(`identity/${environment.name}/${id}`);
const view = (number, record) => ({
  guestNumber: number,
  document: record ? {
    version: record.version, uploadedAt: record.uploadedAt, expiresAt: record.expiresAt,
    status: record.verifiedAt ? "verified" : "pending_review",
    ...(record.verifiedAt ? { verifiedAt: record.verifiedAt } : {}),
  } : null,
});

function validate(action, input) {
  if (!isIdentityAction(action)) fail("NOT_FOUND", 404);
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some((key) => key !== "bookingId" && !actions[action].includes(key)))
    fail("INVALID_FIELDS");
  if ("bookingId" in input && !validVersion(input.bookingId)) fail("NOT_FOUND", 404);
  if (action !== "status" && !(action === "upload" && input.version === null) && !validVersion(input.version))
    fail("INVALID_FIELDS");
  if (action === "verify" && !input.bookingId) fail("FORBIDDEN", 403);
  if (action !== "upload") return null;
  if (input.consent !== true) fail("IDENTITY_CONSENT_REQUIRED");
  const { contentBase64, contentType } = input;
  if (typeof contentBase64 !== "string" || contentBase64.length > MAX_ID_REQUEST ||
      !["image/jpeg", "image/png"].includes(contentType))
    fail("INVALID_ID_IMAGE");
  const buffer = Buffer.from(contentBase64, "base64");
  if (buffer.length < 16 || buffer.length > MAX_ID_BYTES || buffer.toString("base64") !== contentBase64)
    fail("INVALID_ID_IMAGE");
  const png = buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  const jpeg = buffer.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex")) &&
    buffer.subarray(-2).equals(Buffer.from("ffd9", "hex"));
  if (contentType === "image/png" ? !png : !jpeg) fail("INVALID_ID_IMAGE");
  return buffer;
}

async function context(tx, db, token, bookingId, now) {
  if (token._integration || token.email_verified !== true ||
      token.firebase?.sign_in_provider !== "google.com")
    fail("VERIFIED_GOOGLE_ACCOUNT_REQUIRED", 403);
  let ownerIds, customerId, canInspect = true, canUpload = true;
  if (bookingId) {
    const member = (await tx.get(db.collection(sharedCollectionName("members")).doc(token.uid))).data();
    if (studioAccess(member).bookings !== "manager") fail("FORBIDDEN", 403);
    const b = (await tx.get(db.collection(collectionName("bookings")).doc(bookingId))).data();
    if (!b) fail("NOT_FOUND", 404);
    ({ ownerIds, customerId } = await customerOwnerContext(tx, db, b.owner));
    canInspect = ["confirmed", "checked_in"].includes(b.status);
    canUpload = canInspect && b.source === "host_manual";
  } else {
    ({ ownerIds, customerId } = await customerBinding(tx, db, token));
  }
  const profile = (await tx.get(customerProfiles(db).doc(customerId))).data();
  if (!profile || profile.erasedAt) fail("PROFILE_RECREATE_REQUIRED", 409);
  if (!bookingId && normalizedEmail(token.email) !== normalizedEmail(profile.email))
    fail("IDENTITY_REVIEW_REQUIRED", 409);
  const number = await readGuestNumber(tx, db, ownerIds);
  if (!canInspect) return { number, canInspect, canUpload };
  const snapshots = await tx.getAll(...ownerIds.map((id) => records(db).doc(id)));
  const current = snapshots.filter((s) => s.data()?.expiresAt > now);
  if (current.length > 1) fail("IDENTITY_REVIEW_REQUIRED", 409);
  const chosen = current[0] || snapshots.find((s) => s.id === customerId);
  return {
    number, canInspect, canUpload, ref: chosen.ref,
    record: current[0]?.data(),
  };
}

function requireVersion(c, version) {
  if ((c.record?.version ?? null) !== version) fail("IDENTITY_VERSION_CONFLICT", 409);
}

function audit(tx, db, action, uid, requestId, now) {
  tx.create(db.collection(collectionName("booking_identity_audit")).doc(), {
    action, actor: uid, requestId, at: now,
  });
}

function retire(tx, db, record, now) {
  if (record) tx.set(files(db).doc(record.version), { dueAt: now }, { merge: true });
}

// Called by the existing profile erasure transaction. Read before any write.
export async function prepareIdentityErasure(tx, db, ownerIds) {
  if (!environment.preprod) return () => {};
  const rows = await tx.getAll(...ownerIds.map((id) => records(db).doc(id)));
  return (now) => {
    for (const row of rows) {
      if (!row.exists) continue;
      retire(tx, db, row.data(), now);
      tx.delete(row.ref);
    }
  };
}

export async function guestIdentity(db, token, action, input, requestId, options = {}) {
  const buffer = validate(action, input);
  const now = options.now ?? Date.now();
  const getContext = (tx) => context(tx, db, token, input.bookingId, now);
  if (action === "status")
    return db.runTransaction(async (tx) => {
      const c = await getContext(tx);
      return { ...view(c.number, c.record), canInspect: c.canInspect, canUpload: c.canUpload };
    });

  const update = (tx, c) => {
    if (!c.canInspect || (action === "upload" && !c.canUpload) ||
        (action === "remove" && input.bookingId))
      fail("FORBIDDEN", 403);
    requireVersion(c, input.version);
    if (action === "upload" && input.bookingId && c.record) fail("FORBIDDEN", 403);
    return c.record;
  };
  if (action === "upload") {
    const id = randomUUID(), job = files(db).doc(id);
    await db.runTransaction(async (tx) => {
      update(tx, await getContext(tx));
      // A failed or interrupted upload still has a bounded cleanup record.
      tx.create(job, { dueAt: now + DAY, state: "pending" });
    });
    const store = options.bucket ?? bucket(), file = object(store, id);
    try {
      let cleaned;
      try {
        const { default: sharp } = await import("sharp");
        const image = sharp(buffer, { limitInputPixels: 12000000, failOn: "error" });
        const metadata = await image.metadata();
        if (metadata.format !== (input.contentType === "image/png" ? "png" : "jpeg") || (metadata.pages ?? 1) !== 1)
          fail("INVALID_ID_IMAGE");
        cleaned = await image.autoOrient().resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
          .flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer();
        if (cleaned.length > MAX_ID_BYTES) fail("INVALID_ID_IMAGE");
      } catch {
        fail("INVALID_ID_IMAGE");
      }
      await file.save(cleaned, {
        resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: "image/jpeg", cacheControl: "private, no-store" },
      });
      return await db.runTransaction(async (tx) => {
        const c = await getContext(tx);
        const previous = update(tx, c);
        const pending = (await tx.get(job)).data();
        if (pending?.state !== "pending" || pending.dueAt <= (options.now ?? Date.now()))
          fail("IDENTITY_UPLOAD_EXPIRED", 409);
        const record = {
          version: id, uploadedAt: now, expiresAt: now + RETENTION,
          contentType: "image/jpeg", uploadedBy: token.uid,
          consentPolicy: "guest-id-v1", source: input.bookingId ? "host_manual" : "guest",
        };
        retire(tx, db, previous, now);
        tx.set(c.ref, record);
        tx.set(job, { dueAt: record.expiresAt, state: "active", owner: c.ref.id });
        audit(tx, db, action, token.uid, requestId, now);
        return view(c.number, record);
      });
    } catch (error) {
      // Do not delete after an ambiguous commit. The worker handles pending uploads.
      throw error instanceof BookingError ? error : new BookingError("IDENTITY_STORAGE_UNAVAILABLE", 503);
    }
  }

  const result = await db.runTransaction(async (tx) => {
    const c = await getContext(tx), record = update(tx, c);
    if (action === "remove") {
      retire(tx, db, record, now);
      tx.delete(c.ref);
    }
    if (action === "verify" && !record.verifiedAt) {
      record.verifiedAt = now;
      tx.update(c.ref, { verifiedAt: now, verifiedBy: token.uid, verifiedBooking: input.bookingId });
    }
    audit(tx, db, action, token.uid, requestId, now);
    return { number: c.number, record };
  });
  if (action !== "preview") return view(result.number, action === "remove" ? null : result.record);
  try {
    const [bytes] = await object(options.bucket ?? bucket(), result.record.version).download();
    await db.runTransaction(async (tx) => update(tx, await context(tx, db, token, input.bookingId, options.now ?? Date.now())));
    return { contentType: result.record.contentType, contentBase64: bytes.toString("base64") };
  } catch (error) {
    if (error instanceof BookingError) throw error;
    fail("IDENTITY_STORAGE_UNAVAILABLE", 503);
  }
}

export async function drainGuestIdentity(db, { now = Date.now(), storage } = {}) {
  const due = await files(db).where("dueAt", "<=", now).orderBy("dueAt").limit(20).get();
  if (due.empty) return;
  const store = storage ?? bucket();
  let failed = false;
  for (const row of due.docs) {
    try {
      const retireObject = await db.runTransaction(async (tx) => {
        const job = (await tx.get(row.ref)).data();
        if (!job || job.dueAt > now) return false;
        if (job.owner) {
          const ref = records(db).doc(job.owner);
          if ((await tx.get(ref)).data()?.version === row.id) tx.delete(ref);
        }
        tx.set(row.ref, { state: "retired", dueAt: now }, { merge: true });
        return true;
      });
      if (retireObject) {
        await object(store, row.id).delete({ ignoreNotFound: true });
        await row.ref.delete();
      }
    } catch {
      failed = true;
    }
  }
  if (failed) throw Error("IDENTITY_CLEANUP_UNAVAILABLE");
}
