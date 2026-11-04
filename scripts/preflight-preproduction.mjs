import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { validateObservabilityConfig } from "../functions/observability-config.mjs";
import { firebaseClient } from "./delivery/credentials.mjs";
import { indexReady } from "./delivery/firestore-index-readiness.mjs";
const Client = await firebaseClient(),
  client = new Client({
    urlPrefix: "https://firestore.googleapis.com",
    apiVersion: "v1",
    auth: true,
  });
const base = "/projects/aroha-retreat/databases/(default)";
const decode = (v) =>
  v.mapValue
    ? Object.fromEntries(
        Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]),
      )
    : "integerValue" in v
      ? Number(v.integerValue)
      : "nullValue" in v
        ? null
        : v.stringValue;
const remote = (
  await client.get(base + "/documents/aroha_runtime_config/observability")
).body;
const metadata = validateObservabilityConfig(
  decode({ mapValue: { fields: remote.fields } }),
);
const expected = JSON.parse(
  await readFile("config/observability-runtime.json", "utf8"),
);
if (!isDeepStrictEqual(metadata, expected))
  throw Error("RUNTIME_METADATA_NOT_PUBLISHED");
const sm = new Client({
  urlPrefix: "https://secretmanager.googleapis.com",
  apiVersion: "v1",
  auth: true,
});
for (const name of [
  "RESEND_API_KEY_PREPROD",
  "RESEND_WEBHOOK_SECRET_PREPROD",
]) {
  const v = (
    await sm.get("/projects/aroha-retreat/secrets/" + name + "/versions/latest")
  ).body;
  if (v.state !== "ENABLED") throw Error("PREPROD_SECRET_NOT_ENABLED");
}
const authClient = new Client({
  urlPrefix: "https://identitytoolkit.googleapis.com",
  apiVersion: "admin/v2",
  auth: true,
});
const auth = (await authClient.get("/projects/aroha-retreat/config")).body;
if (
  ![
    "aroha-retreat-preprod.web.app",
    "aroha-retreat-preprod.firebaseapp.com",
  ].every((d) => auth.authorizedDomains?.includes(d))
)
  throw Error("PREPROD_AUTH_DOMAIN_NOT_CONFIGURED");
const required = JSON.parse(
  await readFile("firestore.indexes.json", "utf8"),
).indexes.filter((i) => i.collectionGroup.startsWith("aroha_preprod_"));
for (const group of new Set(required.map((i) => i.collectionGroup))) {
  const actual = [];
  let pageToken;
  do {
    const r = await client.get(
      base + "/collectionGroups/" + group + "/indexes",
      { queryParams: { ...(pageToken ? { pageToken } : {}) } },
    );
    actual.push(...(r.body.indexes || []));
    pageToken = r.body.nextPageToken;
  } while (pageToken);

  for (const index of required.filter((i) => i.collectionGroup === group))
    if (
      !actual.some((i) => indexReady(i, index))
    )
      throw Error("PREPROD_INDEX_NOT_READY:" + group);
}
const exemptions = JSON.parse(
  await readFile("firestore.indexes.json", "utf8"),
).fieldOverrides.filter((f) => f.collectionGroup.startsWith("aroha_preprod_"));
for (let offset = 0; offset < exemptions.length; offset += 4) {
  await Promise.all(
    exemptions.slice(offset, offset + 4).map(async (f) => {
      const actual = (
        await client.get(
          base +
            "/collectionGroups/" +
            f.collectionGroup +
            "/fields/" +
            encodeURIComponent(f.fieldPath),
        )
      ).body;
      if (
        !actual.indexConfig ||
        actual.indexConfig?.usesAncestorConfig ||
        actual.indexConfig?.reverting ||
        (actual.indexConfig?.indexes || []).length ||
        (f.ttl && actual.ttlConfig?.state !== "ACTIVE")
      )
        throw Error(
          "PREPROD_FIELD_METADATA_NOT_READY:" +
            f.collectionGroup +
            ":" +
            f.fieldPath,
        );
    }),
  );
}
const field = (name, op, value) => ({
  fieldFilter: { field: { fieldPath: name }, op, value },
});
const now = Date.now(),
  stringValue = (s) => ({ stringValue: s }),
  intValue = (n) => ({ integerValue: String(n) });
const queries = [
  [
    "aroha_preprod_bookings",
    [field("owner", "EQUAL", stringValue("preflight-no-guest"))],
    [
      ["createdAt", "DESCENDING"],
      ["__name__", "DESCENDING"],
    ],
  ],
  [
    "aroha_preprod_bookings",
    [
      field("status", "EQUAL", stringValue("checked_in")),
      field("departure", "LESS_THAN_OR_EQUAL", stringValue("2099-01-01")),
    ],
  ],
  [
    "aroha_preprod_bookings",
    [
      field("status", "IN", {
        arrayValue: { values: ["confirmed", "checked_in"].map(stringValue) },
      }),
      field("departure", "GREATER_THAN", stringValue("2099-01-01")),
    ],
  ],
  [
    "aroha_preprod_bookings",
    [
      field("status", "EQUAL", stringValue("pending_approval")),
      field("expiresAt", "GREATER_THAN", intValue(now)),
    ],
  ],
  [
    "aroha_preprod_bookings",
    [
      field("promo", "EQUAL", stringValue("PREFLIGHT")),
      field("status", "IN", {
        arrayValue: {
          values: ["confirmed", "checked_in", "completed"].map(stringValue),
        },
      }),
    ],
  ],
  [
    "aroha_preprod_bookings",
    [
      field("promo", "EQUAL", stringValue("PREFLIGHT")),
      field("status", "EQUAL", stringValue("pending_approval")),
      field("expiresAt", "GREATER_THAN", intValue(now)),
    ],
  ],
  [
    "aroha_preprod_booking_credits",
    [
      field("owner", "EQUAL", stringValue("preflight-no-guest")),
      field("active", "EQUAL", { booleanValue: true }),
      field("arrival", "LESS_THAN_OR_EQUAL", stringValue("2099-01-02")),
      field("departure", "GREATER_THAN_OR_EQUAL", stringValue("2099-01-01")),
    ],
  ],
  ...["aroha_preprod_observability_outbox", "aroha_preprod_notifications"].map(
    (group) => [
      group,
      [field("nextAttemptAt", "LESS_THAN_OR_EQUAL", intValue(now))],
      [["nextAttemptAt", "ASCENDING"]],
    ],
  ),
  [
    "aroha_preprod_notifications",
    [field("bookingId", "EQUAL", stringValue("preflight-no-booking"))],
  ],
  [
    "aroha_preprod_notifications",
    [field("providerMessageId", "EQUAL", stringValue("preflight-no-message"))],
  ],
];
for (const [group, filters, order = []] of queries)
  await client.post(base + "/documents:runQuery", {
    structuredQuery: {
      from: [{ collectionId: group }],
      where:
        filters.length === 1
          ? filters[0]
          : { compositeFilter: { op: "AND", filters } },
      ...(order.length
        ? {
            orderBy: order.map(([fieldPath, direction]) => ({
              field: { fieldPath },
              direction,
            })),
          }
        : {}),
      limit: 1,
    },
  });
console.log(
  JSON.stringify({
    environment: "pre-prod",
    readyIndexes: required.length,
    readOnlyQueryProbes: queries.length,
  }),
);
