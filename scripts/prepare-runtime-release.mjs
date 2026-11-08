// Prepare reviewed source with current live mail/owner settings. Deployment is separate.
import { readFile, writeFile, mkdir, cp, rm, lstat } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { firebaseClient } from "./delivery/credentials.mjs";
const args = process.argv.slice(2),
  environment = args[args.indexOf("--environment") + 1];
if (
  !args.includes("--environment") ||
  !["production", "pre-prod"].includes(environment)
)
  throw Error("EXPLICIT_ENVIRONMENT_REQUIRED");
const git = (...args) => {
  const r = spawnSync("git", args, { encoding: "utf8" });
  if (r.status) throw Error("GIT_CHECK_FAILED");
  return r.stdout.trim();
};
if (git("status", "--porcelain"))
  throw Error("CLEAN_COMMITTED_SOURCE_REQUIRED");
try {
  const source = git("rev-parse", "HEAD"),
    preprod = environment === "pre-prod",
    suffix = preprod ? "Preprod" : "",
    Client = await firebaseClient(),
    client = new Client({
      urlPrefix: "https://cloudfunctions.googleapis.com",
      apiVersion: "v2",
      auth: true,
    });
  const managed = new Set([
    "FIREBASE_CONFIG",
    "GCLOUD_PROJECT",
    "EVENTARC_CLOUD_EVENT_SOURCE",
    "FUNCTION_REGION",
    "FUNCTION_TARGET",
    "FUNCTION_SIGNATURE_TYPE",
    "LOG_EXECUTION_ID",
  ]);
  const userEnv = (f) =>
    Object.fromEntries(
      Object.entries(f.serviceConfig.environmentVariables).filter(
        ([k]) => !managed.has(k),
      ),
    );
  const providers = await Promise.all(
      ["arohaApi", "arohaBookingEmailDispatch", "arohaBookingEmailRetry"].map(
        async (n) =>
          (
            await client.get(
              "/projects/aroha-retreat/locations/asia-south2/functions/" +
                n +
                suffix,
            )
          ).body,
      ),
    ),
    env = userEnv(providers[0]);
  if (
    env.MAIL_ENABLED !== "true" ||
    env.AROHA_ENVIRONMENT !== environment ||
    env.DT_EXPORT_ENABLED !== "true" ||
    providers.some((f) => !isDeepStrictEqual(userEnv(f), env))
  )
    throw Error("CURRENT_RUNTIME_CONFIGURATION_REVIEW_REQUIRED");
  const replyTo = args.includes('--reply-to') ? args[args.indexOf('--reply-to')+1] : undefined;
  if(replyTo && replyTo !== 'retreataroha@gmail.com')throw Error('UNREVIEWED_REPLY_TO');
  const configurationChanges = replyTo && env.MAIL_REPLY_TO !== replyTo ? ['MAIL_REPLY_TO'] : [];
  if(replyTo)env.MAIL_REPLY_TO=replyTo;
  const output = resolve(
    "local/" + (preprod ? "preprod-functions" : "production-functions"),
  );
  try {
    const s = await lstat(output);
    if (
      s.isSymbolicLink() ||
      JSON.parse(await readFile(output + "/release.json")).environment !==
        environment
    )
      throw Error("UNRECOGNISED_RELEASE_OUTPUT");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  await mkdir("local", { recursive: true, mode: 0o700 });
  await rm(output, { recursive: true, force: true });
  await cp("functions", output, {
    recursive: true,
    filter: (p) =>
      !["node_modules", "tests"].includes(basename(p)) &&
      !/^\.(env|secret)/.test(basename(p)) &&
      !p.endsWith(".log") &&
      !p.endsWith(".md"),
  });
  await cp(output + "/index.mjs", output + "/application.mjs");
  await writeFile(
    output + "/index.mjs",
    `if(process.env.AROHA_ENVIRONMENT!==${JSON.stringify(environment)}||process.env.MAIL_ENABLED!=='true')throw Error('RUNTIME_ENVIRONMENT_REQUIRED');\nconst application=await import('./application.mjs');\n` +
      [
        "arohaApi",
        ...(!preprod ? ["arohaBookingEvents"] : []),
        "arohaBookingEmailDispatch",
        "arohaBookingEmailRetry",
      ]
        .map((n) => `export const ${n + suffix}=application.${n};`)
        .join("\n") +
      "\n",
  );
  await writeFile(
    output + "/.env.aroha-retreat",
    Object.entries(env)
      .map(([k, v]) => k + "=" + JSON.stringify(v))
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  await writeFile(
    output + "/release.json",
    JSON.stringify(
      {
        source,
        environment,
        codebase: preprod ? "aroha-website-preprod" : "aroha-website",
        mailEnabled: true,
        configurationChanges,
        localValidationOnly: false,
        providerRevisions: providers.map((f) => ({
          name: f.name.split("/").at(-1),
          revision: f.serviceConfig.revision,
        })),
      },
      null,
      2,
    ),
  );
  const config = JSON.parse(
    await readFile(preprod ? "firebase.preprod.json" : "firebase.json"),
  );
  if (
    config.functions.length !== 1 ||
    config.functions[0].codebase !==
      (preprod ? "aroha-website-preprod" : "aroha-website")
  )
    throw Error("UNEXPECTED_CODEBASE");
  config.functions[0].source = preprod
    ? "local/preprod-functions"
    : "local/production-functions";
  if (!preprod)
    await writeFile(
      ".production-api.firebase.json",
      JSON.stringify(config, null, 2),
    );
  const install = spawnSync("npm", ["ci", "--ignore-scripts"], {
    cwd: output,
    stdio: "inherit",
  });
  if (install.status) throw Error("RUNTIME_INSTALL_FAILED");
  console.log(
    JSON.stringify({
      prepared: true,
      source,
      environment,
      mailEnabled: true,
      configurationPreserved: configurationChanges.length === 0,
      configurationChanges,
      selectiveDeploymentRequired: [
        "arohaApi" + suffix,
        "arohaBookingEmailDispatch" + suffix,
        "arohaBookingEmailRetry" + suffix,
      ],
    }),
  );
} catch {
  console.error("RUNTIME_PREPARATION_FAILED");
  process.exitCode = 1;
}
