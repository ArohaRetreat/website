import { welcomeMarkup, natureContent } from "../website/nature-render.mjs";
import { tourContent } from "../website/field-render.mjs";
import { build } from "esbuild";
import { PUBLIC_ORIGIN } from "../functions/origins.mjs";
import { renderMap, mapDefaults } from "../website/map-render.mjs";
import { verifyNaturaAssets } from "./natura-assets.mjs";
import { mkdir, cp, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { renderSite, esc } from "../website/render.mjs";
import {
  validateContent,
  validateTour,
  validateNature,
  validateStoryMap,
} from "../functions/domain.mjs";
const root = new URL("../", import.meta.url),
  dist = new URL("dist/", root),
  assets = new URL("assets/", dist);
await verifyNaturaAssets(root);
const application = JSON.parse(await readFile(new URL("package.json", root)));
await rm(dist, { recursive: true, force: true });
await mkdir(assets, { recursive: true });
await mkdir(new URL("admin/", dist), { recursive: true });
const content = validateContent(
  JSON.parse(await readFile(new URL("website/content.json", root), "utf8")),
);
validateTour(
  JSON.parse(
    await readFile(new URL("website/tour-content.json", root), "utf8"),
  ),
);
validateNature(natureContent(tourContent(content)));
validateStoryMap(mapDefaults, tourContent(content));
await mkdir(new URL("map/", dist), { recursive: true });
await cp(new URL("website/assets/", root), assets, { recursive: true });
await mkdir(new URL("brand/", assets), { recursive: true });
await mkdir(new URL("fonts/", assets), { recursive: true });
for (const [source, target] of [
  [
    "vendor/natura/brand/logo-white.svg",
    "brand/logo-white.svg",
  ],
  [
    "vendor/natura/brand/logo-forest.svg",
    "brand/logo-forest.svg",
  ],
  ["vendor/natura/brand/icon.svg", "brand/icon.svg"],
  ["vendor/natura/fonts/Lora/Lora-Variable.woff2", "fonts/Lora.woff2"],
  ["vendor/natura/fonts/Allura/Allura-Regular.woff2", "fonts/Allura.woff2"],
  ["vendor/natura/fonts/Allura/OFL.txt", "fonts/Allura-OFL.txt"],
  ["vendor/natura/fonts/Lora/OFL.txt", "fonts/Lora-OFL.txt"],
  ["vendor/natura/fonts/SourceSans3/OFL.txt", "fonts/Source-OFL.txt"],
  ["vendor/natura/fonts/NotoSansKannada/OFL.txt", "fonts/Kannada-OFL.txt"],
  [
    "vendor/natura/fonts/SourceSans3/SourceSans3-Variable.woff2",
    "fonts/Source.woff2",
  ],
  [
    "vendor/natura/fonts/NotoSansKannada/NotoSansKannada-Variable.woff2",
    "fonts/Kannada.woff2",
  ],
])
  await copyFile(new URL(source, root), new URL(target, assets));
for (const file of [
  "site.css",
  "admin.css",
  "field.css",
  "hrudhi-gate.css",
  "guest-experience.css",
  "hrudhi-guide.css",
  "living.css",
  "arrival.css",
  "collections.css",
  "map.css",
  "footer.css",
  "navigation.css",
  "page-transitions.css",
  "sunset.css",
])
  await copyFile(new URL("website/" + file, root), new URL(file, assets));
await copyFile(
  new URL("website/admin.html", root),
  new URL("admin/index.html", dist),
);
// This directory is owned by the website bundler; retire stale hashed chunks.
await rm(new URL("chunks/", assets), { recursive: true, force: true });
const bundle = await build({
  entryPoints: {
    site: new URL("website/site.mjs", root).pathname,
    admin: new URL("website/admin.mjs", root).pathname,
    map: new URL("website/map.mjs", root).pathname,
  },
  bundle: true,
  format: "esm",
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  outdir: assets.pathname,
  minify: true,
  metafile: true,
  target: ["es2022"],
  legalComments: "eof",
  define: {
    __AROHA_EMULATORS__: process.env.AROHA_EMULATORS === "1" ? "true" : "false",
  },
});
// Guests need a public Firestore read, never the admin Auth/Storage implementations.
const outputs = bundle.metafile.outputs;
const publicEntry = Object.keys(outputs).find((name) => outputs[name].entryPoint?.endsWith("website/firebase-public.mjs"));
if (!publicEntry) throw Error("Public Firebase entry missing from the build graph.");
const visited = new Set();
function visit(name) {
  if (visited.has(name) || !outputs[name]) return;
  visited.add(name);
  for (const dependency of outputs[name].imports) if (!dependency.external) visit(dependency.path);
}
visit(publicEntry);
const guestInputs = [...new Set([...visited].flatMap((name) => Object.keys(outputs[name].inputs)))];
if (guestInputs.some((name) => /node_modules\/@firebase\/(auth|storage)\//.test(name)))
  throw Error("Admin Auth/Storage leaked into the guest Firebase bundle.");
const guestBytes=[...visited].reduce((n,name)=>n+outputs[name].bytes,0);
const homeEntry=Object.keys(outputs).find(name=>outputs[name].entryPoint?.endsWith('website/site.mjs'));
visited.clear();visit(homeEntry);
const homeInputs=[...visited].flatMap(name=>Object.keys(outputs[name].inputs));
if(homeInputs.some(name=>/website\/map(?:[.-])/.test(name)))throw Error('Living Map code or artwork content leaked into the homepage.');
const authEntry = Object.keys(outputs).find(name=>outputs[name].entryPoint?.endsWith("website/firebase-auth.mjs"));
if(!authEntry)throw Error("Guest Auth lazy entry missing.");
visited.clear();visit(authEntry);
const authInputs=[...visited].flatMap(name=>Object.keys(outputs[name].inputs));
if(authInputs.some(name=>/node_modules\/@firebase\/storage\//.test(name)||name.endsWith("website/firebase.mjs")))throw Error("Admin API/Storage leaked into guest sign-in.");
const authBytes=[...visited].reduce((n,name)=>n+outputs[name].bytes,0);
await mkdir(new URL("local/", root), { recursive: true });
await writeFile(new URL("local/guest-bundle-analysis.json", root), JSON.stringify({
  entry: publicEntry, bytes: guestBytes,
  adminAuthStorageExcluded: true,
  guestAuth: {entry:authEntry, bytes:authBytes, lazy:true, adminApiStorageExcluded:true},
}, null, 2));
const transitionBoot = await build({
  stdin: {
    contents: `import {installPageTransitions} from './website/page-transitions.mjs';installPageTransitions(${JSON.stringify(content.theme.motion)});`,
    resolveDir: root.pathname,
  },
  bundle: true, format: "iife", minify: true, write: false, target: ["es2022"],
});
const transitionHead = `<link rel="stylesheet" href="/assets/page-transitions.css"><script>${transitionBoot.outputFiles[0].text}</script>`;
await writeFile(
  new URL("index.html", dist),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="${content.theme.forest}"><meta name="description" content="${esc(content.seo.description)}"><link rel="canonical" href="${PUBLIC_ORIGIN}/"><meta property="og:url" content="${PUBLIC_ORIGIN}/"><meta property="og:title" content="${esc(content.seo.title)}"><meta property="og:description" content="${esc(content.seo.description)}"><meta property="og:image" content="${PUBLIC_ORIGIN}${esc(content.hero.image)}"><title>${esc(content.seo.title)}</title>${transitionHead}<script type="module" src="/assets/site.js" blocking="render"></script><link rel="icon" href="/assets/brand/icon.svg" type="image/svg+xml"><link rel="preload" href="/assets/fonts/Lora.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/assets/site.css"><link rel="stylesheet" href="/assets/field.css"><link rel="stylesheet" href="/assets/hrudhi-gate.css"><link rel="stylesheet" href="/assets/living.css"><link rel="stylesheet" href="/assets/arrival.css"><link rel="stylesheet" href="/assets/collections.css"><link rel="stylesheet" href="/assets/footer.css"><link rel="stylesheet" href="/assets/navigation.css"><link rel="stylesheet" href="/assets/sunset.css"><link rel="stylesheet" href="/assets/guest-experience.css"><link rel="stylesheet" href="/assets/hrudhi-guide.css"><link rel="preload" href="/assets/fonts/Allura.woff2" as="font" type="font/woff2" crossorigin></head><body>${welcomeMarkup(content, natureContent(tourContent(content)), esc)}<div id="site">${renderSite(content)}</div><noscript><style>#aroha-welcome{display:none!important}.public-menu-toggle{display:none}.public-header .public-quick-links{display:flex;flex-wrap:wrap}.public-header{height:auto;flex-wrap:wrap}</style><p style="padding:20px">Interactive details require JavaScript. Call <a href="tel:+${content.visit.phone}">+${content.visit.phone}</a> to plan your visit.</p></noscript></body></html>`,
);
await writeFile(new URL("map/index.html", dist), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#1c2c1f"><title>The Living Map — Aroha Retreat</title>${transitionHead}<script type="module" src="/assets/map.js" blocking="render"></script><meta name="description" content="Explore an illustrated farm route and eleven connected places at Aroha Retreat. Explore real farm films and the stories behind your stay."><link rel="canonical" href="${PUBLIC_ORIGIN}/map/"><meta property="og:url" content="${PUBLIC_ORIGIN}/map/"><meta property="og:title" content="The Living Map — Aroha Retreat"><meta property="og:image" content="${PUBLIC_ORIGIN}/assets/retreat/living-tree-v1.webp"><link rel="icon" href="/assets/brand/icon.svg" type="image/svg+xml"><link rel="preload" href="/assets/fonts/Lora.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/assets/fonts/Allura.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/assets/site.css"><link rel="stylesheet" href="/assets/map.css"><link rel="stylesheet" href="/assets/footer.css"><link rel="stylesheet" href="/assets/navigation.css"><link rel="stylesheet" href="/assets/sunset.css"><link rel="stylesheet" href="/assets/guest-experience.css"><link rel="stylesheet" href="/assets/hrudhi-guide.css"></head><body><div id="living-map">${renderMap(content)}</div><noscript><style>.map-tools,.public-menu-toggle{display:none}.public-header .public-quick-links{display:flex;flex-wrap:wrap}.public-header{height:auto;flex-wrap:wrap}.map-scene{position:relative;height:400px;min-height:0;background:#1c2c1f}.physical-map{opacity:1;visibility:visible}.farm-map-plane{left:50%;width:380px;transform:translate(-50%,-50%)}.tree-camera,.farm-marker{display:none}.map-narrative{margin:0 auto;max-width:850px;width:auto;pointer-events:auto}.map-introduction,.map-chapter,.map-stories-heading,.map-ending{width:auto;max-width:none;margin:0;padding:35px;background:#fffdf8;border:0;box-shadow:none;min-height:0}.map-descent{display:none}</style></noscript></body></html>`);
// Optional public RUM tag is configured independently; no ingestion credential belongs here.
let runtime = JSON.parse(
  await readFile(new URL("config/website-runtime.public.json", root), "utf8"),
);
try {
  runtime = JSON.parse(
    await readFile(new URL("config/website-runtime.json", root), "utf8"),
  );
} catch {}
await writeFile(new URL("runtime-config.json", dist), JSON.stringify(runtime));
await writeFile(
  new URL("website-release.json", dist),
  JSON.stringify({
    name: "Aroha Retreat",
    version: application.version,
    revision: /^[a-f0-9]{40}$/.test(process.env.AROHA_BUILD_REVISION || "")
      ? process.env.AROHA_BUILD_REVISION
      : null,
    contentSchema: 1,
    admin: "/admin/",
    design: "/design/",
    map: "/map/",
  }),
);
await writeFile(
  new URL("robots.txt", dist),
  `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${PUBLIC_ORIGIN}/sitemap.xml\n`,
);
console.log("Built independent Aroha website and host studio. Compose a pinned Natura export before shared Hosting deployment.");

await writeFile(new URL("sitemap.xml", dist), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${PUBLIC_ORIGIN}/</loc></url><url><loc>${PUBLIC_ORIGIN}/map/</loc></url></urlset>`);
