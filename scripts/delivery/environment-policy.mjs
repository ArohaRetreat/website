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
