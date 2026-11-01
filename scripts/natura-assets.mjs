import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export async function verifyNaturaAssets(root) {
  const base = new URL("vendor/natura/", root);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", base)));
  if (manifest.repository !== "ArohaRetreat/natura" || !/^[a-f0-9]{40}$/.test(manifest.revision))
    throw Error("Natura dependency provenance is missing.");
  for (const file of manifest.files) {
    if (!/^(runtime|brand|fonts)\/[a-zA-Z0-9/_.-]+$/.test(file.path) || file.path.split("/").includes(".."))
      throw Error("Invalid Natura dependency path.");
    const bytes = await readFile(new URL(file.path, base));
    if (createHash("sha256").update(bytes).digest("hex") !== file.sha256)
      throw Error(`Natura asset changed: ${file.path}`);
  }
  return manifest;
}
