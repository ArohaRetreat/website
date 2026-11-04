import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const suites = {
  application: ["tests/*.test.mjs"],
  "preprod-integration": ["functions/tests/preprod-integration.mjs"],
  "api-preprod-telemetry": ["functions/tests/telemetry.mjs"],
  "api-telemetry": ["functions/tests/telemetry.mjs"],
  "api-integration": ["functions/tests/integration.mjs", "functions/tests/booking-integration.mjs"],
};
const suite = process.argv[2];
if (!suites[suite]) throw Error("INVALID_SUITE");
mkdirSync(".delivery-reports", { recursive: true });
const r = spawnSync(
  process.execPath,
  [
    "--test",
    "--test-reporter=spec",
    "--test-reporter-destination=stdout",
    "--test-reporter=./scripts/delivery/node-test-reporter.mjs",
    `--test-reporter-destination=.delivery-reports/${suite}.jsonl`,
    ...suites[suite],
  ],
  { stdio: "inherit" },
);
process.exitCode = r.status ?? 1;
