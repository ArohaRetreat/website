import { createHash } from "node:crypto";
import { environment, collectionName } from "../environment.mjs";
import { mailSettings, validEmail } from "./config.mjs";
import {
  contextFields,
  bookingEvent,
  queueCommitted,
} from "../booking/observability.mjs";
const hash = (v) => createHash("sha256").update(v).digest("hex");
export const mailCollection = (db) =>
  db.collection(collectionName("notifications"));
export const invoiceCollection = (db) =>
  db.collection(collectionName("invoices"));
export const invoiceYear = (now) => new Date(now + 19800000).getUTCFullYear();
export function invoiceSnapshot(
  booking,
  profile,
  sequence,
  config,
  now = Date.now(),
  previous,
) {
  if (
    !Number.isSafeInteger(booking.total) ||
    booking.total < 0 ||
    !Number.isSafeInteger(booking.subtotal) ||
    !Number.isSafeInteger(booking.discount) ||
    booking.subtotal - booking.discount !== booking.total
  )
    throw Error("INVOICE_PRICE_REQUIRED");
  const lines = (booking.lineItems || []).map((l) => ({
    label: String(l.label).slice(0, 200),
    amount: l.amount,
  }));
  if (
    !lines.length ||
    lines.length > 30 ||
    lines.some((l) => !Number.isSafeInteger(l.amount) || l.amount < 0) ||
    lines.reduce((n, l) => n + l.amount, 0) !== booking.subtotal
  )
    throw Error("INVOICE_PRICE_REQUIRED");
  const v = {
    schemaVersion: 1,
    id: booking.id + "-v" + ((previous?.version || 0) + 1),
    bookingId: booking.id,
    owner: booking.owner,
    environment: environment.name,
    number: `${config.test ? "TEST-" : ""}AR-${invoiceYear(now)}-${String(sequence).padStart(6, "0")}`,
    version: (previous?.version || 0) + 1,
    supersedes: previous?.id || null,
    createdAt: now,
    currency: "INR",
    reference: booking.reference,
    kind: booking.kind || "legacy",
    arrival: booking.arrival,
    departure: booking.departure,
    startsAt: booking.startsAt || 0,
    endsAt: booking.endsAt || 0,
    guestName:
      booking.contact?.name || profile.contact?.name || profile.name || "Guest",
    guestEmail: profile.email,
    issuer: { ...config.issuer },
    test: config.test,
    lineItems: lines,
    subtotal: booking.subtotal,
    discount: booking.discount,
    total: booking.total,
    amountPaid: 0,
    balanceDue: booking.total,
    status: "unpaid",
  };
  return { ...v, snapshotHash: hash(JSON.stringify(v)) };
}
export function queueNotifications(
  tx,
  db,
  {
    event,
    booking,
    profile,
    config = mailSettings(),
    invoice,
    now = Date.now(),
  },
) {
  if (!config.enabled) return [];
  if (
    ![
      "booking.requested",
      "booking.confirmed",
      "booking.approve_change",
    ].includes(event.type)
  )
    return [];
  if (!validEmail(profile.email)) throw Error("VERIFIED_RECIPIENT_REQUIRED");
  const channels =
    event.type === "booking.requested"
      ? ["guest_acknowledgement", "host_notification"]
      : ["guest_confirmation"];
  return channels.map((channel) => {
    const id = hash(environment.name + ":" + event.eventId + ":" + channel),
      target = channel === "host_notification" ? config.hostTo : profile.email;
    const job = {
      schemaVersion: 1,
      id,
      owner: booking.owner,
      bookingId: booking.id,
      environment: environment.name,
      sourceEventId: event.eventId,
      sourceContext: contextFields(),
      channel,
      to: config.test ? config.testRecipient : target,
      from: config.from,
      replyTo: config.replyTo,
      test: config.test,
      invoiceId: invoice?.id || null,
      subjectPrefix: config.test ? "[PRE-PROD TEST] " : "",
      snapshot: {
        reference: booking.reference,
        guestName:
          booking.contact?.name ||
          profile.contact?.name ||
          profile.name ||
          "Guest",
        arrival: booking.arrival,
        departure: booking.departure,
        startsAt: booking.startsAt || 0,
        endsAt: booking.endsAt || 0,
        kind: booking.kind || "legacy",
        guests: booking.guests,
        total: booking.total,
        bookingVersion: booking.version,
        amended: event.type === "booking.approve_change",
      },
      status: "queued",
      version: 1,
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
    };
    tx.create(mailCollection(db).doc(id), job);
    queueCommitted(
      tx,
      db,
      bookingEvent({
        id: "mail:" + id + ":queued",
        type: "email.queued",
        authority: "server-confirmed",
        actor: event.actor,
        entity: booking.id,
        jobId: id,
        invoiceId: invoice?.id,
        outcome: "succeeded",
        at: now,
      }),
    );
    return id;
  });
}
