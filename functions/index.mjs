import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { sendEmail } from "./email/provider.mjs";
import { mailSettings } from "./email/config.mjs";
import { mailCollection } from "./email/jobs.mjs";
import { deliverEmail, drainEmails } from "./email/delivery.mjs";
import { communicationCommand } from "./email/api.mjs";
import { captureEmailWebhook } from "./email/webhook.mjs";
import {
  refreshTelemetryConfig,
  activeTelemetryConfig,
  validateObservabilityConfig,
  publicObservabilityConfig,
} from "./observability-config.mjs";
import {
  environment,
  collectionName,
  sharedCollectionName,
  isTester,
  environmentFields,
  serviceName,
} from "./environment.mjs";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  bookingEvent,
  queueEvent,
  requestPhone,
  captureJourney,
  captureResponse,
  drainEvents,
  OPERATIONS,
} from "./booking/observability.mjs";
import { studioAccess, validModuleAccess } from "./access.mjs";
import {
  traceRequest,
  recordSummary,
  domainSpan,
  traceBookingDelivery,
} from "./telemetry.mjs";
import { PUBLIC_ORIGIN, isAllowedOrigin } from "./origins.mjs";
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
import {
  publicBookingState,
  publicBookingCalendar,
  bookingState,
  bookingCommand,
  throttleBooking,
} from "./booking/store.mjs";
import { BookingError } from "./booking/domain.mjs";
initializeApp();
const monitoringSecret = defineSecret("DYNATRACE_PLATFORM_TOKEN");
// The Firebase deployer resolves every declared SecretParam, even when a worker
// does not bind it. Disabled mail must not declare or require sending authority.
const resendSecret = process.env.MAIL_ENABLED === "true" ? defineSecret(
  environment.preprod ? "RESEND_API_KEY_PREPROD" : "RESEND_API_KEY",
) : null;
const resendWebhookSecret = process.env.MAIL_ENABLED === "true" ? defineSecret(
  environment.preprod
    ? "RESEND_WEBHOOK_SECRET_PREPROD"
    : "RESEND_WEBHOOK_SECRET",
) : null;
const mailSecrets = () =>
  process.env.MAIL_ENABLED === "true" ? [resendSecret] : [];
const db = getFirestore(),
  hash = (v) => createHash("sha256").update(v).digest("hex");
const collection = (name) =>
  db.collection(
    ["members", "invitations"].includes(name)
      ? sharedCollectionName(name)
      : collectionName(name),
  );
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
  if (environment.preprod) {
    if (!isTester(token)) throw new DomainError("PREPROD_TESTER_REQUIRED", 403);
    const snap = await db
      .collection(sharedCollectionName("members"))
      .doc(token.uid)
      .get();
    if (!snap.exists || snap.data().active !== true)
      throw new DomainError("INVITATION_REQUIRED", 403);
    return {
      uid: token.uid,
      email: emailKey(token.email),
      role: snap.data().role,
      active: true,
      modules: {
        website: false,
        bookings: studioAccess(snap.data()).bookings,
        access: false,
      },
    };
  }
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
      return {
        uid: token.uid,
        email,
        role: "superadmin",
        active: true,
        modules: studioAccess({ active: true, role: "superadmin" }),
      };
    }
    if (member.exists) {
      const m = member.data();
      if (!m.active) throw new DomainError("ACCESS_REVOKED", 403);
      return {
        uid: token.uid,
        email,
        role: m.role,
        active: true,
        modules: studioAccess(m),
      };
    }
    const inviteRef = collection("invitations").doc(hash(email)),
      invite = await tx.get(inviteRef);
    if (
      !invite.exists ||
      invite.data().status !== "pending" ||
      invite.data().expiresAt <= Date.now()
    )
      throw new DomainError("INVITATION_REQUIRED", 403);
    const role = invite.data().role,
      moduleFields = {
        ...(invite.data().websiteAccess === undefined
          ? {}
          : { websiteAccess: invite.data().websiteAccess }),
        ...(invite.data().bookingAccess === undefined
          ? {}
          : { bookingAccess: invite.data().bookingAccess }),
      };
    tx.set(ref, {
      email,
      role,
      active: true,
      ...moduleFields,
      updatedAt: now(),
    });
    tx.update(inviteRef, {
      status: "accepted",
      acceptedAt: now(),
      uid: token.uid,
    });
    audit(tx, token, "access.accepted", token.uid);
    return {
      uid: token.uid,
      email,
      role,
      active: true,
      modules: studioAccess({ active: true, role, ...moduleFields }),
    };
  });
}
async function requireMember(token, operation) {
  const member = await collection("members").doc(token.uid).get();
  if (
    !member.exists ||
    !member.data().active ||
    !can(member.data().role, operation) ||
    (operation !== "access" && !studioAccess(member.data()).website)
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
        !can(member.data().role, permission) ||
        (permission !== "access" && !studioAccess(member.data()).website)
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
    secrets: [
      ...(process.env.DT_EXPORT_ENABLED === "true" ? [monitoringSecret] : []),
      ...(process.env.MAIL_ENABLED === "true" ? [resendWebhookSecret] : []),
    ],
  },
  async (req, res) => {
    await refreshTelemetryConfig(db);
    const payload = await traceRequest(req, res, async () => {
      const requestId = randomUUID(),
        started = Date.now();
      let operation = "unknown",
        bookingKind = "unknown",
        status = 200,
        errorCode = "",
        telemetryToken,
        businessResult,
        captureAllowed = false;
      res.set("X-Request-Id", requestId);
      res.set("Cache-Control", "no-store");
      res.set("X-Content-Type-Options", "nosniff");
      try {
        if (
          !isAllowedOrigin(req.get("origin"), !!process.env.FUNCTIONS_EMULATOR)
        )
          throw new DomainError("ORIGIN_DENIED", 403);
        if (req.rawBody?.length > 220000)
          throw new DomainError("PAYLOAD_TOO_LARGE", 413);
        captureAllowed = true;
        const bookingPath =
          req.path.replace(/^\/api\/v1/, "").replace(/\/$/, "") || "/";
        const initialOp = bookingPath.startsWith("/booking/")
          ? bookingPath.slice(9)
          : "";
        if (OPERATIONS.includes(initialOp)) operation = "booking." + initialOp;
        if (bookingPath === "/email/webhook" && req.method === "POST") {
          operation = "email.webhook";
          if (process.env.MAIL_ENABLED !== "true")
            throw new DomainError("NOT_FOUND", 404);
          try {
            return await captureEmailWebhook(
              db,
              req,
              resendWebhookSecret.value(),
            );
          } catch (e) {
            throw new DomainError(
              e.message === "WEBHOOK_ENVIRONMENT_MISMATCH"
                ? e.message
                : "INVALID_WEBHOOK_SIGNATURE",
              e.status || 400,
            );
          }
        }
        if (bookingPath === "/runtime-config" && req.method === "GET") {
          operation = "runtime.config";
          const conf = await db
            .collection("aroha_runtime_config")
            .doc("observability")
            .get();
          if (!conf.exists)
            return {
              environment: environment.name,
              configVersion: 0,
              rumScriptUrl: null,
            };
          return publicObservabilityConfig(
            validateObservabilityConfig(conf.data()),
          );
        }
        if (bookingPath === "/booking/public" && req.method === "GET") {
          operation = "booking.public";
          return await publicBookingState(db);
        }
        if (bookingPath === "/booking/calendar" && req.method === "POST") {
          operation = "booking.calendar";
          if (!req.is("application/json")) throw new DomainError("JSON_REQUIRED",415);
          if (req.rawBody?.length > 2000) throw new DomainError("PAYLOAD_TOO_LARGE",413);
          await throttleBooking(db,"calendar:"+hash(String(req.ip||"unknown")));
          return await publicBookingCalendar(db,req.body);
        }
        if (bookingPath === "/booking/journey-event" && req.method === "POST") {
          operation = "booking.journey-event";
          if (req.rawBody?.length > 2000)
            throw new DomainError("PAYLOAD_TOO_LARGE", 413);
          if (req.get("X-Aroha-Consent") !== "monitoring")
            throw new DomainError("MONITORING_CONSENT_REQUIRED", 403);
          const bearer = req.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
          if (bearer) {
            try {
              telemetryToken = await getAuth().verifyIdToken(bearer, true);
            } catch {
              throw new DomainError("INVALID_SESSION", 401);
            }
          }
          if (telemetryToken && !isTester(telemetryToken))
            throw new DomainError("PREPROD_TESTER_REQUIRED", 403);
          await throttleBooking(
            db,
            telemetryToken?.uid ||
              "anonymous:" + hash(String(req.ip || "unknown")),
          );
          try {
            return await captureJourney(
              db,
              telemetryToken,
              req.body,
              requestId,
            );
          } catch (e) {
            if (e.code === "INVALID_JOURNEY_EVENT")
              throw new DomainError(e.code, 422);
            throw e;
          }
        }
        const bearer = req.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
        if (!bearer) throw new DomainError("SIGN_IN_REQUIRED", 401);
        let token;
        try {
          token = await getAuth().verifyIdToken(bearer, true);
          telemetryToken = token;
        } catch {
          throw new DomainError("INVALID_SESSION", 401);
        }
        if (!isTester(token))
          throw new DomainError("PREPROD_TESTER_REQUIRED", 403);
        const path =
          req.path.replace(/^\/api\/v1/, "").replace(/\/$/, "") || "/";
        const b = req.body ?? {};
        if (req.method === "POST" && !req.is("application/json"))
          throw new DomainError("JSON_REQUIRED", 415);
        if (path === "/session" && req.method === "POST") {
          operation = "access.session";
          const admitted = await session(token);
          if (environment.preprod)
            admitted.modules = {
              website: false,
              bookings: admitted.modules.bookings,
              access: false,
            };
          return { session: admitted, requestId };
        }
        if (path.startsWith("/booking/")) {
          const bookingOp = path.slice(9);
          if (
            ![
              "communications",
              "invoice-download",
              "email-resend",
              "guest-profile",
              "journey-event",
              "profile",
              "state",
              "availability",
              "quote",
              "create",
              "booking-action",
              "note",
              "change-quote",
              "change-request",
              "settings",
              "unit",
              "promo",
              "block",
              "unblock",
              "readiness",
              "reservation-detail",
              "guest-contact",
            ].includes(bookingOp)
          )
            throw new DomainError("NOT_FOUND", 404);
          operation = "booking." + bookingOp;
          const requestedKind =
            req.body?.kind || req.get("X-Aroha-Booking-Kind");
          if (["day", "individual", "private", "event"].includes(requestedKind))
            bookingKind = requestedKind;
          if (req.rawBody?.length > 16000)
            throw new DomainError("PAYLOAD_TOO_LARGE", 413);
          if (
            token.email_verified !== true ||
            token.firebase?.sign_in_provider !== "google.com"
          )
            throw new DomainError("VERIFIED_GOOGLE_ACCOUNT_REQUIRED", 403);
          await throttleBooking(db, token.uid);
          const admin = req.query.admin === "1";
          try {
            if (bookingOp === "journey-event" && req.method === "POST")
              return await captureJourney(db, token, b, requestId);
            if (path === "/booking/profile" && req.method === "GET")
              return (await bookingState(db, token, { admin: false })).profile;
            if (path === "/booking/state" && req.method === "GET")
              return await bookingState(db, token, {
                admin,
                start: req.query.start,
                cursor: req.query.cursor,
              });
            if (req.method !== "POST") throw new DomainError("NOT_FOUND", 404);
            if (
              ["communications", "invoice-download", "email-resend"].includes(
                bookingOp,
              )
            ) {
              const booking = await bookingCommand(
                db,
                token,
                "reservation-detail",
                { id: b.id },
                req.get("Idempotency-Key") || randomUUID(),
                { admin },
              );
              const m = admin
                ? (
                    await db
                      .collection(sharedCollectionName("members"))
                      .doc(token.uid)
                      .get()
                  ).data()
                : null;
              const communication = await communicationCommand(
                db,
                bookingOp,
                b,
                {
                  booking,
                  actor: {
                    id: token.uid,
                    role: admin ? "host" : "guest",
                    bookingAccess: studioAccess(m).bookings,
                  },
                },
              );
              businessResult = { id: booking.id };
              return communication;
            }
            const result = await domainSpan(
              "firestore.booking." + bookingOp,
              () =>
                bookingCommand(
                  db,
                  token,
                  path.slice(9),
                  b,
                  req.get("Idempotency-Key"),
                  { admin, journeyId: req.get("X-Aroha-Journey"), requestId },
                ),
            );
            businessResult = result;
            if (["day", "individual", "private", "event"].includes(result.kind))
              bookingKind = result.kind;
            return result;
          } catch (e) {
            if (e instanceof BookingError)
              throw new DomainError(e.code, e.status);
            throw e;
          }
        }
        if (environment.preprod)
          throw new DomainError("PREPROD_CONTENT_READ_ONLY", 403);
        const actor = await requireMember(
          token,
          /^\/(members|invitations)(\/|$)/.test(path) ? "access" : "read",
        );
        if (path === "/draft" && req.method === "GET") {
          operation = "content.read";
          const snap = await collection("content").doc("draft").get();
          return {
            draft: snap.exists ? snap.data() : null,
            requestId,
          };
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
          return { version, requestId };
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
          return { version, requestId };
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
          return {
            revisions: rows.slice(0, limit).map((s) => ({
              id: s.id,
              version: s.data().version,
              publishedAt:
                s.data().publishedAt?.toDate?.().toISOString() ?? null,
            })),
            nextCursor:
              rows.length > limit ? rows[limit - 1].data().version : null,
            requestId,
          };
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
          return { version, requestId };
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
          return {
            [col]: rows.slice(0, 50).map(clean),
            nextCursor: rows.length > 50 ? rows[49].id : null,
            requestId,
          };
        }
        if (path === "/invitations" && req.method === "POST") {
          operation = "access.invited";
          if (!validModuleAccess(b))
            throw new DomainError("INVALID_MODULE_ACCESS", 422);
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
              ...(b.websiteAccess === undefined
                ? {}
                : { websiteAccess: b.websiteAccess }),
              ...(b.bookingAccess === undefined
                ? {}
                : { bookingAccess: b.bookingAccess }),
              status: "pending",
              expiresAt: Date.now() + 7 * 86400000,
              invitedBy: actor.uid,
              updatedAt: now(),
            });
            audit(tx, actor, operation, hash(email));
          });
          return {
            inviteUrl: `${PUBLIC_ORIGIN}/admin/`,
            expiresInDays: 7,
            requestId,
          };
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
          return { ok: true, requestId };
        }
        if (path.startsWith("/members/") && req.method === "POST") {
          operation = "access.updated";
          const uid = path.split("/")[2];
          if (
            !uid ||
            uid.length > 128 ||
            uid === actor.uid ||
            typeof b.active !== "boolean" ||
            !validModuleAccess(b)
          )
            throw new DomainError("INVALID_MEMBER");
          await mutate(actor, operation, async (tx) => {
            const ref = collection("members").doc(uid),
              snap = await tx.get(ref);
            if (!snap.exists) throw new DomainError("NOT_FOUND", 404);
            const target = snap.data();
            if (
              (b.websiteAccess !== undefined ||
                b.bookingAccess !== undefined) &&
              b.expectedVersion !== (target.version || 0)
            )
              throw new DomainError("VERSION_CONFLICT", 409);
            if (
              owners().has(target.email) ||
              !mayManage(actor.role, target.role, b.role)
            )
              throw new DomainError("FORBIDDEN", 403);
            tx.update(ref, {
              role: b.role,
              active: b.active,
              version: (target.version || 0) + 1,
              ...(b.websiteAccess === undefined
                ? {}
                : { websiteAccess: b.websiteAccess }),
              ...(b.bookingAccess === undefined
                ? {}
                : { bookingAccess: b.bookingAccess }),
              updatedAt: now(),
            });
            audit(tx, actor, operation, uid);
          });
          return { ok: true, requestId };
        }
        throw new DomainError("NOT_FOUND", 404);
      } catch (error) {
        const failure = classifyError(
          error instanceof BookingError
            ? new DomainError(error.code, error.status)
            : error,
        );
        status = failure.status;
        errorCode = failure.code;
        res.status(status);
        return { error: { code: errorCode, requestId } };
      } finally {
        const op = req.path
          .replace(/^\/api\/v1\/booking\//, "")
          .replace(/\/$/, "");
        if (captureAllowed && OPERATIONS.includes(op)) {
          const delivery = await captureResponse(
            db,
            {
              id: "response:" + requestId,
              type: "booking.api_response",
              authority: "server-observed",
              actor: telemetryToken?.uid,
              journeyId: req.get("X-Aroha-Journey"),
              requestId,
              method: req.method,
              operation: op,
              outcome: status < 400 ? "succeeded" : "failed",
              status,
              errorCode,
              durationMs: Date.now() - started,
              kind: bookingKind,
              entity: businessResult?.id,
            },
            {
              phoneLookup: () =>
                requestPhone(
                  db,
                  telemetryToken,
                  req.body,
                  businessResult,
                  status,
                ),
              fallback:
                process.env.DT_EXPORT_ENABLED === "true" &&
                activeTelemetryConfig()
                  ? (event) =>
                      fetch(activeTelemetryConfig().businessEventsEndpoint, {
                        method: "POST",
                        headers: {
                          Authorization:
                            "Bearer " + activeTelemetryConfig().token,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify([event]),
                        signal: AbortSignal.timeout(1500),
                      })
                  : undefined,
            },
          );
          if (!delivery.queued)
            console.warn(
              JSON.stringify({
                ...environmentFields(),
                service: serviceName("aroha-api"),
                code: delivery.fallbackAccepted
                  ? "BUSINESS_EVENT_CAPTURE_FALLBACK"
                  : "BUSINESS_EVENT_CAPTURE_FAILED",
                requestId,
              }),
            );
        }

        recordSummary({ operation, status, requestId, errorCode, bookingKind });
        console.info(
          JSON.stringify({
            severity: status >= 500 ? "ERROR" : "INFO",
            service: serviceName("aroha-api"),
            ...environmentFields(),
            version: "0.8.0",
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

// At-least-once delivery. Existing pre-cutover booking/email outbox is never drained.
export const arohaBookingEvents = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "asia-south2",
    memory: "256MiB",
    timeoutSeconds: 120,
    maxInstances: 1,
    secrets: process.env.DT_EXPORT_ENABLED === "true" ? [monitoringSecret] : [],
  },
  async () => {
    if (process.env.DT_EXPORT_ENABLED !== "true") return;
    await refreshTelemetryConfig(db);
    if (!activeTelemetryConfig()) return;
    await traceBookingDelivery(() =>
      drainEvents(db, (event) =>
        fetch(activeTelemetryConfig().businessEventsEndpoint, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + activeTelemetryConfig().token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([event]),
          signal: AbortSignal.timeout(3000),
        }),
      ),
    );
  },
);

const emailWorkerOptions = {
  region: "asia-south2",
  memory: "256MiB",
  timeoutSeconds: 120,
  maxInstances: 1,
  concurrency: 1,
  secrets: [
    ...(process.env.DT_EXPORT_ENABLED === "true" ? [monitoringSecret] : []),
    ...mailSecrets(),
  ],
};
async function withEmailDelivery(handler, sourceContext) {
  if (!mailSettings().enabled) return;
  await refreshTelemetryConfig(db);
  return traceBookingDelivery(handler, "booking.email.delivery", sourceContext);
}
export const arohaBookingEmailDispatch = onDocumentCreated(
  {
    ...emailWorkerOptions,
    document: collectionName("notifications") + "/{jobId}",
    retry: true,
  },
  async (event) => {
    if (!event.data) return;
    return withEmailDelivery(async () => {
      const r = await deliverEmail(
        db,
        mailCollection(db).doc(event.params.jobId),
        (body, options) =>
          sendEmail(
            process.env.FUNCTIONS_EMULATOR ? "" : resendSecret.value(),
            body,
            options,
          ),
      );
      return { delivered: r.accepted ? 1 : 0, failed: r.failed ? 1 : 0 };
    }, event.data.data()?.sourceContext);
  },
);
export const arohaBookingEmailRetry = onSchedule(
  { ...emailWorkerOptions, schedule: "every 1 minutes" },
  async () =>
    withEmailDelivery(() =>
      drainEmails(db, (body, options) =>
        sendEmail(
          process.env.FUNCTIONS_EMULATOR ? "" : resendSecret.value(),
          body,
          options,
        ),
      ),
    ),
);
