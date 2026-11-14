import test from "node:test";
import assert from "node:assert/strict";
import { mergeReleaseIndex, releaseCopy, syncReviewWindows, verifiedRelease } from "../scripts/sync-public-updates.mjs";

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
