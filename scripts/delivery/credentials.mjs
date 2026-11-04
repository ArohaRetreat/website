import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("../../", import.meta.url));
export async function firebaseClient() {
  const cli = process.env.FIREBASE_CLI_PATH;
  if (!cli || !cli.endsWith("/firebase-tools/lib/bin/firebase.js"))
    throw Error("FIREBASE_CLI_PATH_REQUIRED");
  const require = createRequire(cli),
    lib = dirname(dirname(cli));
  const auth = require(lib + "/auth.js"),
    { requireAuth } = require(lib + "/requireAuth.js");
  const options = { project: "aroha-retreat", nonInteractive: true };
  const account = auth.getProjectDefaultAccount(root);
  if (account) auth.setActiveAccount(options, account);
  await requireAuth(options);
  return require(lib + "/apiv2.js").Client;
}
export async function deliveryToken() {
  if (process.env.DT_DELIVERY_TOKEN) return process.env.DT_DELIVERY_TOKEN;
  const Client = await firebaseClient();
  const client = new Client({
    urlPrefix: "https://secretmanager.googleapis.com",
    apiVersion: "v1",
    auth: true,
  });
  const result = await client.get(
    "/projects/aroha-retreat/secrets/DYNATRACE_PLATFORM_TOKEN/versions/latest:access",
  );
  const token = Buffer.from(result.body.payload.data, "base64")
    .toString("utf8")
    .trim();
  if (!token) throw Error("DELIVERY_TOKEN_MISSING");
  return token;
}
export async function hostingRelease(site = "aroha-retreat") {
  if (!["aroha-retreat", "aroha-retreat-preprod"].includes(site))
    throw Error("INVALID_HOSTING_SITE");
  const Client = await firebaseClient();
  const client = new Client({
    urlPrefix: "https://firebasehosting.googleapis.com",
    apiVersion: "v1beta1",
    auth: true,
  });
  const result = await client.get(
    `/projects/aroha-retreat/sites/${site}/channels/live`,
  );
  const release = result.body.release;
  return {
    version: release?.version?.name,
    releaseTime: release?.releaseTime,
    type: release?.type,
  };
}
export async function configureGitHubSecret() {
  const token = await deliveryToken();
  const r = spawnSync(
    "gh",
    ["secret", "set", "DT_DELIVERY_TOKEN", "--repo", "ArohaRetreat/website"],
    { input: token, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
  if (r.status !== 0) throw Error("GITHUB_SECRET_SETUP_FAILED");
  console.log(
    "Encrypted delivery credential configured for the trusted observer.",
  );
}
