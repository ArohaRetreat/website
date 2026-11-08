import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { excludedRetreatMedia, mediaSha256 } from "./preprod-media.mjs";

const run = promisify(execFile);
const source = "website/assets/retreat";
const stage = "local/finops/media";
await mkdir(stage, { recursive: true });
const names = (await readdir(source)).filter(name => !excludedRetreatMedia.has(name)).sort();
const assets = {};
let inputBytes = 0, outputBytes = 0;

async function prepare(name) {
  const input = resolve(source, name), output = resolve(stage, name);
  const original = await readFile(input);
  let result;
  if (name.endsWith(".mp4")) {
    const video = name.startsWith("hrudhi-gate-");
    await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", input,
      "-map", "0:v:0", "-map", "0:a?", "-map_metadata", "-1",
      "-vf", "fps=30,scale=w='min(iw,1280)':h='min(ih,1080)':force_original_aspect_ratio=decrease:force_divisible_by=2",
      "-c:v", "libx264", "-threads", "3", "-preset", "fast", "-crf", video ? "25" : "26",
      "-g", video ? "15" : "60", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", output]);
    result = await readFile(output);
  } else if (name.endsWith(".webp")) {
    if (original.length > 360_000 && !/sheet|sprite/i.test(name)) {
      const temp = output + ".png";
      try {
        await run("dwebp", [input, "-o", temp]);
        await run("cwebp", ["-quiet", "-q", "80", "-m", "5", "-metadata", "none", temp, "-o", output]);
        result = await readFile(output);
      } finally {
        await rm(temp, { force: true });
      }
    }
  } else {
    throw Error("UNCLASSIFIED_RETREAT_ASSET:" + name);
  }
  if (!result || result.length >= original.length) {
    await copyFile(input, output);
    result = original;
  }
  inputBytes += original.length;
  outputBytes += result.length;
  assets[name] = { sha256: mediaSha256(result), bytes: result.length };
}

for (let i = 0; i < names.length; i += 3)
  await Promise.all(names.slice(i, i + 3).map(prepare));

const sorted = Object.fromEntries(names.map(name => [name, assets[name]]));
await writeFile("config/preprod-media.json", JSON.stringify({ version: 1, assets: sorted }, null, 2) + "\n");
console.log(JSON.stringify({ count: names.length, inputBytes, outputBytes }));
