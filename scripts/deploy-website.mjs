import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { deployObserved, replayDeployment } from "./delivery/deployment.mjs";
import { assertShellBudget, readMediaManifest, verifyMediaMetadata, writeMediaHostingConfig } from "./hosting-media.mjs";
import { configureNaturaHosting, naturaSamples, readNaturaLayout, verifyNaturaObject } from "./natura-media.mjs";
import { verifyDesignPreserved } from "./delivery/preserve-design.mjs";
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
const layout = await readNaturaLayout(root);
const composition = await verifyHostingComposition(root, git.stdout.trim());
if (!composition.designMedia) throw Error("NATURA_MEDIA_OFFLOAD_REQUIRED");
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
const website = JSON.parse(await readFile(root + "dist/website-release.json", "utf8"));
if (website.mediaStorage !== "firebase") throw Error("MEDIA_OFFLOAD_REQUIRED");
await assertShellBudget(root + "dist", { includeDesign: true });
const assets = await readMediaManifest(root);
await verifyMediaMetadata(assets);
await Promise.all(naturaSamples(layout).map(file => verifyNaturaObject(file)));
args.push("--config", await configureNaturaHosting(await writeMediaHostingConfig(root, assets, "production"), layout));
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
  await verifyDesignPreserved(root, { layout });
  process.exitCode = await deployObserved(root, cli, args, { naturaLayout: layout });
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
