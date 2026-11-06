# Host Studio module design — proposal v1

Tracking: [website issue111](https://github.com/ArohaRetreat/website/issues/111).

Status: planning, not deployed behavior. This design follows the user’s6November2026 request to simplify booking administration for nontechnical hosts and account for10,000 customer accounts. Walk-in identity and loyalty are specified separately in [Walk-in booking design](walk-in-booking-identity-design-v1.md). It is a separate follow-on to the in-progress REST1.2/MCP0.2, payment ledger, private feedback and lifecycle release. No production data migration, infrastructure expansion or new search provider is approved by this document.

## What the current implementation gets wrong

- `functions/booking/store.mjs` bookingState retrieves25 reservations plus cursor and related calendar records, but `website/booking.mjs` searches and filters the already loaded array. The filter can report no matches while a matching record exists on another page.
- The state endpoint reads only the latest50 guest profiles, without a customer cursor. The Guests table and registered-guest select reuse that slice. An older customer can be impossible to select; that limit is neither a complete directory nor a scalable search interface.
- Some dashboard totals are computed from loaded records. They describe the page rather than the whole operational queue.
- Booking cards, calendar cells, details, offers, change requests, invoices and manual bookings share a crowded host surface. Status copy, controls and alignment do not give a nontechnical host a consistent next action.
- The overview still says payments are not connected. That copy must describe the delivered ledger state, not imply online payment collection.

Ten thousand stored accounts and ten thousand simultaneous users are different requirements. The former needs indexed bounded reads and usable navigation. The latter also needs measured authentication/API/database concurrency, rate limits and an explicit resource/cost decision. Neither is solved by rendering more rows or by frontend virtualization alone.

## Navigation and responsibilities

| Module | Default view | Primary action |
| --- | --- | --- |
| Needs review | Pending decisions ordered by review deadline; separate new requests, date changes and event offers | Review request |
| Reservations | Upcoming visits with server-side status/date/type filters | Open booking |
| Customers | Search prompt; no directory download on login | Find customer |
| Payments | Outstanding balances and recent immutable ledger entries | Open booking’s payments |
| Feedback | Private submitted feedback; no public reviews | Read feedback |
| Rooms & availability | Current readiness, bounded date window and blocks | Update readiness |
| Settings | Rates, policies, operational facilities and restricted access settings | Save one section |

Keep one Studio sign-in and module-aware navigation. A booking viewer sees read-only details; a booking manager gets eligible actions. Website/content administration and access administration remain separate permissions. Hide unavailable actions and explain the role when useful; never rely on hidden buttons for authorization.

## Booking decisions

1. The queue row has one action: **Review request**. Use plain statuses: **Needs review**, **Confirmed**, **Checked in**, **Completed**, **Declined**, **Cancelled**. Keep technical enum names out of the interface.
2. Open one detail panel with guest, visit dates/times in IST, party size, rooms, immutable quoted price and the exact decision needed. Contact is fetched only when permitted and required. A date-change request shows old versus requested dates/price; an unaccepted event offer explains why confirmation is unavailable.
3. Pin a consistent action area: **Back**, **Decline request**, **Accept booking**. Acceptance is one deliberate action after review; do not stack repeated confirmation dialogs. Decline expands a short inline confirmation because it rejects the guest’s request. Keep any internal note separate from guest-facing message.
4. The server rechecks current role, resource version, quote, hold deadline, capacity and readiness using the existing shared domain. Expired or conflicting requests cannot be accepted based on a cached green badge.
5. After a committed decision show **Booking accepted** or **Request declined**, with the resulting state and next action. Show email state separately: queued, sent to mail service, delivery failed, or no message configured. Do not claim the guest has read an email.
6. During a pending/uncertain response disable repeated submission and retain the same idempotency key and payload. A definite stale-version response reloads the current booking and explains what changed. A timeout is not a rejection and must not generate another decision or payment.

Decline currently does not have a promised guest-notification workflow. If the redesigned product promises a decline email, implement and test a separately versioned operational template and recipient policy before showing that promise. Do not silently send an internal decline note to the guest.

Check-in and checkout belong on confirmed/in-progress booking details, never beside Accept/Decline for a pending request. Checkout shows actual recorded payments and outstanding balance; completion does not imply payment. The new ledger and feedback operations are reused rather than reimplemented by the redesign.

## List and responsive layout

- Desktop: restrained table with Guest / Visit / Dates / Status / Amount / Action, stable column widths, aligned amounts and one consistent action column. Keep the toolbar outside the rows.
- Mobile: the same record hierarchy in compact cards, with dates/status first and one full-width review action. Use a sheet/detail page with a persistent action area; no clipped two-column forms or horizontal action-button overflow.
- Search, date range, status and sort are sent to the server. Changing any filter resets the cursor and cancels/discards the older request. The page labels the active filter and has explicit loading, empty, error and stale states.
- Default25 rows, maximum50. Use Next/Previous and cached cursor history; do not append every historical page into the DOM. Focus and scroll stay stable on return from a detail panel.
- Customer pickers are asynchronous comboboxes with bounded results, keyboard navigation and one selected customer. Never load all accounts into a native select. Explicitly distinguish an existing registered guest from a host-recorded private customer with no linked account.
- Do not derive queue-wide totals, payment balances, customer history counts or loyalty from the current table page.

## Proposed API contract1.3 surface

These are proposals, not additions to the shipped1.2 OpenAPI until implemented and tested. The interactive Studio and any future MCP tools must delegate to the same read/query/policy services. Existing approve/decline, payment, check-in/out, documents and feedback mutations remain the business authority.

| Read | Query contract | Permission/projection |
| --- | --- | --- |
| `GET /host/overview` | Bounded operational counters; returns `asOf` and freshness | Current booking staff; no customer identities |
| `GET /host/reservations` | `status`, `arrivalFrom`, `arrivalTo`, `kind`, approved `sort`, `limit`, opaque `cursor`; exact reference lookup | Booking staff, redacted rows; no private notes/contact |
| `GET /host/customers` | Name prefix or exact reference; `limit`, opaque `cursor`; empty query returns a search prompt, not the directory | New explicit `customers:read` scope plus current booking staff |
| `POST /host/customers/lookups` | Exact normalized email or E.164 phone; bounded query, no wildcard/suffix enumeration | Booking manager plus explicit contact scope; audited, rate-limited; no PII in logs/URLs generated by UI analytics |
| `GET /host/customers/{id}` | One selected customer | Current row/module policy; separate explicit contact projection |
| `GET /host/customers/{id}/reservations` | Status/date filter, `limit`, opaque `cursor` | Booking staff; bounded redacted history |
| `GET /host/payments` | Outstanding-only or ledger date window; `limit`, cursor | Existing payment read scope and current booking permission |
| `GET /feedback` | Existing private feedback page; add explicit supported filters in a compatible contract | Manager with feedback scope; guest text remains private |

Customer contact lookup uses a POST search request to keep private search values out of request URLs and infrastructure access logs. It remains a read-only business operation and must be annotated accordingly in MCP. Never infer read/write semantics solely from HTTP verb for such a future endpoint.

Every list returns `{items, nextCursor, appliedFilters, asOf}`. Detail versions use strong ETags. Cursors bind environment, actor, grant/version, normalized filters, sort, page size, last sort tuple and expiry; changing filters invalidates the cursor. Stable sort includes document ID as a tie-breaker. Cross-environment and cross-user replay fail closed.

## Query and data design

Use Firestore indexed range/equality queries and cursor pagination, not collection downloads, offsets or filtering after `limit`. This follows [Firebase’s cursor pagination guidance](https://firebase.google.com/docs/firestore/query-data/query-cursors).

Start with normalized name-prefix and exact reference/email/phone lookup supported by existing infrastructure. Avoid claiming arbitrary substring/fuzzy search. Current Firestore search capabilities vary by edition/API; native pipeline text search or an external service needs project capability, privacy, cost and migration discovery before selection. See [Firebase text search](https://firebase.google.com/docs/firestore/enterprise/text-search).

Maintain a minimal environment-isolated customer directory projection keyed by stable UID, populated from real profile updates and relevant booking changes. Keep display/search fields private, normalize Unicode consistently, and do not duplicate private notes, financial documents or full customer histories. Erasure removes searchable contact/profile fields; retained financial/reservation history does not silently recreate them. Host-private customers remain explicitly unlinked unless an authorized linking workflow exists.

Booking rows include the safe display fields needed by that page, avoiding one profile read per visible row. This requires a privacy-aware projection strategy; an erasure must invalidate a cached display projection as well. No historical source customer name is fabricated from an incomplete50-profile sample.

Operational counters are bounded materialized projections, partitioned by status/date as appropriate and updated through idempotent committed events or the authoritative transaction. Responses disclose freshness. Do not add a full scan or repeated global count query to every login. Make rebuild/reconciliation a bounded administrative operation with explicit progress; incomplete rebuilds cannot silently hide older customers.

Declare and deploy the required compound indexes before the read cutover. An additive, checkpointed backfill creates only necessary search/list projections; dry-run counts, explicit write scope, erasure handling, duplicate normalization and resumable progress must be reviewed before any production backfill. Existing bookings, approved prices, documents, contact snapshots, language content and immutable media remain authoritative.

## Validation and delivery sequence

1. Review the task flow and synthetic wireframe before a broad UI rewrite. This step changes no live data.
2. Implement/test versioned query contracts and projections, then replace customer picker and server filtering. Keep old route adapters during migration.
3. Replace the decision panel and aligned responsive rows. Reuse shared financial and feedback panels; correct stale overview copy.
4. Add permitted operational notification behavior only when its domain/template/recipient tests pass.
5. Validate with10,000 synthetic customers and at least100,000 synthetic reservations in an isolated dataset. Cover a customer older than the newest50, a match beyond the first25 bookings, ties, filter changes, erased profiles, access revocation and concurrent decisions.
6. Assert bounded page reads and payload sizes, constant visible row limits and no per-row profile fan-out. Measure cold/warm search and queue p50/p95, read amplification, error rates, keyboard/mobile usability and stale-response behavior. Publish measured results, not invented capacity guarantees.
7. Separately load-test the expected concurrent-login pattern against an approved nonproduction environment;3-instance production settings are not evidence for10,000 simultaneous users. Any resource/cost change is explicit.
8. Deliver issue-linked reviewed PRs, exact-head CI, independent preprod then production releases, and preservation/live-read evidence. No live synthetic booking/payment/email writes or automatic credential creation for acceptance tests.

Acceptance: an occasional nontechnical host can find an older customer, find a reservation outside the first page, understand the price and decision, accept or decline once, and identify the resulting booking/email/payment state without learning API terms or navigating overlapping dialogs.
