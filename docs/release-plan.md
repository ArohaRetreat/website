## Website0.20.0 / API0.7.0 — issue65 (pre-production)

See [contract](preproduction-email-contract.md) and [operations](preproduction-email-operations.md). New isolated aroha_preprod_* indexes/TTL must be ready, then publish validated metadata and deploy only the generated preprod codebase/site. Shared Auth and private invoice Storage remain in the existing project; CMS/member writes are blocked from preprod. Preprod recipients are forced to the approved inbox and test invoices request no payment. Separate Resend sending-only/webhook secrets. No data migration/replay of production reservations. No production promotion in this task; production email activation additionally requires real billing/host configuration. Central metadata becomes effective on production only after a separately approved one-time runtime-loader upgrade. Preserve pinned Natura/export/media and five previous Hosting versions. Rollback preprod artifacts independently, retain booking/invoice/job ledgers and disable new sends if required.

## Website0.19.0 / API0.6.0 — issue63

Additive API/contact/module/continuous-event contract in booking-platform-v2.md. New reservations require saved or supplied contact; old clients without a saved profile receive CONTACT_REQUIRED and must reload. Existing contacts/quotes/times/prices/stays are not migrated. Existing members retain legacy module defaults. New module grants use expectedVersion. New Storage rule enforces websiteAccess. Add unindexed contact/event fields and delivered expireAt TTL to the new private outbox; never drain/replay the old booking/email outbox. Check READY metadata plus exact nextAttemptAt<=now ordered limit20 query before activating arohaBookingEvents. No new composite index or SDK dependency. Existing Secret Manager token and owner environment stay intact.

Deploy rules/index metadata, API and scheduled worker before exact merged Hosting. Worker every minute, max1 instance/20 events per batch; retain failed records/backoff and seven-day delivered queue receipts. Monitor capture failures/backlog, separately verify202 ingest and tenant business/log/metric/trace records. Test isolated browser profile/contact/range/draft persistence and emulator authorisation/concurrency/PII/retry cases. Never create production verification reservations. Rollback Hosting independently; pause new requests if necessary and retain API/data/ledger access. Do not delete private records or restore CMS seed. Preserve all pinned Natura files. Emails/payments/audio remain parked.

## Website0.18.1 — issue61

Frontend-only booking palette, layout and motion correction; API0.5.0 unchanged. Use public forest sunset palette across guest surfaces, warm ink and white botanical markers, native dark date controls and white logos. Align radio/form/calendar geometry. Short WAAPI transitions cancel on replacement/pagehide/reduced motion; keyboard actions remain instant and dialogs retain native focus. Validate contrast, interruption, day/sunset plan/rooms/review/visits/dialogs and320/390px layouts. Preserve pricing/inventory/CMS/Natura; no migration or backend deployment. Publish exact merged source after CI using existing observed Hosting guard.

## Website0.18.0 / API0.5.0 — issue59

Approved mixed booking products; see booking-products-contract.md. New API products.mjs and additive strict request fields/actions; same auth/ownership/rules. Ledgers include departure morning, previous-day legacy discovery and overdue checked-in reconciliation. Offers/expiry/room readiness/guest acceptance/admin controls and child pricing share server policy. Master room opening explicitly confirmed/named by owner; migrate only its placeholder config without replacing host settings or bookings. Preserve old prices/time snapshots and CMS/Natura. Existing composite status/departure index also serves new overdue query: verify READY and exact read-only probe before API publication. No rules/index/secret/SDK upgrade required. Email/payments/audio remain parked. Test domain/DOM/real emulator concurrency/denials, OTLP/foundation/build, isolated Chrome UI, current-head CI and observed API-before-Hosting exact-source release. Rollback cannot delete inventory/data; pause requests if needed and retain management.

## Website0.17.4 — issue56 acceptance correction

Owner clarified actual leaf icon, not a leaf-shaped background. Use website/calendar-leaf.svg as a fine botanical line illustration around each date, with an open centre. Build/export and hash-verify the new /assets/calendar-leaf.svg. Replace decorative selection pseudo-element with drawn stem/veined leaf around each selected date; green/day, white/sunset. Preserve cell geometry/date labels/focus/range and existing atmosphere clock. No API/CMS/reservation data/build bootstrap/Natura changes. Verify both calendar styles in Chrome, application/foundation/build/current-head CI and observed exact-source Hosting. Rollback Hosting only, retain all data.

## Website 0.17.3 — issue56

Guest calendar appearance: green/white leaf endpoints with readable inverse date text, range contrast, intact button hit target/focus. Guest booking document restores existing IST atmosphere pre-paint (including boundary/history/background refresh); host document remains unchanged. No optional analytics or page-transition bootstrap on booking. API/CMS/booking/index/rules/secrets/Natura unchanged. Verify app/foundation/build/current-head CI and desktop/phone CSS review in Chrome; publish exact-source Hosting preserving current CMS/Natura. Rollback Hosting only and retain live reservations. Header0.17.2 changes remain intact.

## Website 0.17.2 — issue54

Header appearance only: shared top transparency through24px, solid forest masthead after scroll, transparent homepage masthead when the full header band is over the cinematic farm journey, solid on exit. Existing RAF/geometry and cleanup are reused; no new observer. Reduced-motion/text tour and map Reading View keep solid contrast while scrolled. Both atmospheres covered. API/CMS/booking/index/rules/secrets/browser theme-color unchanged. Verify boundaries/reverse/restored scroll, application/foundation/build/current-head integration and exact-source observed Hosting release with pinned Natura0.6.1. Rollback Hosting only, preserving all live data. Actual browser/phone acceptance remains separate.

## Website 0.17.1 — issue52

Booking navigation only: omit booking from header quick links, retain full Menu entry and expose explicit booking/history anchors in the signed-in account popover. Account link styles share existing controls. No API, CMS, inventory, rules, indexes, secrets, consent or telemetry schema change. Validate application/foundation checks and build, merge linked PR, compose pinned Natura0.6.1 and verify exact-source Hosting hashes/observed deployment. Rollback Hosting only; preserve all live booking/CMS data. Actual account/device acceptance stays separate.

## Website0.17.0 / API0.4.0 — issue50

Production booking activation was explicitly authorised. Owner confirmed no existing offline commitments and selected host-agreed pricing. Four identified two-person units active, overall capacity10; fifth/future rooms closed until explicit readiness verification. Publish no demo identities, records, tariffs or offers. Pricing remains null at launch; no payment/email. Existing CMS/public content and Natura0.6.1 remain preserved.

New private booking/config/day/profile/quote/request/cursor/audit/outbox/credit collections are protected by existing deny-all browser rules. Create booking query/credit indexes and metadata TTL configuration; wait READY and run exact read-only probes. Test guest/host capability, concurrency, quote/version/idempotency, expiry, global promo counters, date-change replacement, credit coalescing, contact and cursor ownership. Deploy API before guarded immutable Hosting. Verify book/host pages, hashes and unauthenticated booking denial, and record signal receipts and tenant records separately. Real-account browser/device acceptance remains distinct.

Rollback Hosting independently. Preserve API0.4 compatibility and booking records; never roll back reservation data, ledger state, membership or secrets. Use the booking pause setting to stop new requests while retaining host management.

## Website0.16.3 / issue48

Frontend presentation/identity pass only: shared header/footer, notice centring, intro photos, concise impression captions, dusk controls, experience disclosure grouping, map seam, Google-avatar display, browser favicon/theme metadata and story arrow. API0.3.0/CMSv8/Natura0.6.1 unchanged. Validate both modes and320/390 layouts, photo host rejection/fallback, exclusive disclosure reversal, favicon preference changes and header/fragment spacing. Android toolbar tint and actual Google-photo retrieval are separate device/account gates. Rollback Hosting without changing content or membership.

## Website 0.16.2 / issue46

Frontend only: IST06:00/18:00 clock, expiring manual override, prepaint/live/bfcache refresh, popup text geometry and stable hero clearance. API0.3.0/CMSv8/Natura0.6.1 unchanged. Test UTC/IST day edges, year rollover, override expiry and storage denial; review popup/hero desktop and phone geometry. Rollback Hosting independently of content; old indefinite saved atmosphere is intentionally superseded by the new clock policy.

## Website 0.16.1 / issue44

Frontend presentation and interaction only: non-modal consent popup, botanical section boundaries, gallery/detail action geometry and reversible FAQ motion. No API/schema/rules/index/secret/content changes. API0.3.0 and Natura0.6.1 retained. Validate desktop/320/390 layouts, FAQ reversal/close/reduced motion, welcome-to-consent handoff and dismissal; deploy immutable merged revision through observed Hosting wrapper. Rollback Hosting to previous version without restoring or modifying CMS content.

# Website 0.16.0 / API0.3.0 impact

Issue41. Public place-photo selector, album farm filter, scoped supplied-media additions/removal and one labelled generated library asset. Existing optional stop fields gain eveningImage/eveningImageAlt with trusted URL/description validation; host studio renders them using existing media controls. Backend update precedes CMS saving/publication. Firestore schemaVersion1 stays compatible, rules/indexes/roles/secrets unchanged. Theme, caption fallback, static/phone images, filter/page/viewer and content-preservation tests apply. Existing generated Hrudhi voice is not integrated. Pool image is a labelled completion impression from the actual rectangular pool and palm setting in the supplied construction clips.

Current draft must be exported/backed up and narrowly patched; do not overwrite owner changes with seed. Publish only after media URLs and API are live. Rollback website/API to prior immutable source, and use CMS revision history as a separate content rollback if needed; do not delete original media or revert account access. Compose the same pinned Natura0.6.1 export and run the observed Hosting deploy/live verifier. Check each delivery signal and native marker separately from runtime RUM and CMS writes.

# Website 0.15.0 impact

Issue #39. Frontend-only update to guide rendering/controllers, optional browser telemetry bootstrap/identity, guest account popover and non-overlay consent card. Add one transparent four-view WebP derivative; the new voiced video stays outside website source/build. API remains0.2.2, Natura consumer0.6.1. No Firestore schema, indexes, storage rules, roles, secrets or backend deployment changes. Existing CMS custom walk sheets remain compatible. Use the pinned Natura export for shared Hosting composition.

Gates: gait/heading/path and consent/identity race tests; guest display-name/custom-asset compatibility; all app/foundation checks and build; phone/desktop walk/turn/reverse, dialog pause, name-menu/Escape/focus, consent and lazy Analytics checks. PR-linked CI/review before merge; observed Hosting-only deploy; live hash/draft-denial verification; each delivery receipt; fresh custom-domain user.events and signed-in UID tagging, plus GA tag behavior separately from GA dashboard ingestion. No new video integration.

Rollback: rebuild/redeploy prior immutable website source and the same pinned Natura export using the observed deployment wrapper. No user data rollback. Existing consent choices remain stored and optional. New tag/guide assets can be reverted without changing account access.

# Release impact and verification plan

Status: pending decisions and implementation. This is not deployment authorization.

Record issue URL/acceptance criteria, verified issue-to-PR relationship and resolution state, version, source revision, PR/checked head/merge SHA, workflow/run/attempt, target environment and authorized scope. List affected UI, modules/contracts/policies, settings, data/indexes/migrations, secret bindings, telemetry, docs/screenshots and rollback consequences. Define executable predeploy gates and separate postdeploy checks for the chosen stack.

Postdeploy evidence must include exact version/SHA/service revisions; public/protected-route checks; independent docs checks; per-signal transport and partial rejection counts; tenant queries for events/logs/traces/actual metric samples; actual native RUM linkage status; failures/limits. No customer writes without explicit authorization. Never label these pending checks passed.

Track SDLC events from intake/development through review/checks/merge, release/deployment, runtime verification and rollback. Document source authority, stable IDs, safe fields, delivery/recovery, and source-to-tenant proof separately from application signal evidence.

## 0.9.0 — Living Map / API 0.2.0

Adds standalone `/map/`, generated botanical artwork, eleven editable stories/four chapters, native-scroll tree entrance and physical map, deep links/history, Reading View and consent-controlled map signals. Home design and Natura export remain intact. Affected: website renderer/controller/styles/build/SEO, admin map editor/preview, optional server content validation, API version/telemetry, tests/docs. No new secrets, roles, indexes or rules. Deploy API first, then the checked composed website artifact containing pinned Natura 0.6.1. Retain previous Hosting version and API source for rollback; stored content/history is preserved. Preview/browser review, real device acceptance and RUM linkage are distinct gates.
