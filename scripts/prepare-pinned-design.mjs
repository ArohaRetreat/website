import {readFile, writeFile, mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {gzipSync} from "node:zlib";
import {spawnSync} from "node:child_process";
import {resolve} from "node:path";
const pin=JSON.parse(await readFile("config/natura-hosting.json"));
if(pin.repository!=="ArohaRetreat/natura" || !/^[a-f0-9]{40}$/.test(pin.revision))throw Error("INVALID_DESIGN_PIN");
const directory=resolve("local/pinned-natura-source");
await mkdir(directory,{recursive:true});
function run(command,args){const r=spawnSync(command,args,{cwd:directory,stdio:"inherit"});if(r.status!==0)throw Error("PINNED_DESIGN_PREPARATION_FAILED");}
run("git",["init","--quiet"]);
const head=spawnSync("git",["rev-parse","HEAD"],{cwd:directory,encoding:"utf8"});
const source=head.status===0?head.stdout.trim():null;
if(source!==pin.revision){
  if(source)throw Error("EXISTING_DESIGN_SOURCE_MISMATCH");
  run("git",["fetch","--depth=1","https://github.com/ArohaRetreat/natura.git",pin.revision]);
  run("git",["checkout","--detach",pin.revision]);
}
if(spawnSync("git",["status","--porcelain"],{cwd:directory,encoding:"utf8"}).stdout.trim())throw Error("DIRTY_PINNED_DESIGN");
run("npm",["run","build"]);
// Upstream ZIP tooling embeds build timestamps. Preserve the published archives,
// not fresh timestamp-only variants of the same original artwork.
const archives=JSON.parse(await readFile("config/natura-export-archives.json"));
if(archives.revision!==pin.revision)throw Error("ARCHIVE_PIN_MISMATCH");
for(const file of archives.files){
  if(!/^\/design\/downloads\/[A-Za-z0-9_.-]+\.zip$/.test(file.path) || !/^[a-f0-9]{64}$/.test(file.hostingHash))throw Error("INVALID_ARCHIVE_PIN");
  const cache=resolve("local",file.hostingHash+".zip");let bytes;
  try{bytes=await readFile(cache);}catch(e){if(e.code!=="ENOENT")throw e;const r=await fetch("https://aroharetreat.com"+file.path,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error("PINNED_ARCHIVE_UNAVAILABLE");bytes=Buffer.from(await r.arrayBuffer());}
  if(createHash("sha256").update(gzipSync(bytes,{level:9})).digest("hex")!==file.hostingHash)throw Error("PUBLISHED_ARCHIVE_CHANGED");
  await writeFile(cache,bytes);await writeFile(resolve(directory,"dist",file.path.slice(1)),bytes);
}
const {composeHosting}=await import("./hosting-composition.mjs");
await composeHosting(process.cwd(),resolve(directory,"dist/design"));
