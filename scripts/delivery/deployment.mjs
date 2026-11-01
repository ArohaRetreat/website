import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { event, REPOSITORY } from "./contract.mjs";
import { telemetry } from "./otlp.mjs";
import { exportDelivery } from "./transport.mjs";
import { deliveryToken, hostingRelease } from "./credentials.mjs";
import { verifyLive } from "./verify-live.mjs";
export function deploymentEvents(record) {
  const identity = ["hosting", record.id];
  const common = {
    "sdlc.source": "firebase-hosting",
    "sdlc.authority": "provider-confirmed",
    "deployment.id": record.id,
    "deployment.environment": "production",
    "deployment.version": record.website.version,
    "git.commit.sha": record.website.revision,
    "deployment.hosting.version": record.after?.version || "unknown",
    "service.name": "aroha-website",
  };
  const events = [
    event(
      "sdlc.deployment.completed",
      identity,
      record.after?.releaseTime || record.finishedAt,
      { ...common, "sdlc.status": record.status },
    ),
  ];
  if (record.status === "deployed")
    events.push(
      event(
        "sdlc.runtime.verified",
        [...identity, "verify"],
        record.verification.verifiedAt || record.finishedAt,
        {
          ...common,
          "sdlc.source": "live-http-verifier",
          "sdlc.authority": "runtime-observed",
          "sdlc.status": record.verification.status,
          "verification.hash_matched_files":
            record.verification.hashMatchedFiles || 0,
        },
      ),
    );
  const marker =
    record.status === "deployed"
      ? {
          eventType: "CUSTOM_DEPLOYMENT",
          title: `Aroha website ${record.website.version}`,
          startTime: Date.parse(record.after.releaseTime),
          properties: {
            "event.provider": "aroha.sdlc",
            deploymentProject: REPOSITORY,
            deploymentVersion: record.website.version,
            deploymentName: "Aroha website Hosting",
            "git.commit.sha": record.website.revision,
            "hosting.version": record.after.version,
            "verification.status": record.verification.status,
            "sdlc.event.id": events[0]["sdlc.event.id"],
          },
        }
      : null;
  return { events, marker };
}
export async function reportDeployment(record, token) {
  const { events, marker } = deploymentEvents(record);
  const otel = telemetry("aroha-delivery", "1.0.0", "production");
  const parent = otel.span(
    "deployment.delivery",
    { "sdlc.status": record.status },
    record.startedAt,
    record.verificationFinishedAt || record.finishedAt,
  );
  const deploy = otel.span(
    "firebase.hosting.deploy",
    events[0],
    record.startedAt,
    record.finishedAt,
    parent,
  );
  otel.log(events[0], deploy);
  otel.metric(
    "deployment",
    record.status,
    (Date.parse(record.finishedAt) - Date.parse(record.startedAt)) / 1000,
  );
  if (events[1]) {
    const start = record.verificationStartedAt || record.finishedAt;
    const end = record.verificationFinishedAt || record.finishedAt;
    const verified = otel.span(
      "deployment.verify-live",
      events[1],
      start,
      end,
      parent,
    );
    otel.log(events[1], verified);
    otel.metric(
      "verification",
      record.verification.status,
      (Date.parse(end) - Date.parse(start)) / 1000,
    );
  }
  return exportDelivery(events, otel, token, marker);
}
export async function deployObserved(root, cli, args) {
  // Require export credentials before changing production. They never enter Firebase arguments.
  const token = await deliveryToken(),
    before = await hostingRelease();
  const website = JSON.parse(
    await readFile(root + "dist/website-release.json", "utf8"),
  );
  const record = {
    schemaVersion: 1,
    id: randomUUID(),
    website,
    before,
    startedAt: new Date().toISOString(),
    status: "pending",
    verification: { status: "not-run" },
  };
  const directory = root + "local/delivery-outbox";
  await mkdir(directory, { recursive: true });
  const filename = directory + "/deployment-" + record.id + ".json";
  await writeFile(filename, JSON.stringify(record, null, 2));
  const result = spawnSync(
    process.execPath,
    [cli, ...args, "--project", "aroha-retreat", "--non-interactive"],
    { cwd: root, stdio: "inherit" },
  );
  record.finishedAt = new Date().toISOString();
  record.cliExitCode = result.status ?? 1;
  try {
    record.after = await hostingRelease();
  } catch {
    record.after = null;
  }
  const deployed =
    record.after?.type === "DEPLOY" &&
    record.after.version !== before.version &&
    Date.parse(record.after.releaseTime) >= Date.parse(record.startedAt) - 1000;
  record.status = deployed ? "deployed" : "failed-or-partial";
  if (deployed) {
    record.verificationStartedAt = new Date().toISOString();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        record.verification = await verifyLive(root, website);
        break;
      } catch {
        record.verification = {
          status: "failed",
          verifiedAt: new Date().toISOString(),
          reason: "LIVE_VERIFICATION_FAILED",
        };
        if (attempt < 4) await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  record.verificationFinishedAt = new Date().toISOString();
  await writeFile(filename, JSON.stringify(record, null, 2));
  try {
    record.telemetry = await reportDeployment(record, token);
  } catch {
    record.telemetry = { accepted: false, reason: "EXPORT_FAILED" };
  }
  await writeFile(filename, JSON.stringify(record, null, 2));
  console.log(
    JSON.stringify({
      deploymentId: record.id,
      status: record.status,
      verification: record.verification.status,
      telemetry: record.telemetry,
      receipt: filename,
    }),
  );
  // Never redeploy or roll back a successful release to repair reporting. Exit 2 means reporting/verification needs replay.
  return record.status !== "deployed"
    ? 1
    : record.verification.status !== "verified" || !record.telemetry.accepted
      ? 2
      : 0;
}
export async function replayDeployment(filename) {
  const record = JSON.parse(await readFile(filename, "utf8"));
  if (
    record.schemaVersion !== 1 ||
    !["deployed", "failed-or-partial"].includes(record.status) ||
    record.id.length > 80
  )
    throw Error("INVALID_DEPLOYMENT_RECEIPT");
  record.telemetry = await reportDeployment(record, await deliveryToken());
  await writeFile(filename, JSON.stringify(record, null, 2));
  console.log(
    JSON.stringify({ deploymentId: record.id, telemetry: record.telemetry }),
  );
  return record.telemetry.accepted ? 0 : 2;
}
