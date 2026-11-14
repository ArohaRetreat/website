import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { github as readActions } from "./delivery/github.mjs";

const repo = "ArohaRetreat/website";
const workflow = ".github/workflows/deploy-environment.yml";
const github = "https://api.github.com/";
const iteration = 442692234;
const targets = {
  main: { environment: "production", profile: "production", site: "aroha-retreat" },
  preprod: { environment: "preprod", profile: "pre-prod", site: "aroha-retreat-preprod" },
};
const semver = /^\d+\.\d+\.\d+$/;
const revision = /^[a-f0-9]{40}$/;
const recordLink = /^https:\/\/github\.com\/ArohaRetreat\/website\/(?:actions\/runs\/\d+|blob\/[a-f0-9]{40}\/release-evidence\/[A-Za-z0-9._/-]+\.md)$/;
const dateFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata",
});

function validDate(value) {
  const date = new Date(value + "T00:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}

export function syncReviewWindows(reviews, items) {
  const byIssue = new Map();
  for (const item of items) {
    const match = /^https:\/\/github\.com\/ArohaRetreat\/website\/issues\/(\d+)$/.exec(item.content?.html_url);
    if (match && item.content_type === "Issue") byIssue.set(Number(match[1]), item);
  }
  return reviews.map(review => {
    const item = byIssue.get(review.scheduleIssue);
    const field = item?.fields?.find(field => field.id === iteration);
    if (item && !item.archived_at && (!field || field.data_type !== "iteration")) {
      throw Error("PUBLIC_UPDATES_ITERATION_FIELD_MISSING");
    }
    const value = item && !item.archived_at ? field.value : null;
    if (value === null) return { ...review, start: null, end: null };
    const { start_date: start, duration } = value;
    if (!validDate(start) || !Number.isSafeInteger(duration) || duration < 1 || duration > 366) {
      throw Error("PUBLIC_UPDATES_ITERATION_INVALID");
    }
    const end = new Date(start + "T00:00:00Z");
    end.setUTCDate(end.getUTCDate() + duration - 1);
    return { ...review, start, end: end.toISOString().slice(0, 10) };
  }).sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999"));
}

function trustedRun(run, branch) {
  return run.repository?.full_name === repo && run.head_repository?.full_name === repo &&
    run.head_branch === branch && run.path === workflow && run.status === "completed" &&
    ["push", "workflow_dispatch"].includes(run.event) &&
    revision.test(run.head_sha) && Number.isSafeInteger(run.id) && Number.isSafeInteger(run.run_attempt);
}

export function verifiedRelease(run, receipt) {
  const target = targets[run.head_branch];
  const website = receipt.website;
  const publication = receipt.after;
  if (!target || !trustedRun(run, run.head_branch) ||
    receipt.schemaVersion !== 1 || receipt.status !== "deployed" ||
    receipt.verification?.status !== "verified" || website?.emulators !== false ||
    website.revision !== run.head_sha || website.environment !== target.profile ||
    !semver.test(website.version) || publication?.type !== "DEPLOY" ||
    !new RegExp(`^projects/aroha-retreat/sites/${target.site}/versions/[a-f0-9]+$`).test(publication.version)) {
    return null;
  }
  const releaseTime = new Date(publication.releaseTime);
  const start = Date.parse(run.created_at);
  const finish = Date.parse(run.updated_at);
  if (![+releaseTime, start, finish].every(Number.isFinite) ||
    +releaseTime < start - 60_000 || +releaseTime > finish + 60_000) return null;
  const date = Object.fromEntries(dateFormat.formatToParts(releaseTime).map(({ type, value }) => [type, value]));
  return {
    environment: target.environment,
    version: website.version,
    date: `${date.year}-${date.month}-${date.day}`,
    evidence: `https://github.com/${repo}/actions/runs/${run.id}`,
  };
}

const key = release => `${release.environment}/${release.version}`;

function safeRelease(release) {
  if (!release || !Object.values(targets).some(value => value.environment === release.environment) ||
    !semver.test(release.version) || !validDate(release.date) ||
    (release.api !== undefined && !semver.test(release.api)) ||
    !recordLink.test(release.evidence) ||
    typeof release.title !== "string" || !release.title.trim() || release.title.length > 140 ||
    typeof release.summary !== "string" || !release.summary.trim() || release.summary.length > 500) {
    throw Error("PUBLIC_UPDATES_RELEASE_INVALID");
  }
  const { environment, version, date, title, summary, api, evidence } = release;
  return { environment, version, date, title, summary, ...(api ? { api } : {}), evidence };
}

export function mergeReleaseIndex(curated, previous, fresh) {
  const entries = new Map(previous.map(safeRelease).map(release => [key(release), release]));
  for (const release of fresh.map(safeRelease)) {
    const saved = entries.get(key(release));
    if (!saved || release.date < saved.date) entries.set(key(release), release);
  }
  for (const release of curated.map(safeRelease)) entries.set(key(release), release);
  return [...entries.values()].sort((a, b) => a.environment.localeCompare(b.environment) ||
    b.date.localeCompare(a.date) || b.version.localeCompare(a.version, "en", { numeric: true }));
}

export function releaseCopy(changelog, version) {
  const section = changelog.split(/^## /m).find(section =>
    new RegExp(`^(?:Website )?${version.replaceAll(".", "\\.")}(?:\\s|$)`).test(section),
  );
  const heading = section?.split("\n")[0];
  const sentence = section?.split("\n").slice(1).map(line => line.trim())
    .find(line => /^[\p{L}\p{N}]|^[-*] /u.test(line));
  const clean = value => value?.replace(/^[-*] /, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[`*]/g, "").trim();
  const title = clean(heading?.split(" — ")[1]);
  const summary = clean(sentence);
  return {
    title: title && title.length <= 140 ? title : `Website ${version}`,
    summary: summary && summary.length <= 500 ? summary : "This website version is deployed and verified.",
  };
}

async function request(path, { api = true } = {}) {
  const response = await fetch(api ? new URL(path, github) : path, {
    headers: {
      "Cache-Control": "no-cache",
      ...(api ? { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10" } : {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw Error("PUBLIC_UPDATES_HTTP_" + response.status);
  return response;
}

async function projectItems() {
  const rows = [];
  let path = `orgs/ArohaRetreat/projectsV2/1/items?per_page=100&fields=${iteration}`;
  for (let page = 0; path && page < 20; page++) {
    const response = await request(path);
    rows.push(...await response.json());
    const next = /<([^>]+)>; rel="next"/.exec(response.headers.get("link") ?? "")?.[1];
    if (next && !/^https:\/\/api\.github\.com\/(?:orgs\/ArohaRetreat|organizations\/350652334)\/projectsV2\/1\/items\?/.test(next)) {
      throw Error("PUBLIC_UPDATES_PROJECT_CURSOR_INVALID");
    }
    path = next;
  }
  if (path) throw Error("PUBLIC_UPDATES_PROJECT_LIMIT");
  if (!rows.some(item => item.fields?.some(field => field.id === iteration && field.data_type === "iteration"))) {
    throw Error("PUBLIC_UPDATES_PROJECT_ITERATION_UNAVAILABLE");
  }
  return rows;
}

async function receiptFor(run, token) {
  const { artifacts } = await readActions(`/repos/${repo}/actions/runs/${run.id}/artifacts?per_page=100`, token);
  const name = `environment-delivery-${run.id}-${run.run_attempt}`;
  const result = artifacts.find(artifact => artifact.name === name && !artifact.expired);
  if (!result) return null;
  if (!Number.isSafeInteger(result.id) || result.size_in_bytes > 200_000) {
    throw Error("PUBLIC_UPDATES_RECEIPT_LIMIT");
  }
  const bytes = await readActions(`/repos/${repo}/actions/artifacts/${result.id}/zip`, token, { binary: true });
  if (bytes.length > 200_000) throw Error("PUBLIC_UPDATES_RECEIPT_LIMIT");
  try {
    return JSON.parse(execFileSync("python3", [fileURLToPath(new URL("delivery/read-hosting-receipt.py", import.meta.url))], {
      input: bytes, encoding: "utf8", maxBuffer: 400_000, stdio: ["pipe", "pipe", "pipe"],
    }));
  } catch {
    throw Error("PUBLIC_UPDATES_RECEIPT_INVALID");
  }
}

async function publishableReleases(known, token) {
  const visited = new Set(known.map(release => release.evidence));
  const fresh = [];
  const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString();
  // Earlier releases are carried by the curated index. Reconcile recent runs from the start of this sync.
  const trackingStart = "2026-11-13T18:30:00.000Z";
  for (const branch of Object.keys(targets)) {
    const since = cutoff > trackingStart ? cutoff : trackingStart;
    const path = `/repos/${repo}/actions/workflows/deploy-environment.yml/runs?branch=${branch}&status=completed&per_page=100&created=${encodeURIComponent(">=" + since)}`;
    const { total_count, workflow_runs: runs } = await readActions(path, token);
    if (total_count > runs.length) throw Error("PUBLIC_UPDATES_DEPLOYMENT_LIMIT");
    for (const run of runs.filter(run => trustedRun(run, branch))) {
      if (visited.has(`https://github.com/${repo}/actions/runs/${run.id}`)) continue;
      const receipt = await receiptFor(run, token);
      if (!receipt) continue;
      const release = verifiedRelease(run, receipt);
      if (!release || known.some(saved => key(saved) === key(release))) continue;
      const changelog = await request(`https://raw.githubusercontent.com/${repo}/${run.head_sha}/CHANGELOG.md`, { api: false });
      fresh.push({ ...release, ...releaseCopy(await changelog.text(), release.version) });
    }
  }
  return fresh;
}

async function main([output]) {
  if (!output || !process.env.GH_TOKEN) throw Error("PUBLIC_UPDATES_OUTPUT_AND_TOKEN_REQUIRED");
  const curated = JSON.parse(await readFile(new URL("../docs/public/updates.json", import.meta.url), "utf8"));
  const history = await request("https://aroharetreat.github.io/website/release-history.json", { api: false });
  const published = await history.json();
  if (!Array.isArray(published) || published.length > 500) throw Error("PUBLIC_UPDATES_HISTORY_INVALID");
  const known = mergeReleaseIndex(curated.releases, published, []);
  const [items, fresh] = await Promise.all([projectItems(), publishableReleases(known, process.env.GH_TOKEN)]);
  const reviews = syncReviewWindows(curated.reviews, items);
  const releases = mergeReleaseIndex(curated.releases, published, fresh);
  await writeFile(output, JSON.stringify({ ...curated, reviews, releases }, null, 2) + "\n");
  console.log(JSON.stringify({ reviews: reviews.length, releases: releases.length, newlyVerified: fresh.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2)).catch(error => {
    console.error(/^PUBLIC_UPDATES_[A-Z0-9_]+$/.test(error.message) ? error.message : "PUBLIC_UPDATES_SYNC_FAILED");
    process.exitCode = 1;
  });
}
