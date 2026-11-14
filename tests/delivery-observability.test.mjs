import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import {
  event,
  parseReport,
  validateRun,
  completionTime,
  id,
} from "../scripts/delivery/contract.mjs";
import { runEvents, collectRun } from "../scripts/delivery/github.mjs";
import { instrumentRun } from "../scripts/delivery/report-run.mjs";
import { deploymentEvents } from "../scripts/delivery/deployment.mjs";
import { telemetry } from "../scripts/delivery/otlp.mjs";
import { request, exportDelivery } from "../scripts/delivery/transport.mjs";
const require = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const { ProtobufTraceSerializer } = require("@opentelemetry/otlp-transformer");
const now = "2026-11-02T00:00:00Z",
  sha = "a".repeat(40);
const run = {
  id: 42,
  run_attempt: 2,
  name: "Website application checks",
  path: ".github/workflows/application.yml",
  event: "pull_request",
  repository: { full_name: "ArohaRetreat/website" },
  head_repository: { full_name: "ArohaRetreat/website" },
  head_sha: sha,
  status: "completed",
  conclusion: "failure",
  created_at: now,
  run_started_at: now,
  updated_at: "2026-11-02T00:01:00Z",
};
const job = {
  id: 7,
  name: "application",
  status: "completed",
  conclusion: "failure",
  started_at: now,
  completed_at: run.updated_at,
  steps: [
    {
      number: 1,
      status: "completed",
      conclusion: "success",
      started_at: now,
      completed_at: now,
    },
    {
      number: 2,
      status: "completed",
      conclusion: "failure",
      started_at: now,
      completed_at: run.updated_at,
    },
    { number: 3, status: "completed", conclusion: "skipped" },
  ],
};
const cases = ["passed", "failed", "skipped"].map((status, i) => ({
  schema: 1,
  kind: "test",
  id: id("test", i),
  ordinal: i,
  status,
  durationMs: i,
}));
const snapshot = { run, jobs: [job], reports: { "application.jsonl": cases } };
test("source execution identity is stable across reporter reruns and changes across execution attempts", () => {
  const a = runEvents(snapshot, 1),
    b = runEvents(snapshot, 9);
  assert.deepEqual(
    a.map((x) => x["sdlc.event.id"]),
    b.map((x) => x["sdlc.event.id"]),
  );
  assert.equal(b[0]["workflow.execution.attempt"], 2);
  assert.equal(b[0]["workflow.reporting.attempt"], 9);
  assert.notEqual(
    a[0]["sdlc.event.id"],
    runEvents({ ...snapshot, run: { ...run, run_attempt: 3 } }, 1)[0][
      "sdlc.event.id"
    ],
  );
  assert.equal(a[0]["sdlc.occurred_at"], "2026-11-02T00:01:00.000Z");
});
test("workflow failure, skipped steps and passed/failed/skipped/missing test results remain distinct", () => {
  const events = runEvents(snapshot, 1);
  assert.equal(events[0]["sdlc.status"], "failure");
  assert.ok(
    events.some(
      (x) =>
        x["event.type"] === "sdlc.step.completed" &&
        x["sdlc.status"] === "skipped",
    ),
  );
  for (const value of ["passed", "failed", "skipped"])
    assert.ok(
      events.some(
        (x) =>
          x["event.type"] === "sdlc.test.completed" &&
          x["sdlc.status"] === value,
      ),
    );
  assert.equal(
    events.filter(
      (x) =>
        x["event.type"] === "sdlc.test.report" &&
        x["sdlc.status"] === "missing",
    ).length,
    4,
  );
});
test("foreign forks, unknown workflow and incomplete source runs are refused", () => {
  for (const patch of [
    { head_repository: { full_name: "attacker/fork" } },
    { repository: { full_name: "other/repo" } },
    { name: "evil" },
    { status: "in_progress" },
    { head_sha: "invalid" },
  ])
    assert.throws(() => validateRun({ ...run, ...patch }));
});
test("untrusted test reports are bounded, deduplicated and stripped of names and assertion data", () => {
  const rows = parseReport(
    JSON.stringify({
      ...cases[0],
      name: "PRIVATE-NAME",
      output: "PRIVATE-ASSERTION",
    }),
    "application.jsonl",
  );
  const emitted = JSON.stringify(
    runEvents({ ...snapshot, reports: { "application.jsonl": rows } }, 1),
  );
  assert.ok(!emitted.includes("PRIVATE-"));
  assert.throws(() =>
    parseReport(
      JSON.stringify({ ...cases[0], status: "invented" }),
      "application.jsonl",
    ),
  );
  assert.throws(() =>
    parseReport(
      [cases[0], cases[0]].map(JSON.stringify).join("\n"),
      "application.jsonl",
    ),
  );
  assert.throws(() =>
    parseReport("x".repeat(1024 * 1024 + 1), "application.jsonl"),
  );
});
function zipEntries(entries) {
  const code = `import sys,zipfile,io,stat,json
b=io.BytesIO()
with zipfile.ZipFile(b,'w') as z:
 for name, content, *options in json.load(sys.stdin):
  i=zipfile.ZipInfo(name)
  i.external_attr=(stat.S_IFLNK | 0o777)<<16 if options and options[0] else 0
  z.writestr(i,content,compress_type=zipfile.ZIP_DEFLATED)
sys.stdout.buffer.write(b.getvalue())`;
  const result = spawnSync("python3", ["-c", code], { input: JSON.stringify(entries) });
  assert.equal(result.status, 0);
  return result.stdout;
}
function zip(name, content = "{}", symlink = false) {
  return zipEntries([[name, content, symlink]]);
}
test("artifact reader refuses traversal, symlinks and oversized archives without extraction", () => {
  const reader = (input) =>
    spawnSync("python3", ["scripts/delivery/read-archive.py"], {
      input,
      encoding: "utf8",
    });
  assert.equal(reader(zip("application.jsonl", "")).status, 0);
  assert.equal(reader(zip("preprod-integration.jsonl", "")).status, 0);
  assert.equal(reader(zip("api-preprod-telemetry.jsonl", "")).status, 0);
  for (const name of [
    "../application.jsonl",
    "/tmp/application.jsonl",
    "evil.py",
  ])
    assert.notEqual(reader(zip(name)).status, 0);
  assert.notEqual(reader(zip("application.jsonl", "target", true)).status, 0);
  assert.notEqual(reader(Buffer.alloc(2 * 1024 * 1024 + 1)).status, 0);
  assert.notEqual(reader(zipEntries([["api-external.jsonl", "{}"], ["api-external.jsonl", "{}"]])).status, 0);
  assert.notEqual(reader(zip("api-loyalty.jsonl", "x".repeat(200_000))).status, 0);
});
test("collector requests original attempt-specific jobs and artifact name, never executes artifact input", async () => {
  const calls = [];
  const get = async (path) => {
    calls.push(path);
    if (path.includes("/jobs?")) return { jobs: [job] };
    if (path.includes("/artifacts?"))
      return {
        artifacts: [
          {
            id: 9,
            name: "delivery-reports-application-2",
            size_in_bytes: 100,
            expired: false,
          },
        ],
      };
    if (path.endsWith("/zip"))
      return zip("application.jsonl", cases.map(JSON.stringify).join("\n"));
    return run;
  };
  const result = await collectRun("42", "2", "synthetic", { get });
  assert.equal(result.reports["application.jsonl"].length, 3);
  assert.ok(calls.some((x) => x.includes("/attempts/2/jobs?")));
});
test("actual external API and loyalty records survive the full artifact-to-event path", async () => {
  const external = "api-external.jsonl";
  const loyalty = "api-loyalty.jsonl";
  const content = JSON.stringify({
    ...cases[0],
    completedAt: now,
    name: "PRIVATE-NAME",
    command: "PRIVATE-COMMAND",
    fixture: "PRIVATE-FIXTURE",
  });
  const archive = zipEntries([[external, content], [loyalty, content]]);
  const get = async (path) => {
    if (path.includes("/jobs?")) return { jobs: [job] };
    if (path.includes("/artifacts?")) return {
      artifacts: [{
        id: 10,
        name: "delivery-reports-website-integration-2",
        size_in_bytes: archive.length,
        expired: false,
      }],
    };
    if (path.endsWith("/zip")) return archive;
    return run;
  };
  const collected = await collectRun("42", "2", "synthetic", { get });
  const events = runEvents(collected, 3, "81");
  const reports = events.filter(item => [external, loyalty].includes(item["test.suite"]));
  const completed = reports.filter(item => item["event.type"] === "sdlc.test.completed");
  assert.equal(reports.length, 4);
  assert.equal(completed.length, 2);
  assert.notEqual(completed[0]["sdlc.event.id"], completed[1]["sdlc.event.id"]);
  for (const item of completed) {
    assert.equal(item["sdlc.status"], "passed");
    assert.equal(item["sdlc.authority"], "runner-reported");
    assert.equal(item["sdlc.occurred_at"], new Date(now).toISOString());
    assert.equal(item["workflow.execution.attempt"], 2);
    assert.equal(item["workflow.reporting.run.id"], "81");
  }
  assert.deepEqual(
    completed.map(item => item["sdlc.event.id"]),
    runEvents(collected, 4, "81").filter(item => item["event.type"] === "sdlc.test.completed")
      .map(item => item["sdlc.event.id"]),
  );
  assert.ok(!JSON.stringify(events).includes("PRIVATE-"));
});
test("historical CI replay keeps source event time and exports the current observer span", async () => {
  const events = runEvents(snapshot, 1, "80");
  for (const [hour, expected] of [["00", true], ["02", false]]) {
    const { otel, sourceSpans } = instrumentRun(snapshot, events, {
      startedAt: `2026-11-02T${hour}:05:00Z`,
      observedAt: `2026-11-02T${hour}:05:01Z`,
    });
    try {
      const batches = await otel.batches();
      const traceBatch = Buffer.from(batches.find(batch => batch.signal === "traces").body);
      assert.equal(sourceSpans, expected);
      assert.equal(traceBatch.includes("github.workflow"), expected);
      assert.ok(traceBatch.includes("delivery.report"));
    } finally {
      await otel.shutdown();
    }
  }
  assert.equal(events[0]["sdlc.occurred_at"], "2026-11-02T00:01:00.000Z");
});
test("HTTP retries are bounded, preserve payload identity and never retry permission rejection", async () => {
  const bodies = [];
  let n = 0;
  const r = await request("/api/v2/bizevents/ingest", "same", "synthetic", {
    fetchImpl: async (_u, o) => {
      bodies.push(o.body);
      return new Response("", { status: ++n < 3 ? 503 : 202 });
    },
    sleep: async () => {},
  });
  assert.ok(r.accepted);
  assert.equal(n, 3);
  assert.deepEqual(bodies, ["same", "same", "same"]);
  n = 0;
  const denied = await request(
    "/api/v2/bizevents/ingest",
    "same",
    "synthetic",
    {
      fetchImpl: async () => {
        n++;
        return new Response("PRIVATE-ERROR", { status: 403 });
      },
    },
  );
  assert.equal(n, 1);
  assert.equal(denied.accepted, false);
});
test("real SDK produces all three protobuf signal bodies and safe receipts", async () => {
  const t = telemetry("aroha-ci-observer-test", "1.0.0", "test");
  const context = t.span("fixture", { operation: "test" }, now, run.updated_at);
  t.log({ operation: "test" }, context);
  t.metric("test", "passed", 1);
  const seen = [];
  const result = await exportDelivery(
    [
      event("sdlc.test.completed", ["fixture"], now, {
        "sdlc.status": "passed",
      }),
    ],
    t,
    "synthetic",
    { eventType: "CUSTOM_DEPLOYMENT" },
    {
      fetchImpl: async (url, o) => {
        seen.push({ url, body: o.body });
        return url.endsWith("/events/ingest")
          ? Response.json({ eventIngestResults: [{ status: "OK" }] })
          : new Response("", { status: 200 });
      },
    },
  );
  assert.ok(result.accepted);
  assert.equal(seen.length, 5);
  for (const signal of ["traces", "logs", "metrics"])
    assert.ok(
      seen.find((x) => x.url.endsWith("/" + signal)).body.byteLength > 0,
    );
  assert.ok(!JSON.stringify(result).includes("synthetic"));
});
test("partial OTLP rejection cannot be reported as successful delivery", async () => {
  const t = {
    batches: async () => [
      {
        signal: "traces",
        body: new Uint8Array([1]),
        decode: ProtobufTraceSerializer.deserializeResponse,
        rejectKey: "rejectedSpans",
      },
    ],
    shutdown: async () => {},
  };
  const result = await exportDelivery([], t, "synthetic", null, {
    fetchImpl: async () =>
      new Response(new Uint8Array([10, 2, 8, 1]), { status: 200 }),
  });
  assert.equal(result.signals.traces.rejected, 1);
  assert.equal(result.accepted, false);
});
test("only a provider-confirmed deployment creates a native marker; failed verification is explicit", () => {
  const record = {
    id: "fixture",
    website: { version: "0.12.0", revision: sha },
    startedAt: now,
    finishedAt: run.updated_at,
    status: "failed-or-partial",
    verification: { status: "not-run" },
  };
  assert.equal(deploymentEvents(record).marker, null);
  const observed = deploymentEvents({
    ...record,
    status: "deployed",
    after: { version: "hosting-version", releaseTime: now },
    verification: { status: "failed" },
  });
  assert.equal(observed.marker.eventType, "CUSTOM_DEPLOYMENT");
  assert.equal(observed.marker.properties["verification.status"], "failed");
  assert.equal(observed.events[0]["sdlc.status"], "deployed");
  assert.equal(observed.events[1]["sdlc.status"], "failed");
});
test("observer definition keeps credentials out of source CI and checks out only trusted default branch", async () => {
  const observer = await readFile(
    ".github/workflows/delivery-observability.yml",
    "utf8",
  );
  assert.match(observer, /github.event.repository.default_branch/);
  assert.doesNotMatch(observer, /ref:.*head_sha/);
  assert.match(observer, /actions: read/);
  assert.doesNotMatch(observer, /id-token: write|contents: write/);
  for (const file of ["application.yml", "foundation.yml"]) {
    const source = await readFile(".github/workflows/" + file, "utf8");
    assert.doesNotMatch(source, /secrets\.|DT_DELIVERY_TOKEN/);
    assert.match(source, /if: always\(\)/);
  }
});
test("native Node failed/skipped case reports preserve actual outcomes without private test text", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const folder = await mkdtemp(join(tmpdir(), "aroha-runner-"));
  try {
    const fixture = join(folder, "fixture.test.mjs");
    await writeFile(
      fixture,
      "import test from 'node:test';test('PRIVATE-PASS',()=>{});test('PRIVATE-FAIL',()=>{throw Error('PRIVATE-ASSERTION')});test.skip('PRIVATE-SKIP',()=>{});",
    );
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(
      process.execPath,
      [
        "--test",
        "--test-reporter=./scripts/delivery/node-test-reporter.mjs",
        fixture,
      ],
      { encoding: "utf8", env },
    );
    assert.equal(r.status, 1);
    assert.ok(!r.stdout.includes("PRIVATE-"));
    const rows = parseReport(r.stdout, "application.jsonl");
    for (const state of ["passed", "failed", "skipped"])
      assert.ok(rows.some((x) => x.status === state));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("workflow occurrence time follows original completed jobs instead of later API metadata updates", () => {
  assert.equal(
    completionTime({ ...run, updated_at: "2026-11-03T00:00:00Z" }, [job]),
    "2026-11-02T00:01:00.000Z",
  );
});
