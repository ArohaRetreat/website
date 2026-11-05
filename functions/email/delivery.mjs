import { DomainError } from "../domain.mjs";
import { operationSpan } from "../telemetry.mjs";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { environment, collectionName } from "../environment.mjs";
import { mailSettings, recipientAllowed } from "./config.mjs";
import { mailCollection, invoiceCollection } from "./jobs.mjs";
import { invoicePdf } from "./documents.mjs";
import { emailTemplate } from "./templates.mjs";
import {
  bookingEvent,
  queueEvent,
  queueCommitted,
} from "../booking/observability.mjs";
export async function deliverEmail(
  db,
  ref,
  send,
  { now = Date.now(), makePdf = invoicePdf } = {},
) {
  const config = mailSettings();
  if (!config.enabled) return { disabled: true };
  const lease = randomUUID();
  const job = await db.runTransaction(async (tx) => {
    const d = await tx.get(ref),
      v = d.data();
    if (
      !v ||
      v.environment !== environment.name ||
      !["queued", "retry", "sending"].includes(v.status) ||
      v.nextAttemptAt > now
    )
      return null;
    if (
      Number.isFinite(v.firstAttemptAt) &&
      now - v.firstAttemptAt >= 23 * 3600000
    ) {
      tx.update(ref, {
        status: "needs_reconciliation",
        version: (v.version || 0) + 1,
        nextAttemptAt: FieldValue.delete(),
        lease: FieldValue.delete(),
      });
      return null;
    }
    tx.update(ref, {
      status: "sending",
      lease,
      firstAttemptAt: v.firstAttemptAt || now,
      nextAttemptAt: now + 90000,
      version: (v.version || 0) + 1,
    });
    return v;
  });
  if (!job) return { skipped: true };
  let messageId,
    errorCode = "MAIL_DELIVERY_FAILED",
    retryAfter = 30000,
    uncertain = false,
    suppressed = false;
  try {
    if (
      !recipientAllowed(job,config)
    ) {
      errorCode="MAIL_RECIPIENT_BOUNDARY";
      throw Object.assign(Error(errorCode), { terminal: true });
    }
    const booking = (
      await db.collection(collectionName("bookings")).doc(job.bookingId).get()
    ).data();
    if (!booking || booking.owner !== job.owner)
      throw Object.assign(Error("BOOKING_NOT_FOUND"), { terminal: true });
    const isCurrent = (b) =>
      b?.owner === job.owner &&
      (job.channel === "guest_confirmation"
        ? ["confirmed", "checked_in", "completed"].includes(b.status) &&
          b.invoiceId === job.invoiceId
        : b.status === "pending_approval");
    suppressed = !isCurrent(booking);
    if (suppressed) errorCode = "MAIL_SUPPRESSED";
    else {
      const { attachments: inline = [], ...message } = emailTemplate(job),
        attachments = [...inline];
      if (job.channel === "guest_confirmation") {
        const ref = invoiceCollection(db).doc(job.invoiceId),
          invoice = (await ref.get()).data();
        if (
          !invoice ||
          invoice.owner !== job.owner ||
          ["void", "superseded"].includes(invoice.status)
        )
          throw Object.assign(Error("INVOICE_NOT_FOUND"), { terminal: true });
        let pdf;
        try {
          pdf = await makePdf(invoice);
        } catch {
          errorCode = "INVOICE_DOCUMENT_FAILED";
          throw Error(errorCode);
        }
        attachments.push({
          filename: invoice.number + ".pdf",
          content: pdf.buffer,
        });
        await ref.update({ documentStatus: "ready", object: pdf.object });
        await queueEvent(
          db,
          bookingEvent({
            id: "invoice:" + invoice.id + ":generated",
            type: "invoice.generated",
            authority: "server-observed",
            entity: job.bookingId,
            jobId: job.id,
            invoiceId: job.invoiceId,
            providerMessageId: messageId,
            outcome: "succeeded",
          }),
        );
      }
      // PDF generation can outlive a cancellation or replacement approval.
      const latest = (
        await db.collection(collectionName("bookings")).doc(job.bookingId).get()
      ).data();
      if (!isCurrent(latest)) {
        suppressed = true;
        errorCode = "MAIL_SUPPRESSED";
      } else
        messageId = await operationSpan(
          "email.provider.send",
          async () => {
            const result = await send(
              {
                from: `Aroha Retreat <${job.from}>`,
                to: [job.to],
                replyTo: job.replyTo,
                ...message,
                ...(attachments.length ? { attachments } : {}),
                tags: [
                  { name: "environment", value: environment.name },
                  { name: "job_id", value: job.id },
                  { name: "channel", value: job.channel },
                ],
              },
              { idempotencyKey: "aroha-" + environment.name + "-" + job.id },
            );
            if (result.error) {
              const status = Number(result.error.statusCode) || 0;
              errorCode =
                status === 409
                  ? "MAIL_IDEMPOTENCY_CONFLICT"
                  : status === 429
                    ? "MAIL_RATE_LIMIT"
                    : status >= 500 || !status
                      ? "MAIL_PROVIDER_UNAVAILABLE"
                      : "MAIL_PROVIDER_REJECTED";
              const wait = String(result.headers?.["retry-after"] || ""),
                delay = /^\d+$/.test(wait)
                  ? Number(wait) * 1000
                  : Date.parse(wait) - now;
              retryAfter = Number.isFinite(delay)
                ? Math.min(86400000, Math.max(30000, delay))
                : 30000;
              throw Object.assign(new DomainError(errorCode, status || 503), {
                terminal: status >= 400 && status < 500 && status !== 429,
                uncertain: !status || status === 409,
                reconcile: status === 409,
              });
            }
            if (
              !result.data?.id ||
              !/^[a-zA-Z0-9-]{1,128}$/.test(result.data.id)
            ) {
              errorCode = "MAIL_RESULT_UNCERTAIN";
              throw Object.assign(new DomainError(errorCode, 503), {
                uncertain: true,
              });
            }
            return result.data.id;
          },
          { client: true, attributes: { "server.address": "api.resend.com" } },
        );
    }
  } catch (e) {
    uncertain = job.uncertain === true || e.uncertain === true;
    const status = e.reconcile
      ? "needs_reconciliation"
      : e.terminal
        ? "failed"
        : "retry";
    await db.runTransaction(async (tx) => {
      const d = await tx.get(ref),
        v = d.data();
      if (v?.lease !== lease) return false;
      const attempts = (v.attempts || 0) + 1;
      tx.update(ref, {
        status,
        attempts,
        uncertain,
        errorCode,
        lease: FieldValue.delete(),
        version: (v.version || 0) + 1,
        ...(["failed", "needs_reconciliation"].includes(status)
          ? { nextAttemptAt: FieldValue.delete() }
          : {
              nextAttemptAt:
                now +
                Math.max(
                  retryAfter,
                  Math.min(21600000, 30000 * 2 ** Math.min(attempts, 10)),
                ),
            }),
      });
      if (errorCode === "INVOICE_DOCUMENT_FAILED")
        queueCommitted(
          tx,
          db,
          bookingEvent({
            id: "invoice:" + job.invoiceId + ":failed:" + attempts,
            type: "invoice.failed",
            authority: "server-observed",
            entity: job.bookingId,
            jobId: job.id,
            invoiceId: job.invoiceId,
            outcome: "failed",
            errorCode,
          }),
        );
      queueCommitted(
        tx,
        db,
        bookingEvent({
          id: "mail:" + job.id + ":attempt:" + attempts,
          type: "email.failed",
          authority: "server-observed",
          entity: job.bookingId,
          jobId: job.id,
          invoiceId: job.invoiceId,
          providerMessageId: messageId,
          outcome: "failed",
          errorCode,
        }),
      );
      return true;
    });
    return { failed: true };
  }
  const status = suppressed
    ? job.uncertain === true
      ? "needs_reconciliation"
      : "suppressed"
    : "accepted";
  await db.runTransaction(async (tx) => {
    const d = await tx.get(ref),
      v = d.data();
    if (v?.lease !== lease) return false;
    tx.update(ref, {
      status,
      uncertain: suppressed ? job.uncertain === true : false,
      attempts: (v.attempts || 0) + 1,
      ...(messageId ? { providerMessageId: messageId, acceptedAt: now } : {}),
      lease: FieldValue.delete(),
      nextAttemptAt: FieldValue.delete(),
      version: (v.version || 0) + 1,
    });
    queueCommitted(
      tx,
      db,
      bookingEvent({
        id: "mail:" + job.id + ":" + status,
        type: "email." + status,
        authority: "server-observed",
        entity: job.bookingId,
        jobId: job.id,
        invoiceId: job.invoiceId,
        providerMessageId: messageId,
        outcome: suppressed ? "cancelled" : "succeeded",
      }),
    );
    return true;
  });
  return { accepted: !!messageId, suppressed };
}
export async function drainEmails(db, send, { limit = 5 } = {}) {
  const rows = await mailCollection(db)
    .where("nextAttemptAt", "<=", Date.now())
    .orderBy("nextAttemptAt")
    .limit(limit)
    .get();
  let delivered = 0,
    failed = 0;
  for (const row of rows.docs) {
    const r = await deliverEmail(db, row.ref, send);
    if (r.accepted) delivered++;
    if (r.failed) failed++;
  }
  return { delivered, failed };
}
