import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
const path = "functions/.env.local";
await writeFile(
  path,
  "AROHA_ENVIRONMENT=pre-prod\nDT_EXPORT_ENABLED=false\nMAIL_ENABLED=false\nBILLING_DISPLAY_NAME=Synthetic Aroha\nBILLING_ADDRESS=Synthetic test address\nBILLING_PAYMENT_INSTRUCTIONS=Synthetic test only\nSUPER_ADMIN_EMAILS=owner@example.test\nPREPROD_TESTER_EMAILS=owner@example.test,guest@example.test,other@example.test,platform-owner@example.test,platform-guest@example.test,platform-other@example.test\n",
  { flag: "wx", mode: 0o600 },
);
try {
  const cli = process.env.FIREBASE_CLI_PATH;
  const child = spawn(
    cli ? process.execPath : "npx",
    [
      ...(cli ? [cli] : ["--yes", "firebase-tools@15.34.1"]),
      "emulators:exec",
      "--project",
      "demo-aroha",
      "--only",
      "auth,firestore,functions,storage",
      "node scripts/delivery/run-node-tests.mjs api-external",
    ],
    { stdio: "inherit" },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (c) => resolve(c ?? 1));
  });
} finally {
  await unlink(path);
}
