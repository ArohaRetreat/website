# Booking acceptance coverage — issue101

Use [the execution contract](preprod-booking-e2e-v1.md) and [test commands](testing.md). Source, runner output and private evidence under `local/test-evidence/` determine a result; this catalog is not a blanket acceptance claim.

## Reusable HTTP scenarios

`website/testing/booking-scenarios.mjs` owns 24 stable scenario IDs. `functions/tests/preprod-integration.mjs` runs them through actual HTTP, emulator Auth, Firestore, Storage and the email collector. The deployed preprod `/admin/testing/` runs the same scenarios through the real Google session and production services scoped to isolated preprod collections. Execution labels distinguish those two runs.

- Public policy/environment and calendar privacy; invalid dates, child ages, forged prices and contacts.
- Private room pricing for couples, one adult with one child, additional children and maximum room party; day adult/child rates; shared adult places; inclusive multi-day exclusive rates.
- Pending request, host approval, current private invoice and cancellation; guest cancellation; host rejection; future check-in and premature completion denial.
- Idempotent replay and conflicting reuse, stale host versions, approved date amendments preserving original capacity until approval.
- Concurrent overnight/day adult capacity, exclusive conflicts, occupied private rooms, run-owned promo discount and redemption limits.
- Saved-profile inheritance/integrity, anonymous invoice denial, run-owned reservation/promo cleanup and unchanged pre-existing bookings.

The live runner additionally waits for delivered acknowledgement, host notification and confirmation before retiring approved fixtures. Tests use an empty future window and normal prices. A run cannot alter unrelated reservations, profiles, room readiness, CMS or production.

## Additional executable boundaries

- `tests/booking-products.test.mjs`: children beyond 35 total heads, family occupancy combinations, checkout-morning concurrency, expired holds/quotes, exclusive rules, turnover readiness and shared assignments.
- `functions/tests/booking-integration.mjs`: transaction races/oversubscription, independent ownership and rules denials, admission/module permissions, authoritative profiles, pagination, expiry, loyalty and promo reservation limits. Its isolated production-contract mode is not a live production acceptance run.
- `functions/tests/preprod-integration.mjs`: actual recipient policy, approved email/PDF version snapshots, invoice revisions/voiding, signed webhooks, preprod rules and production canaries.
- `tests/preproduction-email.test.mjs`, `tests/booking-platform-v2.test.mjs`: retries, uncertain acceptance, delivery deduplication, lease ownership, environment/runtime metadata and safe event transport.
- `tests/booking-concierge.test.mjs`, `tests/booking-products-ui.test.mjs`, `tests/booking-motion.test.mjs`: form state, expired quotes, contact persistence, interrupted submits, blocked calendar ranges, sign-out masking, interrupted motion, keyboard focus and reduced motion.
- `tests/booking-visit-label.test.mjs`: day dates, inclusive exclusive ranges across year boundaries and overnight checkout dates. A live Safari request exposed the original day-label defect; preprod0.23.6 corrects the display without changing inventory boundaries.
- `tests/booking-e2e-report.test.mjs`: private-data allowlist, explicit execution/authority, rejected malformed reports, configured destination restrictions and genuine SDK trace parent/timing relationships.
- `scripts/testing/verify-build.mjs`: test console present only in preprod; no runner fixture strings in production assets.

## Live acceptance and remaining gaps

A signed-in Safari day request was submitted through the ordinary guest UI, reviewed and approved in Host Studio. Its acknowledgement, host notification and confirmation reported recipient-server delivery; the downloaded PDF-v4 was visually reviewed on both pages. The test was cancelled and its invoice voided. Website changes opened without any save/publish. Form steps, server responses, mutations, email delivery and the request's native backend trace were independently searchable in Dynatrace.

These observations do not certify a new Google popup/redirect, a second real user's ownership boundary, Gmail/Outlook inbox rendering, physical Android behaviour, native RUM navigation or the entire live scenario matrix. A locked Mac interrupted the remaining Safari work; retain those gates as pending until actual execution resumes.

Check-in/checkout booking states exist, but the full stage-specific check-in/checkout emails, recorded payment receipt and scheduled private feedback flow remain unfinished under issue70. Their absent integration must be reported as blocked, not passed. Temporal expiry/loyalty simulations are controlled test-clock/domain or emulator evidence, not fabricated historical live stays.
