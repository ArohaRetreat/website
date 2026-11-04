import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { productionBaseline } from "./delivery/production-baseline.mjs";
import { randomUUID } from "node:crypto";
import { hostingRelease, deliveryToken } from "./delivery/credentials.mjs";
import { reportDeployment } from "./delivery/deployment.mjs";
import { verifyLive } from "./delivery/verify-live.mjs";
const root = process.cwd() + "/",
  cli = process.env.FIREBASE_CLI_PATH;
if (!cli || !process.argv.includes("--pre-prod"))
  throw Error("EXPLICIT_PREPROD_TARGET_REQUIRED");
const git = (...args) => {
  const r = spawnSync("git", args, { encoding: "utf8" });
  if (r.status !== 0) throw Error("GIT_CHECK_FAILED");
  return r.stdout.trim();
};
if (git("status", "--porcelain"))
  throw Error("COMMIT_REVIEWED_SOURCE_BEFORE_DEPLOYMENT");
const source = git("rev-parse", "HEAD"),
  config = JSON.parse(await readFile("firebase.preprod.json", "utf8")),
  release = JSON.parse(
    await readFile("local/preprod-functions/release.json", "utf8"),
  ),
  website = JSON.parse(
    await readFile("dist-preprod/website-release.json", "utf8"),
  );
if (
  config.hosting.site !== "aroha-retreat-preprod" ||
  config.hosting.public !== "dist-preprod" ||
  config.functions.length !== 1 ||
  config.functions[0].codebase !== "aroha-website-preprod" ||
  config.functions[0].source !== "local/preprod-functions" ||
  config.hosting.rewrites[0].function.functionId !== "arohaApiPreprod" ||
  release.source !== source ||
  release.localValidationOnly !== false ||
  website.revision !== source ||
  website.environment !== "pre-prod" ||
  website.emulators !== false
)
  throw Error("PREPROD_ARTIFACT_MISMATCH");
const env = await readFile(
  "local/preprod-functions/.env.aroha-retreat",
  "utf8",
);
if (
  !env.includes('AROHA_ENVIRONMENT="pre-prod"') ||
  !env.includes('MAIL_ENABLED="true"')
)
  throw Error("PREPROD_RUNTIME_NOT_CONFIGURED");
const readiness = spawnSync(
  process.execPath,
  ["scripts/preflight-preproduction.mjs"],
  { stdio: "inherit" },
);
if (readiness.status !== 0) throw Error("PREPROD_READINESS_REQUIRED");
const token = await deliveryToken(),
  productionBefore = await productionBaseline();
const record = {
  schemaVersion: 1,
  id: randomUUID(),
  website,
  productionBefore,
  startedAt: new Date().toISOString(),
  status: "pending",
  verification: { status: "not-run" },
};
await mkdir("local/delivery-outbox", { recursive: true });
const path = "local/delivery-outbox/preprod-" + record.id + ".json";
await writeFile(path, JSON.stringify(record, null, 2));
const result = spawnSync(
  process.execPath,
  [
    cli,
    "deploy",
    "--config",
    "firebase.preprod.json",
    "--project",
    "aroha-retreat",
    "--only",
    "functions:aroha-website-preprod,hosting:aroha-retreat-preprod",
    "--non-interactive",
    // Acknowledge the reviewed at-least-once policy on the initial email trigger.
    // The target/codebase guards above keep this scoped to pre-production.
    "--force",
  ],
  { stdio: "inherit" },
);
record.finishedAt = new Date().toISOString();
record.cliExitCode = result.status ?? 1;
try {
  record.after = await hostingRelease("aroha-retreat-preprod");
} catch {
  record.after = null;
}
record.productionAfter = await productionBaseline();
record.productionReleasePreserved =
  isDeepStrictEqual(record.productionAfter.hosting, productionBefore.hosting) &&
  isDeepStrictEqual(
    record.productionAfter.functions,
    productionBefore.functions,
  );
record.concurrentContentChange = !isDeepStrictEqual(
  record.productionAfter.cms,
  productionBefore.cms,
);
record.status =
  result.status === 0 && record.after?.type === "DEPLOY"
    ? "deployed"
    : "failed-or-partial";
await writeFile(path, JSON.stringify(record, null, 2));
if (!record.productionReleasePreserved)
  throw Error("UNEXPECTED_PRODUCTION_RELEASE_CHANGE");
if (record.status === "deployed") {
  record.verificationStartedAt = new Date().toISOString();
  try {
    record.verification = await verifyLive(root, website, {
      origin: "https://aroha-retreat-preprod.web.app",
      directory: "dist-preprod",
      includeDesign: false,
    });
  } catch {
    record.verification = {
      status: "failed",
      reason: "LIVE_VERIFICATION_FAILED",
    };
  }
  record.verificationFinishedAt = new Date().toISOString();
}
await writeFile(path, JSON.stringify(record, null, 2));
try {
  record.telemetry = await reportDeployment(record, token);
} catch {
  record.telemetry = { accepted: false, reason: "EXPORT_FAILED" };
}
await writeFile(path, JSON.stringify(record, null, 2));
console.log(
  JSON.stringify({
    status: record.status,
    verification: record.verification.status,
    telemetry: record.telemetry,
    receipt: path,
  }),
);
process.exitCode =
  result.status === 0 &&
  record.verification.status === "verified" &&
  record.telemetry.accepted
    ? 0
    : 1;
