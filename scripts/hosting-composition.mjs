import { readFile, writeFile, readdir, cp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, relative, sep } from "node:path";
import { hostingHashes } from "./hosting-compression.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
async function inventory(directory, base = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) throw Error("Hosting composition refuses symbolic links.");
    if (entry.isDirectory()) files.push(...await inventory(path, base));
    else if (entry.isFile()) {
      const name = relative(base, path).split(sep).join("/");
      if (name !== "hosting-composition.json") files.push({ path: name, sha256: sha(await readFile(path)) });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
export async function composeHosting(root, designDirectory) {
  const dist = resolve(root, "dist"), source = resolve(designDirectory);
  if (source === dist || source.startsWith(dist + sep) || dist.startsWith(source + sep))
    throw Error("Supply an independent Natura design export outside the website build.");
  const expected = JSON.parse(await readFile(resolve(root, "config/natura-hosting.json")));
  const website = JSON.parse(await readFile(resolve(dist, "website-release.json")));
  const design = JSON.parse(await readFile(resolve(source, "release.json")));
  if (website.name !== "Aroha Retreat") throw Error("Build the website first.");
  if (design.name !== "Natura" || design.basePath !== "/design/" || design.version !== expected.version || design.revision !== expected.revision || design.status !== "release" || design.hrudhiReview !== "alpha")
    throw Error("Natura design export does not match the pinned release.");
  await readFile(resolve(source, "index.html"));
  await inventory(source); // Refuse symlinks before copying any files.
  await rm(resolve(dist, "design"), { recursive: true, force: true });
  await cp(source, resolve(dist, "design"), { recursive: true });
  const files=await inventory(dist);
  const designHostingFiles=await hostingHashes(dist,files.filter(f=>f.path.startsWith('design/')).map(f=>'/'+f.path));
  const composition = { schemaVersion: 1, website, design, files, designHostingFiles };
  await writeFile(resolve(dist, "hosting-composition.json"), JSON.stringify(composition, null, 2) + "\n");
  return composition;
}
export async function verifyHostingComposition(root, revision) {
  const dist = resolve(root, "dist");
  const composition = JSON.parse(await readFile(resolve(dist, "hosting-composition.json")));
  const expected = JSON.parse(await readFile(resolve(root, "config/natura-hosting.json")));
  const website = JSON.parse(await readFile(resolve(dist, "website-release.json")));
  const design = JSON.parse(await readFile(resolve(dist, "design/release.json")));
  if (website.name !== "Aroha Retreat" || website.revision !== revision || JSON.stringify(website) !== JSON.stringify(composition.website) || JSON.stringify(design) !== JSON.stringify(composition.design) || design.revision !== expected.revision || design.version !== expected.version)
    throw Error("Hosting artifact revision mismatch; rebuild both applications.");
  const actual = await inventory(dist);
  if(composition.designHostingFiles && JSON.stringify(composition.designHostingFiles)!==JSON.stringify(await hostingHashes(dist,actual.filter(f=>f.path.startsWith('design/')).map(f=>'/'+f.path))))
    throw Error("Hosting compressed artifact mismatch.");
  if (!actual.some(f => f.path === "index.html") || !actual.some(f => f.path === "admin/index.html") || !actual.some(f => f.path === "design/index.html") || JSON.stringify(actual) !== JSON.stringify(composition.files))
    throw Error("Hosting artifact is incomplete or changed after composition.");
  return composition;
}
