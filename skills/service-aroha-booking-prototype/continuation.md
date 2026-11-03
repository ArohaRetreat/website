# Aroha booking prototype continuation — 3 November 2026

Issue [#50](https://github.com/ArohaRetreat/website/issues/50), draft PR [#51](https://github.com/ArohaRetreat/website/pull/51), branch `feat/booking-prototype`, working checkout `/private/tmp/aroha-guest-experience`. Based on production website0.16.3 / cec4a963840a4cf6a88e1d77d324dc3f8ea104ff. Prototype version0.1.0 is independent; no production version/tag/Hosting change.

## Implemented locally

- Guest portal: sample sign-in, date-range calendar and typed dates, party/whole-room selection, server quote, promo, private requests, pending approval, upcoming/past/cancelled bookings, note edit, cancellation, confirmed-stay date-change request and tier progress.
- Host Studio: overview,14-day room/occupancy calendar, approval/decline/cancellation, guarded check-in/completion/no-show, reservation search/filter, host-created reservations for sample guests, room capacity/rate/closure edits, maintenance blocks, promo generation/activation, configurable capacity/approval/cancellation/tier policies and local audit.
- Website changes groups the current CMS categories for review and explicitly opens the preserved live editor separately. It does not read/modify production content. Full embedded editor integration and verified room activation remain production follow-up.
- Domain/HTTP boundaries: private owner projection, synthetic host capability, version checks, scoped idempotency, quote revalidation, half-open dates, expiry reconciliation, limited promo reservations and atomic single-process JSON commit. Date changes retain original allocation until rechecked host approval; requested replacement dates are not reserved early.
- Owner policy: overall10 overnight guests; four identified two-person room placeholders, unidentified fifth closed, four future five-person rooms closed. Rates, benefits and24h/48h review/cancellation defaults are explicitly illustrative. Day visits disabled pending policy.

## Actual evidence

- `npm test`:139 passed, including22 booking domain/HTTP/DOM tests and the117 existing application tests.
- `sh scripts/check.sh`: foundation structure/links and21 foundation tests passed.
- `npm run build`: production website build passed; no booking/prototype route, account picker or assets are emitted into dist.
- Pinned jsdom26.1.0 tests exercise guest request → host approval → guest note/date change → host change approval → cancellation, plus host module navigation, offer creation, policy saves and host-created requests against the actual local HTTP adapter. These are DOM tests, not browser layout/modal-focus certification.
- Local review server runs through `npm run dev:booking`, loopback8782. [Guest](http://127.0.0.1:8782/prototype/booking/), [host](http://127.0.0.1:8782/prototype/studio/). Persisted synthetic state is in OS temp `aroha-booking-review-v1.json`; sessions reset on restart.
- Browser inventory/runtime continued to report “Local browser use is disabled in Work settings,” including after the owner said they would enable it. No actual desktop/phone browser or console acceptance, screenshots, physical-device review or real Google sign-in is claimed.
- GitHub issue creation through the connector failed403; configured `gh` CLI created issue50 successfully. PR/CI status must be checked live; no merge or production deployment is part of this work.
- Audit/outbox is local only; delivery `not_configured`. No tenant telemetry, external calendars, email, payment or production booking records were written.

## Review and next action

Use the [review guide](../../docs/booking-prototype-review.md) and [actual prototype OpenAPI contract](../../docs/api/aroha-booking-prototype-v1.json). Start/restart the local server after source edits; its JS bundle is built once at startup. One process owns each state file. Preserve the canonical checkout's pre-existing untracked planning document; do not copy over host-edited data or reset a checkout to synchronise work.

The owner requested a prototype to review before subsequent email integration. Keep the source in an issue-linked review PR, without merge/deployment. Complete browser visual/keyboard/phone review when browser access becomes available. Production integration still requires Firebase identities/capabilities, Firestore resource-ledger transactions/rules/ready indexes, bounded pagination/retention/abuse controls, expiry worker, verified room inventory/rates/terms, offline reservation import, embedded CMS navigation and explicit release approval. Hrudhi narration remains parked.
