## Website 0.28.1 — isolate staff styling

- Scope the booking-desk additions to Host Studio so guest credit cards retain their daylight/sunset colors and mobile layout.

## Website 0.28.0 — a clearer booking desk

- Open Host Studio on a server-filtered Needs review queue and group navigation by daily work, guest follow-up and retreat settings.
- Keep Add booking in the header, align reservation rows and replace each bounded cursor page instead of appending history.
- Review requests in one staff-facing panel with direct reviewed acceptance, inline decline and separate contact, email, history and allocation controls.
- Preserve API0.13.0, existing scope/version/business rules, private data, CMS, original assets and operational email/payment workflows.

## 0.27.1 — refresh selected bookings outside the current page

- Re-read the selected booking after mutation when it is outside the current list page. Close and clear private details when the signed-in account changes or access cannot be refreshed. API and contract remain0.13.0/1.3.0.

## 0.27.0 / API 0.13.0 — manual bookings and nightly loyalty

- Add one-review host booking for new or existing guest emails without creating Auth accounts. Verified same-email Google sign-in claims the private customer alias; history, documents, feedback and credits share current ownership policy.
- Add nightly100/200/300-credit earning, ₹1 redemption, atomic holds/consumption/restoration, reasoned adjustments and separate immutable credit invoice snapshots. Retain6/10 qualifying-stay thresholds; no historical credit import.
- Replace the customer picker with bounded private search; add customer/credit views, server-filtered reservation pages, global payment ledger/private feedback and read-only snapshot totals. Guest credits have their own page and review-stage price update.
- Extend canonical contract to1.3.0/121operations and scoped own/all access. Existing read-only MCP grants stay unchanged. Separate MCP/docs release required.
- Cancelled invoices no longer present historical charges as payable; recorded money remains for review without automatic refund transfers. Existing frozen message/PDF versions and unrelated booking/CMS data are preserved.

## API 0.12.1 — cancellation and decline emails

- Queue one operational cancellation/decline email in the booking transaction, including manually recorded bookings. Preserve frozen templates, invoice voiding, current mail settings and no historical replay.
- Suppress stale status/version jobs and preserve provider idempotency; the notice never claims a payment or refund. Existing REST/MCP contracts remain unchanged.

## 0.26.0 / API 0.12.0 — scoped CRUD and stay lifecycle

- Extend canonical external contract1.2.0 to106 domain-backed operations; existing mcp-readonly grants retain their original nine-operation ceiling. New explicitly scoped mcp grants support CRUD.
- Add append-only verified manual payments/full reversals, private receipts, ledger-backed checkout statements, actual check-in/checkout timestamps and optional private feedback due24hours after checkout. No online charge or bank transfer is initiated.
- Add shared CMS/access facade, eligible profile erasure receipts, manager-private notes, inactive unit creation/retirement, atomic blocks, prospective promotions, sponsored integration clients and immutable validated media workflows.
- Route existing Studio content/access operations through the same policy service and add payment/document/feedback panels to existing booking views. Preserve approved email-v3/PDF-v4 assets, existing pricing/capacity and production data.
- Record per-operation safe audits and committed business events. New lifecycle templates apply only to new operations; no historical email replay.

## 0.25.1 / API 0.11.0 — optional non-expiring integration tokens

- Accept explicit expiresInHours:null for Never expires; keep 24-hour default and 1–168-hour timed tokens. Existing grants retain their deadlines.
- Preserve live account/role/scope/environment checks and revocation. Permanent grants count toward active limits and omit the TTL field; malformed stored expiry fails closed.
- Publish token-management schemas and contract1.1.0. Recognize the explicitly compatible scoped API0.10/0.11 booking contract in frontend delivery gates.

## 0.25.0 / API 0.10.0 — scoped external API

- Add the versioned external API contract and 39 scoped operations using the existing booking, pricing and authorization rules. Future financial, feedback and lifecycle CRUD remains tracked under issue 105.
- Add expiring, revocable integration grants issued through verified Google sign-in, own/all row access, read-only MCP grants, conditional writes, client-bound idempotency and sensitive-read audit records.
- Add Hosting routes for both environments and isolated emulator coverage. Preserve production email settings, private reservations, CMS, approved email/PDF assets and existing customer records.

## 0.24.0 / API 0.9.0 — production booking promotion and private reservations

- Promote approved exclusive pricing/calendar, signed-in enquiry, homepage sign-in return and branded booking emails through an independent main release.
- Add host-recorded confirmed private-exclusive reservations with unknown attendance, inclusive daily prices, transactional conflicts/idempotency/audit, and a separately queued private confirmation/invoice. No guest identity or payment is fabricated.
- Host Studio labels private reservations; public date picker greys booked dates with a finite Already booked explanation, without customer details.
- Production preparation validates real billing details and explicitly enables only the required email exports. Keep old queues, CMS, Natura and preprod intact; new-event-only activation.

## 0.23.2 / API 0.8.3 — approved email templates (preprod)

- Actual booking emails now use the approved v3 logo, photograph, website fonts with inbox fallbacks, graphical six-stage journey and stage-specific copy.
- Inline CID artwork travels with the email; confirmation keeps its private invoice attachment. New jobs snapshot the template version; legacy jobs retain their original provider payload for safe retries.
- Preserve actual verified recipients, host notifications, isolated preprod inventory, test identity and production state. Remaining lifecycle triggers and frozen PDF integration stay under issue70.

# 0.23.0 (pre-production)

- Completed guest sign-in returns to the website homepage; Host Studio authentication is unchanged. Booking has a visible Back to website link on desktop and phones.
- Preprod can deliver acknowledgement/confirmation to the verified booking guest and notifications to the configured host, preserving TEST subjects/documents and isolated inventory. Queued recipients are immutable; no historical replay.
- API0.8.1 adds explicit server-owned recipient policy with legacy inbox compatibility and rollback denial. Payment gateway remains deferred.

# 0.22.1 (pre-production)

- Share API compatibility checks between publication and live verification so API0.8.0 is correctly verified for website0.22.

# 0.22.0 (pre-production)

- Exclusive retreat: configurable ₹30000 per selected day, complete upfront price and a single host availability approval. Pending priced requests hold the continuous range; legacy offers/prices remain intact.
- Signed-in account separates WhatsApp enquiries and bookings. Both public enquiry entrypoints require current sign-in, preserving guest-reviewed messages without creating a reservation.
- Calendar disables unavailable dates using a bounded privacy-safe server availability read for the party and entire selected range. Loading/retry, stale response and checkout-boundary behavior retain authoritative transaction checks.
- API0.8.0. Preprod-only delivery; production mail and frozen lifecycle designs remain separately pending.

# 0.21.7

- Clear private dialogs on account loss and reject delayed account-state responses after identity changes, preserving anonymous planning during a first sign-in.

# 0.21.6

- Match concierge startup to its build environment; production and pre-production both accept their own service and reject the opposite environment. Add real-domain startup regression tests and bounded startup failure diagnostics.

# 0.21.5

- Restore platform-dependent Natura build outputs only from the published export when their pinned raw SHA256 matches; cache verified bytes and retain the full pre-publication inventory guard.

# 0.21.4

- Preserve pinned Natura raw content across macOS/Linux uploads; track runtime-specific compressed Hosting hashes separately and retain both published original-art ZIPs exactly.

# 0.21.3

- Bind deployment checks to push workflows on the exact environment branch/revision; an intentionally blocked promotion PR cannot poison another branch's deployment gate.

# 0.21.2

- Do not declare Resend SecretParams when mail is disabled, so production deployment requires no sending credentials or dummy secrets. Verify actual Firebase parameter discovery in both environments.
- API0.7.1; compatible frontend runtime gate accepts patch releases of API0.7.

# 0.21.1

- Promote the approved booking concierge to production guest builds; preserve Host Studio and server-authoritative pricing, inventory and approval.
- Add protected main/preprod delivery policy, direct environment merge denial, branch-specific Hosting workflows with short-lived identity, immutable source checks and separate runtime gates.
- Backend upgrades, database changes and email activation remain explicit releases; production mail stays disabled pending issuer/payment setup. Preserve existing CMS, reservations and pinned Natura.

## 0.21.0 — Guest booking concierge (pre-production)

- Dates-and-party planning, server-priced private/individual recommendations, adaptive day/exclusive paths and complete price breakdowns.
- Real Google/profile contact, idempotent request recovery, own booking history/cancellation/offers/date changes and private invoice access through the existing API0.7.0.
- Preprod-only guest entry; production, Host Studio, host-edited CMS, inventory policy and frozen correspondence designs preserved. No data migration or production promotion.

## 0.20.0 — Pre-production booking communications (prepared)

- Isolate test bookings, inventory, profiles, email jobs and private invoices within the existing Firebase project; use a separate preprod Functions codebase/site.
- Add Resend request acknowledgements, host notifications and approval confirmations with versioned invoice PDFs, durable retry/idempotency and verified webhooks.
- Add environment-specific runtime observability metadata, separate preprod RUM and explicit test-only recipients/billing.
- Production promotion and real email delivery remain separate verification gates. No production CMS/media/Natura migration.

## 0.18.1 — Booking atmosphere and motion

## 0.19.0 — 4 November 2026

- Unite Website changes, Bookings and People & access inside one permission-controlled Host Studio, retaining unsaved editor drafts between modules.
- Add guest contact profiles, final booking contact review and immutable reservation contact snapshots.
- Add inclusive exclusive-event end dates with continuous conflict protection through the last evening.
- Capture consent-aware form steps, server responses and atomic booking outcomes as durable Dynatrace business events, including server-validated guest phone numbers; retain separate bounded logs, metrics and real traces.
- Add scheduled retry delivery, module-aware Storage rules, queue TTL and contact index exemptions. API0.6.0 precedes Hosting; preserve CMS/Natura and existing guest records.

Apply sunset forest surfaces throughout guest booking, including inputs, branding, reviews and dialogs; unify calendar text and form/card layout. Add interruptible step/month/dialog transitions, immediate keyboard/reduced-motion behavior and focus/cleanup coverage. No booking policy/API/data changes.

## 0.18.0 — 3 November 2026

Add day outings, shared individual stays, private family rooms and host-quoted exclusive events. Adult/child pricing, shared35-adult capacity,10 overnight adult places,11AM turnover, event offers/acceptance and room readiness use the same transactional policy. Master room joins the two tree houses/two cottages; construction rooms stay closed. Existing booking prices/terms, CMS and Natura are preserved. API0.5.0.

## 0.17.4 — 3 November 2026

Replace leaf-shaped booking-date backgrounds with illustrative botanical leaf markers with stems and veins around the selected dates. Green in daylight and white in sunset.

## 0.17.3 — 3 November 2026

Booking dates use green leaf selection markers in daylight and white leaves on a forest calendar in sunset. Guest booking pages now share the existing IST atmosphere clock and expiring manual choice.

## 0.17.2 — 3 November 2026

Transparent public headers at the top, forest-green after scrolling, and transparent again over the full-screen farm journey. Reverse scroll and restored positions recalculate the surface; readable fallbacks retain contrast.

## 0.17.1 — 3 November 2026

Keep Book a stay in the main menu and add Book a stay / My bookings to the signed-in account menu. Remove the separate header booking link.

## 0.17.0 — 3 November 2026

- Add authenticated overnight booking requests, host approval, comments, cancellation, date changes and visit tiers.
- Add Host Studio reservation calendar, inventory/readiness controls, blocks, rates/offers, policies and private guest contact; preserve website editing in its own module.
- Enforce verified guest identity, active host permissions, atomic nightly capacity, scoped idempotency, bounded pagination and continuous-stay credit deduplication.
- Launch with host-agreed pricing, no online payment or email, four identified rooms within the ten-person limit, and closed fifth/future inventory. Keep CMS version8 and Natura0.6.1 unchanged.

## 0.16.3 — 2 November 2026

- Centre first-visit copy, expand leaf photography, add persistent larger-logo navigation and prominent footer branding.
- Repair sunset outline controls, animate experience disclosures and remove the map/footer gap.
- Use Google account photographs with fallback, browser-aware favicons and consistent green browser theme metadata.
- Shorten generated-scene captions and correct the story next arrow; preserve automatic IST atmosphere.

## 0.16.2 — 2 November 2026

- Default public atmosphere to Aroha’s IST schedule, with timed manual overrides and background/history refresh.
- Separate first-visit popup copy/actions and give desktop hero text stable clearance below it.

## 0.16.1 — 2 November 2026

- Move optional monitoring to a dismissible first-visit popup after the welcome, preserving consent gates.
- Add botanical section separators and reduce excess introductory spacing.
- Align all four gallery filters, remove filled tour reading backgrounds, and wrap detail actions with a clear gap.
- Ease FAQ opening and closing with interruption, reduced-motion and cleanup support.

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

## 0.24.1 — phone calendar width

Keep booked-date labels inside all seven calendar columns on narrow screens, preserving disabled dates and leaf selection markers.

## 0.24.2 — approved document delivery

Use the frozen PDF-v4 design for new invoices, including the Natura logo, Lora typography and Hrudhi memory panel. Preserve legacy PDFs and retry payloads, and provide an audited design-only correction without reissuing financial invoices or changing reservations.
