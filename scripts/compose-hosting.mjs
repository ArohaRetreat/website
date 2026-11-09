import { fileURLToPath } from "node:url";
import { composeHosting } from "./hosting-composition.mjs";
import { readNaturaLayout } from "./natura-media.mjs";
const flag = process.argv.indexOf("--design-dir");
if (flag < 0 || !process.argv[flag + 1]) throw Error("Usage: npm run build:hosting -- --design-dir /absolute/path/to/natura/dist/design");
const root = fileURLToPath(new URL("../", import.meta.url));
const result = await composeHosting(root, process.argv[flag + 1], { layout: await readNaturaLayout(root) });
console.log(`Composed ${result.files.length} files: Aroha ${result.website.version} and Natura ${result.design.version}.`);
