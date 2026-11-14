import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { mergeReleaseIndex, newestFirst, releaseAnchor, releaseChannel } from "./public-release-index.mjs";

const root = new URL("../", import.meta.url);
const [dataFile, outputDirectory] = process.argv.slice(2);
const output = outputDirectory ? pathToFileURL(resolve(outputDirectory) + sep) : new URL("local/public-updates/", root);
const updates = JSON.parse(await readFile(dataFile || new URL("docs/public/updates.json", root), "utf8"));
const repository = "https://github.com/ArohaRetreat/website";
const project = "https://github.com/orgs/ArohaRetreat/projects/1";
const retreat = "https://aroharetreat.com";
const photograph = "https://firebasestorage.googleapis.com/v0/b/aroha-retreat.firebasestorage.app/o/media%2Fpreprod-finops-67a96464e860e5ab3263bf12256e2732105e08de086f2684a59a11c1b29ed9f2.webp?alt=media";

const entities = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
const escape = value => String(value).replace(/[&<>"']/g, char => entities[char]);
const tidyText = text => text.replace(/[^\S\n]+$/gm, "");
const dateStyle = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });
const time = date => `<time datetime="${escape(date)}">${dateStyle.format(new Date(date))}</time>`;
const channels = [
  { id: "production", title: "Production", description: "Website and Host Studio releases on aroharetreat.com.", icon: "check", product: "Website" },
  { id: "preprod", title: "Pre-production", description: "Website and Host Studio builds available for testing.", icon: "flask", product: "Website" },
  { id: "npm", title: "MCP", description: "Stable versions of @theharithsa/aroha-mcp on npm.", icon: "tools", product: "MCP" },
  { id: "developer", title: "Developer docs", description: "Verified builds of developer.aroharetreat.com.", icon: "docs", product: "" },
];
const releases = mergeReleaseIndex(updates.releases, [], []);
if (releases.length !== updates.releases.length) throw new Error("Duplicate public release entry.");
const groups = channels.map(channel => ({
  ...channel,
  releases: releases.filter(release => releaseChannel(release) === channel.id).sort(newestFirst),
})).filter(channel => channel.releases.length);
const production = groups.find(group => group.id === "production")?.releases[0];
if (!production) throw new Error("Missing production website releases.");

const symbols = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  external: '<path d="M13 5h6v6m0-6-8 8m6 0v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5"/>',
  calendar: '<rect x="4" y="6" width="16" height="15" rx="2"/><path d="M8 3v6m8-6v6M4 11h16m-12 4h2m4 0h2"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  tools: '<path d="M12 3 4.5 7v10L12 21l7.5-4V7L12 3Zm0 9 7.5-5M12 12 4.5 7M12 12v9"/>',
  chat: '<path d="M20 11a7 7 0 0 1-7 7H8l-4 3v-6a7 7 0 0 1-1-4 7 7 0 0 1 7-7h3a7 7 0 0 1 7 7Z"/><path d="M8 11h.01m4 0h.01m4 0h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  flask: '<path d="M9 3h6m-5 0v6l-5 8a2.5 2.5 0 0 0 2 4h10a2.5 2.5 0 0 0 2-4l-5-8V3M8 14h8"/>',
  tag: '<path d="M20 13l-7 7a2 2 0 0 1-2.8 0L4 13.8V4h9.8l6.2 6.2a2 2 0 0 1 0 2.8ZM8 8h.01"/>',
  docs: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h4"/>',
};
const symbol = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[name]}</svg>`;
const issue = (label, number) => `<a href="${repository}/issues/${Number(number)}">${escape(label)} ${symbol("external")}</a>`;

function page({ title, description, current, prefix, content }) {
  const nav = [
    ["roadmap", "Roadmap", prefix],
    ["releases", "Release notes", prefix + "releases/"],
    ["sdlc", "SDLC", prefix + "sdlc/"],
  ].map(([id, label, href]) => `<a href="${href}"${id === current ? ' aria-current="page"' : ""}>${label}</a>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f7f8f0">
  <meta name="description" content="${escape(description)}">
  <title>${escape(title)} · Aroha Retreat</title>
  <link rel="icon" href="${prefix}assets/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${prefix}assets/updates.css">
  ${current === "releases" ? `<script type="module" src="${prefix}assets/releases.js"></script>` : ""}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="top-bar">
    <div class="shell top-row">
      <a href="${prefix}" class="brand" aria-label="Aroha Retreat updates"><img src="${prefix}assets/logo.svg" width="1000" height="340" alt=""></a>
      <nav class="section-nav" aria-label="Aroha updates">${nav}</nav>
      <a class="visit-link" href="${retreat}/">Retreat website ${symbol("external")}</a>
    </div>
  </header>
  <main id="main" class="shell" tabindex="-1">
    ${content}
  </main>
  <footer class="page-footer">
    <div class="shell footer-row">
      <span>© ${new Date().getUTCFullYear()} Aroha Retreat</span>
      <nav aria-label="More from Aroha">
        <a href="${retreat}/book/">Book a stay</a>
        <a href="${retreat}/map/">Living Map</a>
        <a href="${project}">GitHub Project ${symbol("external")}</a>
      </nav>
    </div>
  </footer>
</body>
</html>`;
}

function reviewCard(review) {
  const window = review.start
    ? dateStyle.formatRange(new Date(review.start), new Date(review.end))
    : "Scheduling pending";
  return `<li class="review">
    <span class="review-icon">${symbol(review.icon)}</span>
    <article class="review-card">
      <div class="review-meta">
        <span class="window">${escape(window)}</span>
        <span class="status audience">${escape(review.audience)}</span>
      </div>
      <h3>${escape(review.title)}</h3>
      <p>${escape(review.summary)}</p>
      <div class="card-links">${review.links.map(([label, number]) => issue(label, number)).join("")}</div>
    </article>
  </li>`;
}

function roadmap() {
  const chat = updates.hrudhi;
  return page({
    title: "Roadmap",
    description: "Upcoming website and booking reviews at Aroha Retreat, and the plan for Hrudhi AI.",
    current: "roadmap",
    prefix: "./",
    content: `
      <section class="roadmap-hero" aria-labelledby="roadmap-title">
        <div class="hero-copy">
          <h1 id="roadmap-title">Roadmap</h1>
          <p>See the website and booking improvements we’re preparing for guests and hosts.</p>
          <a class="button light-button" href="./releases/">Read release notes ${symbol("arrow")}</a>
        </div>
        <div class="hero-photo">
          <img src="${escape(photograph)}" width="1800" height="1200" alt="A green field bordered by coconut palms at Aroha Retreat" fetchpriority="high">
        </div>
      </section>
      <div class="roadmap-layout">
        <section aria-labelledby="review-title">
          <div class="section-heading">
            <h2 id="review-title">Scheduled reviews</h2>
            <p>Target windows for testing and review from the GitHub Project.</p>
          </div>
          <ol class="review-list">${updates.reviews.map(reviewCard).join("")}</ol>
          <a class="text-action" href="${project}/views/4">View the GitHub roadmap ${symbol("external")}</a>
        </section>
        <aside class="roadmap-aside" aria-labelledby="planning-title">
          <div class="section-heading"><h2 id="planning-title">In planning</h2></div>
          <article class="planning-card">
            <div class="planning-meta">
              <span class="planning-icon">${symbol("chat")}</span>
              <span class="status planning-status">Hrudhi AI</span>
            </div>
            <h3>${escape(chat.title)}</h3>
            <p>${escape(chat.summary)}</p>
            <h4>Before public rollout</h4>
            <ol class="stages">
              ${chat.stages.map(([label, detail, number]) => `<li><strong>${issue(label, number)}</strong><p>${escape(detail)}</p></li>`).join("")}
            </ol>
            <p class="follow-up">Arize evaluation follows Dynatrace acceptance. ${issue("Follow-up", chat.followUp)}</p>
          </article>
          <a class="current-release" href="./releases/#${releaseAnchor(production)}">
            <span class="release-symbol">${symbol("tag")}</span>
            <span><strong>Latest production release</strong><span>Website ${escape(production.version)} · ${time(production.date)}</span></span>
            ${symbol("arrow")}
          </a>
        </aside>
      </div>`,
  });
}

function releaseCard(release) {
  const sourceLabel = { npm: "View on npm", developer: "Deployed source" }[release.channel] ?? "Publication record";
  return `<li class="release-card" id="${releaseAnchor(release)}" tabindex="-1">
    <div class="release-meta">
      <span class="status version">v${escape(release.version)}</span>
      ${release.dateSource === "live-check" ? '<span class="observed-label">Seen live</span>' : ""}${time(release.date)}
    </div>
    <h4>${escape(release.title)}</h4>
    <p>${escape(release.summary)}</p>
    ${release.api ? `<p class="api-version">Booking API ${escape(release.api)}</p>` : ""}
    <div class="card-links">
      <a href="${escape(release.evidence)}">${sourceLabel} ${symbol("external")}</a>
      ${release.notes ? `<a href="${escape(release.notes)}">GitHub release notes ${symbol("external")}</a>` : ""}
    </div>
  </li>`;
}

function releaseNotes() {
  return page({
    title: "Release notes",
    description: "Verified releases for the Aroha Retreat website, MCP package and developer documentation.",
    current: "releases",
    prefix: "../",
    content: `
      <section class="release-intro" aria-labelledby="release-title">
        <h1 id="release-title">Release notes</h1>
        <p>See what’s live across the website, MCP package and developer docs.</p>
        <div class="latest-grid">${groups.map(group => {
          const latest = group.releases[0];
          const version = group.product ? `${group.product} ${latest.version}` : `v${latest.version}`;
          return `<a class="latest-card ${group.id}" href="#${releaseAnchor(latest)}">
            <span class="latest-icon">${symbol(group.icon)}</span>
            <span><span class="latest-label">${group.title}</span><strong>${escape(version)}</strong><span>${time(latest.date)}</span></span>
            ${symbol("arrow")}
          </a>`;
        }).join("")}</div>
      </section>
      <div class="archive-layout">
        <aside class="version-index" aria-labelledby="versions-title">
          <details id="version-index" open>
            <summary><h2 id="versions-title">Version index</h2></summary>
            <nav aria-label="Release versions">${groups.map(group => `<h3>${group.title}</h3>
              <ul>${group.releases.map(release => {
                const version = `v${release.version}${release.source && group.releases.some(item => item !== release && item.version === release.version) ? ` · ${release.source.slice(0, 7)}` : ""}`;
                return `<li><a href="#${releaseAnchor(release)}">${escape(version)}</a></li>`;
              }).join("")}</ul>`).join("")}</nav>
            <a class="text-action" href="${repository}/blob/main/CHANGELOG.md">Website changelog ${symbol("external")}</a>
          </details>
        </aside>
        <section id="release-archive" aria-labelledby="archive-title">
          <div class="section-heading">
            <h2 id="archive-title">Release archive</h2>
            <p>Dates are shown in IST. Developer docs entries record builds verified live.</p>
          </div>
          <div class="filter-bar" id="release-filters" hidden>
            <div class="filters" role="group" aria-label="Filter releases by channel">
              <button type="button" value="all" aria-pressed="true">All releases</button>
              ${groups.map(group => `<button type="button" value="${group.id}" aria-pressed="false">${group.title}</button>`).join("")}
            </div>
            <span id="release-count" role="status"></span>
          </div>
          ${groups.map(group => `<section class="release-group" data-channel="${group.id}" aria-labelledby="group-${group.id}">
            <div class="group-heading"><h3 id="group-${group.id}">${group.title}</h3><p>${group.description}</p></div>
            <ol>${group.releases.map(releaseCard).join("")}</ol>
          </section>`).join("")}
        </section>
      </div>`,
  });
}

await mkdir(new URL("assets/", output), { recursive: true });
await mkdir(new URL("releases/", output), { recursive: true });
await mkdir(new URL("sdlc/", output), { recursive: true });
const assets = [
  ["site/updates.css", "updates.css"],
  ["site/releases.js", "releases.js"],
  ["vendor/natura/brand/logo-forest.svg", "logo.svg"],
  ["vendor/natura/brand/icon.svg", "icon.svg"],
  ["website/assets/fonts/GoogleSans-Latin.woff2", "GoogleSans.woff2"],
  ["website/assets/fonts/GoogleSans-OFL.txt", "GoogleSans-OFL.txt"],
  ["vendor/natura/fonts/SourceSans3/SourceSans3-Variable.woff2", "SourceSans3.woff2"],
  ["vendor/natura/fonts/SourceSans3/OFL.txt", "SourceSans3-OFL.txt"],
];
await Promise.all(assets.map(async ([source, name]) => {
  const from = new URL(source, root);
  const to = new URL("assets/" + name, output);
  if (name.endsWith(".txt")) {
    await writeFile(to, tidyText(await readFile(from, "utf8")));
  } else {
    await copyFile(from, to);
  }
}));
await writeFile(new URL("index.html", output), tidyText(roadmap()) + "\n");
await writeFile(new URL("releases/index.html", output), tidyText(releaseNotes()) + "\n");
const deliveryPage = page({
  title: "Software delivery lifecycle",
  description: "How Aroha Retreat plans, tests, releases and observes changes to its website and developer tools.",
  current: "sdlc",
  prefix: "../",
  content: await readFile(new URL("site/sdlc.html", root), "utf8"),
});
await writeFile(new URL("sdlc/index.html", output), tidyText(deliveryPage) + "\n");
await writeFile(new URL("release-history.json", output), JSON.stringify(releases, null, 2) + "\n");
await writeFile(new URL(".nojekyll", output), "");
console.log("Built public updates in local/public-updates");
