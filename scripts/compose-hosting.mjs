import { fileURLToPath } from "node:url";
import { composeHosting } from "./hosting-composition.mjs";
const flag = process.argv.indexOf("--design-dir");
if (flag < 0 || !process.argv[flag + 1]) throw Error("Usage: npm run build:hosting -- --design-dir /absolute/path/to/natura/dist/design");
const result = await composeHosting(fileURLToPath(new URL("../", import.meta.url)), process.argv[flag + 1]);
console.log(`Composed ${result.files.length} files: Aroha ${result.website.version} and Natura ${result.design.version}.`);
