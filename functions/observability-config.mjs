import { environment, serviceName } from "./environment.mjs";
let active,
  expires = 0,
  pending;
export function validateObservabilityConfig(value) {
  if (
    value?.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.version) ||
    value.version < 1 ||
    Object.keys(value).some(
      (k) => !["schemaVersion", "version", "environments"].includes(k),
    ) ||
    !value.environments ||
    Object.keys(value.environments).some(
      (k) => !["production", "pre-prod"].includes(k),
    )
  )
    throw Error("INVALID_OBSERVABILITY_CONFIG");
  for (const name of ["production", "pre-prod"]) {
    const p = value.environments[name];
    if (
      !p ||
      Object.keys(p).some(
        (k) =>
          ![
            "rumScriptUrl",
            "otlpEndpoint",
            "businessEventsEndpoint",
            "tokenSecretVersion",
          ].includes(k),
      )
    )
      throw Error("INVALID_OBSERVABILITY_CONFIG");
    if (
      p.rumScriptUrl !== null &&
      !(
        typeof p.rumScriptUrl === "string" &&
        /^https:\/\/js-cdn\.dynatrace\.com\/jstag\/[a-zA-Z0-9]+\/[a-zA-Z0-9]+\/[a-zA-Z0-9_]+\.js$/.test(
          p.rumScriptUrl,
        )
      )
    )
      throw Error("INVALID_RUM_TAG");
    if (
      !/^https:\/\/[a-z0-9-]+\.live\.dynatrace\.com\/api\/v2\/otlp$/.test(
        p.otlpEndpoint,
      ) ||
      p.businessEventsEndpoint !==
        p.otlpEndpoint.replace(/\/otlp$/, "/bizevents/ingest")
    )
      throw Error("INVALID_TELEMETRY_DESTINATION");
    if (
      !/^projects\/aroha-retreat\/secrets\/[A-Z0-9_-]+\/versions\/(latest|[0-9]+)$/.test(
        p.tokenSecretVersion,
      )
    )
      throw Error("INVALID_SECRET_REFERENCE");
  }
  if (
    value.environments["pre-prod"].rumScriptUrl &&
    value.environments["pre-prod"].rumScriptUrl ===
      value.environments.production.rumScriptUrl
  )
    throw Error("RUM_TAGS_MUST_BE_DISTINCT");
  return value;
}
export function publicObservabilityConfig(value, name = environment.name) {
  validateObservabilityConfig(value);
  return {
    environment: name,
    configVersion: value.version,
    rumScriptUrl: value.environments[name].rumScriptUrl,
  };
}
export function activeTelemetryConfig() {
  return active;
}
export async function refreshTelemetryConfig(
  db,
  { now = Date.now(), loadSecret } = {},
) {
  if (process.env.DT_EXPORT_ENABLED !== "true") return active;
  if (now < expires) return active;
  if (pending) return pending;
  pending = (async () => {
    try {
      const snap = await db
        .collection("aroha_runtime_config")
        .doc("observability")
        .get();
      if (!snap.exists) throw Error("OBSERVABILITY_CONFIG_MISSING");
      const v = validateObservabilityConfig(snap.data()),
        p = v.environments[environment.name];
      const secret =
        loadSecret ||
        (async (resource) => {
          const { applicationDefault } = await import("firebase-admin/app");
          const credential = await applicationDefault().getAccessToken();
          const r = await fetch(
            "https://secretmanager.googleapis.com/v1/" + resource + ":access",
            {
              headers: { Authorization: "Bearer " + credential.access_token },
              signal: AbortSignal.timeout(2000),
            },
          );
          if (!r.ok) throw Error("TELEMETRY_SECRET_UNAVAILABLE");
          const b = await r.json();
          return Buffer.from(b.payload.data, "base64").toString("utf8").trim();
        });
      const token = await secret(p.tokenSecretVersion);
      if (!token) throw Error("TELEMETRY_SECRET_UNAVAILABLE");
      active = { ...p, token, configVersion: v.version };
      expires = now + 60000;
      return active;
    } catch {
      expires = now + 15000;
      console.warn(
        JSON.stringify({
          service: serviceName("aroha-telemetry"),
          code: "OBSERVABILITY_CONFIG_REFRESH_FAILED",
          "deployment.environment.name": environment.name,
        }),
      );
      return active;
    }
  })().finally(() => {
    pending = undefined;
  });
  return pending;
}
