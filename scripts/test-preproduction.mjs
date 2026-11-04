import { spawn } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
const files = new Map([
  [
    "functions/.env.local",
    "AROHA_ENVIRONMENT=pre-prod\nDT_EXPORT_ENABLED=false\nSUPER_ADMIN_EMAILS=owner@example.test\nPREPROD_TESTER_EMAILS=owner@example.test,guest@example.test,other@example.test\nMAIL_ENABLED=true\nMAIL_FROM=test@example.test\nMAIL_REPLY_TO=owner@example.test\nMAIL_HOST_TO=owner@example.test\nMAIL_TEST_RECIPIENT=owner@example.test\nMAIL_TEST_COLLECTOR_URL=http://127.0.0.1:17881/email\n",
  ],
  [
    "functions/.secret.local",
    "RESEND_API_KEY_PREPROD=re_synthetic_never_sent\nRESEND_WEBHOOK_SECRET_PREPROD=whsec_c3ludGhldGljLXdlYmhvb2stc2VjcmV0\nDYNATRACE_PLATFORM_TOKEN=synthetic\n",
  ],
]);
const productionContract = process.argv.includes("--production-contract");
if (productionContract) {
  files.clear();
  files.set(
    "functions/.env.local",
    "SUPER_ADMIN_EMAILS=owner@example.test\nDT_EXPORT_ENABLED=false\n",
  );
}
const owned = [];
try {
  for (const [path, body] of files) {
    await writeFile(path, body, { flag: "wx", mode: 0o600 });
    owned.push(path);
  }
  const cli = process.env.FIREBASE_CLI_PATH;
  const args = [
    "emulators:exec",
    "--project",
    "demo-aroha",
    "--only",
    "auth,firestore,functions,storage",
    process.argv.includes("--review")
      ? "node scripts/review-preproduction.mjs"
      : "node scripts/delivery/run-node-tests.mjs " +
        (productionContract ? "api-integration" : "preprod-integration"),
  ];
  const child = spawn(
    cli ? process.execPath : "npx",
    cli ? [cli, ...args] : ["--yes", "firebase-tools@15.34.1", ...args],
    { stdio: "inherit" },
  );
  const stop = () => child.kill("SIGINT");
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  process.exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
} finally {
  for (const path of owned)
    if ((await readFile(path, "utf8")) === files.get(path)) await unlink(path);
}
