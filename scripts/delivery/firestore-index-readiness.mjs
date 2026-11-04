import { isDeepStrictEqual } from "node:util";

// Index listing can include other collection groups. Field shape alone is not identity.
export function indexReady(actual, required) {
  const fields = required.fields.some((f) => f.fieldPath === "__name__")
    ? required.fields
    : [...required.fields, {
        fieldPath: "__name__",
        order: required.fields.at(-1)?.order || "ASCENDING",
      }];
  return actual.state === "READY" &&
    typeof actual.name === "string" &&
    actual.name.includes(`/collectionGroups/${required.collectionGroup}/indexes/`) &&
    actual.queryScope === required.queryScope &&
    isDeepStrictEqual(actual.fields, fields);
}
