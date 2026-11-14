export const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
export const commitPattern = /^[a-f0-9]{40}$/;
export const npmPackage = "@theharithsa/aroha-mcp";
export const developerRepo = "https://github.com/ArohaRetreat/developer";
export const mcpRepo = "https://github.com/ArohaRetreat/mcp";
export const websiteEvidence = /^https:\/\/github\.com\/ArohaRetreat\/website\/(?:actions\/runs\/\d+|blob\/[a-f0-9]{40}\/release-evidence\/[A-Za-z0-9._/-]+\.md)$/;
export const npmVersionUrl = version => `https://www.npmjs.com/package/${npmPackage}/v/${version}`;
export const mcpNotesUrl = version => `${mcpRepo}/releases/tag/v${version}`;

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata",
});

export function validDate(value) {
  const date = new Date(value + "T00:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}

export function istDate(time) {
  const parts = Object.fromEntries(dateFormat.formatToParts(time).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function utcTime(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value) &&
    validDate(value.slice(0, 10)) ? Date.parse(value) : NaN;
}

export const releaseChannel = release => release.channel ?? release.environment;
export const releaseKey = release => [releaseChannel(release), release.version, release.source].filter(Boolean).join("/");
export const releaseAnchor = release => releaseKey(release).replaceAll(/[/.]/g, "-");
export const newestFirst = (a, b) => b.date.localeCompare(a.date) ||
  (b.builtAt ?? "").localeCompare(a.builtAt ?? "") || b.version.localeCompare(a.version, "en", { numeric: true });

function safeRelease(release) {
  if (!release || typeof release.version !== "string" || !versionPattern.test(release.version) || !validDate(release.date) ||
    typeof release.title !== "string" || !release.title.trim() || release.title.length > 140 ||
    typeof release.summary !== "string" || !release.summary.trim() || release.summary.length > 500) {
    throw Error("PUBLIC_UPDATES_RELEASE_INVALID");
  }
  const { channel, environment, version, date, title, summary, api, evidence, notes, source, dateSource, builtAt } = release;
  const base = { version, date, title, summary, evidence };
  if (channel === "npm" && evidence === npmVersionUrl(version) && (!notes || notes === mcpNotesUrl(version))) {
    return { channel, ...base, ...(notes ? { notes } : {}) };
  }
  if (channel === "developer" && typeof source === "string" && commitPattern.test(source) && evidence === `${developerRepo}/tree/${source}` &&
    Number.isFinite(utcTime(builtAt)) && ["hosting-file", "live-check"].includes(dateSource)) {
    return { channel, ...base, source, builtAt, dateSource };
  }
  if (channel === undefined && ["production", "preprod"].includes(environment) &&
    websiteEvidence.test(evidence) && (api === undefined || versionPattern.test(api))) {
    return { environment, ...base, ...(api ? { api } : {}) };
  }
  throw Error("PUBLIC_UPDATES_RELEASE_INVALID");
}

export function mergeReleaseIndex(curated, previous, fresh) {
  const entries = new Map(previous.map(safeRelease).map(release => [releaseKey(release), release]));
  for (const release of fresh.map(safeRelease)) {
    const key = releaseKey(release);
    const saved = entries.get(key);
    if (saved?.channel === "npm" && !saved.notes && release.notes) {
      entries.set(key, { ...release, date: release.date < saved.date ? release.date : saved.date });
    } else if (!saved || release.date < saved.date) {
      entries.set(key, release);
    }
  }
  for (const release of curated.map(safeRelease)) entries.set(releaseKey(release), release);
  return [...entries.values()].sort((a, b) => releaseChannel(a).localeCompare(releaseChannel(b)) || newestFirst(a, b));
}

export function cleanReleaseText(value, limit) {
  if (typeof value !== "string") return "";
  const text = value.trim().replace(/^[-*] /, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*]/g, "").replace(/\s+/g, " ").trim();
  return text.length <= limit ? text : "";
}

export function releaseCopy(changelog, version, product = "Website") {
  const section = changelog.split(/^## /m).find(heading =>
    new RegExp(`^(?:${product} )?${version.replaceAll(".", "\\.")}(?:\\s|$)`).test(heading),
  );
  const [heading, ...lines] = section?.split("\n") ?? [];
  const sentence = lines.map(line => line.trim()).find(line => /^[\p{L}\p{N}]|^[-*] /u.test(line));
  return {
    title: cleanReleaseText(heading?.split(" — ")[1], 140) || `${product} ${version}`,
    summary: cleanReleaseText(sentence, 500) || (product === "Website"
      ? "This website version is deployed and verified."
      : "This documentation build was verified on Firebase Hosting."),
  };
}
