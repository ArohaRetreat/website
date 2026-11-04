import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { deployObserved, replayDeployment } from "./delivery/deployment.mjs";
import { verifyHostingComposition } from "./hosting-composition.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const replayIndex = process.argv.indexOf("--replay-telemetry");
if (replayIndex >= 0) {
  process.exitCode = await replayDeployment(process.argv[replayIndex + 1]);
  process.exit();
}
const git = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
});
if (git.status !== 0)
  throw Error("Cannot identify the current source revision.");
const config = JSON.parse(
  await readFile(new URL("../firebase.json", import.meta.url)),
);
if (config.hosting.site !== "aroha-retreat" || config.hosting.public !== "dist")
  throw Error("Unexpected Hosting target.");
await verifyHostingComposition(root, git.stdout.trim());
const channelFlag = process.argv.indexOf("--channel"),
  channel = process.argv[channelFlag + 1];
const production = process.argv.includes("--production");
const hasChannel = channelFlag >= 0;
if (
  production === hasChannel ||
  (!production && !/^[a-z0-9-]{1,40}$/.test(channel || ""))
)
  throw Error("Choose --channel NAME or explicitly --production.");
const args = production
  ? ["deploy", "--only", "hosting"]
  : [
      "hosting:channel:deploy",
      channel,
      "--expires",
      "7d",
      "--no-authorized-domains",
    ];
const cli = process.env.FIREBASE_CLI_PATH;
if (production) {
  const runtime = await fetch(
    "https://aroharetreat.com/api/v1/runtime-config",
    { signal: AbortSignal.timeout(10000) },
  );
  const metadata = runtime.ok ? await runtime.json() : null;
  if (
    metadata?.environment !== "production" ||
    !Number.isSafeInteger(metadata.configVersion) ||
    metadata.configVersion < 1
  )
    throw Error("UPGRADE_PRODUCTION_API_RUNTIME_CONFIG_BEFORE_FRONTEND");
  if (!cli)
    throw Error(
      "FIREBASE_CLI_PATH is required for observed production deployment.",
    );
  process.exitCode = await deployObserved(root, cli, args);
} else {
  const result = spawnSync(
    cli ? process.execPath : "firebase",
    [
      ...(cli ? [cli] : []),
      ...args,
      "--project",
      "aroha-retreat",
      "--non-interactive",
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
