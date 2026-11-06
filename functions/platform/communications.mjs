import { col, fail } from "./core.mjs";
import { communicationRetryPatch } from "../email/retry.mjs";
const view = (j) => ({
  id: j.id,
  version: j.version,
  channel: j.channel,
  status: j.status,
  createdAt: j.createdAt,
  templateVersion: j.templateVersion || "legacy",
  retryAllowed:
    j.status === "failed" && j.uncertain !== true && !j.providerMessageId,
});
export async function communicationsHandler({ tx, db, ctx, input, booking }) {
  const ref = col(db, "notifications").doc(input.jobId),
    j = (await tx.get(ref)).data();
  if (!j || j.bookingId !== booking.id || j.owner !== booking.owner)
    fail("NOT_FOUND", 404);
  if (ctx.operation === "getCommunication") {
    if (
      j.channel === "host_notification" &&
      (!ctx.all || ctx.modules.bookings === "none")
    )
      fail("NOT_FOUND", 404);
    const result = view(j);
    if (ctx.modules.bookings !== "manager" || !ctx.all)
      result.retryAllowed = false;
    return result;
  }
  const patch = communicationRetryPatch(
    j,
    booking.id,
    input.expectedVersion,
    ctx.now,
  );
  tx.update(ref, patch);
  return { ...view({ ...j, ...patch }), queued: true };
}
