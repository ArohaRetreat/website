# Walk-in booking and loyalty — design proposal v1

Tracking: [website issue111](https://github.com/ArohaRetreat/website/issues/111).

Status: planning only. Complements [Host Studio module design](host-studio-scale-design-v1.md). This proposal is not implemented by the current106-operation API release and creates no accounts, customer links or bookings. The user explicitly requests manual admin booking with email and phone, email-associated loyalty, and past booking visibility after Google sign-in with that email.

## The host’s flow

One entry point: **Add booking** in Host Studio. Do not ask the host to choose between technical categories such as offline principal, UID, private owner or registered account.

1. **Guest details.** Name, email and phone with country code are required. Search for an existing customer as the host types; show only a few permitted matches. Selecting a match fills the details and shows a clear existing-customer label. A new email creates a customer record, not a Google/Firebase account. Ask the host to confirm the email and phone with the guest before saving. Do not silently match or merge two people using a phone number.
2. **Visit details.** Visit type, actual dates/times, adults/children and required rooms. Walk-in defaults to today; future manual bookings use the same form. Show eligible availability and the server-calculated current price, including any applicable existing loyalty benefit. No hidden capacity override or arbitrary discount.
3. **Review and confirm.** One summary of guest, contact, visit, price and intended status. Primary button: **Confirm booking**. A booking manager’s valid manual booking is confirmed directly; it does not enter a second approval queue for the same manager. Recheck capacity, room readiness, current price, grant/role and version in the shared business transaction.
4. **Result.** Show booking reference, confirmed state and email status. Offer **Check in now** only when the booking is eligible. Offer **Record payment** as a separate explicit action. Creating a booking never implies cash was received, checkout occurred or loyalty was earned.

A walk-in’s arrival today may need a host-specific booking window instead of the public advance-booking cutoff. Specify and test that domain rule explicitly; do not backdate a public quote or bypass capacity. Imported historical reservations remain a separate restricted migration workflow, not an ordinary walk-in option.

Registered and not-yet-registered customers use this same host flow. Host-recorded exclusive/private arrangements keep their existing business rules where appropriate, with no duplicate portal or hidden account assumptions.

## The guest’s experience

- The operational confirmation goes to the reviewed booking email under the existing delivery policy. It explains: **Sign in to Aroha with this email to see your visits and loyalty.** It must not promise an account already exists.
- On a successful verified Google sign-in, the server links eligible unclaimed customer records for that exact normalized email to the authenticated Firebase UID. The client cannot supply a different claim email or target UID.
- The guest sees the linked booking in **Your visits**, along with current private documents and eligible loyalty. Past completed visits appear as history; future confirmed visits remain upcoming.
- Existing account bookings and claimed walk-ins are deduplicated into one paginated history. No historical notification is resent because a record was claimed.
- A different signed-in email does not expose the record. Phone possession alone cannot claim it. The interface gives a simple **Booking missing? Contact your host to check the email** path without exposing other account identities.

Normalization trims surrounding whitespace and uses the established case-normalization policy. Do not invent Gmail-dot, plus-address or provider-specific equivalence rules; the Google-verified email is the proof source.

## Loyalty follows actual visits

The canonical customer record can hold earned visit credits before the guest creates an account. Associate those credits with the booking/customer/email record, then expose them to the verified account when it is linked. A manual form submission by itself earns nothing.

- Keep the existing eligible-stay and tier rules. Only an actual host-recorded eligible completion contributes; pending, cancelled, declined, no-show, day and event records do not acquire an overnight stay credit merely because they were manually entered.
- A completion creates one idempotent credit source for that booking. Overlapping/connected reservations follow the current shared stay-counting rules rather than counting the same physical visit twice.
- Account linking never creates a second credit. It changes the account association/read projection and reconciles the same underlying source ledger.
- If the email already belongs to a linked customer, reuse that customer’s legitimate existing loyalty when pricing a new eligible booking. If the account has not signed in yet, preserve eligible completed credits in the customer ledger for eventual claim.
- A later claim or contact correction does not silently recalculate past quoted prices, refund a difference or overwrite an invoice. Apply current benefits to future eligible quotes through the normal pricing service.

## Identity and corrections

Use a stable environment-isolated customer ID independent of mutable email. Suggested states are **Unclaimed** and **Linked**, with **Needs review** only for a real conflict. These states are engineering metadata; ordinary hosts see “Not signed in yet” or “Account connected” where useful.

A proposed customer record contains a stable ID, reviewed contact fields, normalized private lookup fields, contact version, origin and restricted account-link metadata. Do not create fake Firebase UIDs, fabricated Google identities or placeholder user accounts for walk-ins.

A verified account may be linked to the permitted customer records matching its email, but an already linked record must never be reassigned to another UID solely because that email later appears on a different account. Conflicts go to an audited manager workflow; no silent merge or account takeover through customer editing.

Contact correction is separate from identity reassignment:

- Before claim, a manager may correct a mistyped email/phone using the current customer version, a reason and an explicit contact review. The corrected email controls future claiming. Preserve restricted history and prevent the old email from claiming after the correction commits.
- After claim, changing the booking’s delivery contact does not transfer account ownership or loyalty. Account-link correction needs a distinct, permission-protected review and revokes stale access bindings atomically.
- A staff-entered email is not ownership proof. Verified sign-in proves control of the reviewed address; contact read-back reduces mistakes but does not make a typo impossible. Ambiguous duplicate/linked identities are not auto-merged.
- Do not put raw email/phone into public document IDs, logs, metrics, spans, URLs or client-side analytics. Private exact lookup is server-side and explicitly scoped. Audit actor, customer/booking IDs, versions and reason codes; restrict detailed contact-change history.

## Shared ownership and immutable documents

Linking must update the shared ownership resolver used by the website, Studio, REST and MCP. A UI-only workaround is insufficient.

Preserve the original booking and financial document snapshots. Use a separate versioned guest-access/customer-account binding and a bounded guest-history projection, or an equivalently reviewed canonical identity model. Do not simply overwrite booking.owner while leaving invoice.owner, jobs, profile counters and policy checks inconsistent.

All own-row queries and detail/mutation/document/feedback checks must resolve the same current binding. Guest-owned actions remain subject to their normal eligibility rules; linking does not grant access to host-private notes or management actions. Pagination merges/deduplicates original account bookings and claimed customer bookings without downloading all history.

Profile erasure removes eligible searchable/contact data and suppresses optional follow-ups according to the domain policy, while retaining required booking/financial/audit history. A later login must not silently recreate erased profile PII from an old walk-in projection. Account access and retention behavior require explicit tests during the identity refactor.

## Proposed contract additions

These belong to a later reviewed contract revision, not the current1.2 published surface. Reuse existing scoped payment, checkout, document and feedback operations.

| Operation | Contract and policy |
| --- | --- |
| `POST /host/customers/lookups` | Read-only business lookup with a typed name-prefix, exact reference, exact email or exact phone request. Bounded results; no private query text in URL/logs. Booking staff see redacted matches; contact lookup needs manager/current contact permission. Annotate read-only explicitly in a future MCP tool despite POST transport. |
| `POST /host/manual-bookings` | Required name/email/phone plus visit/room selection and accepted current quote. Manager only; explicit customer selection or create decision, stable Idempotency-Key, server validation and atomic conflict checks. Return booking, customer-link status and notification state. Do not accept arbitrary UID/owner fields. |
| `GET /host/customers/{id}` | One selected customer and permitted loyalty summary, versioned; contact projection separately scoped. |
| `PATCH /host/customers/{id}/contact` | If-Match, Idempotency-Key, reviewed correction and reason; cannot reassign a linked account. |
| `POST /me/customer-link` | Uses only the principal’s current verified Google email and UID; no supplied email/target UID. Idempotent linking/reconciliation and a real completion receipt. Website may invoke it after verified sign-in to satisfy automatic history visibility. External/MCP access, if exposed, needs an explicit own-account link scope and the same live verification. |
| `GET /me/reservations` | Unified bounded guest history with cursor, filters and no duplicates across original/claimed bookings. |
| Restricted account-link correction | Separately designed conflict/recovery workflow; never an ordinary contact field or silent email-based transfer. |

All mutations recheck identity, active membership where needed, grant/client state, current resource version and policy inside commit. Grant widening is never implicit. Existing mcp-readonly tokens acquire no new tools. Staff writes cannot choose a guest’s verified identity for them.

## Scale and acceptance

Use the search-first, server-filtered25/default50/max lists in the Host Studio design. A10,000-customer directory must not be loaded into state, a select or the page DOM. Normalize/index lookup fields; bind cursors to actor/grant/environment/query/sort/expiry. Exact phone/email lookup and name-prefix lookup have distinct query contracts. Do not adopt a new full-text provider or infrastructure tier without explicit discovery.

Before production implementation passes:

1. Walk-in with new email and valid phone → one confirmed booking, optional explicit check-in/payment, one customer record; no Firebase account fabricated.
2. Same-email verified Google sign-in → prior booking visible automatically and the same eligible credits exposed exactly once.
3. Different/unverified email, phone-only attempt, caller-supplied UID or email → no claim and no data disclosure.
4. Two hosts entering the same customer, two concurrent logins, and repeated completion/claim requests → deterministic customer resolution, no duplicate booking/credit and no account reassignment.
5. Mistyped email corrected before claim → old address cannot claim; a post-claim contact edit cannot move ownership.
6. Already registered customer → correct existing customer and legitimate tier, no duplicate profile; old prices/documents remain unchanged.
7. Cancelled/no-show/day/event or uncompleted visit → no unearned overnight credit.
8. Access revocation, erasure, immutable PDF ownership, private feedback and all transports → one consistent authorization result.
9. A customer older than the latest50 and a booking beyond the first25 are discoverable in a10,000-customer synthetic dataset with bounded reads and no per-row profile fan-out.
10. Nontechnical host can complete the three-step flow and distinguish booking confirmation, payment, check-in, completion, loyalty and email delivery without technical labels or overlapping dialogs.

Production backfill/linking is a separate reviewed migration: dry-run deterministic matches, report ambiguity, checkpoint progress, preserve all original records/documents, and verify independently before enabling automatic claims. This plan does not authorize a bulk production reassignment.
