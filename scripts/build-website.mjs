import {environmentProfile} from "../functions/environment-profile.mjs";
const deploymentEnvironment=environmentProfile(process.env.AROHA_ENVIRONMENT||"production");
import { welcomeMarkup, natureContent } from "../website/nature-render.mjs";
import { tourContent } from "../website/field-render.mjs";
import { build } from "esbuild";
import { PUBLIC_ORIGIN } from "../functions/origins.mjs";
import { renderMap, mapDefaults } from "../website/map-render.mjs";
import { verifyBundledFilms } from "./media-integrity.mjs";
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
  dist = new URL(deploymentEnvironment.preprod ? "dist-preprod/" : "dist/", root),
  assets = new URL("assets/", dist);
await verifyNaturaAssets(root);
await verifyBundledFilms(new URL("website/assets/retreat/", root));
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
// Preserve Natura geometry; browser-specific favicon variants are website derivatives.
const iconSource = await readFile(new URL("vendor/natura/brand/icon.svg", root), "utf8");
await writeFile(new URL("brand/favicon.svg", assets), iconSource.replace(/(<svg[^>]*>)/, '$1<style>path{fill:#163e2d}@media(prefers-color-scheme:dark){path{fill:#fff}}</style>'));
await writeFile(new URL("brand/favicon-light.svg", assets), iconSource);
await writeFile(new URL("brand/favicon-dark.svg", assets), iconSource.replaceAll('#163E2D','#FFFFFF'));
for (const file of [
  "material.css",
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
    studio: new URL("website/studio.mjs", root).pathname,
    booking: new URL("website/booking.mjs", root).pathname,
    "booking-concierge": new URL("website/booking-concierge-entry.mjs", root).pathname,
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
    __AROHA_ENVIRONMENT__: JSON.stringify(deploymentEnvironment.name),
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
// Both environments resolve tags through the same server-owned runtime document.
// Legacy build-time override files are deliberately not inputs to this release.
await writeFile(new URL("runtime-config.json",dist),JSON.stringify({environment:deploymentEnvironment.name,rumScriptUrl:null,runtimeEndpoint:"/api/v1/runtime-config"}));
const rumBoot=await build({stdin:{contents:`import {bootstrapRuntimeRum} from './website/rum-loader.mjs';bootstrapRuntimeRum();`,resolveDir:root.pathname},bundle:true,format:"iife",minify:true,write:false,target:["es2022"],define:{__AROHA_ENVIRONMENT__:JSON.stringify(deploymentEnvironment.name)}});
const rumHead=`<script data-aroha-rum-bootstrap>${rumBoot.outputFiles[0].text}</script>`;
await writeFile(new URL("admin/index.html",dist),(await readFile(new URL("admin/index.html",dist),"utf8")).replace('<meta charset="utf-8" />',`<meta charset="utf-8" />${rumHead}`));
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
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#163e2d"><meta name="description" content="${esc(content.seo.description)}"><link rel="canonical" href="${PUBLIC_ORIGIN}/"><meta property="og:url" content="${PUBLIC_ORIGIN}/"><meta property="og:title" content="${esc(content.seo.title)}"><meta property="og:description" content="${esc(content.seo.description)}"><meta property="og:image" content="${PUBLIC_ORIGIN}${esc(content.hero.image)}"><title>${esc(content.seo.title)}</title>${rumHead}${transitionHead}<script type="module" src="/assets/site.js" blocking="render"></script><link rel="icon" data-brand-favicon href="/assets/brand/favicon.svg" type="image/svg+xml"><link rel="preload" href="/assets/fonts/Lora.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/assets/site.css"><link rel="stylesheet" href="/assets/field.css"><link rel="stylesheet" href="/assets/hrudhi-gate.css"><link rel="stylesheet" href="/assets/living.css"><link rel="stylesheet" href="/assets/arrival.css"><link rel="stylesheet" href="/assets/collections.css"><link rel="stylesheet" href="/assets/footer.css"><link rel="stylesheet" href="/assets/navigation.css"><link rel="stylesheet" href="/assets/sunset.css"><link rel="stylesheet" href="/assets/guest-experience.css"><link rel="stylesheet" href="/assets/hrudhi-guide.css"><link rel="preload" href="/assets/fonts/Allura.woff2" as="font" type="font/woff2" crossorigin></head><body>${welcomeMarkup(content, natureContent(tourContent(content)), esc)}<div id="site">${renderSite(content)}</div><noscript><style>#aroha-welcome{display:none!important}.public-menu-toggle{display:none}.public-header .public-quick-links{display:flex;flex-wrap:wrap}.public-header{height:auto;flex-wrap:wrap}</style><p style="padding:20px">Interactive details require JavaScript. Call <a href="tel:+${content.visit.phone}">+${content.visit.phone}</a> to plan your visit.</p></noscript></body></html>`,
);
await writeFile(new URL("map/index.html", dist), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#163e2d"><title>The Living Map — Aroha Retreat</title>${rumHead}${transitionHead}<script type="module" src="/assets/map.js" blocking="render"></script><meta name="description" content="Explore an illustrated farm route and eleven connected places at Aroha Retreat. Explore real farm films and the stories behind your stay."><link rel="canonical" href="${PUBLIC_ORIGIN}/map/"><meta property="og:url" content="${PUBLIC_ORIGIN}/map/"><meta property="og:title" content="The Living Map — Aroha Retreat"><meta property="og:image" content="${PUBLIC_ORIGIN}/assets/retreat/living-tree-v1.webp"><link rel="icon" data-brand-favicon href="/assets/brand/favicon.svg" type="image/svg+xml"><link rel="preload" href="/assets/fonts/Lora.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/assets/fonts/Allura.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/assets/site.css"><link rel="stylesheet" href="/assets/map.css"><link rel="stylesheet" href="/assets/footer.css"><link rel="stylesheet" href="/assets/navigation.css"><link rel="stylesheet" href="/assets/sunset.css"><link rel="stylesheet" href="/assets/guest-experience.css"><link rel="stylesheet" href="/assets/hrudhi-guide.css"></head><body><div id="living-map">${renderMap(content)}</div><noscript><style>.map-tools,.public-menu-toggle{display:none}.public-header .public-quick-links{display:flex;flex-wrap:wrap}.public-header{height:auto;flex-wrap:wrap}.map-scene{position:relative;height:400px;min-height:0;background:#1c2c1f}.physical-map{opacity:1;visibility:visible}.farm-map-plane{left:50%;width:380px;transform:translate(-50%,-50%)}.tree-camera,.farm-marker{display:none}.map-narrative{margin:0 auto;max-width:850px;width:auto;pointer-events:auto}.map-introduction,.map-chapter,.map-stories-heading,.map-ending{width:auto;max-width:none;margin:0;padding:35px;background:#fffdf8;border:0;box-shadow:none;min-height:0}.map-descent{display:none}</style></noscript></body></html>`);
// Optional public RUM tag is configured independently; no ingestion credential belongs here.
await writeFile(
  new URL("website-release.json", dist),
  JSON.stringify({
    name: "Aroha Retreat",
    version: application.version,
    revision: /^[a-f0-9]{40}$/.test(process.env.AROHA_BUILD_REVISION || "")
      ? process.env.AROHA_BUILD_REVISION
      : null,
    emulators: process.env.AROHA_EMULATORS === "1",
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
console.log(deploymentEnvironment.preprod ? "Built isolated pre-production Aroha frontend." : "Built independent Aroha website and host studio. Compose a pinned Natura export before shared Hosting deployment.");

await writeFile(new URL("sitemap.xml", dist), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${PUBLIC_ORIGIN}/</loc></url><url><loc>${PUBLIC_ORIGIN}/map/</loc></url></urlset>`);

// Reuse the public IST clock without installing public-page transitions or analytics.
const bookingAtmosphereBoot = await build({stdin:{contents:"import {startAtmosphereClock} from './website/atmosphere.mjs';startAtmosphereClock();",resolveDir:root.pathname},bundle:true,format:"iife",minify:true,write:false,target:["es2022"]});
const bookingAtmosphereHead = `<script data-aroha-booking-atmosphere>${bookingAtmosphereBoot.outputFiles[0].text}</script>`;
// Authenticated booking surfaces are distinct documents, with no demo selectors or analytics bootstraps.
for(const route of ['book','admin/bookings']){
 await mkdir(new URL(route+'/',dist),{recursive:true});
 await writeFile(new URL(route+'/index.html',dist),`<!doctype html><html lang="en"><head><meta charset="utf-8">${route==='book'?bookingAtmosphereHead:''}${rumHead}<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#163e2d"><meta name="robots" content="noindex,nofollow"><title>${route==='book'?'Your stay at Aroha':'Bookings · Aroha Host Studio'}</title><link rel="icon" href="/assets/brand/favicon.svg"><link rel="stylesheet" href="/assets/booking.css"><link rel="stylesheet" href="/assets/material.css"><script type="module" src="/assets/booking.js"></script></head><body><a class="skip" href="#main">Skip to content</a><div class="review-banner">Host-approved reservations · Published visit rates · Published exclusive day rate · No online payment</div><div id="app" data-dt-mask><main class="loading">Opening a little space for you…</main></div><div id="toast" role="status" aria-live="polite"></div><dialog id="detail" data-dt-mask></dialog><noscript>Sign-in and booking requests need JavaScript. Please contact your hosts to arrange a visit.</noscript></body></html>`);
}
await copyFile(new URL('website/booking.css',root),new URL('booking.css',assets));
await copyFile(new URL('website/frontdesk.css',root),new URL('frontdesk.css',assets));
await copyFile(new URL('website/host-operations.css',root),new URL('host-operations.css',assets));
await copyFile(new URL('website/stay-panel.css',root),new URL('stay-panel.css',assets));
{
 await copyFile(new URL('website/booking-concierge.css',root),new URL('booking-concierge.css',assets));
 const path=new URL('book/index.html',dist);let html=await readFile(path,'utf8');
 html=html.replace('/assets/booking.css','/assets/booking-concierge.css').replace('/assets/booking.js','/assets/booking-concierge.js').replace('<div id="toast" role="status" aria-live="polite"></div><dialog id="detail" data-dt-mask></dialog>','').replace('<div class="review-banner">Host-approved reservations · Published visit rates · Published exclusive day rate · No online payment</div>','');
 await writeFile(path,html);
}


await copyFile(new URL("website/calendar-leaf.svg",root),new URL("calendar-leaf.svg",assets));

// One authenticated Studio shell; existing module documents remain mounted privately.
await mkdir(new URL('admin/modules/website/',dist),{recursive:true});
await copyFile(new URL('website/admin.html',root),new URL('admin/modules/website/index.html',dist));
await mkdir(new URL('admin/modules/bookings/',dist),{recursive:true});
await copyFile(new URL('admin/bookings/index.html',dist),new URL('admin/modules/bookings/index.html',dist));
await copyFile(new URL('website/studio.html',root),new URL('admin/index.html',dist));
await copyFile(new URL('website/studio.css',root),new URL('studio.css',assets));
await writeFile(new URL('admin/bookings/index.html',dist),'<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Host Studio</title><script>location.replace("/admin/#bookings")</script><a href="/admin/#bookings">Open bookings in Host Studio</a>');

for(const file of ['admin/index.html','admin/modules/website/index.html','admin/modules/bookings/index.html']){
 const p=new URL(file,dist);let html=await readFile(p,'utf8');if(!html.includes('data-aroha-rum-bootstrap'))html=html.replace('</head>',rumHead+'</head>');await writeFile(p,html);
}
if(deploymentEnvironment.preprod){
  const banner='<aside role="status" class="preprod-banner">PRE-PRODUCTION · Test bookings and test emails · No real reservation or payment</aside>';
  for(const file of ['index.html','map/index.html','book/index.html','admin/index.html','admin/modules/website/index.html','admin/modules/bookings/index.html']){
    const p=new URL(file,dist),publicPage=['index.html','map/index.html'].includes(file);
    let html=await readFile(p,'utf8');
    const status=publicPage?'<aside role="status" class="preprod-banner">PRE-PRODUCTION · TEST ONLY · No real reservations</aside>':banner;
    const publicStyle=publicPage?'.preprod-banner{position:fixed;left:0;right:0;bottom:0;padding:6px 16px;font-size:12px;pointer-events:none}':'';
    html=html.replace('</head>','<meta name="robots" content="noindex,nofollow"><style>.preprod-banner{position:relative;z-index:9999;padding:10px 16px;background:#f3d38d;color:#163e2d;text-align:center;font:600 14px/1.4 sans-serif}'+publicStyle+'</style></head>').replace(/(<body[^>]*>)/,'$1'+status);
    await writeFile(p,html);
  }
  await writeFile(new URL('robots.txt',dist),'User-agent: *\nDisallow: /\n');
}
const releaseFile=new URL('website-release.json',dist),release=JSON.parse(await readFile(releaseFile,'utf8'));release.environment=deploymentEnvironment.name;await writeFile(releaseFile,JSON.stringify(release,null,2));
