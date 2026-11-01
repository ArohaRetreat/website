import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifyHostingComposition } from "./hosting-composition.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const git = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
if (git.status !== 0) throw Error("Cannot identify the current source revision.");
const config = JSON.parse(await readFile(new URL("../firebase.json", import.meta.url)));
if (config.hosting.site !== "aroha-retreat" || config.hosting.public !== "dist") throw Error("Unexpected Hosting target.");
await verifyHostingComposition(root, git.stdout.trim());
const channelFlag = process.argv.indexOf("--channel"), channel = process.argv[channelFlag + 1];
const production = process.argv.includes("--production");
if (production === (channelFlag >= 0) || (!production && !/^[a-z0-9-]{1,40}$/.test(channel || "")))
  throw Error("Choose --channel NAME or explicitly --production.");
const args = production ? ["deploy", "--only", "hosting"] : ["hosting:channel:deploy", channel, "--expires", "7d", "--no-authorized-domains"];
const cli = process.env.FIREBASE_CLI_PATH;
const result = spawnSync(cli ? process.execPath : "firebase", [...(cli ? [cli] : []), ...args, "--project", "aroha-retreat", "--non-interactive"], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
