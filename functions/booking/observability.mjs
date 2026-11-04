import {
  collectionName,
  sharedCollectionName,
  environmentFields,
  runtimeServiceName,
} from "../environment.mjs";
import { recordBusinessEvent } from "../telemetry.mjs";
import { createHash, randomUUID } from "node:crypto";
import { trace } from "@opentelemetry/api";
import { FieldValue } from "firebase-admin/firestore";
import { studioAccess } from "../access.mjs";
export const STEPS = [
  "auth",
  "plan",
  "dates",
  "availability",
  "rooms",
  "review",
  "contact",
  "submit",
  "visits",
  "profile",
  "event_offer",
  "admin",
];
export const OUTCOMES = [
  "viewed",
  "selected",
  "attempted",
  "succeeded",
  "failed",
  "cancelled",
];
export const OPERATIONS = [
  "communications",
  "invoice-download",
  "email-resend",
  "public",
  "state",
  "profile",
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
  "guest-profile",
  "journey-event",
];
const uuid = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const hash = (v) => createHash("sha256").update(v).digest("hex");
export function contextFields() {
  const c = trace.getActiveSpan()?.spanContext();
  return c
    ? { trace_id: c.traceId, span_id: c.spanId }
    : { "correlation.trace": "unavailable" };
}
export function bookingEvent({
  id = randomUUID(),
  type,
  authority,
  actor,
  phone,
  journeyId,
  requestId,
  transactionId,
  method,
  operation,
  step,
  outcome,
  kind,
  status,
  errorCode,
  durationMs,
  entity,
  jobId,
  invoiceId,
  providerMessageId,
  at = Date.now(),
}) {
  const event = {
    "event.id": id,
    "event.provider": "aroha.booking",
    "event.type": type,
    "event.authority": authority,
    "schema.version": 2,
    "service.namespace": "aroha-retreat",
    "service.name": runtimeServiceName(),
    ...environmentFields(),
    "service.version": "0.7.1",
    timestamp: new Date(at).toISOString(),
    ...contextFields(),
  };
  if (actor) event["actor.id"] = String(actor).slice(0, 128);
  if (typeof phone === "string" && /^\+[1-9][0-9]{7,14}$/.test(phone))
    event["contact.phone"] = phone;
  if (uuid(journeyId)) event["journey.id"] = journeyId;
  if (uuid(requestId)) event["request.id"] = requestId;
  if (typeof transactionId === "string" && /^[a-f0-9]{64}$/.test(transactionId))
    event["transaction.id"] = transactionId;
  if (["GET", "POST", "DELETE"].includes(method))
    event["http.request.method"] = method;
  if (OPERATIONS.includes(operation)) event["booking.operation"] = operation;
  if (STEPS.includes(step)) event["booking.step"] = step;
  if (OUTCOMES.includes(outcome)) event["booking.outcome"] = outcome;
  if (["day", "individual", "private", "event"].includes(kind))
    event["booking.kind"] = kind;
  if (Number.isInteger(status) && status >= 100 && status <= 599)
    event["http.response.status_code"] = status;
  if (typeof errorCode === "string" && /^[A-Z_]{1,64}$/.test(errorCode))
    event["error.type"] = errorCode;
  if (Number.isFinite(durationMs))
    event["duration.ms"] = Math.min(30000, Math.max(0, durationMs));
  if (typeof entity === "string" && /^[A-Za-z0-9-]{1,100}$/.test(entity))
    event["booking.entity.id"] = entity;
  if (typeof jobId === "string" && /^[a-f0-9]{64}$/.test(jobId))
    event["email.job.id"] = jobId;
  if (typeof invoiceId === "string" && /^[A-Za-z0-9-]{1,120}$/.test(invoiceId))
    event["invoice.id"] = invoiceId;
  if (
    typeof providerMessageId === "string" &&
    /^[A-Za-z0-9-]{1,128}$/.test(providerMessageId)
  )
    event["email.provider.message.id"] = providerMessageId;
  return event;
}
export const eventRef = (db, event) =>
  db
    .collection(collectionName("observability_outbox"))
    .doc(hash(event["event.id"]));
export const pendingEvent = (event) => ({
  schemaVersion: 2,
  event,
  status: "pending",
  attempts: 0,
  nextAttemptAt: Date.now(),
  createdAt: Date.now(),
});
export function queueCommitted(tx, db, event) {
  tx.create(eventRef(db, event), pendingEvent(event));
}
export async function queueEvent(db, event) {
  const ref = eventRef(db, event);
  const created = await db.runTransaction(async (tx) => {
    const d = await tx.get(ref);
    if (d.exists) return false;
    tx.create(ref, pendingEvent(event));
    return true;
  });
  if (created) recordBusinessEvent(event);
}
export async function requestPhone(db, token, body, result, status) {
  if (!token?.uid) return undefined;
  if (
    status < 400 &&
    typeof result?.phone === "string" &&
    /^\+[1-9][0-9]{7,14}$/.test(result.phone)
  )
    return result.phone;
  if (status < 400 && (body?.id || result?.id)) {
    const id = body?.id || result?.id;
    if (/^[A-Za-z0-9-]{1,100}$/.test(id)) {
      const b = (
        await db.collection(collectionName("bookings")).doc(id).get()
      ).data();
      if (b) {
        const member = (
          await db
            .collection(sharedCollectionName("members"))
            .doc(token.uid)
            .get()
        ).data();
        if (b.owner === token.uid || studioAccess(member).bookings !== "none")
          return (
            b.contact?.phone ||
            (
              await db
                .collection(collectionName("booking_profiles"))
                .doc(b.owner)
                .get()
            ).data()?.contact?.phone
          );
      }
    }
  }
  return (
    await db.collection(collectionName("booking_profiles")).doc(token.uid).get()
  ).data()?.contact?.phone;
}
export async function captureJourney(db, token, body, requestId) {
  if (
    !body ||
    Object.keys(body).some(
      (k) =>
        ![
          "eventId",
          "journeyId",
          "step",
          "outcome",
          "kind",
          "relatedRequestId",
        ].includes(k),
    ) ||
    !uuid(body.eventId) ||
    !uuid(body.journeyId) ||
    !STEPS.includes(body.step) ||
    !OUTCOMES.includes(body.outcome) ||
    (body.kind &&
      !["day", "individual", "private", "event"].includes(body.kind)) ||
    (body.relatedRequestId && !uuid(body.relatedRequestId))
  )
    throw Object.assign(Error("INVALID_JOURNEY_EVENT"), {
      code: "INVALID_JOURNEY_EVENT",
      status: 422,
    });
  const phone = await requestPhone(db, token, null, null, 200);
  const event = bookingEvent({
    id: "client:" + body.journeyId + ":" + body.eventId,
    type: "booking.form_step",
    authority: "client-reported",
    actor: token?.uid,
    phone,
    journeyId: body.journeyId,
    requestId,
    step: body.step,
    outcome: body.outcome,
    kind: body.kind,
    operation: "journey-event",
  });
  if (body.relatedRequestId)
    event["related.request.id"] = body.relatedRequestId;
  await queueEvent(db, event);
  return { accepted: true, eventId: body.eventId };
}
export async function drainEvents(
  db,
  send,
  { now = Date.now(), limit = 20 } = {},
) {
  const rows = await db
    .collection(collectionName("observability_outbox"))
    .where("nextAttemptAt", "<=", now)
    .orderBy("nextAttemptAt")
    .limit(limit)
    .get();
  let delivered = 0,
    failed = 0;
  for (const row of rows.docs) {
    const lease = randomUUID();
    const claimed = await db.runTransaction(async (tx) => {
      const d = await tx.get(row.ref),
        v = d.data();
      if (
        !v ||
        v.schemaVersion !== 2 ||
        v.status === "delivered" ||
        v.nextAttemptAt > now
      )
        return null;
      tx.update(row.ref, { lease, nextAttemptAt: now + 90000 });
      return v;
    });
    if (!claimed) continue;
    let accepted = false,
      code = 0,
      retryAfter = 0;
    try {
      const r = await send(claimed.event);
      code = r.status;
      accepted = code === 202;
      const wait = r.headers?.get?.("Retry-After");
      if (wait)
        retryAfter = /^\d+$/.test(wait)
          ? Number(wait) * 1000
          : Math.max(0, Date.parse(wait) - now);
    } catch {}
    const settled = await db.runTransaction(async (tx) => {
      const d = await tx.get(row.ref),
        v = d.data();
      if (v?.lease !== lease) return false;
      const attempts = (v.attempts || 0) + 1;
      tx.update(
        row.ref,
        accepted
          ? {
              status: "delivered",
              attempts,
              lastStatus: code,
              deliveredAt: now,
              nextAttemptAt: FieldValue.delete(),
              lease: FieldValue.delete(),
              expireAt: new Date(now + 7 * 86400000),
            }
          : {
              status: "pending",
              attempts,
              lastStatus: code,
              nextAttemptAt:
                now +
                Math.max(
                  Number.isFinite(retryAfter) ? retryAfter : 0,
                  Math.min(21600000, 30000 * 2 ** Math.min(attempts, 10)),
                ) +
                Math.floor(Math.random() * 1000),
              lease: FieldValue.delete(),
            },
      );
      return true;
    });
    if (!settled) continue;
    if (accepted) {
      delivered++;
      recordBusinessEvent(claimed.event, "delivered");
    } else failed++;
  }
  return { delivered, failed };
}

// Keep response monitoring independent of the application's database availability.
export async function captureResponse(
  db,
  fields,
  { phoneLookup, fallback, timeoutMs = 2000 } = {},
) {
  const capturedAt = Date.now();
  let event = bookingEvent({ ...fields, at: capturedAt });
  let timer;
  try {
    const work = (async () => {
      const phone = phoneLookup ? await phoneLookup() : undefined;
      event = bookingEvent({ ...fields, phone, at: capturedAt });
      await queueEvent(db, event);
    })();
    await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error("CAPTURE_TIMEOUT")), timeoutMs);
      }),
    ]);
    return { queued: true };
  } catch {
    if (fallback) {
      try {
        const r = await fallback(event);
        if (r.status === 202) {
          recordBusinessEvent(event, "direct-delivered");
          return { queued: false, fallbackAccepted: true };
        }
      } catch {}
    }
    return { queued: false, fallbackAccepted: false };
  } finally {
    clearTimeout(timer);
  }
}
