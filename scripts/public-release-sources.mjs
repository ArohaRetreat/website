import {
  cleanReleaseText, commitPattern, developerRepo, istDate, mcpNotesUrl, npmPackage,
  npmVersionUrl, releaseCopy, releaseKey, utcTime, versionPattern,
} from "./public-release-index.mjs";

const registry = "https://registry.npmjs.org";
const manifestUrl = "https://developer.aroharetreat.com/release.json";
const hostingManifestUrl = "https://aroha-retreat-developer.web.app/release.json";
const githubApi = "https://api.github.com";
const rawDeveloper = "https://raw.githubusercontent.com/ArohaRetreat/developer";
const npmRepository = "git+https://github.com/ArohaRetreat/mcp.git";
const githubHeaders = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10" };

async function readPublic(url, { optional = false, maxBytes = 2 * 1024 * 1024, headers = {} } = {}) {
  const response = await fetch(url, {
    headers: { "Cache-Control": "no-cache", ...headers },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (optional && response.status === 404) return null;
  if (!response.ok) throw Error("PUBLIC_UPDATES_SOURCE_HTTP_" + response.status);
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxBytes) throw Error("PUBLIC_UPDATES_SOURCE_LIMIT");
    chunks.push(chunk);
  }
  return { text: Buffer.concat(chunks).toString("utf8"), lastModified: response.headers.get("last-modified") };
}

function registryReleases(metadata) {
  if (metadata?.name !== npmPackage || !metadata.versions || !metadata.time) {
    throw Error("PUBLIC_UPDATES_NPM_METADATA_INVALID");
  }
  const entries = Object.entries(metadata.versions).filter(([version]) => versionPattern.test(version));
  if (entries.length > 500) throw Error("PUBLIC_UPDATES_NPM_VERSION_LIMIT");
  return entries.map(([version, value]) => {
    const published = utcTime(metadata.time[version]);
    if (value?.version !== version || value.name !== npmPackage || value.repository?.url !== npmRepository ||
      value.dist?.tarball !== `${registry}/${npmPackage}/-/aroha-mcp-${version}.tgz` ||
      !/^sha512-[A-Za-z0-9+/]{86}==$/.test(value.dist.integrity) || !Number.isFinite(published)) {
      throw Error("PUBLIC_UPDATES_NPM_VERSION_INVALID");
    }
    return {
      channel: "npm", version, date: istDate(published),
      title: `Aroha MCP ${version}`,
      summary: "This version of the Aroha Retreat MCP package is available on npm.",
      evidence: npmVersionUrl(version),
    };
  });
}

async function mcpReleases(known, get) {
  const packageRecord = await get(`${registry}/@theharithsa%2faroha-mcp`, { headers: { Accept: "application/json" } });
  const savedReleases = new Map(known.map(release => [releaseKey(release), release]));
  const releases = registryReleases(JSON.parse(packageRecord.text)).filter(release =>
    !savedReleases.get(releaseKey(release))?.notes,
  );
  if (!releases.length) return [];
  // Registry publication stands on its own. Optional release copy can arrive in a later sync.
  const githubReleases = await get(`${githubApi}/repos/ArohaRetreat/mcp/releases?per_page=100`, {
    headers: githubHeaders, optional: true,
  }).then(record => record ? JSON.parse(record.text) : null).catch(() => null);
  const sourceNotes = new Map((Array.isArray(githubReleases) ? githubReleases : [])
    .filter(row => row && !row.draft && !row.prerelease)
    .map(row => [row.tag_name, row]));
  return releases.flatMap(release => {
    const saved = savedReleases.get(releaseKey(release));
    const note = sourceNotes.get("v" + release.version);
    if (note?.html_url === mcpNotesUrl(release.version)) {
      const title = cleanReleaseText(note.name, 140);
      const lines = typeof note.body === "string" ? note.body.split(/\r?\n/) : [];
      const summary = cleanReleaseText(lines.find(line => line.trim() && !line.trim().startsWith("#")), 500);
      if (title) release.title = title;
      if (summary) release.summary = summary;
      release.notes = note.html_url;
    }
    return !saved || release.notes ? [release] : [];
  });
}

async function developerReleases(known, get, now) {
  const [publicSite, hosting] = await Promise.all([
    get(manifestUrl, { maxBytes: 8192 }),
    get(hostingManifestUrl, { maxBytes: 8192 }),
  ]);
  const { name, version, source, builtAt } = JSON.parse(publicSite.text);
  const builtAtMs = utcTime(builtAt);
  if (publicSite.text !== hosting.text || name !== "aroha-developer" ||
    typeof version !== "string" || !versionPattern.test(version) || typeof source !== "string" ||
    !commitPattern.test(source) || !Number.isFinite(builtAtMs) || builtAtMs > now + 60_000) {
    throw Error("PUBLIC_UPDATES_DEVELOPER_MANIFEST_INVALID");
  }

  const key = releaseKey({ channel: "developer", version, source });
  if (known.some(release => releaseKey(release) === key)) return [];

  const [packageRecord, changelog] = await Promise.all([
    get(`${rawDeveloper}/${source}/package.json`, { maxBytes: 65_536 }),
    get(`${rawDeveloper}/${source}/CHANGELOG.md`, { optional: true, maxBytes: 256 * 1024 }),
  ]);
  const pkg = JSON.parse(packageRecord.text);
  if (pkg.name !== name || pkg.version !== version) throw Error("PUBLIC_UPDATES_DEVELOPER_REVISION_INVALID");

  const modified = Date.parse(hosting.lastModified);
  const useHostingDate = Number.isFinite(modified) && modified >= builtAtMs - 1000 && modified <= now + 60_000;
  return [{
    channel: "developer", version, source, builtAt,
    date: istDate(useHostingDate ? modified : now),
    dateSource: useHostingDate ? "hosting-file" : "live-check",
    ...releaseCopy(changelog?.text ?? "", version, "Developer docs"),
    evidence: `${developerRepo}/tree/${source}`,
  }];
}

export async function externalReleases(known, { get = readPublic, now = Date.now() } = {}) {
  const feeds = await Promise.allSettled([mcpReleases(known, get), developerReleases(known, get, now)]);
  const sources = ["npm", "developer"];
  return {
    releases: feeds.flatMap(feed => feed.status === "fulfilled" ? feed.value : []),
    unavailable: sources.filter((_, index) => feeds[index].status === "rejected"),
  };
}
