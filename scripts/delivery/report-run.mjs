import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectRun, runEvents } from "./github.mjs";
import { telemetry } from "./otlp.mjs";
import { exportDelivery } from "./transport.mjs";
import { deliveryToken, configureGitHubSecret } from "./credentials.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
export function instrumentRun(snapshot, events, reportingAttempt) {
  const otel = telemetry("aroha-ci-observer", "1.0.0", "ci");
  const { run, jobs } = snapshot;
  const rootEvent = events[0];
  const parent = otel.span(
    "github.workflow",
    { ...rootEvent, "workflow.reporting.attempt": Number(reportingAttempt) },
    run.run_started_at || run.created_at,
    run.updated_at,
  );
  const jobContexts = new Map();
  for (const job of jobs) {
    const item = events.find(
      (e) =>
        e["event.type"] === "sdlc.check.completed" &&
        e["job.id"] === String(job.id),
    );
    jobContexts.set(
      String(job.id),
      otel.span(
        "github.job",
        item,
        job.started_at || run.run_started_at,
        job.completed_at,
        parent,
      ),
    );
    for (const step of job.steps || []) {
      const item = events.find(
        (e) =>
          e["event.type"] === "sdlc.step.completed" &&
          e["job.id"] === String(job.id) &&
          e["step.number"] === step.number,
      );
      if (item)
        otel.span(
          "github.step",
          item,
          step.started_at || job.started_at,
          step.completed_at || job.completed_at,
          jobContexts.get(String(job.id)),
        );
    }
  }
  for (const item of events) {
    otel.log(item, jobContexts.get(item["job.id"]) || parent);
    otel.metric(
      item["event.type"].split(".").slice(1, -1).join("."),
      item["sdlc.status"],
      Number(item["duration.ms"] || 0) / 1000,
    );
  }
  return otel;
}
async function main() {
  if (process.argv.includes("--configure-github-secret")) {
    await configureGitHubSecret();
    return;
  }
  const payload = process.env.GITHUB_EVENT_PATH
    ? JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"))
    : {};
  const flag = (name) => {
    const i = process.argv.indexOf(name);
    return i < 0 ? null : process.argv[i + 1];
  };
  const runId =
    flag("--run-id") || process.env.SOURCE_RUN_ID || payload.workflow_run?.id;
  const attempt =
    flag("--attempt") ||
    process.env.SOURCE_RUN_ATTEMPT ||
    payload.workflow_run?.run_attempt;
  let ghToken = process.env.GH_TOKEN;
  if (!ghToken) {
    const r = spawnSync("gh", ["auth", "token"], { encoding: "utf8" });
    if (r.status !== 0) throw Error("GITHUB_AUTH_REQUIRED");
    ghToken = r.stdout.trim();
  }
  const snapshot = await collectRun(runId, attempt, ghToken);
  const reportingAttempt = process.env.GITHUB_RUN_ATTEMPT || "1";
  const events = runEvents(snapshot, reportingAttempt);
  const directory = root + "local/delivery-outbox";
  await mkdir(directory, { recursive: true });
  const filename = `${directory}/github-${snapshot.run.id}-${snapshot.run.run_attempt}.json`;
  const outbox = {
    schemaVersion: 1,
    sourceRun: String(snapshot.run.id),
    executionAttempt: snapshot.run.run_attempt,
    reportingAttempt: Number(reportingAttempt),
    events,
  };
  await writeFile(filename, JSON.stringify(outbox, null, 2));
  const token = await deliveryToken();
  const start = new Date().toISOString();
  const otel = instrumentRun(snapshot, events, reportingAttempt);
  otel.span(
    "delivery.report",
    { operation: "github-report", "sdlc.authority": "observer-executed" },
    start,
    new Date().toISOString(),
  );
  outbox.delivery = await exportDelivery(events, otel, token);
  await writeFile(filename, JSON.stringify(outbox, null, 2));
  console.log(
    JSON.stringify({
      sourceRun: outbox.sourceRun,
      executionAttempt: outbox.executionAttempt,
      events: events.length,
      delivery: outbox.delivery,
    }),
  );
  if (!outbox.delivery.accepted) process.exitCode = 2;
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error(
      "Delivery reporting failed; source workflow state is unchanged. Inspect the bounded outbox receipt.",
    );
    process.exitCode = 2;
  });
