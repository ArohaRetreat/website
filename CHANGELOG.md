# 0.16.0 / API0.3.0

- Add a Farm experience journal filter covering the supplied farm photographs and films, with filter-scoped viewing and retained paging.
- Replace the library placeholder with a labelled generated reading-corner impression; use the real illuminated main-house dining photograph for the dining stop.
- Remove the meditation interior image from the public tour/journal and use the supplied real night exterior when After sunset is selected, retaining the existing daylight image and an image-error fallback.
- Add optional CMS day/evening place image fields with compatible API validation and shared photo lifecycle handling. Preserve current host-edited text during the scoped content update.
- Keep Hrudhi narration parked. The pool visual is a labelled completion impression grounded in the supplied construction videos.

# 0.15.0

- Walk Hrudhi along the Living Map's drawn path with front, back, left and right poses; synchronize stride to distance, retain position on interruption and follow her on phones. Connect the homepage guide to continuous scroll progress rather than re-centred destination tabs.
- Show the signed-in guest name and a leaf-shaped account list with My account and Sign out. Keep Google Auth session scope and host permissions unchanged.
- Load the approved Dynatrace tag early for saved consent and identify consenting signed-in visitors with a Firebase UID, clearing on logout/withdrawal. Support the current RUM JavaScript event API, keep collection out of previews and offer a non-overlay first-visit consent card. Google Analytics remains independently opt-in.
- Keep the new voiced Hrudhi Arrival sample in Natura review assets only, pending owner review.

# 0.14.4

- Open the current place’s Discover dialog from the homepage Hrudhi guide, with a matching accessible label. Keep the gate introduction separate.
- Separate mobile tour media, reading, destinations and guide controls into responsive rows so the green reading overlay no longer obscures the revolving photographs/films.

# 0.14.3

- Keep Hrudhi’s whole resting silhouette clear of map labels on phone and desktop; choose a nearby drawn path point using current label and character bounds.

# 0.14.2

- Move Hrudhi into the Living Map illustration and walk along its paths between selected places. Retain position during interruption and use map-relative transforms during responsive resizing. Remove the map introduction button and detached guide rail; preserve marker clicks, reduced motion and homepage guide behavior.

# 0.14.1

- Restore the phone gate film after a metadata export overwrote its MP4. Validate complete MP4 containers before every website build and verify the gate asset manifest against actual bytes.

# 0.14.0

- Add guest Google sign-in/sign-out through a lazy session-scoped Auth module shared with the host studio, without granting host membership or claiming online booking availability.
- Enable Firebase Google Analytics only after separate explicit consent; preserve independent Dynatrace consent, withdrawal and privacy-safe identities.
- Mark the ₹4,500 Meditation & Wellness package Coming soon, with host launch enquiries and no active dated enquiry selection. Availability is CMS-editable and backward compatible.
- Add the verified Hrudhi Farms Google Maps embed on demand and link its supplied address to directions. No Maps API key is needed for the public embed.
- Accompany tour stops and the Living Map with the approved-style Hrudhi guide and a short reference-derived walk cycle. Replace blended gate frames with clearer high-quality 60fps web exports preserving the original 24fps source cadence.
- Make tour reading and control lanes adapt to short/zoomed viewports. Preserve the exact completed gate handoff and automatic reduced-motion behavior.

# 0.13.1

- Release the gate overlay’s visibility and interaction exactly at the completed reveal; prevent a floating-point remainder from leaving an invisible surface over Explore.
- Transfer keyboard focus to the tour after entry and preserve the entrance/tour offset on viewport resize.

# 0.13.0

- Welcome guests with a reversible, scroll-controlled Hrudhi gate-opening film over the existing Explore stage, revealing the real farm in the same pinned viewport. Keep a direct Enter the farm bypass and an accessible illustrated-guide introduction.
- Serve silent 60fps adaptive web editions (540p phones, 1080p desktop); preserve the approved upscaled/interpolated 4K60 master in Natura. Reduced motion and Save-Data avoid fetching film. Remove the public Simple View controls and saved preference; automatic reduced-motion and CMS-disabled-motion fallbacks remain.
- Add optional editable `tour.nature.hrudhi` settings under existing CMS permissions; API 0.2.1 validates bounded copy and existing media origins. No booking, membership or schema migration.

# 0.12.0

## 0.12.1

- Repace the forest menu with a staged 800 ms aperture, reversible close and native focus/Escape handling. Same-page shortcuts wait for the fold; cross-page links keep native history and snapshots.
- Extend public page reveals to 1000 ms with a correctly bounded aperture; soften gallery changes and native details-dialog entry/exit. Reading/Simple View, keyboard menu operation and reduced motion retain immediate alternatives.
- Preserve verified delivery reporting, API 0.2.0 and Natura 0.6.1.


- Add a trusted after-completion Actions observer for workflow/job/step and structured actual test outcomes. Keep export credentials out of source PR checks and parse artifacts with strict privacy/size/path limits.
- Export separate CI/delivery traces, correlated logs, bounded metrics and stable-ID lifecycle BizEvents with original execution attempts and report-only recovery.
- Observe production Hosting releases through provider state, verify live immutable files/access denial, emit successful native deployment markers, and retain independent verification/reporting outcomes without redeploying to repair telemetry.
- Preserve API 0.2.0, public behavior, RUM consent, CMS permissions and pinned Natura 0.6.1. Actual operational verification is tracked in issue #22.

# 0.11.0

- Make After sunset a persistent public-site atmosphere, with forest-green pricing/gallery/map surfaces, warm ivory text, gold actions and dark enquiry/privacy controls.
- Restore the atmosphere before paint on both public routes; add a daylight/sunset switch to the shared menu and retain the actual evening hero photograph across CMS repaints.
- Preserve race/disposal guards and keep sunset colours available when the evening photograph cannot load. Keep daylight restoration, reduced motion, native page transitions, CMS and protected applications unchanged.

# 0.10.1

- Connect public page navigation with a 500 ms native leaf-aperture reveal, preserving native URLs, fragments, Back/Forward, new tabs and browser fallbacks.
- Keep the forest menu in the outgoing snapshot and skip the initial sprout welcome on internal arrivals. Support immediate interruption and reduced/disabled motion, Reading/Simple View and keyboard navigation.

# 0.10.0

- Add a shared forest menu with real palm imagery, a leaf-shaped reveal and bounded water-drop/ripple motion. Both public routes share a page registry and CMS-visible section links.
- Preserve native dialog keyboard/focus behavior, reduced motion, view toggles and enquiry handoff. Pause background media while the menu is open and defer live content repaint until close.
- Use the same full photographic footer, Kannada welcome, host enquiry and privacy controls on the retreat and Living Map pages. Hide floating map tools when the footer is visible.
- Keep API 0.2.0, roles, publication, tariffs, monitoring consent and the pinned Natura 0.6.1 export unchanged.

# 0.9.2

- Keep the Living Map on a continuous forest-green canvas with white cards and faint botanical leaf watermarks.
- Connect chapter cards with reversible, scroll-driven timeline lines; keep steady connections in Reading View and reduced motion.

# 0.9.1

- Reserve space for map controls so the entrance marker remains visible when opening the whole-farm overview directly.

# 0.9.0

- Add The Living Map at /map/: a tree entrance and full-view illustrated farm journey with eleven farm stories, real media, chapter navigation and Reading View.
- Add editable map stories and draft preview to the host studio, with optional backward-compatible schema 1 validation (API 0.2.0).
- Add consent-controlled bounded map events and preserve guest/admin module separation.

# Aroha Retreat website changelog

## [0.8.3] — 2026-11-01

- Split public Firestore reads from admin Auth/Storage; the build checks that guest Firebase dependencies exclude those admin implementations.
- Initialise Auth directly with session-only persistence and open Google immediately from the click, removing per-click persistence migration.
- Show checking-access/loading-draft stages and preconnect the admin sign-in helpers. Preserve membership, publication and session scope.


## [0.8.2] — 2026-11-01

- Promote the reviewed website to the custom domain with canonical SEO/sitemap URLs.
- API 0.1.1 admits the exact apex origin while preserving legacy origins and access rules; invitations point to the canonical host.
- Roll out the already-tested optional tour/nature/evening validation and immutable video-upload rules before Hosting. Preserve owner configuration and the existing telemetry secret binding.
- Keep the Living Map in the next enhancement, issue #4, outside this release.


## [0.8.1] — 2026-11-01

- Separate website, Firebase host studio/API, media, tests and documentation into the public ArohaRetreat/website repository.
- Build independently with pinned Natura fonts, brand and nature-runtime exports; preserve all reviewed 0.8.0 source/media and historical deployment evidence.
- Compose a pinned Natura design export for shared Hosting; refuse partial, stale or changed deployment artifacts.
- Keep remaining acceptance gates open in website issue #2. No runtime deployment is performed by this migration.

## [0.8.0] — 2026-11-01

Five-print paged album with all 35 photos and 21 films; consistent filters/viewer controls. Pricing paper surfaces, shadows and aligned rows. Earlier experience and deployment evidence is retained under release-evidence.
