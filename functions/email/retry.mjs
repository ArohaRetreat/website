import { FieldValue } from "firebase-admin/firestore";
import { BookingError } from "../booking/domain.mjs";
export function communicationRetryPatch(
  job,
  bookingId,
  expectedVersion,
  now = Date.now(),
) {
  if (!job || job.bookingId !== bookingId)
    throw new BookingError("NOT_FOUND", 404);
  if (job.version !== expectedVersion)
    throw new BookingError("VERSION_CONFLICT", 409);
  if (
    job.status !== "failed" ||
    job.uncertain === true ||
    job.providerMessageId
  )
    throw new BookingError("MAIL_RECONCILIATION_REQUIRED", 409);
  return {
    status: "retry",
    version: job.version + 1,
    nextAttemptAt: now,
    firstAttemptAt: FieldValue.delete(),
    errorCode: FieldValue.delete(),
  };
}
