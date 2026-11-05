import { readFileSync } from "node:fs";

// One package-owned version for API responses, runtime telemetry and events.
export const apiVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
