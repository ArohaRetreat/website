// Add required indexes only; never deletes or changes an existing index/TTL policy.
import { readFile } from "node:fs/promises";
import { firebaseClient } from "./delivery/credentials.mjs";
import { indexReady } from "./delivery/firestore-index-readiness.mjs";
const args = process.argv.slice(2),
  environment = args[args.indexOf("--environment") + 1];
if (
  !args.includes("--environment") ||
  !["production", "pre-prod"].includes(environment)
)
  throw Error("EXPLICIT_ENVIRONMENT_REQUIRED");
let phase = "credentials";
try {
  const apply = args.includes("--apply"),
    prefix = environment === "production" ? "aroha_" : "aroha_preprod_",
    Client = await firebaseClient(),
    client = new Client({
      urlPrefix: "https://firestore.googleapis.com",
      apiVersion: "v1",
      auth: true,
    });
  const required = JSON.parse(
    await readFile("firestore.indexes.json"),
  ).indexes.filter((x) =>
    environment === "production"
      ? x.collectionGroup.startsWith(prefix) &&
        !x.collectionGroup.startsWith("aroha_preprod_")
      : x.collectionGroup.startsWith(prefix),
  );
  phase = "list";
  let actual = [];
  for (const group of new Set(required.map((r) => r.collectionGroup))) {
    let pageToken;
    do {
      const r = (
        await client.get(
          `/projects/aroha-retreat/databases/(default)/collectionGroups/${group}/indexes`,
          pageToken ? { queryParams: { pageToken } } : {},
        )
      ).body;
      actual.push(...(r.indexes || []));
      pageToken = r.nextPageToken;
    } while (pageToken);
  }
  const missing = required.filter(
      (r) => !actual.some((a) => indexReady({ ...a, state: "READY" }, r)),
    ),
    pending = required.filter((r) =>
      actual.some(
        (a) => indexReady({ ...a, state: "READY" }, r) && a.state !== "READY",
      ),
    );
  phase = "create";
  if (apply)
    for (const r of missing)
      await client.post(
        `/projects/aroha-retreat/databases/(default)/collectionGroups/${r.collectionGroup}/indexes`,
        { queryScope: r.queryScope, fields: r.fields },
      );
  console.log(
    JSON.stringify({
      environment,
      required: required.length,
      ready: required.length - missing.length - pending.length,
      created: apply ? missing.length : 0,
      missing: apply ? 0 : missing.length,
      pending: pending.length + (apply ? missing.length : 0),
      allReady: !missing.length && !pending.length,
    }),
  );
} catch (e) {
  console.error(
    JSON.stringify({
      error: "INDEX_READINESS_FAILED",
      phase,
      status: e.status || e.statusCode || null,
      code: typeof e.code === "number" ? e.code : null,
    }),
  );
  process.exitCode = 1;
}
