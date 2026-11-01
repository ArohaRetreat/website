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
