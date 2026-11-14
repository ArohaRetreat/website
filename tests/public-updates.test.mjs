import test from "node:test";
import assert from "node:assert/strict";
import { mergeReleaseIndex, releaseCopy, syncReviewWindows, verifiedRelease } from "../scripts/sync-public-updates.mjs";
import { externalReleases } from "../scripts/public-release-sources.mjs";
import { npmPackage, releaseAnchor } from "../scripts/public-release-index.mjs";

const review = { scheduleIssue: 93, title: "Prepare for staff review" };
function projectItem(value, archived_at = null) {
  return {
    archived_at,
    content_type: "Issue",
    content: { html_url: "https://github.com/ArohaRetreat/website/issues/93" },
    fields: [{ id: 442692234, data_type: "iteration", value }],
  };
}

test("public review uses the current sprint start and inclusive end across months", () => {
  const [updated] = syncReviewWindows([review], [projectItem({ start_date: "2026-11-30", duration: 14 })]);
  assert.deepEqual(updated, { ...review, start: "2026-11-30", end: "2026-12-13" });
  assert.equal(syncReviewWindows([review], [projectItem(null)])[0].start, null);
  assert.equal(syncReviewWindows([review], [projectItem(null, "2026-11-14")])[0].start, null);
  assert.throws(() => syncReviewWindows([review], [projectItem({ start_date: "2026-11-31", duration: 14 })]),
    /PUBLIC_UPDATES_ITERATION_INVALID/);
});

const repo = { full_name: "ArohaRetreat/website" };
const run = {
  id: 201,
  run_attempt: 1,
  path: ".github/workflows/deploy-environment.yml",
  repository: repo,
  head_repository: repo,
  head_branch: "preprod",
  head_sha: "a".repeat(40),
  status: "completed",
  event: "push",
  created_at: "2026-11-14T18:28:00Z",
  updated_at: "2026-11-14T18:33:00Z",
};
const receipt = {
  schemaVersion: 1,
  status: "deployed",
  website: { version: "0.33.3", environment: "pre-prod", emulators: false, revision: run.head_sha },
  after: {
    type: "DEPLOY",
    version: "projects/aroha-retreat/sites/aroha-retreat-preprod/versions/123abc",
    releaseTime: "2026-11-14T18:31:00Z",
  },
  verification: { status: "verified" },
};

test("publish only verified website releases with matching metadata and IST dates", () => {
  assert.deepEqual(verifiedRelease(run, receipt), {
    environment: "preprod", version: "0.33.3", date: "2026-11-15",
    evidence: "https://github.com/ArohaRetreat/website/actions/runs/201",
  });
  for (const rejected of [
    { ...receipt, status: "failed-or-partial" },
    { ...receipt, verification: { status: "failed" } },
    { ...receipt, website: { ...receipt.website, revision: "b".repeat(40) } },
    { ...receipt, website: { ...receipt.website, emulators: true } },
    { ...receipt, after: { ...receipt.after, version: receipt.after.version.replace("retreat-preprod", "retreat") } },
    { ...receipt, after: { ...receipt.after, releaseTime: "2026-11-15T08:00:00Z" } },
  ]) assert.equal(verifiedRelease(run, rejected), null);
  assert.equal(verifiedRelease({ ...run, event: "pull_request" }, receipt), null);
  assert.equal(verifiedRelease({ ...run, head_repository: { full_name: "other/website" } }, receipt), null);
});

test("release archive preserves older records and separates the same version by environment", () => {
  const item = {
    ...verifiedRelease(run, receipt),
    ...releaseCopy("## Website 0.33.3 / API 0.18.1 — Booking updates\n\n- A [clearer booking form](https://example.test/).", "0.33.3"),
  };
  assert.equal(item.title, "Booking updates");
  assert.equal(item.summary, "A clearer booking form.");
  const curated = { ...item, environment: "production", title: "Production booking updates" };
  const updated = mergeReleaseIndex([curated], [item], [{ ...item, date: "2026-11-16" }]);
  assert.equal(updated.length, 2);
  assert.equal(updated.find(release => release.environment === "preprod").date, item.date);
  assert.equal(updated.find(release => release.environment === "production").title, curated.title);
});

const registryUrl = "https://registry.npmjs.org/@theharithsa%2faroha-mcp";
const notesUrl = "https://api.github.com/repos/ArohaRetreat/mcp/releases?per_page=100";
const docsUrl = "https://developer.aroharetreat.com/release.json";
const hostingUrl = "https://aroha-retreat-developer.web.app/release.json";
const now = Date.parse("2026-11-14T18:35:00Z");
const source = "d".repeat(40);
const rawDocs = `https://raw.githubusercontent.com/ArohaRetreat/developer/${source}`;
const docsVersion = { name: "aroha-developer", version: "0.4.2" };
const manifest = { ...docsVersion, source, builtAt: "2026-11-14T18:29:00.000Z" };

function feeds(overrides = {}) {
  const newVersion = "0.4.2";
  const versionRecord = {
    name: npmPackage, version: newVersion, repository: { url: "git+https://github.com/ArohaRetreat/mcp.git" },
    dist: {
      tarball: `https://registry.npmjs.org/${npmPackage}/-/aroha-mcp-${newVersion}.tgz`,
      integrity: `sha512-${"a".repeat(86)}==`,
    },
  };
  const currentRecords = {
    [registryUrl]: {
      name: npmPackage,
      versions: { [newVersion]: versionRecord, "0.5.0-stage": {} },
      time: { [newVersion]: "2026-11-14T18:31:00.000Z", "0.5.0-stage": "2026-11-14T18:32:00Z" },
    },
    [notesUrl]: [
      {
        tag_name: "v0.4.2", name: "Booking lookup improvements", body: "Faster [guest lookup](https://example.test/).",
        html_url: "https://github.com/ArohaRetreat/mcp/releases/tag/v0.4.2",
      },
      { tag_name: "v0.4.3", html_url: "https://github.com/ArohaRetreat/mcp/releases/tag/v0.4.3" },
    ],
    [docsUrl]: manifest,
    [hostingUrl]: manifest,
    [rawDocs + "/package.json"]: docsVersion,
    [rawDocs + "/CHANGELOG.md"]: "## 0.4.2 — Updated API guides\n\n- Document booking filters.",
    ...overrides,
  };
  return {
    now,
    get: async url => {
      assert(url in currentRecords);
      const value = currentRecords[url];
      if (value instanceof Error) throw value;
      if (value === null) return null;
      return {
        text: typeof value === "string" ? value : JSON.stringify(value),
        lastModified: url === hostingUrl ? "Sat, 14 Nov 2026 18:30:00 GMT" : null,
      };
    },
  };
}

test("stable npm publications and matched docs builds coexist with the website version index", async () => {
  const { releases, unavailable } = await externalReleases([], feeds());
  assert.deepEqual(unavailable, []);
  const [mcp, docs] = releases;
  assert.equal(mcp.version, "0.4.2");
  assert.equal(mcp.date, "2026-11-15");
  assert.equal(mcp.title, "Booking lookup improvements");
  assert.equal(mcp.summary, "Faster guest lookup.");
  assert.equal(mcp.evidence, `https://www.npmjs.com/package/${npmPackage}/v/0.4.2`);
  assert.equal(docs.title, "Updated API guides");
  assert.equal(docs.source, source);
  assert.equal(docs.dateSource, "hosting-file");
  assert.equal(docs.date, "2026-11-15");
  const website = { ...verifiedRelease(run, receipt), version: "0.4.2", title: "Website update", summary: "A test build." };
  assert.equal(mergeReleaseIndex([website], [], releases).length, 3);
  assert.notEqual(releaseAnchor(docs), releaseAnchor(mcp));
  assert.equal(releaseAnchor(website), "preprod-0-4-2");
  assert.deepEqual(await externalReleases(releases, feeds({
    [rawDocs + "/package.json"]: new Error("A previously verified commit needs no refetch"),
  })), { releases: [], unavailable: [] });
});

test("MCP notes can follow publication and an inconsistent docs deployment leaves the archive intact", async () => {
  const initial = await externalReleases([], feeds({
    [notesUrl]: new Error("Optional release notes unavailable"),
  }));
  assert.equal(initial.releases[0].notes, undefined);
  const refreshed = await externalReleases(initial.releases, feeds({
    [hostingUrl]: { ...manifest, source: "e".repeat(40) },
  }));
  assert.deepEqual(refreshed.unavailable, ["developer"]);
  const history = mergeReleaseIndex([], initial.releases, refreshed.releases);
  assert.equal(history.length, 2);
  assert(history.find(release => release.channel === "npm").notes);
  assert.equal(history.find(release => release.channel === "developer").source, source);
  const rollback = await externalReleases(history, feeds({
    [rawDocs + "/package.json"]: { ...docsVersion, version: "0.4.3" },
  }));
  assert.deepEqual(rollback, { releases: [], unavailable: [] });
  assert.throws(() => mergeReleaseIndex([], [], [{
    ...history[0], evidence: "https://untrusted.example/",
  }]), /PUBLIC_UPDATES_RELEASE_INVALID/);
  const unrecognizedBuild = await externalReleases([], feeds({
    [rawDocs + "/package.json"]: { ...docsVersion, version: "0.4.3" },
  }));
  assert.deepEqual(unrecognizedBuild.unavailable, ["developer"]);
  assert.equal(unrecognizedBuild.releases.length, 1);
});
