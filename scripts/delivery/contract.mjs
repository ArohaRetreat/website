import { createHash } from "node:crypto";
export const REPOSITORY = "ArohaRetreat/website";
export const PROVIDER = "aroha.sdlc";
export const WORKFLOWS = new Map([
  ["Website application checks", "application"],
  ["Foundation checks", "foundation"],
]);
export const JOBS = new Set([
  "application",
  "foundation",
  "website-integration",
]);
export const STATUSES = new Set([
  "success",
  "failure",
  "cancelled",
  "skipped",
  "timed_out",
  "action_required",
  "neutral",
  "stale",
  "startup_failure",
  "pending",
  "missing",
]);
export const REPORTS = new Set([
  "application.jsonl",
  "foundation.jsonl",
  "api-integration.jsonl",
  "api-telemetry.jsonl",
  "api-external.jsonl",
  "api-loyalty.jsonl",
  "preprod-integration.jsonl",
  "api-preprod-telemetry.jsonl",
]);
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export function id(...parts) {
  return digest(parts.join(":"));
}
export function status(value) {
  if (!STATUSES.has(value)) throw Error("INVALID_STATUS");
  return value;
}
export function integer(value) {
  if (!/^\d{1,20}$/.test(String(value))) throw Error("INVALID_ID");
  return String(value);
}
export function revision(value) {
  if (!/^[a-f0-9]{40}$/.test(value)) throw Error("INVALID_REVISION");
  return value;
}
export function timestamp(value) {
  const d = new Date(value);
  if (!Number.isFinite(+d)) throw Error("INVALID_TIMESTAMP");
  return d.toISOString();
}
export function event(type, identity, occurredAt, fields = {}) {
  if (!/^sdlc\.[a-z.]+$/.test(type)) throw Error("INVALID_EVENT_TYPE");
  return {
    "event.provider": PROVIDER,
    "event.type": type,
    "sdlc.schema.version": 1,
    "sdlc.event.id": id(REPOSITORY, ...identity),
    "sdlc.occurred_at": timestamp(occurredAt),
    "sdlc.observed_at": new Date().toISOString(),
    "repository.full_name": REPOSITORY,
    "service.namespace": "aroha-retreat",
    ...fields,
  };
}
export function parseReport(text, name) {
  if (!REPORTS.has(name) || Buffer.byteLength(text) > 1024 * 1024)
    throw Error("REPORT_LIMIT");
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length > 2500) throw Error("REPORT_LIMIT");
  const seen = new Set();
  return lines.map((line) => {
    const x = JSON.parse(line);
    if (
      x.schema !== 1 ||
      x.kind !== "test" ||
      !/^[a-f0-9]{64}$/.test(x.id) ||
      !["passed", "failed", "skipped"].includes(x.status) ||
      !Number.isFinite(x.durationMs) ||
      x.durationMs < 0 ||
      x.durationMs > 3600000 ||
      !Number.isInteger(x.ordinal) ||
      x.ordinal < 0
    )
      throw Error("INVALID_TEST_REPORT");
    if (seen.has(x.id)) throw Error("DUPLICATE_TEST_ID");
    seen.add(x.id);
    return {
      schema: 1,
      kind: "test",
      id: x.id,
      status: x.status,
      durationMs: x.durationMs,
      ordinal: x.ordinal,
      ...(x.completedAt ? { completedAt: timestamp(x.completedAt) } : {}),
    };
  });
}
export function validateRun(run) {
  if (
    run.repository?.full_name !== REPOSITORY ||
    run.head_repository?.full_name !== REPOSITORY ||
    !WORKFLOWS.has(run.name) ||
    ![
      ".github/workflows/application.yml",
      ".github/workflows/foundation.yml",
    ].includes(run.path) ||
    !["push", "pull_request"].includes(run.event) ||
    run.status !== "completed"
  )
    throw Error("UNTRUSTED_SOURCE_RUN");
  integer(run.id);
  integer(run.run_attempt);
  revision(run.head_sha);
  status(run.conclusion);
  return run;
}

export function completionTime(run, jobs) {
  const times = jobs
    .filter((j) => j.completed_at)
    .map((j) => Date.parse(timestamp(j.completed_at)));
  return times.length
    ? new Date(Math.max(...times)).toISOString()
    : timestamp(run.updated_at);
}
