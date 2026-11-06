import { col } from "./core.mjs";
import {
  ledgerRead,
  financialSummary,
  prepareDocument,
  commitDocument,
} from "./finance.mjs";
import { mailSettings, validEmail, recipientMode } from "../email/config.mjs";
import { environment } from "../environment.mjs";
import { digest } from "./core.mjs";
import { contextFields } from "../booking/observability.mjs";
export function queueLifecycle(
  tx,
  db,
  {
    booking,
    profile,
    channel,
    now,
    notBefore = now,
    document,
    facilities = [],
    paymentId,
  },
) {
  const config = mailSettings();
  if (!config.enabled) return "not_configured";
  if (!validEmail(profile.email)) return "recipient_unavailable";
  const id = digest(
    environment.name +
      ":" +
      booking.id +
      ":" +
      channel +
      ":" +
      (paymentId ||
        booking.checkedOutAt ||
        booking.checkedInAt ||
        booking.version),
  );
  const snapshot = {
    reference: booking.reference || booking.id,
    guestName:
      booking.contact?.name || profile.contact?.name || profile.name || "Guest",
    kind: booking.kind || "legacy",
    arrival: booking.arrival,
    departure: booking.departure,
    startsAt: booking.startsAt || 0,
    endsAt: booking.endsAt || 0,
    status: booking.status,
    bookingVersion: booking.version,
    total: booking.total,
    pricingPending: booking.checkoutPricingPending === true,
    guests: booking.guests || booking.adults || 0,
    checkedInAt: booking.checkedInAt || null,
    checkedOutAt: booking.checkedOutAt || null,
    facilities: facilities.slice(0, 20),
    amountPaid: document?.amountPaid ?? booking.actualPaidAtCheckout ?? 0,
    balanceDue:
      document?.balanceDue ?? booking.outstandingAtCheckout ?? booking.total,
  };
  tx.set(col(db, "notifications").doc(id), {
    id,
    schemaVersion: 1,
    owner: booking.owner,
    bookingId: booking.id,
    environment: environment.name,
    sourceEventId: id,
    sourceContext: contextFields(),
    templateVersion: ['guest_cancelled','guest_declined'].includes(channel) ? 'email-v4-status' : "email-v4-lifecycle",
    documentTemplateVersion: document ? "pdf-v4-financial" : null,
    documentId: document?.id || null,
    paymentId: paymentId || null,
    channel,
    to:
      recipientMode(config) === "test-inbox"
        ? config.testRecipient
        : profile.email,
    recipientMode: recipientMode(config),
    from: config.from,
    replyTo: config.replyTo,
    test: config.test,
    subjectPrefix: config.test ? "[PRE-PROD TEST] " : "",
    snapshot,
    status: "queued",
    version: 1,
    attempts: 0,
    createdAt: now,
    nextAttemptAt: notBefore,
  });
  return "queued";
}
export async function prepareStayLifecycle(
  tx,
  db,
  { booking, operation, input, now },
) {
  if (
    operation !== "booking-action" ||
    !["checkin", "complete", "cancel", "decline"].includes(input.action) ||
    !booking
  )
    return null;
  if (['cancel','decline'].includes(input.action)) return {action:input.action};
  if (input.action === "checkin") return { action: "checkin" };
  const ledger = await ledgerRead(tx, db, booking.id);
  if (booking.total === null && !ledger.length)
    return { action: "complete", summary: null, prepared: null };
  const summary = financialSummary(booking, ledger),
    config = mailSettings();
  const prepared =
    environment.preprod ||
    (config.issuer.address && config.issuer.paymentInstructions)
      ? await prepareDocument(
          tx,
          db,
          { ...booking, checkedOutAt: now },
          summary,
          "checkout_statement",
          now,
        )
      : null;
  return { action: "complete", summary, prepared };
}
export function commitStayLifecycle(
  tx,
  db,
  { prepared, booking, profile, settings, now },
) {
  if (!prepared) return;
  if (['cancel','decline'].includes(prepared.action)) {
    const status=prepared.action==='cancel'?'cancelled':'declined';
    booking.lifecycleDelivery={...(booking.lifecycleDelivery||{}),[status]:queueLifecycle(tx,db,{booking,profile,channel:'guest_'+status,now})};
    return;
  }
  if (prepared.action === "checkin") {
    booking.checkedInAt = now;
    booking.lifecycleDelivery = {
      ...(booking.lifecycleDelivery || {}),
      checkin: queueLifecycle(tx, db, {
        booking,
        profile,
        channel: "guest_checkin",
        facilities: (settings.facilities || [])
          .filter((f) => f.available === true)
          .map((f) => f.name),
        now,
      }),
    };
    return;
  }
  booking.checkedOutAt = now;
  booking.actualPaidAtCheckout = prepared.summary?.paidPaise ?? 0;
  booking.outstandingAtCheckout = prepared.summary?.balanceDuePaise ?? null;
  booking.checkoutPricingPending = !prepared.summary;
  if (prepared.prepared) {
    commitDocument(tx, db, prepared.prepared, now);
    booking.checkoutStatementId = prepared.prepared.document.id;
  }
  const checkout = queueLifecycle(tx, db, {
    booking,
    profile,
    channel: "guest_checkout",
    now,
    document: prepared.prepared?.document,
  });
  // Imported private bookings have no fabricated Google identity or unusable feedback link.
  const feedback =
    booking.source === "host_private"
      ? "account_required"
      : queueLifecycle(tx, db, {
          booking,
          profile,
          channel: "guest_feedback",
          now,
          notBefore: now + 24 * 3600000,
        });
  booking.lifecycleDelivery = {
    ...(booking.lifecycleDelivery || {}),
    checkout,
    feedback,
  };
}
