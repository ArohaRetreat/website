import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  REPOSITORY,
  integer,
  validateRun,
  WORKFLOWS,
  JOBS,
  event,
  parseReport,
  status,
  completionTime,
} from "./contract.mjs";
export async function github(
  path,
  token,
  { binary = false, fetchImpl = fetch } = {},
) {
  if (!path.startsWith("/repos/" + REPOSITORY + "/"))
    throw Error("GITHUB_PATH");
  const response = await fetchImpl("https://api.github.com" + path, {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: binary ? "manual" : "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (binary && response.status === 302) {
    const location = new URL(response.headers.get("location"));
    if (location.protocol !== "https:") throw Error("ARTIFACT_REDIRECT");
    const download = await fetchImpl(location, {
      signal: AbortSignal.timeout(20000),
    });
    if (!download.ok) throw Error("ARTIFACT_DOWNLOAD");
    const limit = 2 * 1024 * 1024,
      chunks = [];
    let total = 0;
    for await (const chunk of download.body) {
      total += chunk.length;
      if (total > limit) throw Error("ARTIFACT_LIMIT");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  if (!response.ok) throw Error("GITHUB_HTTP_" + response.status);
  const text = await response.text();
  if (text.length > 8 * 1024 * 1024) throw Error("GITHUB_RESPONSE_LIMIT");
  return JSON.parse(text);
}
export async function collectRun(runId, attempt, token, { get = github } = {}) {
  runId = integer(runId);
  let run = await get(`/repos/${REPOSITORY}/actions/runs/${runId}`, token);
  attempt = integer(attempt || run.run_attempt);
  run = validateRun(
    await get(
      `/repos/${REPOSITORY}/actions/runs/${runId}/attempts/${attempt}`,
      token,
    ),
  );
  if (String(run.run_attempt) !== attempt || String(run.id) !== runId)
    throw Error("SOURCE_ATTEMPT_MISMATCH");
  const jobs = [];
  for (let page = 1; page <= 10; page++) {
    const part = await get(
      `/repos/${REPOSITORY}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100&page=${page}`,
      token,
    );
    jobs.push(...part.jobs);
    if (part.jobs.length < 100) break;
    if (page === 10) throw Error("JOB_LIMIT");
  }
  const reports = {};
  for (let page = 1; page <= 10; page++) {
    const part = await get(
      `/repos/${REPOSITORY}/actions/runs/${runId}/artifacts?per_page=100&page=${page}`,
      token,
    );
    for (const artifact of part.artifacts) {
      if (
        !new RegExp(
          `^delivery-reports-(application|foundation|website-integration|preprod)-${attempt}$`,
        ).test(artifact.name)
      )
        continue;
      if (artifact.expired || artifact.size_in_bytes > 2 * 1024 * 1024)
        throw Error("ARTIFACT_LIMIT");
      const zip = await get(
        `/repos/${REPOSITORY}/actions/artifacts/${integer(artifact.id)}/zip`,
        token,
        { binary: true },
      );
      const r = spawnSync(
        "python3",
        [fileURLToPath(new URL("./read-archive.py", import.meta.url))],
        { input: zip, maxBuffer: 3 * 1024 * 1024, encoding: "utf8" },
      );
      if (r.status !== 0) throw Error("ARTIFACT_REJECTED");
      for (const [name, text] of Object.entries(JSON.parse(r.stdout))) {
        if (reports[name]) throw Error("DUPLICATE_REPORT");
        reports[name] = parseReport(text, name);
      }
    }
    if (part.artifacts.length < 100) break;
    if (page === 10) throw Error("ARTIFACT_PAGE_LIMIT");
  }
  return { run, jobs, reports };
}
export function runEvents(
  { run, jobs, reports },
  reportingAttempt,
  reportingRunId = "local",
) {
  validateRun(run);
  const completedAt = completionTime(run, jobs);
  const base = {
    "sdlc.source": "github-api",
    "sdlc.authority": "github-confirmed",
    "workflow.name": WORKFLOWS.get(run.name),
    "workflow.run.id": integer(run.id),
    "workflow.execution.attempt": Number(integer(run.run_attempt)),
    "workflow.reporting.attempt": Number(integer(reportingAttempt)),
    "workflow.reporting.run.id":
      reportingRunId === "local" ? "local" : integer(reportingRunId),
    "git.commit.sha": run.head_sha,
    "workflow.run.url": `https://github.com/${REPOSITORY}/actions/runs/${run.id}`,
    "ci.observation.kind": "retrospective",
    "pull_request.numbers": (run.pull_requests || [])
      .slice(0, 20)
      .map((p) => Number(integer(p.number))),
  };
  const events = [
    event(
      "sdlc.workflow.completed",
      [run.id, run.run_attempt, "workflow"],
      completedAt,
      { ...base, "sdlc.status": run.conclusion },
    ),
  ];
  for (const job of jobs) {
    if (!JOBS.has(job.name)) throw Error("UNKNOWN_JOB");
    if (job.status !== "completed" || !job.completed_at)
      throw Error("INCOMPLETE_JOB");
    events.push(
      event(
        "sdlc.check.completed",
        [run.id, run.run_attempt, "job", job.id],
        job.completed_at,
        {
          ...base,
          "job.name": job.name,
          "job.id": integer(job.id),
          "sdlc.status": status(job.conclusion),
          "duration.ms": Math.max(
            0,
            Date.parse(job.completed_at) - Date.parse(job.started_at),
          ),
        },
      ),
    );
    for (const step of job.steps || [])
      if (step.status === "completed")
        events.push(
          event(
            "sdlc.step.completed",
            [run.id, run.run_attempt, "job", job.id, "step", step.number],
            step.completed_at || job.completed_at,
            {
              ...base,
              "job.name": job.name,
              "job.id": integer(job.id),
              "step.number": Number(integer(step.number)),
              "sdlc.status": status(step.conclusion),
              "duration.ms": Math.max(
                0,
                Date.parse(step.completed_at || job.completed_at) -
                  Date.parse(step.started_at || job.started_at),
              ),
            },
          ),
        );
  }
  const expected =
    run.name === "Foundation checks"
      ? ["foundation.jsonl"]
      : [
          "application.jsonl",
          "api-integration.jsonl",
          "api-telemetry.jsonl",
          "api-external.jsonl",
          "api-loyalty.jsonl",
        ];
  if (run.name !== "Foundation checks" && reports["preprod-integration.jsonl"])
    expected.push("preprod-integration.jsonl");
  if (
    run.name !== "Foundation checks" &&
    reports["api-preprod-telemetry.jsonl"]
  )
    expected.push("api-preprod-telemetry.jsonl");
  for (const name of expected) {
    const cases = reports[name];
    if (!cases?.length) {
      events.push(
        event(
          "sdlc.test.report",
          [run.id, run.run_attempt, "report", name],
          completedAt,
          { ...base, "test.suite": name, "sdlc.status": "missing" },
        ),
      );
      continue;
    }
    events.push(
      event(
        "sdlc.test.report",
        [run.id, run.run_attempt, "report", name],
        completedAt,
        {
          ...base,
          "test.suite": name,
          "sdlc.status": "available",
          "test.case.count": cases.length,
          "sdlc.authority": "runner-reported",
        },
      ),
    );
    for (const test of cases)
      events.push(
        event(
          "sdlc.test.completed",
          [run.id, run.run_attempt, "test", name, test.id],
          test.completedAt || completedAt,
          {
            ...base,
            "test.suite": name,
            "test.completion.time.kind": test.completedAt
              ? "runner-clock"
              : "workflow-end",
            "test.case.id": test.id,
            "test.case.ordinal": test.ordinal,
            "sdlc.authority": "runner-reported",
            "sdlc.status": test.status,
            "duration.ms": test.durationMs,
          },
        ),
      );
  }
  return events;
}
