import { randomUUID } from "node:crypto";
import { normalizedEmail } from "../booking/customers.mjs";
import { contextFields } from "../booking/observability.mjs";
import { environment, isTesterEmail } from "../environment.mjs";
import { mailSettings, recipientMode, validEmail } from "../email/config.mjs";
import { col, digest, fail, queryPage } from "./core.mjs";
import { studioCustomer } from "./studio-data.mjs";

const subjects = {
  guest_acknowledgement: "Booking request received",
  guest_confirmation: "Booking confirmed",
  guest_cancelled: "Booking cancelled",
  guest_declined: "Booking declined",
  guest_checkin: "Check-in",
  guest_checkout: "Checkout",
  guest_feedback: "Private feedback invitation",
  guest_manual: "Staff email",
};
const view = (job) => ({
  id: job.id,
  channel: job.channel,
  subject: job.manual?.subject || subjects[job.channel],
  status: job.status,
  recipient: job.to,
  reference: job.snapshot?.reference || null,
  createdAt: job.createdAt,
  acceptedAt: job.acceptedAt ?? null,
  deliveredAt: job.deliveredAt ?? null,
  statusAt: job.deliveryStatusAt ?? null,
  test: job.test === true,
});

export async function studioEmail({ tx, db, ctx, input }) {
  const notifications = col(db, "notifications");
  if (ctx.operation === "getStudioEmail") {
    const job = (await tx.get(notifications.doc(input.jobId))).data();
    if (!job || job.environment !== environment.name || !Object.hasOwn(subjects, job.channel))
      fail("NOT_FOUND", 404);
    return { ...view(job), message: job.manual?.message ?? null, replyTo: job.replyTo };
  }
  if (ctx.operation === "listStudioEmail") {
    let query = notifications.where("channel", "in", Object.keys(subjects));
    let binding = "all";
    if (input.id) {
      const { owners } = await studioCustomer(tx, db, input.id);
      query = query.where("owner", "in", owners);
      binding = owners.join(",");
    }
    return queryPage(tx, db, ctx, "studioEmail:" + binding, { limit: 15, ...input }, query, view, {
      orderField: "createdAt", descending: true,
    });
  }

  const config = mailSettings();
  if (!config.enabled) fail("MAIL_DISABLED", 409);
  const { profile, owners } = await studioCustomer(tx, db, input.id);
  const email = normalizedEmail(profile.email);
  if (profile.erasedAt || !validEmail(email)) fail("MAIL_RECIPIENT_UNAVAILABLE", 409);
  const mode = recipientMode(config);
  if (mode === "booking" && !isTesterEmail(email)) fail("PREPROD_MAIL_RECIPIENT_REQUIRED", 403);
  const subject = input.subject.trim();
  const message = input.message.replace(/\r\n?/g, "\n").trim();
  if (/[\x00-\x1f\x7f]/.test(subject) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(message))
    fail("INVALID_EMAIL_TEXT");

  let booking;
  if (input.bookingId) {
    booking = (await tx.get(col(db, "bookings").doc(input.bookingId))).data();
    if (!booking || !owners.includes(booking.owner)) fail("NOT_FOUND", 404);
  }
  const id = digest(environment.name + ":studio-mail:" + randomUUID());
  const job = {
    schemaVersion: 1,
    id,
    owner: input.id,
    bookingId: booking?.id || null,
    environment: environment.name,
    test: config.test,
    sourceEventId: id,
    sourceContext: contextFields(),
    channel: "guest_manual",
    templateVersion: "email-v1-studio-message",
    recipientMode: mode,
    recipientEmail: email,
    to: mode === "test-inbox" ? config.testRecipient : email,
    from: config.from,
    replyTo: config.replyTo,
    snapshot: { reference: booking?.reference || null },
    manual: { subject, message },
    status: "queued",
    version: 1,
    attempts: 0,
    createdAt: ctx.now,
    nextAttemptAt: ctx.now,
  };
  tx.create(notifications.doc(id), job);
  return { ...view(job), replyTo: job.replyTo };
}
