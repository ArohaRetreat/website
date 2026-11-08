// Retry mail and telemetry independently so one unavailable destination cannot
// prevent the other queue from progressing during this scheduled invocation.
export async function runPreprodMaintenance({ drainMail, drainTelemetry, drainIdentity }) {
  const failures = [];
  for (const drain of [drainMail, drainTelemetry, drainIdentity]) {
    if (!drain) continue;
    try {
      await drain();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, "PREPROD_MAINTENANCE_FAILED");
}
