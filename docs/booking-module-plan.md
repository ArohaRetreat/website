# Aroha booking module — proposed implementation plan

Status: proposed production design, 3 November 2026. The owner subsequently authorised a local prototype, tracked in issue50; see the [review guide](booking-prototype-review.md). Production inventory, account, infrastructure and deployment changes remain outside this prototype. Website baseline: 0.16.3 / cec4a963840a4cf6a88e1d77d324dc3f8ea104ff. Emails are a subsequent integration.

## Confirmed requirements and decisions

- Signed-in guests can request a stay or configured visit slot, add private comments, see their bookings, and cancel under the applicable policy.
- Host approval is required before confirmation (owner decision in this conversation).
- Current overnight capacity is **10 people across approximately five rooms**, correcting the initial 20-person statement (owner clarification).
- The original breakdown identifies two tree houses and two cottages. The fifth room's identity, occupancy and readiness remain to be mapped. Do not invent it or automatically advertise five equivalent rooms.
- Four large rooms under construction may each hold five people. They remain inactive until the host explicitly opens them. Do not infer a future site capacity by adding beds together.
- Inventory, capacity, rates, booking policies, discounts, promo codes and loyalty rules need operational administration.
- Existing website editing moves under **Website changes**; **Bookings** becomes a separate Studio module. Preserve existing draft/publish/history semantics and all host copy, including English/Kannada welcome text.
- Tiers requested: Visitor, Friend after more than five stays, Family at ten or more stays. Benefits and calculation details below are proposed.

## Product boundaries

Deliver a real reservation system with a host approval queue and an authoritative Aroha calendar. This replaces the relevant enquiry-only claims only when the complete booking flow is released. Public website exploration and existing WhatsApp enquiries remain available.

An in-app Retreat calendar is included. Google Calendar integration is not implied by the word calendar; establish whether an external calendar is required before adding it. If later connected, it is a downstream projection of confirmed Aroha reservations, not the inventory authority. Private guest comments must not be exported by default. No invitations or email are sent in this phase.

Online payments remain excluded. Decide rates, taxes/fees, payment-at-property terms and cancellation charges before enabling priced bookings; do not invent tariffs or present a refund mechanism without a payment system. Approval is a real reservation confirmation, separate from any later financial collection or message delivery.

## Guest experience

Introduce `/book/` and `/account/`, registered in the shared public-page registry. Keep the botanical identity, actual accommodation photography, forest surfaces and steady readable controls. The booking interface should prioritise dates, availability and clarity over decorative motion. It must work on phones, keyboard, reduced motion and at 200% zoom.

1. **Arrival after sign-in:** successful guest login opens the booking portal, as requested. Existing guests see an upcoming-booking summary and clear Book a stay / My bookings actions. An explicit booking intent restores selected dates after login. A restored session does not repeatedly redirect on every public page or interrupt Host Studio sign-in.
2. **Choose a visit:** overnight dates or an enabled day-visit slot, adults/children and party size. Overnight uses arrival/departure dates with visible check-in/out times; day visits use host-configured slots. Do not enable day visits until their capacity and operating hours are defined.
3. **Choose accommodation:** show only eligible active units, real photos, maximum occupancy, amenities, accessibility facts and price basis. Support multiple rooms in one reservation with explicit guest allocation. Shared-room versus whole-room selling is an explicit inventory setting; initial recommendation is whole units, without strangers sharing a room.
4. **Review:** stable date/guest/unit summary, itemised server-calculated price, eligible loyalty benefit, optional promo code, private special-request field and clear cancellation/approval terms. Comments are requests, not guarantees. No public reviews/comments feature is inferred.
5. **Submit:** create one durable request and reserve its inventory atomically. Show a reference, **Awaiting host approval**, approval deadline, terms and My bookings link. Do not label it confirmed or claim email delivery.
6. **Manage:** upcoming/past/cancelled tabs, booking detail, status history, requests/comments, approved price, cancellation action and loyalty progress. A change to dates, room or party requires a new availability/price check and host reapproval; keep the current reservation until replacement succeeds atomically.

Unauthenticated users may browse the booking entry, but identifiable booking access and mutations require verified identity. Proposed availability/quote endpoints initially require login to bound abuse; revisit anonymous search after operational testing. Preserve a non-executable local date/guest draft across login only; do not persist private comments in browser storage.

Calendar UX: disabled dates explain unavailable versus outside booking window; accessible typed date inputs accompany a visual range picker; never rely on colour alone. Show no-availability alternatives, loading/retry states, stale quotes, expired requests, session expiry and a clear recovery path. A sticky mobile summary must leave fields and native scrolling unobstructed. English/Kannada interface support should follow the site's content policy, with host-approved operational copy.

## Host Studio structure

| Module | Included controls |
| --- | --- |
| Website changes | All existing brand/welcome, layout, tour/films, Living Map, cottage descriptions, experiences, packages, contact/FAQs, design/motion, preview, backup and published history |
| Bookings: overview | Requests awaiting approval, today's arrivals/departures, expiring requests, occupancy and operational warnings |
| Bookings: calendar | Room-row timeline, month/list alternatives, day-visit capacity, pending/confirmed/blocked states, filters and accessible booking details |
| Bookings: reservations | Search by reference/approved fields, bounded list filters, approve/decline/cancel, check-in/out, no-show, host-created phone/WhatsApp bookings and change requests |
| Bookings: inventory | Unit types, individual units, occupancy, active dates, maintenance blocks, operating hours, stay limits and effective-dated overall capacity |
| Bookings: rates & offers | Per-unit/per-person basis, seasonal/date rates, weekday/weekend rules, fixed/percentage discounts, promo generation, validity and usage limits |
| Bookings: guest loyalty | Completed stays, tier rules/benefits, audited historic-stay imports/corrections and guest-visible progress |
| Bookings: policies | Approval deadline, notice periods, check-in/out, day slots, cancellation and request-edit policies, booking pause and lead-time/horizon |
| People & access | Existing protected host membership/invitations; booking capabilities are explicit and separate from website editing |

Website draft/publish controls appear only in Website changes. Operational booking changes have their own save/confirmation, versioning and audit; publishing a website draft must never change reservations or inventory. Switching modules preserves unsaved website edits. All content edits start from the current host draft, never from a wholesale seed import.

Proposed initial permissions: admins/super-admins manage bookings and operational settings; existing editor/viewer roles gain no guest-data access by default. Add narrower reservation-operator/read-only capabilities only through an explicit capability policy, not by broadening content editor permissions. Host manual bookings obey the same availability and capacity rules. Admin authority never silently permits overbooking.

## Inventory and time model

Use separate versioned records for accommodation types, individual sellable units, site-capacity policy, rate plans, operating slots and maintenance blocks. Marketing cottage cards may reference unit types, but are not inventory records. Bookings snapshot unit labels, prices, terms and policy versions so future configuration changes do not rewrite history.

Initial configuration proposal: overall overnight limit 10; individually verify capacities and availability for the two tree houses, two cottages and the fifth room. Only verified units can be sold. New large rooms start inactive. Capacity changes use effective dates and a conflict preview; reject reductions, closures or room deactivation that invalidate existing commitments until hosts resolve them. Deactivation does not delete a referenced unit.

Use Asia/Kolkata for all business rules and local stay dates; store event timestamps in UTC. Overnight ranges are half-open `[arrivalDate, departureDate)`, so checkout day can be sold again subject to cleaning buffers. An overnight room lock is per unit/night, extended for configured turnaround rules. Separate property-occupancy slots must include overlapping overnight presence and day visits; a nightly bed count alone cannot enforce a simultaneous on-site visitor limit. Day-visit capacity, counting of children/infants, cleaning time and day/overnight overlap require host settings before that booking type opens.

Do not promise arbitrary hourly booking for overnight rooms. Configured day slots and whole-unit overnight bookings provide a bounded first model. Whole-retreat/exclusive-use reservations can be supported by locking all sellable units plus site capacity; their pricing and whether this is needed at launch remain a decision.

## Reservation lifecycle and concurrency

Proposed states: `pending_approval → confirmed → checked_in → completed`, with permitted branches to `declined`, `expired`, `cancelled` and `no_show`. Define a transition table in the contract, including actor, prior state, expected version, allocation effect and audit event. Operational corrections create compensating history rather than deleting records.

- A quote is short-lived and does **not** hold inventory. Final submission rechecks price, eligibility and availability.
- Pending approval reserves inventory until an explicit deadline; a proposed starting default is 24 hours, constrained to expire before arrival and configurable by host. The owner has approved host approval, not this deadline. Without email, hosts need an operational review routine and a visible queue; never imply unattended alerts exist.
- Confirmed reservations consume inventory until cancellation or departure. Approval after expiry cannot resurrect a request without a fresh allocation check.
- Cancel/decline/expiry releases only that reservation's allocation and reserved offer usage, exactly once. Guest cancellation is immediate within the agreed policy; outside self-service terms offer a cancellation request, retaining inventory until resolved. Admin cancellation is explicit, reasoned and audited.
- Prevent request spam with per-account active-request limits, bounded party/stay/horizon sizes, endpoint rate limits and duplicate submission protection. Authenticate independently of optional analytics consent.
- Use deterministic unit-night/property-slot ledger document IDs. All competing creates, approvals, moves, cancellations, maintenance blocks and policy changes must transact through the same ledger and guard/version records. Searching overlapping bookings and then writing a new document is insufficient.
- In one Firestore transaction, read all applicable config guards, resource/slot allocations, active pending leases, booking version, promo reservations and idempotency record **before** writing. Evaluate effective expiry using trusted server time, enforce unit and aggregate limits, then write reservation, allocations, audit and delivery outbox. Reject conflicts without partial changes. Read-only search is advisory; the final transaction is authoritative.
- Expired allocations are ignored/reconciled consistently during these transactions, including promo limits, even if cleanup is late. A bounded worker reconciles expired request states; TTL is only eventual housekeeping. Firestore documents explain that TTL deletion is not immediate and that transaction callbacks may rerun; no emails, external calendar calls or telemetry transport side effects belong inside callbacks. See [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions) and [TTL](https://firebase.google.com/docs/firestore/ttl).
- Bound ledger size, booking duration and search range at contract design; prove maximum transaction read/write counts with representative multi-room bookings. Retry contention within a limit and return a useful conflict response. If the model outgrows these bounds, revisit the datastore rather than weakening exclusivity.

## Prices, promotions and loyalty

All money uses integer minor units with explicit currency (proposed INR), price basis and itemised amounts. Server-generated quotes include `quoteId`, expiry, policy/rate versions, eligible discount and a snapshot of cancellation terms. Totals never come from client-submitted prices. Refresh a changed quote and ask the guest to review before submission; never silently increase a price.

Promotion configuration: generated or chosen code, fixed/percentage amount, maximum benefit, minimum spend, eligible units/visit types/tiers, booking-date and stay-date windows, global/per-account limits, active state and explicit stacking policy. Proposed default: one best eligible offer rather than cumulative stacking, pending owner approval. Normalise codes; generate unguessable private codes, restrict enumeration and redact codes from telemetry. Manual discounts require permission and reason; zero/negative totals and discounts above the allowed subtotal are rejected.

Reserve a limited-use promotion on pending submission, consume on confirmation, release on expiry/decline; specify whether confirmed cancellation restores usage before launch. All usage changes are atomic and idempotent. Revoking a code stops new use without rewriting existing accepted terms. Quote eligibility alone never guarantees a remaining redemption.

| Tier | Proposed qualifying completed overnight stays |
| --- | --- |
| Visitor | 0–5 |
| Friend | 6–9, matching “more than 5” |
| Family | 10+ |

Count host-verified completed stays, not reservations submitted, nights, cancelled visits or promo redemptions. A multi-room stay counts once for the account owner. Initial proposal is lifetime qualifying overnight stays; day visits and group companions receive no automatic stay credit. Define split/back-to-back reservation handling to prevent tier farming. Any broader companion credit requires verified identity and explicit rules. Host corrections/imports are audited and deduplicated; reversing a completion reverses its credit. Show progress without inventing discounts. Tier benefits, threshold edits and downgrade policy require host configuration; preserve benefits already contracted on an existing booking.

## Proposed versioned API contract

Extend `/api/v1` with a separately owned booking domain and OpenAPI contract `docs/api/aroha-booking-v1.yaml` before implementation. Do not repurpose `/session`, which currently admits host members. Guest Firebase authentication is distinct from host membership admission. Shared validators/policy functions serve guest UI, Studio and any future MCP adapter; adapters cannot bypass them.

| Proposed route | Purpose / authorization |
| --- | --- |
| GET `/booking/config` | Safe enabled products/policies; verified guest, no private operational data |
| POST `/booking/availability` | Bounded dates, party and room search; verified guest; aggregate availability only |
| POST `/booking/quotes` | Server-priced short-lived quote, eligible tier/promo; verified guest |
| POST `/bookings` | Idempotent pending request from quote; verified guest |
| GET `/me/bookings` | Own bookings only, filter-bound cursor |
| GET `/bookings/:id` | Owner or authorised operator, projected by permission |
| POST `/bookings/:id/cancel` | Owner within policy, or authorised operator with reason |
| POST `/bookings/:id/change-requests` | Proposed date/unit/party change; versioned, no premature release |
| PATCH `/bookings/:id/guest-note` | Owner, bounded private comments, status/version restrictions |
| GET `/me/loyalty` | Own tier, eligible completed-stay count and progress |
| GET `/admin/bookings` and `/admin/booking-calendar` | Explicit booking-read capability; bounded queries |
| POST `/admin/bookings` | Host-created reservation, same availability engine |
| POST `/admin/bookings/:id/actions` | Allowlisted approve/decline/check-in/complete/no-show/cancel/correction actions |
| GET/PUT `/admin/booking-settings` | Versioned policies and effective dates; manage capability |
| GET/POST/PATCH `/admin/booking-units` and `/:id` | Versioned unit inventory; manage capability |
| GET/POST/PATCH `/admin/booking-blocks` and `/:id` | Versioned maintenance/closure blocks; conflict-safe |
| GET/POST/PATCH `/admin/booking-rates` and `/:id` | Versioned effective-dated pricing |
| GET/POST/PATCH `/admin/booking-promotions` and `/:id` | Restricted promo management and redemption summaries |
| POST `/admin/booking-loyalty-adjustments` | Audited correction/import with reason and deduplication key |

Freeze detailed request/response schemas, action transitions, permission matrix and limits in OpenAPI before coding. Mutations require `Idempotency-Key`; store a scoped request hash and durable replay result. Same key/body returns the original result, same key/different body returns conflict. Updates require `expectedVersion` or equivalent precondition; ownership and current membership/capability are rechecked inside mutations. Never accept a guest-supplied owner UID, tier, role, total or confirmation state.

Proposed bounds: 31-night stays, 365-day booking horizon, 62-day calendar/search windows, 25 bookings/page, 1,000-character guest note and strictly bounded unit/party counts. These are engineering starting points to approve, not live property policies. Calendar responses use projected bounded records and pagination where needed; cursors are opaque, tamper-resistant and bound to actor/filter/sort. Private notes/contact details do not appear in bulk calendar payloads. Stable secondary sort keys prevent paging omissions/duplicates.

Use existing `{error:{code,requestId}}` convention and safe field validation details. Include 401/403/404 ownership denial, 409 `AVAILABILITY_CHANGED`, `QUOTE_CHANGED`, `VERSION_CONFLICT`, `PROMO_EXHAUSTED`, `IDEMPOTENCY_CONFLICT`, `INVALID_TRANSITION`; 410 `QUOTE_EXPIRED`; 422 policy/input errors; 429 rate-limit and bounded dependency failures. Private responses are `no-store`. Public availability never exposes other guests.

## Data, security and service ownership

Proposed private collections: booking settings/units/rates/blocks; bookings and bounded allocation ledgers; quotes/idempotency; promotions/redemptions; guest loyalty/credit ledger; booking audit and delivery outbox. Choose final names and indexes in the contract. The existing published site and host draft remain separate and unchanged.

All booking access passes through verified server APIs. Deny direct browser Firestore writes/reads for private booking collections. Guests read only their own projected records; unguessable references do not substitute for authorization. Verified Google login does not grant host access. Preserve revoked-token checks and active host-membership checks. Avoid collecting companion identities or sensitive medical details; notes should ask guests not to include sensitive data. Separate guest-visible requests, guest-visible host responses and private staff notes.

Define guest-data retention, access/export/deletion and handling of retained business/audit records before launch. Financial/legal policies need owner review rather than invented compliance claims. Mask private booking screens/inputs for telemetry and disable automatic free-text capture. Analytics consent remains independent; transactional booking access does not require marketing consent.

Register the independently maintained booking domain through the service-skill catalog before implementation, with entrypoints, contract, tests, migration/rollback and continuation. Keep the API thin and move inventory, price, promo, loyalty and lifecycle policy into shared testable domain code. Reuse Firebase/Functions in asia-south2 unless verified transaction bounds show a reason to change; no new booking SaaS is assumed.

## Observability and email seam

Server-confirmed audit/outbox events: booking requested/confirmed/declined/cancelled/expired/changed/completed, inventory blocked, promo reserved/redeemed/released and loyalty credit adjusted. Include stable event ID, operation, bounded outcome/reason, resource version and committed timestamp. Private IDs may be restricted in audit/logs where allowed; never use them as unbounded metric dimensions. No comments, names, email addresses, promo codes or tokens in telemetry.

Measure API latency/errors, allocation conflicts, pending/expiry counts, worker lag and outbox retry backlog with bounded dimensions. Keep browser attempted actions distinct from durable committed outcomes. Correlate using actual OTel context; do not invent native RUM-to-backend evidence.

Write a durable event outbox in the booking transaction now, with versioned event payloads and stable aggregate/event identifiers. Future email/calendar workers must project only necessary data, deduplicate deliveries, retry safely and show failure separately. Until a real consumer exists, record notification delivery as not configured; do not accumulate a queue presented as active email delivery. Integration activation needs an explicit historical replay/cutover policy to avoid sending old confirmations. No email provider, sender domain, templates, consent assumption, scheduled external sends or calendar credentials are selected here.

## Delivery sequence and acceptance gates

1. **Contract and policy approval:** map five rooms and 10-person limit, define day capacity, approval expiry, prices/terms, cancellation, tier credit/benefits and calendar scope. Produce OpenAPI, transition/permission matrices, ledger bounds and two phone/desktop booking/Studio designs. Parent GitHub issue and linked implementation slices follow acceptance of this plan; do not claim an issue or PR exists yet.
2. **Inventory and transactional core:** register booking service, deny-by-default rules, indexes, configuration, rates/quotes, allocation engine and host-created reservations. Gate on real concurrent emulator tests before guest writes are enabled.
3. **Guest requests and host approval:** `/book/`, signed-in entry, comments, My bookings, cancellation/change handling, Studio queue/calendar and explicit operational saves. End-to-end pending → approval → display → cancel must work without email.
4. **Offers and loyalty:** admin promo/rate controls, usage lifecycle, completed-stay credit, tier progress and audited corrections. These are part of the complete module, not decorative placeholders; the end-to-end module is incomplete until this slice passes.
5. **Hardening and controlled launch:** accessibility/responsive/browser review, real Google identity verification, bounded abuse controls, data/privacy review, owner-approved inventory and policies, index readiness, feature-gated rollout and reconciliation checks. Deploy API/rules/indexes before UI activation; preserve exact pinned Natura `/design` composition and host CMS content. Record implementation, CI, deployment, live flows, searchable telemetry and physical-device acceptance separately.
6. **Email integration design next:** choose provider/sender, templates, host/guest notifications, delivery status/retry and replay policy against the existing committed-event seam. This phase does not block in-app booking correctness but its operational absence must be visible at launch.

Required tests include two guests contending for the last unit/site slot; multi-room atomic failure; expired allocation cleanup delayed; expired approval racing a new request; duplicate submits/retries/cancellations; stale quote/rate/config edits; host role revocation during mutation; capacity reduction/maintenance conflict; same-day turnover and day/overnight overlap; guest ownership/IDOR denial; promo last-use race and cancelled redemption policy; duplicate completion/reversal and tier thresholds at 5/6/9/10; preserved dirty CMS edits across module navigation; sign-in return flow; no private data in telemetry; and outbox failure without loss of the committed booking.

Before activation, reconcile all existing offline/WhatsApp bookings into the same calendar to prevent selling already-promised rooms. Keep a booking kill switch that stops new requests without deleting or hiding existing reservations. Hosting rollback must not undo booking data or revive stale inventory; maintain backwards-compatible APIs and an admin reconciliation route. Use synthetic data in emulators; any production booking/cancellation verification write requires explicit authorization.

## Remaining owner decisions

- Exact fifth room, per-room capacities, whole-room versus bed sharing and whether the site-wide 10-person cap includes day visitors.
- Day visits at launch, slots/hours, child/infant occupancy rules and exclusive-retreat reservations.
- Price basis and actual rates, fees/taxes, payment-at-property terms, cancellation/change cutoffs and pending-approval deadline.
- Tier benefits, lifetime versus rolling counts, qualifying visit rules and promo stacking/cancellation restoration.
- Internal calendar only or a specific external Retreat calendar to synchronise later.

These decisions block only their dependent features/configuration, not independent contract/design work. This document is a reviewable plan, not a claim that bookings or notifications are implemented.
