import { Resend } from "resend";
import { createHash } from "node:crypto";
import { environment, collectionName } from "../environment.mjs";
import { mailCollection } from "./jobs.mjs";
import { FieldValue } from "firebase-admin/firestore";
import { bookingEvent, queueCommitted } from "../booking/observability.mjs";
const statuses = {
  "email.sent": "accepted",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "failed",
  "email.delivery_delayed": "delayed",
};
const rank = {
  queued: 0,
  retry: 0,
  sending: 0,
  accepted: 1,
  delayed: 1,
  delivered: 3,
  failed: 2,
  bounced: 4,
  complained: 5,
};
export async function captureEmailWebhook(
  db,
  request,
  secret,
  { verify } = {},
) {
  const raw = request.rawBody;
  if (!Buffer.isBuffer(raw) || raw.length > 64000)
    throw Object.assign(Error("INVALID_WEBHOOK"), { status: 400 });
  let event;
  try {
    event = (verify || ((o) => new Resend("unused").webhooks.verify(o)))({
      payload: raw.toString("utf8"),
      headers: {
        id: request.get("svix-id"),
        timestamp: request.get("svix-timestamp"),
        signature: request.get("svix-signature"),
      },
      webhookSecret: secret,
    });
  } catch {
    throw Object.assign(Error("INVALID_WEBHOOK_SIGNATURE"), { status: 400 });
  }
  const status = statuses[event.type];
  if (!status) return { accepted: true, ignored: true };
  const id = event.data?.email_id;
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(id || ""))
    throw Object.assign(Error("INVALID_WEBHOOK"), { status: 400 });
  const tags = Array.isArray(event.data?.tags)
    ? Object.fromEntries(event.data.tags.map((t) => [t.name, t.value]))
    : event.data?.tags || {};
  if (tags.environment && tags.environment !== environment.name) {
    // Both signed webhooks share one Resend account. A verified event for the
    // other known environment is acknowledged without touching local jobs.
    if (["production", "pre-prod"].includes(tags.environment))
      return { accepted: true, ignored: true };
    throw Object.assign(Error("WEBHOOK_ENVIRONMENT_MISMATCH"), { status: 400 });
  }
  let ref;
  if (/^[a-f0-9]{64}$/.test(tags.job_id || ""))
    ref = mailCollection(db).doc(tags.job_id);
  else {
    const rows = await mailCollection(db)
      .where("providerMessageId", "==", id)
      .limit(1)
      .get();
    ref = rows.docs[0]?.ref;
  }
  if (!ref) return { accepted: true, ignored: true };
  const webhookId = String(request.get("svix-id") || "");
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(webhookId))
    throw Object.assign(Error("INVALID_WEBHOOK"), { status: 400 });
  const receipt = db
    .collection(collectionName("email_webhooks"))
    .doc(createHash("sha256").update(webhookId).digest("hex"));
  const job = await db.runTransaction(async (tx) => {
    const [d, r] = await Promise.all([tx.get(ref), tx.get(receipt)]);
    if (r.exists) return null;
    const j = d.data();
    if (
      !j ||
      j.environment !== environment.name ||
      (j.providerMessageId && j.providerMessageId !== id)
    )
      return null;
    const to = Array.isArray(event.data?.to) ? event.data.to : [];
    if (!to.includes(j.to)) return null;
    tx.create(receipt, {
      environment: environment.name,
      eventId: webhookId,
      messageId: id,
      jobId: j.id,
      type: event.type,
      at: Date.now(),
      expireAt: new Date(Date.now() + 30 * 86400000),
    });
    if ((rank[status] || 0) >= (rank[j.status] || 0))
      tx.update(ref, {
        status,
        uncertain: false,
        ...(event.type === "email.suppressed"
          ? { errorCode: "MAIL_PROVIDER_SUPPRESSED" }
          : {}),
        providerMessageId: id,
        version: (j.version || 0) + 1,
        lease: FieldValue.delete(),
        nextAttemptAt: FieldValue.delete(),
        ...(status === "delivered" ? { deliveredAt: Date.now() } : {}),
        ...(status === "failed" ||
        status === "bounced" ||
        status === "complained"
          ? { uncertain: false }
          : {}),
      });
    queueCommitted(
      tx,
      db,
      bookingEvent({
        id: "mail:webhook:" + webhookId,
        type: "email." + status,
        authority: "server-observed",
        entity: j.bookingId,
        jobId: j.id,
        invoiceId: j.invoiceId,
        providerMessageId: id,
        ...(event.type === "email.suppressed"
          ? { errorCode: "MAIL_PROVIDER_SUPPRESSED" }
          : {}),
        outcome: ["failed", "bounced", "complained"].includes(status)
          ? "failed"
          : "succeeded",
      }),
    );
    return j;
  });
  return { accepted: true };
}
