---
name: service-aroha-booking
description: Maintain Aroha's authenticated overnight reservations and host inventory.
---

# Aroha production booking

Owner ArohaRetreat. API0.6.0 / website0.19.0. Domain `functions/booking/domain.mjs`; Firestore adapter `store.mjs`; request schema `contract.json`; API entry `functions/index.mjs`. Guest frontend `website/booking.mjs` / `booking-api.mjs` / `booking.css`; `/book/` and `/admin/#bookings`. Read [API contract](../../docs/api/aroha-booking-v1.json), [policy notes](../../functions/booking/contract-notes.md), [continuation](continuation.md) and [plan](../../docs/booking-module-plan.md).

Verified Google bearer identity is independent of host membership. Existing host session admission bootstraps only configured owners/invited members. Booking access requires active module viewer/manager capability; mutations require manager, re-read in the same mutation transaction. Public config never exposes reservations. Guest state projects only own records; calendar/contact reads require host capability. Private screens are masked; optional detailed journey observations respect monitoring consent. Phone is server-enriched only in business events; see service-booking-observability.

Historical 0.17.0 launch (superseded by mixed products below): no existing commitments; host-agreed pricing, no online charge; four identified2-person units under a10-person overnight cap; fifth and future rooms closed. Null prices are never displayed as free. Day visits remain unavailable. Future units need explicit readiness and actual names before activation. Per-booking cancellation terms snapshot; initial full cancellation before arrival, no financial charges.

Read configuration/member/profile/idempotency/quote/reservation and all affected nightly ledgers before writes. A configuration guard serialises inventory changes across instances. Ledger entries are bounded by whole-room inventory; pending approval expiry is checked by server time independently of cleanup. Date changes retain original allocation until host approval, then atomically replace it. Version checks and actor-scoped request hashes prevent retries/stale changes. Active request limit3 and durable60/min API limit apply. Configuration edits conservatively require reconciliation beyond200 active records; do not weaken that bound silently.

Firestore browser access remains denied for booking collections. Quotes and cursor/idempotency metadata have separate TTL timestamps; capacity never relies on deletion. Cursors are private server-issued actor/view-bound records,15-minute validity. Guest pages25 records, host25 recent plus14-day calendar, users50, audit10; all returned data is projected. Contact email is a reservation-specific protected read, absent from bulk calendar/users. Keep guest notes out of logs/events/metrics.

Tests: `npm test`, `npm run build`, `sh scripts/check.sh`, `node --test functions/tests/telemetry.mjs`, and `node scripts/delivery/run-node-tests.mjs api-integration` inside isolated demo-aroha Auth/Firestore/Functions/Storage emulators with Java21 and synthetic `.env.local`. Never deploy emulator configuration or perform synthetic production bookings without explicit permission.

Deploy READY indexes from firestore.indexes.json before function/UI queries. Preserve existing production owner/secret configuration and Natura0.6.1 shared Hosting composition. Deploy API before tested immutable Hosting source. Rollback never deletes bookings or restores stale availability; use `paused` to stop new requests while preserving management.

Backend OTel retains aroha-api identity/version and bounded operation/error classes. Durable audit/outbox record committed operations with stable event IDs; no private notes/email in telemetry. Email/outbox transport is not configured. Activation of future email must explicitly choose cutover/replay policy; never silently send historic events. Hosting/deployment telemetry and native RUM linkage remain separate evidence.

Website0.17.3 guest date selection uses CSS leaf silhouettes (green in daylight, white on a forest calendar in sunset) without changing rectangular buttons, numbers or aria state. The booking document installs only the existing atmosphere clock before paint; no optional analytics or public-page transition bootstrap. Host booking document is unaffected.

0.17.4 corrects issue56 acceptance: selected dates show an actual botanical icon (stem and veins) around their date, not a leaf-shaped background. Keep matching green/day and white/sunset icons/numbers and existing accessible button box.

Mixed products: read docs/booking-products-contract.md and products.mjs before changing availability. Preserve35-adult onsite/10 overnight limits, under10 classification, private max2+2/base2-person pricing, shared allocations, departure-morning/overdue presence, site exclusivity with expiring offer holds and owner consent. Day/event completions must never create stay credits. Master room is owner-confirmed operating inventory; future rooms closed. Config migration is scoped, never a seed restore. Existing settings/products and old bookings retain host edits/terms. Existing status/departure index needs exact overdue query probe before deployment.

Guest booking0.18.1 uses semantic full-surface day/sunset palettes and native dark date inputs. Preserve white/forest original logos, legible calendar labels and leaf icons; theme follows the shared clock without re-rendering forms. Step/month/dialog motion is interruptible and disabled for reduced motion/keyboard; preserve close/reopen safety and focus cleanup. No API/policy/data change.

Preprod website0.21.0 selects booking-concierge-entry.mjs / booking-concierge.mjs / booking-concierge.css and booking-options.mjs only at /book/. Read [concierge contract](../../docs/booking-concierge-v1.md). Recommendations are presentation hints from current API availability; every displayed price and create comes from the existing API. Retain real profile/Google email, server quotes, idempotency on uncertain outcomes, versioned own-booking actions and consent-bound journey steps. Production and Host Studio retain their existing entry until separately promoted.
