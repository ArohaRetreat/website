import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { composeHosting } from "./hosting-composition.mjs";
import { readNaturaLayout } from "./natura-media.mjs";
import { restorePinnedExport } from "./restore-pinned-export.mjs";

const root = process.cwd();
const environment = process.env.AROHA_ENVIRONMENT || "production";
if (!["pre-prod", "production"].includes(environment)) throw Error("NATURA_ENVIRONMENT_REQUIRED");
const directory = environment === "pre-prod" ? "dist-preprod" : "dist";
const layout = await readNaturaLayout(root);
const sourceFlag = process.argv.indexOf("--source");
let exportDirectory = sourceFlag >= 0 ? process.argv[sourceFlag + 1] : null;
if (sourceFlag >= 0 && (!exportDirectory || !isAbsolute(exportDirectory)))
  throw Error("ABSOLUTE_NATURA_EXPORT_REQUIRED");
if (!exportDirectory) {
  const source = resolve("local/pinned-natura-source");
  await mkdir(source, { recursive: true });
  const run = (command, args) => {
    const result = spawnSync(command, args, { cwd: source, stdio: "inherit" });
    if (result.status !== 0) throw Error("PINNED_DESIGN_PREPARATION_FAILED");
  };
  run("git", ["init", "--quiet"]);
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: source, encoding: "utf8" });
  if (head.status === 0 && head.stdout.trim() !== layout.pin.revision)
    throw Error("EXISTING_DESIGN_SOURCE_MISMATCH");
  if (head.status !== 0) {
    run("git", ["fetch", "--depth=1", "https://github.com/ArohaRetreat/natura.git", layout.pin.revision]);
    run("git", ["checkout", "--detach", layout.pin.revision]);
  }
  if (spawnSync("git", ["status", "--porcelain"], { cwd: source, encoding: "utf8" }).stdout.trim())
    throw Error("DIRTY_PINNED_DESIGN");
  run("npm", ["run", "build"]);
  exportDirectory = resolve(source, "dist");
  // Restore the pinned shell only. Large published media and ZIPs stay in Storage.
  await restorePinnedExport(exportDirectory, { files: layout.shell });
}
const artifact = await composeHosting(root, resolve(exportDirectory, "design"), { directory, layout });
console.log(JSON.stringify({ environment, design: artifact.design.version, designMedia: artifact.designMedia }));
