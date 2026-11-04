import { readFile } from "node:fs/promises";
import { deliveryTarget, repository } from "./environment-policy.mjs";
const target = deliveryTarget(process.env.GITHUB_REF);
if (process.env.GITHUB_REPOSITORY !== repository ||
    !["push", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME))
  throw Error("TRUSTED_BRANCH_EVENT_REQUIRED");
const sha = process.env.GITHUB_SHA;
if (!/^[a-f0-9]{40}$/.test(sha || "")) throw Error("SOURCE_REQUIRED");
const headers = { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json" };
async function api(path) {
  const r = await fetch("https://api.github.com/repos/" + repository + path,
    { headers, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw Error("CI_GATE_UNAVAILABLE");
  return r.json();
}
const required = ["application", "website-integration", "foundation", "branch-policy"];
for (let attempt = 0; attempt < 60; attempt++) {
  if ((await api("/git/ref/heads/" + target.branch)).object.sha !== sha)
    throw Error("SUPERSEDED_BRANCH_REVISION");
  const checks = (await api("/commits/" + sha + "/check-runs?per_page=100")).check_runs;
  const current = required.map(name => checks.filter(c => c.name === name && c.app.slug === "github-actions")
    .sort((a,b) => b.id-a.id)[0]);
  if (current.every(c => c?.status === "completed" && c.conclusion === "success")) {
    console.log("Current-source required checks passed for " + target.environment);
    process.exit(0);
  }
  if (current.some(c => c?.status === "completed" && c.conclusion !== "success"))
    throw Error("REQUIRED_CHECK_FAILED");
  await new Promise(resolve => setTimeout(resolve, 10000));
}
throw Error("REQUIRED_CHECKS_NOT_COMPLETE");
