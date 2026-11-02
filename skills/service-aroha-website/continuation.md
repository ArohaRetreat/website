# Farm media and place photo variants — 0.16.0 / API0.3.0

Issue41. Album Farm experience filter is based on stop=farm and shares page/viewer state with existing photo/film filters. Twelve additional unique media entries include nine photographs and three silent films; higher-resolution originals replace duplicate exports. Meditation interior p-dsc-3815 is removed from public selection, while original files/history are retained. Library uses a labelled generated artistic impression, dining the existing DSC_3779 night photograph, meditation day stays intact with an optional supplied night image.

place-photos.mjs owns day/evening selection, deferred orbit sources, image-error fallback, caption/note updates and listener disposal. Field journey, orbit panels, reduced-motion document, place details and Living Map use the same variants. Tour stops accept optional eveningImage/eveningImageAlt; API must be upgraded before CMS publication. scripts/content/farm-media-refresh.mjs creates an idempotent narrow patch preserving owner text and unrelated content. Export the current host draft, patch that backup, then import/save/publish through existing version-checked administration; never overwrite host changes with the build seed. Current source/CI/browser/API/Hosting/content-version evidence belongs to the issue/release receipt.

Hrudhi narration remains parked. Pool generation uses Downloads clips timestamped18.09.14 and18.09.16 as geometry references and is explicitly labelled as a completion impression. Natura consumer remains0.6.1; generated master stays in Natura review assets and only the WebP derivative is bundled.

# Directional guide, account menu and browser monitoring — 0.15.0

Issue #39. guide-walking.mjs owns the distance-driven four-view stride; homepage phones follow native journey progress, map guide follows sampled connected paths and the phone camera tracks her current position. Hidden/offscreen/dialog pauses do not advance the clock. The bundled legacy sheet upgrades to the four-row derivative while host-selected custom eight-frame sheets remain supported. Source master belongs to Natura review assets; new voiced Arrival export is review-only and is not bundled.

Guest account headers show the bounded escaped display name with generic telemetry action labels; native leaf popover owns outside click/Escape and links to existing account/sign-out. Session-scoped Firebase Google Auth and host authorization stay unchanged. Inline first-visit consent never covers story media. Independent Dynatrace and Google preferences remain optional. Saved Dynatrace consent boots the exact approved public script before app modules; Firebase Auth updates dynatrace.identifyUser with a firebase:UID identifier, Classic fallback and bounded readiness retry. Logout/withdrawal clears identity; pagehide only suspends retries. No raw email/name is assigned as a telemetry identifier. New RUM sendEvent fallback uses bounded event_properties fields.

Local tests/build and browser review are recorded in the current PR; use actual release receipts for deployment and tenant evidence. API0.2.2 and Natura0.6.1 pins unchanged. Finalized RUM sessions, new user.events records, GA dashboard ingestion and native RUM-to-backend linkage are separate gates. See docs/website-observability.md and docs/website-guest-experience.md.

# Mobile story and Hrudhi details — 0.14.4

Issue #37: homepage guide clicks invoke openTourStop with journey.index, the same details renderer as Discover; gate introduction remains before entry. Phone tour uses explicit grid rows for media/reading/navigation/guide rather than overlapping absolute reading layers. Small-height variants retain reachable controls and full details in the dialog. Desktop orbit and map guide are unchanged. docs/hrudhi-narrated-guide-plan.md proposes a separate narrated sample; no narration is silently published. API0.2.2/Natura0.6.1 unchanged.

# Map guide clearance — 0.14.3

Issue #34 final phone review found the arrival label obscured the resting character. guideDestination now chooses a sampled path point clear of all current marker bounds plus the full character silhouette, using current map dimensions. Route travel and reduced-motion destinations share this clearance. No API/Natura changes.

# Hrudhi on the map — 0.14.2

Issue #34 replaces the map bottom rail with map-hrudhi.mjs and map-guide-route.mjs. The guide is decorative inside farm-map-plane and follows samples of the drawn main/side paths. New stop selection interrupts from the current rendered position; percentage transforms scale with the map. Dialogs, hidden/offscreen and reduced motion pause/settle safely; disposal removes all effects/listeners. No map Meet Hrudhi button or character hotspot. Homepage introduction/guide remain. API 0.2.2 and Natura 0.6.1 unchanged; current PR/release receipt owns deployment evidence.

# Mobile gate repair — 0.14.1

Issue #31: 0.14.0 mobile-v2 MP4 was overwritten by metadata JSON in a one-off export script. Re-encode from the original 24fps source without optical-flow blending; validate all bundled films before dist generation and test manifest sizes/hashes. Hash matching alone did not establish valid media playback. API 0.2.2 and Natura 0.6.1 remain unchanged. Current PR/release receipts establish deployment status.

# Transition refinement — 0.12.1 preparation

Issue #25 addresses the too-fast menu and page reveal. `menu-motion.mjs` owns finite reversible menu effects and interruption/disposal; navigation.mjs retains native modal focus and menu-to-fragment/enquiry handoff. Shared tokens pace menu/content/route scenes; native discrete CSS adds details-dialog transitions and gallery changes settle over 420 ms. Reduced/static/keyboard alternatives are preserved. Read docs/website-navigation.md. Current source/CI/preview/deployment evidence belongs to issue #25; this preparation note is not a production claim. API 0.2.0, Natura 0.6.1 and verified delivery reporting remain unchanged.

# Delivery observability — 0.12.0 verified

Production https://aroharetreat.com runs source 872393140f98c45af2f2e14d39dccfef2680ed30 (PR #23), Hosting 48c08d6816bf20f6, released 2026-11-01T22:32:56.521Z. Live verifier matched 22 files and draft denial 401. Main CI and both automatic observer workflows passed; delivery BizEvents, logs, traces, metrics and native deployment marker are tenant-searchable. Read the delivery-observability continuation and issue #22 for exact run/deployment identities. API 0.2.0, Natura 0.6.1, CMS and website design are unchanged. Native RUM linkage and host/device acceptance remain separate. Documentation-only follow-ups do not change the deployed revision.

# Persistent sunset atmosphere — 0.11.0

Issue #20 makes the existing After sunset choice affect both public pages. atmosphere.mjs restores an explicit day/evening preference before paint via the transition bootstrap; the menu provides a reversible control from either page. sunset.css styles dark pricing/gallery/map/dialog surfaces with warm ivory text, subdued borders, retained leaf motifs and gold actions. The real evening hero photo restores on render; failure keeps sunset colours and a labelled day-photo fallback. Shared event listeners and decode requests are disposed safely. Theme is local to the visitor, not a CMS change; admin/design/API are unchanged. Tests include palette contrast, preference normalization, restore/synchronization and image-failure behavior. Read issue #20/current PR and local release receipts for actual CI/deployment/browser state; physical-device and native RUM linkage are not implied.

# Public page transitions — 0.10.1

Issue #18 connects the public documents through native cross-document snapshots and a 500 ms leaf aperture. Page registry moved to public-pages.mjs (re-exported by navigation.mjs). A tiny classic head script registers pagereveal/pageswap before paint; pointer/keyboard interruption cancels active reveals, and keyboard/Reading/Simple/disabled/reduced motion skip them. Exact-destination session markers expire after 15 seconds; same-origin public referrer is a storage-denied welcome fallback. Menu stays in outgoing snapshot; restored renderers close stale modals. Initial direct arrivals preserve the sprout welcome, internal arrivals bypass it. No router, network fetch interception, overlay delay, schema/API or Natura changes. See issue/PR receipts for actual release state; responsive desktop review is not physical-device certification.

# Shared public navigation and footer — 0.10.0

Issue #14 adds the shared forest menu, real palm frond, leaf reveal and bounded falling-drop/ripple animation to `/` and `/map/`. PUBLIC_PAGES in navigation.mjs is the route registry; section links respect CMS visibility. Native dialogs own modal focus/Escape; both controllers defer CMS replacement while any dialog is open, pause background films, and apply pending content on close. Shared guest-dialogs.mjs retains enquiry validation, guest-reviewed WhatsApp preparation and consent controls. The map footer now uses the identical photographic home footer and hides floating map controls when it is visible. See docs/website-navigation.md.

Prepared checks: 60 application tests and website build pass. Desktop Chrome review covers Escape/focus, menu enquiry handoff and footer privacy; responsive review uses 320/390 iframe viewports, not physical devices. API 0.2.0 and Natura 0.6.1 remain unchanged. Read issue #14 and current PR/release receipts for the actual merge/deployment state; this source note does not certify publication, physical devices or native RUM linkage.

# Map forest canvas and timeline — 0.9.2

Issue #4 follow-up: continuous forest-green background, white explanation cards with pricing-style faint leaf/vein motifs, and five scroll-driven connections between the story heading, four chapter cards and closing card. Native scrolling controls reversible line scale; reading/reduced/disabled-motion use a steady connection. The physical route and API0.2.0 are unchanged. Deployment/version evidence is recorded in issue #4 and local release receipts; this source note alone is not deployment proof.

# Living Map implementation — 0.9.0 / API 0.2.0

Issue #4. Read docs/website-map-direction.md. The separate map uses map-render.mjs/map.mjs/map-state.mjs/map.css and an optional validated storyMap object. The studio materializes legacy fallback stories privately and previews /map/?preview=1. Deploy API before Hosting; preserve stored content and existing roles. Current verification/deployment is recorded in the issue and release evidence; this preparation note is not deployment proof.

# Aroha website continuation

## Verified current deployment

Website 0.8.3 is live at https://aroharetreat.com from 9b4ca2f9cec559369e5db095cb1d4f91eeaff208, Hosting 71855ca361752379. API 0.1.1 is ACTIVE as arohaapi-00003-yah with its existing owner/secret configuration. Real owner sign-in/draft read and backend log/span/metric searchability are verified; publication/restore/uploads and native RUM linkage remain separate. Natura 0.6.1 profile downloads are retained. Read release-evidence/aroha-0.8.3 and issues #5/#8. Living Map #4 is next in milestone 0.9.0; it is not implemented in this release.


## Startup performance follow-up (0.8.3)

Issue #8 follows the real production owner sign-in. Guest Firestore uses firebase-public.mjs / firebase-app.mjs and never imports admin Auth/Storage; build-website.mjs enforces this graph boundary. Admin Auth is initialised directly with browserSessionPersistence and its popup resolver. Preserve session-only behavior and distinct access/draft loading stages. Backend/API remains 0.1.1; user-observed Google/device/network delay is not certified fixed solely by source changes.


## Custom-domain production release

Website 0.8.2 / API 0.1.1 is prepared for issue #5: exact canonical API origin, canonical invite/SEO URLs, current optional content validation/video rules and guarded shared Hosting. Preserve the existing owner configuration and Secret Manager binding. Verify deployment facts from the issue/release evidence; this preparation note does not certify deployment. Living Map issue #4 is the separate next enhancement.


## Current repository ownership

Source now lives in ArohaRetreat/website. Import issue #1; remaining acceptance issue #2. Historical references to issue #16 and PR #17 below refer to ArohaRetreat/natura, where tracking is superseded by the repository separation. Read docs/repository-separation.md. Website build is independent; shared Hosting requires an explicit pinned Natura export and deployment guard. No deployment is part of this source move. Existing production secrets/owner settings remain outside this repo.

## Historical implementation and deployment record

Issue #16; branch feat/aroha-website-admin. Aroha website 0.1.0 is deployed at / with the host studio at /admin/, preserving Natura /design/. Ten owner photographs were edited through Adobe tools at full resolution before resuming integration. Masters/provenance remain outside the public repository in Photo-Production; edited WebP derivatives and dedicated hero crops ship. The palm cutout is excluded because its edge fringe is not accepted; desktop Photoshop was unresponsive during attempted manual refinement.

Prepared structured content/media/theme/section editing, session-scoped Google sign-in, API-enforced roles, copyable invitations, private preview, versioned save/publish/history restore and WhatsApp enquiry. Local emulator browser checks verified save/reload/preview/publication and invitation creation with synthetic identities. Responsive iframe checks at nominal 320/390 px showed no horizontal overflow; they are not physical-device certification. Actual Google provider enabled state and Blaze activation were verified read-only.

Latest unit, integrated rules/API, OTLP, complete build, foundation, GitHub CI/PR and deployment evidence must be read from issue #16 and release-evidence rather than inferred from prepared code. Deployment is verified for code revision 3088054b04f52dc59d1271c6dcff8281a06eda90; PR #17 remains open and actual owner OAuth is not yet accepted. Server monitoring is active and searchable for the final backend revision. Keep the public RUM tag, accurately matched room interiors, real gate/route references and physical-device acceptance explicit. See docs/website-plan.md for design/operational scope and docs/website-observability.md for unconfigured signal delivery stages.

Current release evidence: release-evidence/aroha-0.1.0/release.md. Root/admin/design live routes and thirty file hashes verified; fresh browser showed no errors or warnings.

Owner supplied the public RUM tag; config/website-runtime.public.json is the versioned default. Both public and studio initialize the consent-controlled loader; duplicate/racing loads are guarded. 64 application tests pass including consent, duplicate insertion and withdrawal-during-fetch. Shared Hosting build/deployment must be repeated from this committed revision; browser and tenant evidence is reported in issue #16.

## Cinematic revision 0.2.0

The initial photographic brochure did not meet the owner's visual acceptance. The public site is rebuilt around a reversible 3D threshold, native scroll-driven camera movement, a morning/evening photographic switch, explicit chapter navigation and route progress, an arched horizontal cottage collection with door hover, native experience disclosures and layered parallax memory cards. Existing schema 1 content and protected CMS/API are retained. cinematic.mjs writes transform/opacity in the existing scroll RAF and disconnects reveal observers on replacement. Simple View and reduced motion bypass spatial movement. The threshold and route ornament are artistic narrative elements, not a surveyed gate or property map.

Browser review covers entry open, chapter controls, morning/evening, mobile layouts at nominal 320/390 widths, cottage dialogs, Simple View and gallery. Source review fixed hidden-journey handling and keeps first/last chapter text readable. No physical-device FPS claim. The approved RUM tag was separately verified absent before consent, inserted after opt-in and absent again after withdrawal/reload. Beacon/session/backend linkage remains unverified. Read issue #16 / PR #17 for the final deployed revision and current-head checks.

## Illustrated revision 0.3.0

The photographic cinematic direction also failed visual acceptance. The new implementation uses six original generated transparent illustrations, interactive farm destinations, morning/evening world lighting, four scroll chapters, illustrated cottage/farm/stillness scenes, and a visit ledger alongside actual photographs. See docs/website-art-direction.md for prompt briefs and provenance. Hero worldImage/eveningImage/foregroundImage are optional validated CMS fields; existing schema 1 records remain supported. Simple View preserves the current section and hotspots navigate its static articles.

65 application tests and the shared build pass; current-head GitHub application, foundation and emulator integration checks pass on 60725fd. Public visual direction is delivered through a separate preview, with production unchanged. The extended API schema must reach production before publishing new optional illustration settings through the studio. Generated masters are separate from the public derivatives. No surveyed layout, actual room interior, physical-device performance or full RUM linkage is implied.

## Connected spatial revision 0.4.0

The 0.3 static illustration concept also failed visual acceptance. The new implementation uses one lazy-loaded Three.js world with actual gate hinges, camera travel, pond reflection, cottage door/photo detail, meditation and orchard destinations, day/evening lighting and a final aerial view. Scrolling remains native. Static geometry is merged; grass/crowns are instanced. Generated palm crowns are alpha vegetation textures within the 3D scene, not pre-rendered scene panels. The readable document remains available through Simple View/reduced motion and WebGL failure/context loss. New tests cover reversible camera movement, gate timing, terrain clearance, finite/bounded geometry and resource disposal.

Reference interaction study was repeated in native Chrome on 1 November: Overworld entry/scroll/Studio, Unbelievably Crap multiple scroll states, Mirage entry/project selector/reverse, BLUNT film/editorial/product scene. See docs/website-spatial-direction.md and current 0.4 evidence for actual verification/deployment. Neither visual acceptance nor physical-device performance follows from test counts. No source merge or production promotion is authorized by the revision itself.

## Real-film revision 0.5 (1 November)

The owner rejected 0.4 craft and supplied the farm's actual relationships. Current public entry uses field-render.mjs, field-journey.mjs, field.css and tour-content.json; site.mjs preserves the validated enquiry, native modal/focus and consent flows. Procedural 3D is no longer the public entry, although its source/tests remain. Read docs/website-film-direction.md before editing. There are 11 destination views and all 35 photos/21 silent SDR web films in the journal. Tree-house stairs/door/interior/return sequence uses actual footage. Kitchen/library/pool positions come from the host; their contextual images are labelled accurately. No seamless 3D, compass bearing or surveyed scale claim.

The studio attaches optional tour data to older schema 1 drafts and supports typed, immutable video uploads under 40 MiB. The additive API/schema/rules require production rollout before those new fields can be published; preview Hosting does not do that. Local isolated integration tests cover the expanded content and video write permissions. Do not copy synthetic functions/.env.local into production. Recovery checkout remains Documents/Codex/aroha-art-review; external canonical checkout was not reset. Edited masters/provenance remain in Aroha-Media-Production outside the public repo. Consult current release evidence and PR head for final checks/deployment, not these preparation notes.

## Living motion revision 0.6 (1 November)

The owner accepted the film direction as better but requested the reference’s revolving motion and more nature craft. Studio Mirage’s live welcome/orbit was rechecked in Chrome: an opening orb transitions to concave project panels; wheel input revolves the panels. Aroha now revolves its actual farm photos with native scrolling, rather than copying Mirage’s assets, WebGL implementation or scroll interception. Current additions are living.css, nature-render.mjs, botanical-motion.mjs and welcome.mjs. Natura’s original seed germination plays once per document entry at 1.9x with Skip, 3.2-second fail-open and reduced-motion/Simple View bypass. Leaf/hero transforms share the existing requested RAF; CSS fronds and entrance animations pause for dialogs/hidden tabs and are disposed on replacement.

Two generated transparent botanical assets have external PNG masters under Aroha-Art-Production; only WebP derivatives ship. The leaf layers, shaped hero photo and rooted plant with revolving real-photo petals are documented in docs/website-living-direction.md. Optional tour.nature is validated and attached by the studio to old drafts, preserving schema 1. Its backend support is still a production prerequisite. First-paint and welcome copy use the build seed, as with existing social metadata; live content replaces the public page after Firebase loads. Do not imply first-paint content is server-rendered from the latest Firestore record.

Current checks, preview manifest/revision and visual captures belong in release-evidence/aroha-0.6.0 and PR #17. Do not infer visual acceptance or production rollout from local test success. Recovery checkout remains Documents/Codex/aroha-art-review; no canonical external dirty work was reset.

## Continuous arrival revision 0.7 (1 November)

The owner requested one continuous sprout-to-site reveal and a stronger hero with Natura calligraphy. welcome.mjs now holds the completed sprout while a growing leaf-shaped SVG aperture reveals the page; it disposes the player only after the opening. Hard deadline 6.1 s; Skip/tab hiding/error paths release immediately, and Simple View/reduced motion/background initial loads bypass it. Do not add an unconditional resize-to-finish listener: Chrome can dispatch a startup resize and cut the sequence before it opens. The mask adapts with its SVG viewBox rather than aborting on viewport changes. Native Chrome intermediate frames verify the aperture, with all completion paths covered by tests.

arrival.css replaces the prior inset-photo composition with a centered, full-width photographic invitation. Local licensed Allura accents the final short Latin title line and intro welcome. hero-atmosphere.mjs handles a guest-requested evening photograph using decode/race/disposal guards, with a readable fallback on image failure. Optional nature heroEveningImage/heroEveningAlt preserve older records and require the separately reviewed production backend schema rollout before CMS saves. No new observability event or consent behavior is introduced.

Read release-evidence/aroha-0.7.0 and PR #17 for the exact deployed revision/checks. Browser viewport overrides produced a scaled screenshot after a reload; reset the override and use the local responsive iframe harness for stable 320/390 checks. Phone screenshots remain emulation. Do not claim visual acceptance or production promotion.

## Album and pricing revision 0.8 (1 November)

The owner requested corrected desktop gallery controls, less scrolling and more creative gallery/pricing treatment. album.mjs replaces the all-items wall with five-print spreads, equal All/Photos/Films controls, sticky top paging, bounded live counters and a static noscript fallback. All 56 supplied media remain; the seed starts with five representative items while host-supplied CMS ordering stays authoritative. Full-screen navigation receives the current filter scope. Controller state survives render/Simple View; pending CMS updates reveal the original selected media before returning focus. Only the chosen clip loads and native close clears its source. No new schema or telemetry event is added.

collections.css adds paper-print gallery surfaces and separate pricing cards with shadows, botanical corners, perforated bands, rounded actions and subgrid price alignment. Rates/inclusions are not changed. Fine-pointer hover/page transitions require enabled motion; static print rotation remains decorative in Simple View. On phones the pager belongs above the main image, not below it; the previous below-photo placement made guests scroll past the next photograph when paging.

Browser checks cover paging/filter/reset/final one-item page, modal 2/35 photo scope, selected clip-only loading and return, Simple View state, equal desktop button dimensions, aligned price rows and 320/390 responsive iframe layouts. Direct browser viewport overrides remain unreliable after reload, so use the documented local harness rather than treating a scaled screenshot as an app defect. Read release-evidence/aroha-0.8.0 and current PR #17 head for actual checks/deployment and open production gates.

## Natura profile gallery dependency / 1 November 2026

The shared Hosting design export is pinned to Natura 0.6.1 at d2a170f6b42ed46635879873629abb5e9c467447 (ArohaRetreat/natura#20). This adds standalone/profile PNG downloads, including white on forest green. The existing vendored logo/font/nature subset is unchanged. This dependency pin does not authorise upgrading the older currently live public website; its runtime and configuration are preserved for the logo-only release. Full website promotion remains a separate release.


Website 0.13.0 adds hrudhi-gate.mjs/hrudhi-gate.css, optional CMS Hrudhi settings, native scroll seeking inside the existing Explore stage and no-film fallbacks; public Simple View controls/preferences are removed. Read docs/website-living-direction.md. Validate seek coalescing/disposal, intro focus, phone framing and no film request in reduced/Save-Data. API 0.2.1 validator must precede Hosting.

0.13.1 corrects exact handoff visibility/inert completion and preserves the entrance offset on resize. Test gateReveal(1) for exact zero/complete; verify tour controls accept clicks after the live bypass.

Current enhancement: website 0.14.0, issues 30/31. Guest Google sign-in and separate GA consent, wellness coming-soon state, on-demand verified map/address, Hrudhi companion on both public routes, non-blended clearer gate web editions and adaptive tour controls. Read docs/website-guest-experience.md. API 0.2.2 prerequisite; no membership/booking database changes. Verify production Google popup, reduced motion, zoom, map and actual tour clicks.
