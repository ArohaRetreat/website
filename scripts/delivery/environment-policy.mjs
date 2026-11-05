export const repository = "ArohaRetreat/website";
export function deliveryTarget(ref) {
  const branch = { "refs/heads/main": "main", "refs/heads/preprod": "preprod" }[ref];
  if (!branch) throw Error("ENVIRONMENT_BRANCH_REQUIRED");
  const production = branch === "main";
  return Object.freeze({
    branch, environment: production ? "production" : "pre-prod",
    site: production ? "aroha-retreat" : "aroha-retreat-preprod",
    directory: production ? "dist" : "dist-preprod",
    origin: production ? "https://aroharetreat.com" : "https://aroha-retreat-preprod.web.app",
  });
}
export function assertPullRequest(head, base) {
  if (["main", "preprod"].includes(head) && ["main", "preprod"].includes(base))
    throw Error("DIRECT_ENVIRONMENT_MERGE_FORBIDDEN");
}
export function assertArtifact(target, release, revision, config) {
  if (!/^[a-f0-9]{40}$/.test(revision) || release.revision !== revision ||
      release.environment !== target.environment || release.emulators !== false ||
      config.hosting?.site !== target.site || config.hosting?.public !== target.directory)
    throw Error("ENVIRONMENT_ARTIFACT_MISMATCH");
}
export function branchChecks(checks, runs, branch, sha) {
  const suites = new Set();
  for (const name of ["Website application checks", "Foundation checks", "Environment branch policy"]) {
    const run = runs.filter(r => r.name === name && r.event === "push" && r.head_branch === branch && r.head_sha === sha)
      .sort((a,b) => b.id-a.id || b.run_attempt-a.run_attempt)[0];
    if (run) suites.add(run.check_suite_id);
  }
  return ["application", "website-integration", "foundation", "branch-policy"].map(name =>
    checks.filter(c => c.name === name && c.app.slug === "github-actions" && suites.has(c.check_suite.id))
      .sort((a,b) => b.id-a.id)[0]);
}

// Both publication and independent live verification use the same API contract.
export function compatibleBookingApi(websiteVersion, apiVersion) {
  const website=/^0\.(\d+)\.(\d+)$/.exec(websiteVersion || "");
  if(!website) return false;
  const minor=Number(website[1])>=22 ? 8 : 7;
  const api=/^0\.(\d+)\.(\d+)$/.exec(apiVersion || "");
  return !!api && Number(api[1])===minor && Number(api[2]) >= (Number(website[1])>23 || (Number(website[1])===23 && Number(website[2])>=1) ? 2 : Number(website[1])>=23 ? 1 : 0);
}
