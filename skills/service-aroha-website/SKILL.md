---
name: service-aroha-website
description: Maintain Aroha Retreat's photographic film tour and host content studio.
---

# Aroha website and host studio

Owner: ArohaRetreat. Source: website/. Entries: site.mjs, admin.mjs, render.mjs; field-render.mjs owns the public layout and map; field-journey.mjs owns native scrolling and playback; field.css owns its design. Earlier spatial/cinematic renderers remain in source for comparison. Build: npm run build:website; standalone website build: npm run build. Website version 0.13.1 is independent of Natura 0.6.1. Read docs/repository-separation.md for ownership and guarded shared Hosting composition. Read [plan](../../docs/website-plan.md), [API](../../docs/api/aroha-v1.md), [observability](../../docs/website-observability.md) and [continuation](continuation.md).

The enquiry-led public website has a photographic film tour and a document fallback, Simple View, cottages, experiences, packages, gallery and practical information. WhatsApp receives a guest-reviewed enquiry; there is no payment, inventory check, room hold or booking confirmation. Preserve Natura identity/fonts and Hrudhi. Do not fabricate property geometry or label an unrelated photograph as a particular room.

Version 1 data is validated by functions/domain.mjs; seed is website/content.json. Escape all text. Bound images to local retreat derivatives or this Firebase Storage bucket. Public clients read only aroha_public/site. The build seed supplies first render and fallback; live client metadata updates from Firestore, but pre-rendered social previews follow the build seed.

The studio uses session-scoped Google sign-in and API-enforced membership. Super-admin/admin publishes, editor saves drafts/uploads media, viewer reads. Structured controls cover content, photographs, section order/visibility, theme and motion, excluding executable code. Saves use expected versions; conflicts preserve work for backup. Preview validates sender/origin. Publishing is explicit; restore creates a draft. Uploaded media is immediately public and immutable, disclosed before upload.

Edited masters remain outside this public repository. Edited WebP derivatives and silent SDR web film editions ship. Desktop/mobile hero images are separate settings. The photographic palm cutout remains excluded; the new foreground palm illustration has transparent source artwork. See [photography](../../docs/website-photography.md).

Run npm run test:website, npm test, emulator integration, OTLP tests and browser review. AROHA_EMULATORS=1 builds local-only synthetic sign-in controls; production bundles must omit those controls. Emulator and iframe checks do not certify real Google OAuth or physical devices.

Firebase routes: /, /admin/, /api/v1 and preserved /design/. Shared releases must contain both sites; compose-hosting.mjs consumes the pinned Natura export and deploy-website.mjs verifies its full file manifest. Hosting rollback and content-history restore are separate operations. Never automatically roll back memberships or delete immutable media. Public RUM requires an approved script and consent; privileged tokens and enquiry details never enter frontend telemetry.

Read [spatial direction](../../docs/website-spatial-direction.md) before changing the camera or scene. No scroll interception. Preserve native vertical touch scrolling, scene disposal on replacement, pause on modal/hidden/offscreen, section position when toggling views, and a readable fallback after context loss. Scene graphics are interpretations, never a surveyed map or authentic room interior.

Current public entry uses field-render.mjs / field-journey.mjs / field.css and the optional validated tour contract. Read [film direction](../../docs/website-film-direction.md). Preserve all supplied photo/video journal coverage and native playback/motion fallbacks. See continuation for the production schema/rule prerequisite.

The living layer uses nature-render.mjs, botanical-motion.mjs, welcome.mjs and living.css. Read docs/website-living-direction.md before editing. The sprout is Natura’s shared germination drawing; generated botanical art is decorative and never a claimed exact farm specimen. Preserve bounded welcome cleanup, native reversible panel motion, fixed reading controls, deferred image sources and a single active film.

Revision 0.7 layers arrival.css over the public styling and hero-atmosphere.mjs over the hero. Keep the original germination player alive until the leaf aperture finishes. Calligraphy uses Natura’s local Allura only for short Latin invitations; never controls/body/Kannada. Evening photography is a guest-triggered editorial state, loaded on selection and guarded against stale decoding. Read the continuous-arrival section of the living direction before changing startup.

The compact gallery uses album.mjs and collections.css. Preserve all media, filter-scoped viewer navigation, five-entry paging, state retention and original-target focus restoration after CMS repaints. The same stylesheet owns the pricing card surfaces/subgrid; do not alter tariffs to style cards.

Guest live content uses firebase-public.mjs / firebase-app.mjs. Admin-only firebase.mjs initialises session-only Auth and Storage. Preserve this module boundary and the build graph check; do not make login wait for a persistence migration. Startup must distinguish Google completion, access verification and draft loading. Read release-evidence/aroha-0.8.3 for current deployment and measured limits.

Living Map entry: map.mjs, renderer map-render.mjs, navigation math map-state.mjs, map.css. Read docs/website-map-direction.md. Keep the scene camera separate from reading text, pause/dispose films and observers, preserve direct place fragments/history, legacy content fallback, phone chapter controls and no-JS/Reading View. storyMap CMS references existing tour IDs; its optional API validation requires tour. Do not load map art/controller on the homepage.

Map card connections use the existing scroll RAF and timelineProgress; animate only the line transform, keep geometry outside card clipping, and retain static connections in Reading View/reduced motion. The forest backdrop and opaque white leaf-watermarked cards apply at every breakpoint.

Shared public chrome: public-pages.mjs owns the page registry; navigation.mjs/navigation.css owns, native full-screen botanical menu and bounded motion; footer.mjs/footer.css owns the photographic footer; guest-dialogs.mjs owns enquiry/privacy dialog bodies. Read docs/website-navigation.md before adding routes. Preserve focus return, delayed menu-to-enquiry handoff, deferred CMS repaint, background media pausing and reduced/disabled motion. Register only existing pages; CMS-hidden home sections must not appear. Keep map art out of the homepage dependency graph.

Page transitions: page-transitions.mjs is bundled into a small classic head script so pagereveal runs before painting. page-transitions.css opts public documents into native cross-document transitions only; admin/design remain independent. Do not replace native links with a fetch router or add an artificial navigation delay. Keep bounded exact-destination arrival markers, optional storage, no-repeat internal welcome, motion fallbacks and interruption. Read the transition section of docs/website-navigation.md.

Sunset atmosphere: atmosphere.mjs owns the validated guest preference and shared event, restored by the classic head bootstrap before paint. sunset.css scopes forest-dark public surfaces to html[data-atmosphere=sunset]; it is not loaded by admin/design. Hero and menu controls share this state. Evening photo failure retains the chosen colours while announcing a photographic fallback; preserve decode races and unsubscribe on disposal. Do not recolour/filter original photographs or replace CMS brand tokens. New palette foreground/background pairs are checked for AA contrast.

Production delivery is observed by the separately registered delivery-observability module. Read docs/delivery-observability.md and its service skill before changing scripts/deploy-website.mjs, source test reporters or the trusted workflow. A successful Hosting release, live verification and telemetry acceptance are distinct states; never repeat deployment just to repair telemetry. Local production requires installed functions dependencies and explicit FIREBASE_CLI_PATH. Preview channel behavior remains separate.

Hrudhi welcome (0.13.0): hrudhi-gate.mjs and hrudhi-gate.css own the gate overlay inside Explore and introduction. Preserve one queued seek, disposal/dialog/visibility guards, automatic static no-video fallbacks and stationary controls. Optional CMS fields require API 0.2.1. Read the Hrudhi section of docs/website-living-direction.md.

Gate 0.13.1 must release hidden/inert state at an explicit completed progress boundary, rather than comparing a derived floating-point fade to one. Preserve gate-phase and tour offset when resizing.
