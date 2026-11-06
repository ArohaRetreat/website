import {communicationRetryPatch} from './retry.mjs';
import { studioAccess } from "../access.mjs";
import { sharedCollectionName } from "../environment.mjs";
import { mailCollection, invoiceCollection } from "./jobs.mjs";
import { invoicePdf } from "./documents.mjs";
import { mailSettings } from "./config.mjs";
import { BookingError } from "../booking/domain.mjs";
export async function communicationCommand(
  db,
  operation,
  input,
  { booking, actor },
) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (k) =>
        !(
          operation === "email-resend"
            ? ["id", "jobId", "expectedVersion"]
            : ["id"]
        ).includes(k),
    )
  )
    throw new BookingError("INVALID_REQUEST");
  if (operation === "communications") {
    const jobs = await mailCollection(db)
        .where("bookingId", "==", booking.id)
        .limit(10)
        .get(),
      doc = await invoiceCollection(db)
        .doc(booking.invoiceId || booking.id + "-v1")
        .get(),
      invoice = doc.data();
    return {
      enabled: mailSettings().enabled,
      notifications: jobs.docs
        .filter(
          (d) =>
            d.data().channel !== "host_notification" || actor?.role === "host",
        )
        .map((d) => {
          const j = d.data();
          return {
            id: d.id,
            channel: j.channel,
            status: j.status,
            version: j.version,
            createdAt: j.createdAt,
            acceptedAt: j.acceptedAt || null,
            deliveredAt: j.deliveredAt || null,
            retryAllowed:
              actor?.role === "host" &&
              actor.bookingAccess === "manager" &&
              j.status === "failed" &&
              j.uncertain !== true &&
              !j.providerMessageId,
          };
        }),
      invoice: invoice
        ? {
            id: invoice.id,
            number: invoice.number,
            total: invoice.total,
            balanceDue: invoice.status === "void" ? 0 : invoice.balanceDue,
            status: invoice.status,
            test: invoice.test,
          }
        : null,
    };
  }
  if (operation === "invoice-download") {
    const invoice = (
      await invoiceCollection(db)
        .doc(booking.invoiceId || booking.id + "-v1")
        .get()
    ).data();
    if (!invoice || invoice.owner !== booking.owner)
      throw new BookingError("INVOICE_NOT_FOUND", 404);
    if (["void", "superseded"].includes(invoice.status))
      throw new BookingError("INVOICE_NOT_PAYABLE", 409);
    const pdf = await invoicePdf(invoice);
    return {
      filename: invoice.number + ".pdf",
      contentType: "application/pdf",
      contentBase64: pdf.buffer.toString("base64"),
    };
  }
  if (operation === "email-resend") {
    if (
      actor?.role !== "host" ||
      actor.bookingAccess !== "manager" ||
      !Number.isSafeInteger(input.expectedVersion) ||
      !/^[a-f0-9]{64}$/.test(input.jobId || "")
    )
      throw new BookingError("FORBIDDEN", 403);
    await db.runTransaction(async (tx) => {
      const ref = mailCollection(db).doc(input.jobId),
        [d, m] = await Promise.all([
          tx.get(ref),
          tx.get(db.collection(sharedCollectionName("members")).doc(actor.id)),
        ]),
        j = d.data();
      if (studioAccess(m.data()).bookings !== "manager")
        throw new BookingError("FORBIDDEN", 403);
      tx.update(ref,communicationRetryPatch(j,booking.id,input.expectedVersion));
    });
    return { queued: true };
  }
  throw new BookingError("NOT_FOUND", 404);
}
