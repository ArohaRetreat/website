# Booking review prototype 0.1.0

Run `npm run dev:booking` from the repository root. Open [guest review](http://127.0.0.1:8782/prototype/booking/) or [host review](http://127.0.0.1:8782/prototype/studio/).

All accounts, rates, policies and reservations are synthetic. This local server does not connect to Firebase, email, payments, external calendars or Dynatrace. Production builds exclude it. Use the [review guide](../../docs/booking-prototype-review.md), [API contract](../../docs/api/aroha-booking-prototype-v1.json) and [service skill](../../skills/service-aroha-booking-prototype/SKILL.md) before changing it.

The prototype’s single-process queue and atomic JSON file commit model must be replaced by production resource-ledger transactions before real reservations are accepted. Loopback binding and explicit demo identity are deliberate. Do not publish this server.
