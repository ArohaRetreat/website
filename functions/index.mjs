import { traceRequest, recordSummary, domainSpan } from "./telemetry.mjs";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash, randomUUID } from "node:crypto";
import {
  DomainError,
  classifyError,
  can,
  mayManage,
  emailKey,
  expectedVersion,
  validateContent,
} from "./domain.mjs";
initializeApp();
const monitoringSecret = defineSecret("DYNATRACE_PLATFORM_TOKEN");
const db = getFirestore(),
  hash = (v) => createHash("sha256").update(v).digest("hex");
const collection = (name) => db.collection("aroha_" + name);
const owners = () =>
  new Set(
    (process.env.SUPER_ADMIN_EMAILS || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  );
const now = () => FieldValue.serverTimestamp();
function audit(tx, actor, operation, entity, extra = {}) {
  const ref = collection("audit").doc();
  tx.set(ref, {
    schemaVersion: 1,
    eventId: ref.id,
    actor: actor.uid,
    operation,
    entity,
    occurredAt: now(),
    ...extra,
  });
}
async function session(token) {
  if (
    token.email_verified !== true ||
    token.firebase?.sign_in_provider !== "google.com"
  )
    throw new DomainError("VERIFIED_GOOGLE_ACCOUNT_REQUIRED", 403);
  const email = emailKey(token.email),
    ref = collection("members").doc(token.uid);
  return db.runTransaction(async (tx) => {
    const member = await tx.get(ref);
    if (owners().has(email)) {
      if (
        !member.exists ||
        member.data().role !== "superadmin" ||
        !member.data().active
      ) {
        tx.set(
          ref,
          { email, role: "superadmin", active: true, updatedAt: now() },
          { merge: true },
        );
        audit(tx, token, "access.bootstrap", token.uid);
      }
      return { uid: token.uid, email, role: "superadmin", active: true };
    }
    if (member.exists) {
      const m = member.data();
      if (!m.active) throw new DomainError("ACCESS_REVOKED", 403);
      return { uid: token.uid, email, role: m.role, active: true };
    }
    const inviteRef = collection("invitations").doc(hash(email)),
      invite = await tx.get(inviteRef);
    if (
      !invite.exists ||
      invite.data().status !== "pending" ||
      invite.data().expiresAt <= Date.now()
    )
      throw new DomainError("INVITATION_REQUIRED", 403);
    const role = invite.data().role;
    tx.set(ref, { email, role, active: true, updatedAt: now() });
    tx.update(inviteRef, {
      status: "accepted",
      acceptedAt: now(),
      uid: token.uid,
    });
    audit(tx, token, "access.accepted", token.uid);
    return { uid: token.uid, email, role, active: true };
  });
}
async function requireMember(token, operation) {
  const member = await collection("members").doc(token.uid).get();
  if (
    !member.exists ||
    !member.data().active ||
    !can(member.data().role, operation)
  )
    throw new DomainError("FORBIDDEN", 403);
  return { uid: token.uid, ...member.data() };
}
async function mutate(actor, operation, callback) {
  return domainSpan("firestore." + operation, () =>
    db.runTransaction(async (tx) => {
      const member = await tx.get(collection("members").doc(actor.uid));
      const permission = operation.startsWith("access.")
        ? "access"
        : operation === "content.saved"
          ? "edit"
          : "publish";
      if (
        !member.exists ||
        !member.data().active ||
        !can(member.data().role, permission)
      )
        throw new DomainError("FORBIDDEN", 403);
      actor.role = member.data().role;
      return callback(tx);
    }),
  );
}
const clean = (s) => ({
  id: s.id,
  ...s.data(),
  updatedAt: s.data().updatedAt?.toDate?.().toISOString() ?? null,
});
export const arohaApi = onRequest(
  {
    region: "asia-south2",
    memory: "256MiB",
    maxInstances: 3,
    timeoutSeconds: 30,
    invoker: "public",
    secrets: process.env.DT_EXPORT_ENABLED === "true" ? [monitoringSecret] : [],
  },
  async (req, res) => {
    const payload = await traceRequest(req, res, async () => {
      const requestId = randomUUID(),
        started = Date.now();
      let operation = "unknown",
        status = 200,
        errorCode = "";
      res.set("X-Request-Id", requestId);
      res.set("Cache-Control", "no-store");
      res.set("X-Content-Type-Options", "nosniff");
      try {
        if (
          req.get("origin") &&
          ![
            "https://aroha-retreat.web.app",
            "https://aroha-retreat.firebaseapp.com",
            ...(process.env.FUNCTIONS_EMULATOR
              ? ["http://127.0.0.1:8770", "http://localhost:8770"]
              : []),
          ].includes(req.get("origin"))
        )
          throw new DomainError("ORIGIN_DENIED", 403);
        if (req.rawBody?.length > 220000)
          throw new DomainError("PAYLOAD_TOO_LARGE", 413);
        const bearer = req.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
        if (!bearer) throw new DomainError("SIGN_IN_REQUIRED", 401);
        let token;
        try {
          token = await getAuth().verifyIdToken(bearer, true);
        } catch {
          throw new DomainError("INVALID_SESSION", 401);
        }
        const path =
          req.path.replace(/^\/api\/v1/, "").replace(/\/$/, "") || "/";
        const b = req.body ?? {};
        if (req.method === "POST" && !req.is("application/json"))
          throw new DomainError("JSON_REQUIRED", 415);
        if (path === "/session" && req.method === "POST") {
          operation = "access.session";
          return ({ session: await session(token), requestId });
        }
        const actor = await requireMember(token, "read");
        if (path === "/draft" && req.method === "GET") {
          operation = "content.read";
          const snap = await collection("content").doc("draft").get();
          return ({
            draft: snap.exists ? snap.data() : null,
            requestId,
          });
        }
        if (path === "/draft" && req.method === "POST") {
          operation = "content.saved";
          if (!can(actor.role, "edit")) throw new DomainError("FORBIDDEN", 403);
          validateContent(b.content);
          const ref = collection("content").doc("draft");
          const version = await mutate(actor, operation, async (tx) => {
            const snap = await tx.get(ref);
            const current = snap.exists ? snap.data().version : 0;
            expectedVersion(b.expectedVersion, current);
            tx.set(ref, {
              content: b.content,
              version: current + 1,
              updatedAt: now(),
              updatedBy: actor.uid,
            });
            audit(tx, actor, operation, "draft", { version: current + 1 });
            return current + 1;
          });
          return ({ version, requestId });
        }
        if (path === "/publish" && req.method === "POST") {
          operation = "content.published";
          if (!can(actor.role, "publish"))
            throw new DomainError("FORBIDDEN", 403);
          const draft = collection("content").doc("draft"),
            pub = collection("public").doc("site");
          const version = await mutate(actor, operation, async (tx) => {
            const d = await tx.get(draft);
            if (!d.exists) throw new DomainError("NO_DRAFT", 404);
            const value = d.data();
            expectedVersion(b.expectedVersion, value.version);
            validateContent(value.content);
            const previous = await tx.get(pub);
            if (previous.exists && previous.data().version === value.version)
              throw new DomainError("ALREADY_PUBLISHED", 409);
            const rev = collection("revisions").doc(String(value.version));
            tx.set(rev, {
              ...value,
              publishedAt: now(),
              publishedBy: actor.uid,
            });
            tx.set(pub, {
              content: value.content,
              version: value.version,
              publishedAt: now(),
            });
            audit(tx, actor, operation, "site", { version: value.version });
            return value.version;
          });
          return ({ version, requestId });
        }
        if (path === "/revisions" && req.method === "GET") {
          operation = "content.history";
          const limit = 25,
            cursor = req.query.cursor;
          if (
            cursor &&
            (!Number.isSafeInteger(Number(cursor)) || Number(cursor) < 0)
          )
            throw new DomainError("INVALID_CURSOR");
          let q = collection("revisions")
            .orderBy("version", "desc")
            .limit(limit + 1);
          if (cursor) q = q.startAfter(Number(cursor));
          const rows = (await q.get()).docs;
          return ({
            revisions: rows
              .slice(0, limit)
              .map((s) => ({
                id: s.id,
                version: s.data().version,
                publishedAt:
                  s.data().publishedAt?.toDate?.().toISOString() ?? null,
              })),
            nextCursor:
              rows.length > limit ? rows[limit - 1].data().version : null,
            requestId,
          });
        }
        if (path === "/restore" && req.method === "POST") {
          operation = "content.restored";
          if (!can(actor.role, "publish"))
            throw new DomainError("FORBIDDEN", 403);
          if (!Number.isSafeInteger(b.revision) || b.revision < 1)
            throw new DomainError("INVALID_REVISION");
          const version = await mutate(actor, operation, async (tx) => {
            const ref = collection("content").doc("draft"),
              current = await tx.get(ref),
              old = await tx.get(
                collection("revisions").doc(String(b.revision)),
              );
            if (!old.exists) throw new DomainError("NOT_FOUND", 404);
            expectedVersion(
              b.expectedVersion,
              current.exists ? current.data().version : 0,
            );
            const content = validateContent(old.data().content),
              version = b.expectedVersion + 1;
            tx.set(ref, {
              content,
              version,
              updatedAt: now(),
              updatedBy: actor.uid,
            });
            audit(tx, actor, operation, "draft", {
              version,
              restoredFrom: b.revision,
            });
            return version;
          });
          return ({ version, requestId });
        }
        if (
          (path === "/members" || path === "/invitations") &&
          req.method === "GET"
        ) {
          operation = "access.list";
          if (!can(actor.role, "access"))
            throw new DomainError("FORBIDDEN", 403);
          const col = path.slice(1);
          let q = collection(col).orderBy("__name__").limit(51);
          const cursor = req.query.cursor;
          if (cursor) {
            if (
              typeof cursor !== "string" ||
              cursor.length > 128 ||
              cursor.includes("/")
            )
              throw new DomainError("INVALID_CURSOR");
            q = q.startAfter(cursor);
          }
          const rows = (await q.get()).docs;
          return ({
            [col]: rows.slice(0, 50).map(clean),
            nextCursor: rows.length > 50 ? rows[49].id : null,
            requestId,
          });
        }
        if (path === "/invitations" && req.method === "POST") {
          operation = "access.invited";
          const email = emailKey(b.email);
          if (!mayManage(actor.role, "viewer", b.role))
            throw new DomainError("FORBIDDEN", 403);
          if (owners().has(email))
            throw new DomainError("PROTECTED_OWNER", 409);
          await mutate(actor, operation, async (tx) => {
            const target = await tx.get(
              collection("members").where("email", "==", email).limit(1),
            );
            if (!target.empty) throw new DomainError("MEMBER_EXISTS", 409);
            tx.set(collection("invitations").doc(hash(email)), {
              email,
              role: b.role,
              status: "pending",
              expiresAt: Date.now() + 7 * 86400000,
              invitedBy: actor.uid,
              updatedAt: now(),
            });
            audit(tx, actor, operation, hash(email));
          });
          return ({
            inviteUrl: "https://aroha-retreat.web.app/admin/",
            expiresInDays: 7,
            requestId,
          });
        }
        if (path.startsWith("/invitations/") && req.method === "DELETE") {
          operation = "access.invitation-revoked";
          const key = path.split("/")[2];
          if (!/^[a-f0-9]{64}$/.test(key)) throw new DomainError("INVALID_ID");
          await mutate(actor, operation, async (tx) => {
            const ref = collection("invitations").doc(key),
              snap = await tx.get(ref);
            if (!snap.exists) throw new DomainError("NOT_FOUND", 404);
            if (!mayManage(actor.role, snap.data().role, snap.data().role))
              throw new DomainError("FORBIDDEN", 403);
            tx.update(ref, { status: "revoked", updatedAt: now() });
            audit(tx, actor, operation, key);
          });
          return ({ ok: true, requestId });
        }
        if (path.startsWith("/members/") && req.method === "POST") {
          operation = "access.updated";
          const uid = path.split("/")[2];
          if (
            !uid ||
            uid.length > 128 ||
            uid === actor.uid ||
            typeof b.active !== "boolean"
          )
            throw new DomainError("INVALID_MEMBER");
          await mutate(actor, operation, async (tx) => {
            const ref = collection("members").doc(uid),
              snap = await tx.get(ref);
            if (!snap.exists) throw new DomainError("NOT_FOUND", 404);
            const target = snap.data();
            if (
              owners().has(target.email) ||
              !mayManage(actor.role, target.role, b.role)
            )
              throw new DomainError("FORBIDDEN", 403);
            tx.update(ref, {
              role: b.role,
              active: b.active,
              updatedAt: now(),
            });
            audit(tx, actor, operation, uid);
          });
          return ({ ok: true, requestId });
        }
        throw new DomainError("NOT_FOUND", 404);
      } catch (error) {
        const failure = classifyError(error);
        status = failure.status;
        errorCode = failure.code;
        res.status(status);
        return { error: { code: errorCode, requestId } };
      } finally {
        recordSummary({ operation, status, requestId, errorCode });
        console.info(
          JSON.stringify({
            severity: status >= 500 ? "ERROR" : "INFO",
            service: "aroha-api",
            version: "0.1.0",
            operation,
            status,
            durationMs: Date.now() - started,
            requestId,
          }),
        );
      }
    });
    // Finish bounded telemetry exports while request CPU is still allocated.
    return res.json(payload);
  },
);
