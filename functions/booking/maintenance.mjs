// Keep the bounded drains independent, including if one destination stalls.
export async function runBookingMaintenance({ drainMail, drainTelemetry }) {
  const results = await Promise.allSettled(
    [drainMail, drainTelemetry].map(drain => Promise.resolve().then(drain)),
  );
  const failures = results.filter(result => result.status === "rejected").map(result => result.reason);
  if (failures.length) throw new AggregateError(failures, "BOOKING_MAINTENANCE_FAILED");
}
