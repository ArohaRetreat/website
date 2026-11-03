# Booking prototype review — 0.1.0

Issue: [#50](https://github.com/ArohaRetreat/website/issues/50). Source branch `feat/booking-prototype`, based on website 0.16.3 / cec4a963840a4cf6a88e1d77d324dc3f8ea104ff. This is a standalone local prototype, excluded from the production website build and Firebase routes.

## Open the review

From the working checkout `/private/tmp/aroha-guest-experience`:

```sh
npm run dev:booking
```

- [Guest portal](http://127.0.0.1:8782/prototype/booking/)
- [Host Studio](http://127.0.0.1:8782/prototype/studio/)

Use **Demo sign-in** to select Ananya or Arjun. Use **Enter sample Host Studio** to enter the host view. These are explicitly synthetic accounts; neither Google identity nor host permissions are being exercised against production. Account selection applies to all tabs in the same browser, so sign in to the desired persona after switching views, or use separate browser contexts to compare guest/host side by side.

Sample bookings persist in the local OS temporary directory as `aroha-booking-review-v1.json`; demo sessions reset after a server restart. To start over, stop the server, rename this file to a backup, and restart. No CMS draft, live calendar, external account or real reservation is modified.

## Guest walkthrough

1. Choose a sample guest and future dates. Search whole-room availability. Dates use IST, departure is exclusive, and a stay is limited to31 nights within a365-day arrival horizon.
2. Select a tree-house/cottage placeholder, or multiple rooms for a larger group. Four currently identified two-person units provide eight configured beds within the owner's ten-person overnight limit. The fifth room remains unidentified and the four future rooms remain closed.
3. Review the sample INR quote, optional private request and cancellation/approval terms. Try `SLOWDAYS` for a10% illustrative discount. Your tier benefit and promo do not stack; only the better offer applies.
4. Submit after acknowledging the sample terms. The request becomes **Awaiting host approval**, holds the selected rooms and appears under Your visits. A reference and review deadline are visible. No payment is collected and no email is sent.
5. Open details, edit the private note or cancel the request. After a host approves it, request new dates: the original stay remains reserved until the host approves the replacement. Replacement dates are not held while a change request is waiting.
6. Review upcoming, past and cancelled lists and the Visitor/Friend/Family progress. Ananya begins with five completed sample stays. Friend begins at6 and Family at10. Only completed stays count; a multi-room booking counts once.

## Host walkthrough

- **Overview:** review the pending queue and capacity/readiness notices. Open a request to approve, decline or cancel it. Check-in and completion enforce stay dates; future stays cannot be marked completed to earn early credits.
- **Calendar:** browse a14-day room timeline and occupancy totals. Select a booking for details. Select an empty future room cell to create a maintenance block; release it from the calendar or inventory view. Conflicting blocks are rejected.
- **Reservations:** search guest/reference/room and filter by status. Use Add host reservation for a sample phone/WhatsApp request on behalf of a sample guest. Review its quote, create it pending, then approve explicitly.
- **Rooms & inventory:** edit active-room sample rates, occupancy and request availability. Closure/reduced-capacity changes that invalidate reservations are rejected. Fifth/future-room activation deliberately remains gated on a later verified room configuration flow.
- **Rates & offers:** create a generated/custom invitation code, percentage/fixed discount, validity dates and redemption limit. Pause/reactivate it. Pending reservations reserve redemptions; cancellation releases the prototype usage.
- **Guests & loyalty:** inspect completed-stay counts and tiers. Change sample thresholds/benefits under policies. Historical credit imports and manual corrections remain a production follow-up.
- **Booking policies:** adjust the ten-person site cap, approval window, cancellation cutoff, tier thresholds and sample discounts, or pause new requests. Existing booking cancellation terms remain snapshotted. Review local operational history.
- **Website changes:** inspect the proposed grouping of all current editing categories. The existing live Host Studio opens separately, with an explicit live-site notice. This prototype does not impersonate or replace the existing CMS editor.

The prototype defaults to a24-hour host-review deadline and48-hour confirmed-stay cancellation cutoff; these remain sample settings. Pending requests can be cancelled immediately. Late confirmed cancellations require the host. The defaults do not establish actual property tariffs, tax treatment, payment terms or cancellation charges.

## Technical boundaries and next steps

The [prototype OpenAPI contract](api/aroha-booking-prototype-v1.json) describes the actual `/prototype-api/v1` routes. [The full plan](booking-module-plan.md) describes the intended production module. Server-side rules enforce owner/capability boundaries, idempotency, current versions, room/date capacity and quote changes. JSON state is cloned and committed by atomic file rename under a single-process queue. That proves local prototype consistency; it does not prove distributed production booking correctness.

Before real bookings: verify room identities/occupancy and all rates/terms; import existing offline commitments; implement verified Firebase guest identity and host capabilities, Firestore resource-ledger transactions, rules, ready indexes, pagination/retention, abuse controls and production expiry/reconciliation. Day visits require capacity and slot policies. Room inventory needs the complete verified activation flow. Operational calendar, offers and guest privacy need owner review.

Audit/outbox events are local committed records with private notes excluded. Delivery is `not_configured`. No Dynatrace records, email deliveries or external calendar events are emitted by this prototype. A later email integration needs sender/provider decisions, templates, delivery/retry/deduplication and an explicit cutover/replay policy. No historical prototype events should be sent to guests.

## Verification

Run `npm run test:booking`, `npm test`, `sh scripts/check.sh` and `npm run build`. The application CI runner discovers `tests/*.test.mjs`, including booking tests. Tests use isolated synthetic temp state and loopback servers. Read the [continuation](../skills/service-aroha-booking-prototype/continuation.md) for actual current results and open visual verification. Browser review, physical-device acceptance, CI, merge and deployment are separate gates.

The UI interaction test uses pinned jsdom26.1.0, compatible with the repository's existing Node baseline. It executes the guest/host DOM controllers against the real local API, including note edits, date changes, cancellations, promo creation, policy saves and host-created reservations. jsdom does not evaluate layout, contrast, real modal focus, browser console behaviour or phone rendering; passing it cannot certify visual acceptance.
