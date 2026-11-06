// Derived lookup fields only. Never creates accounts, email keys or credits.
import { mkdir, writeFile } from "node:fs/promises";
import { firebaseClient } from "./delivery/credentials.mjs";
import { customerSearchFields } from "../functions/booking/customers.mjs";
const args = process.argv.slice(2),
  environment = args[args.indexOf("--environment") + 1];
if (
  !args.includes("--environment") ||
  !["production", "pre-prod"].includes(environment)
)
  throw Error("EXPLICIT_ENVIRONMENT_REQUIRED");
const apply = args.includes("--apply"),
  prefix = environment === "production" ? "aroha_" : "aroha_preprod_",
  output = `local/customer-search-${environment}-${apply ? "apply" : "dry-run"}.json`;
try {
  const Client = await firebaseClient(),
    client = new Client({
      urlPrefix: "https://firestore.googleapis.com",
      apiVersion: "v1",
      auth: true,
    });
  const decode = (v) => v?.stringValue ?? v?.mapValue?.fields;
  let pageToken,
    visited = 0,
    changed = 0;
  const receipts = [];
  const stable = (v) =>
    v && typeof v === "object"
      ? Array.isArray(v)
        ? v.map(stable)
        : Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, stable(v[k])]),
          )
      : v;
  await mkdir("local", { recursive: true, mode: 0o700 });
  const checkpoint = () =>
    writeFile(
      output,
      JSON.stringify(
        { environment, apply, visited, changed, receipts },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  do {
    const body = (
      await client.get(
        `/projects/aroha-retreat/databases/(default)/documents/${prefix}booking_profiles`,
        { queryParams: { pageSize: 100, ...(pageToken ? { pageToken } : {}) } },
      )
    ).body;
    for (const d of body.documents || []) {
      visited++;
      const f = d.fields || {};
      if (f.erasedAt) continue;
      const contact = f.contact?.mapValue?.fields,
        fields = customerSearchFields({
          name: decode(f.name) || "",
          email: decode(f.email) || "",
          contact: {
            name: decode(contact?.name) || "",
            phone: decode(contact?.phone) || "",
          },
        }),
        updates = Object.fromEntries(
          Object.entries(fields)
            .filter(([k, v]) => decode(f[k]) !== v)
            .map(([k, v]) => [k, { stringValue: v }]),
        );
      if (!Object.keys(updates).length) continue;
      changed++;
      if (apply) {
        await client.post(
          "/projects/aroha-retreat/databases/(default)/documents:commit",
          {
            writes: [
              {
                update: { name: d.name, fields: updates },
                updateMask: { fieldPaths: Object.keys(updates) },
                currentDocument: { updateTime: d.updateTime },
              },
            ],
          },
        );
        const after = (await client.get("/" + d.name)).body;
        for (const [k, v] of Object.entries(updates))
          if (after.fields?.[k]?.stringValue !== v.stringValue)
            throw Error("DERIVED_FIELD_VERIFICATION_FAILED");
        const oldRest = JSON.stringify(
            Object.fromEntries(
              Object.entries(f).filter(([k]) => !Object.hasOwn(updates, k)),
            ),
          ),
          newRest = JSON.stringify(
            Object.fromEntries(
              Object.entries(after.fields || {}).filter(
                ([k]) => !Object.hasOwn(updates, k),
              ),
            ),
          );
        if (oldRest !== newRest) {
          if (
            JSON.stringify(stable(JSON.parse(oldRest))) !==
            JSON.stringify(stable(JSON.parse(newRest)))
          )
            throw Error("UNRELATED_PROFILE_CHANGE_REVIEW_REQUIRED");
        }
      }
      receipts.push({
        name: d.name,
        fieldPaths: Object.keys(updates),
        sourceUpdateTime: d.updateTime,
      });
    }
    await checkpoint();
    pageToken = body.nextPageToken;
    if (visited >= 20000 && pageToken)
      throw Error("BOUNDED_RUN_LIMIT_REVIEW_REQUIRED");
  } while (pageToken);
  await mkdir("local", { recursive: true, mode: 0o700 });
  await writeFile(
    output,
    JSON.stringify({ environment, apply, visited, changed, receipts }, null, 2),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      environment,
      apply,
      visited,
      changed,
      verified: apply,
      fieldsOnly: ["searchName", "searchEmail", "searchPhone"],
    }),
  );
} catch {
  console.error(
    "CUSTOMER_SEARCH_BACKFILL_FAILED; inspect private receipts and current source before retrying",
  );
  process.exitCode = 1;
}
