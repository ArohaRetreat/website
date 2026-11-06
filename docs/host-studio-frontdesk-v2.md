# Front desk v2 — preprod review candidate

Issue #111. Website0.29.0, API0.14.0, external contract1.4.0. Production remains held for owner review.

The approved direction replaces the booking shell with a compact forest/neutral workspace, guest-first rows, a contextual reservation panel and phone cards/full-screen detail. Front desk starts with Review requests, with Check-ins today, In house and Check-outs alongside it. Add a walk-in uses the existing three-step quote/confirmation flow on a focused full-screen surface. CMS/access modules stay mounted and unsaved CMS drafts remain protected.

## Contract and permissions

Read-only POST `/api/external/v1/host/reservation-searches` (`searchHostReservations`): active booking staff, `rowAccess:all`, integration scope `customers:read`. Contact-bearing search text is private request-body content. The operation adds display names but no email, phone, notes or profile directory. The existing nine-operation legacy MCP ceiling and existing reservation projections remain unchanged. This is an additive candidate API; no MCP package publication or production developer-docs promotion belongs to this preprod release.

Input: required `view` (`review`, `arrivals`, `in_house`, `departures`, `all`), optional single `kind`, stored/effective `status` (all view only), `attention` (review only), inclusive arrival date boundaries, exact case-normalised reference, limit1–50(default25), opaque15-minute cursor. Invalid calendar dates, reversed ranges and incompatible filters fail validation. Default sort is response deadline then document ID for review, arrival then ID otherwise. A date-change request has no response deadline in current policy, so it follows timed requests; the UI must not invent one. Cursor binds full filters, view, principal, integration grant/version, page size and relevant IST day. Errors use existing envelope/request IDs and INVALID_CURSOR/CURSOR_EXPIRED semantics. The response is bounded summaries plus next cursor and asOf, without fabricated full-result counts.

Review includes new requests, unpriced legacy offers and confirmed date-change requests. Expired pending holds are excluded. Arrivals means confirmed reservations arriving today IST; departures means checked-in reservations departing today IST. Ordinary terminal statuses stay available in All bookings. Pending and expired status filters account for elapsed unprocessed holds. Search defaults to exact reference; private name/email/phone customer lookup is in Guests, using the existing bounded endpoint.

All mutations reuse existing APIs, current membership/version/capacity/price checks and email/loyalty policy. Decision outcomes, arrival and payment remain separate. An uncertain response freezes action payload/key, blocks alternate actions and offers same-key retry. Staff can still reach allocation, cancellation, offer composition, contact correction and other existing utilities through More booking options. No bulk decisions are introduced.

## Query prerequisite and migration

`deskKind`, `deskAttention` and `deskDeadline` are derived fields maintained in the existing atomic booking write. No duplicate identity/contact fields or new business state. `scripts/backfill-booking-desk.mjs --environment pre-prod` is dry-run by default; `--apply` changes only these fields using updateTime preconditions and independently verifies unrelated fields. It refuses production. A concurrent edit aborts for re-read rather than overwriting it. New indexes are additive and preprod only; deploy/verify READY before the query is exposed. Prepared runtime configuration must preserve live owner/mail settings, secrets and resources.

The read model uses indexed filters and limit+1 reads per page, with two bounded queries for effective expired status. It does not filter the first loaded25 records. No per-row customer lookup. Current scale fixture is10,000 synthetic customers/100,000 bookings; test results are recorded separately, not asserted by this document. No claim of production latency or concurrent-login capacity follows from emulator scale tests.

Rollback: revert frontend to its compatible previous revision and API if necessary; retain derived fields/indexes and business data. Do not roll back CMS, bookings, identities, credits, payments or notification ledgers. Production promotion will require an independent release branch/PR from main and the owner's review.

## Review and verification

Automated controller coverage includes server filter inputs, cursor reset, next/previous replacement, separate approval/check-in, deliberate decline and read-only controls, frozen retry after uncertain response. HTTP/emulator tests cover real policy, contacts/loyalty, bounded queries, outsider denial and invalid ranges. Browser review covers desktop, tablet and phone layouts and actual visible controls. Browser emulation does not certify physical-device or staff usability acceptance.

Before owner acceptance: try reviewing a request, adding a walk-in and checking in on both devices. Check navigation, text size, filter recovery, drawer context and whether each action's consequence is clear. Keep production held until that review.
