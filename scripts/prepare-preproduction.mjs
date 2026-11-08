import { mailSettings } from "../functions/email/config.mjs";
import { environmentProfile } from "../functions/environment-profile.mjs";
import { cp, mkdir, readFile, writeFile, rm, lstat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve, basename } from "node:path";
const root = process.cwd(),
  output = resolve(root, "local/preprod-functions");
const configurationFile = process.env.AROHA_PREPROD_CONFIG_FILE;
if (!configurationFile) throw Error("AROHA_PREPROD_CONFIG_FILE_REQUIRED");
const config = JSON.parse(await readFile(configurationFile, "utf8"));
const allowed = [
  "SUPER_ADMIN_EMAILS",
  "PREPROD_TESTER_EMAILS",
  "MAIL_ENABLED",
  "MAIL_FROM",
  "MAIL_REPLY_TO",
  "MAIL_HOST_TO",
  "MAIL_TEST_RECIPIENT",
  "MAIL_RECIPIENT_MODE",
  "BILLING_DISPLAY_NAME",
  "BILLING_ADDRESS",
  "BILLING_PAYMENT_INSTRUCTIONS",
  "BILLING_CONFIG_VERSION",
  "BILLING_REGISTRATION_NUMBER",
];
if (Object.keys(config).some((k) => !allowed.includes(k)))
  throw Error("UNKNOWN_PREPROD_CONFIGURATION");
if (
  config.MAIL_ENABLED !== "true" ||
  ((config.MAIL_RECIPIENT_MODE || "test-inbox") === "test-inbox" && !config.MAIL_TEST_RECIPIENT) ||
  !config.PREPROD_TESTER_EMAILS
)
  throw Error("INCOMPLETE_PREPROD_CONFIGURATION");
if (
  Object.values(config).some((v) => typeof v !== "string" || /[\r\n]/.test(v))
)
  throw Error("INVALID_PREPROD_CONFIGURATION");
mailSettings(config, environmentProfile("pre-prod"));
const source = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).stdout.trim();
if (!/^[a-f0-9]{40}$/.test(source)) throw Error("SOURCE_REQUIRED");
if (
  !process.argv.includes("--allow-dirty") &&
  spawnSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).stdout.trim()
)
  throw Error("COMMIT_REVIEWED_SOURCE_BEFORE_PREPARING_RELEASE");
await mkdir(resolve(root, "local"), { recursive: true });
try {
  const previous = await lstat(output);
  if (
    previous.isSymbolicLink() ||
    JSON.parse(await readFile(resolve(output, "release.json"), "utf8"))
      .environment !== "pre-prod"
  )
    throw Error("UNRECOGNISED_PREPROD_OUTPUT");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await rm(output, { recursive: true, force: true });
await cp(resolve(root, "functions"), output, {
  recursive: true,
  filter: (path) =>
    !["node_modules", "tests"].includes(basename(path)) &&
    !/^\.(env|secret)/.test(basename(path)) &&
    !path.endsWith(".log") &&
    !path.endsWith(".md"),
});
await cp(resolve(output, "index.mjs"), resolve(output, "application.mjs"));
await writeFile(
  resolve(output, "index.mjs"),
  `if(process.env.AROHA_ENVIRONMENT!=='pre-prod')throw Error('PREPROD_ENVIRONMENT_REQUIRED');\nconst application=await import('./application.mjs');\nexport const arohaApiPreprod=application.arohaApi;\nexport const arohaBookingEmailDispatchPreprod=application.arohaBookingEmailDispatch;\nexport const arohaBookingEmailRetryPreprod=application.arohaBookingEmailRetry;\n`,
);
await writeFile(
  resolve(output, ".env.aroha-retreat"),
  Object.entries({
    AROHA_ENVIRONMENT: "pre-prod",
    DT_EXPORT_ENABLED: "true",
    ...config,
  })
    .map(([k, v]) => k + "=" + JSON.stringify(v))
    .join("\n") + "\n",
  { mode: 0o600 },
);
await writeFile(
  resolve(output, "release.json"),
  JSON.stringify(
    {
      source,
      localValidationOnly: process.argv.includes("--allow-dirty"),
      environment: "pre-prod",
      site: "aroha-retreat-preprod",
      codebase: "aroha-website-preprod",
    },
    null,
    2,
  ),
);
const result = spawnSync(process.execPath, ["scripts/build-website.mjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    AROHA_ENVIRONMENT: "pre-prod",
    AROHA_BUILD_REVISION: source,
    AROHA_EMULATORS: "0",
  },
});
if (result.status !== 0) throw Error("PREPROD_BUILD_FAILED");
const install = spawnSync("npm", ["ci", "--ignore-scripts"], {
  cwd: output,
  stdio: "inherit",
});
if (install.status !== 0) throw Error("PREPROD_DEPENDENCY_INSTALL_FAILED");
console.log(
  "Prepared isolated pre-production source " +
    source +
    ". Production artifacts were not changed.",
);
