import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const suites = {
  application: ["tests/*.test.mjs"],
  "api-loyalty": ["functions/tests/loyalty-integration.mjs"],
  "preprod-integration": ["functions/tests/preprod-integration.mjs"],
  "api-preprod-telemetry": ["functions/tests/telemetry.mjs"],
  "api-external": ["functions/tests/external-integration.mjs","functions/tests/platform-integration.mjs"],
  "api-telemetry": ["functions/tests/telemetry.mjs"],
  "api-integration": ["functions/tests/integration.mjs", "functions/tests/booking-integration.mjs", "functions/tests/private-booking-integration.mjs"],
};
const suite = process.argv[2];
if (!suites[suite]) throw Error("INVALID_SUITE");
mkdirSync(".delivery-reports", { recursive: true });
const r = spawnSync(
  process.execPath,
  [
    "--test",
    ...(suite === "api-external" ? ["--test-concurrency=1"] : []),
    "--test-reporter=spec",
    "--test-reporter-destination=stdout",
    "--test-reporter=./scripts/delivery/node-test-reporter.mjs",
    `--test-reporter-destination=.delivery-reports/${suite}.jsonl`,
    ...suites[suite],
  ],
  { stdio: "inherit" },
);
process.exitCode = r.status ?? 1;
