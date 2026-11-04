import { isDeepStrictEqual } from "node:util";
import { readFile } from "node:fs/promises";
import { validateObservabilityConfig } from "../functions/observability-config.mjs";
import { firebaseClient } from "./delivery/credentials.mjs";
const config = validateObservabilityConfig(
  JSON.parse(
    await readFile(
      new URL("../config/observability-runtime.json", import.meta.url),
      "utf8",
    ),
  ),
);
if (!process.argv.includes("--apply")) {
  console.log(
    JSON.stringify({
      valid: true,
      version: config.version,
      environments: Object.keys(config.environments),
    }),
  );
} else {
  const Client = await firebaseClient(),
    client = new Client({
      urlPrefix: "https://firestore.googleapis.com",
      apiVersion: "v1",
      auth: true,
    });
  const name =
    "projects/aroha-retreat/databases/(default)/documents/aroha_runtime_config/observability";
  let previous;
  try {
    previous = (await client.get("/" + name)).body;
  } catch (e) {
    if (e.status !== 404 && e.context?.response?.statusCode !== 404) throw e;
  }
  const decode = (v) =>
    v?.integerValue ? Number(v.integerValue) : v?.stringValue;
  const oldVersion = decode(previous?.fields?.version);
  const encode = (v) =>
    v === null
      ? { nullValue: null }
      : typeof v === "number"
        ? { integerValue: String(v) }
        : typeof v === "string"
          ? { stringValue: v }
          : {
              mapValue: {
                fields: Object.fromEntries(
                  Object.entries(v).map(([k, x]) => [k, encode(x)]),
                ),
              },
            };
  const fields = encode(config).mapValue.fields;
  if (previous && isDeepStrictEqual(previous.fields, fields)) {
    console.log("Observability metadata already matches.");
  } else {
    if (previous && config.version <= oldVersion)
      throw Error("INCREASE_METADATA_VERSION_BEFORE_PUBLISHING");
    await client.post(
      "/projects/aroha-retreat/databases/(default)/documents:commit",
      {
        writes: [
          {
            update: { name, fields },
            currentDocument: previous
              ? { updateTime: previous.updateTime }
              : { exists: false },
          },
        ],
      },
    );
    const readback = (await client.get("/" + name)).body;
    if (Number(readback.fields.version.integerValue) !== config.version)
      throw Error("METADATA_READBACK_FAILED");
    console.log(
      "Published observability metadata version " + config.version + ".",
    );
  }
}
