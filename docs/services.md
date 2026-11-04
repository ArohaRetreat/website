# Service inventory

The [catalog](../skills/catalog.json) registers foundation tooling, the Aroha website/host studio and the Firebase API. Natura is maintained in its separate repository; only pinned exported assets are dependencies here. Read the affected service skill and continuation before changing code.

The [booking prototype](../skills/service-aroha-booking-prototype/SKILL.md) is an independently maintained local review module under `prototypes/booking/`. It uses synthetic sessions and isolated JSON persistence, has no production routes and is excluded from the website build. See [review instructions](booking-prototype-review.md).

The [production booking domain](../skills/service-aroha-booking/SKILL.md) owns verified guest reservations and transactional inventory within the existing API deployment. Guest and host entrypoints are /book/ and /admin/bookings/.

Booking communications: [Resend email and private invoices](../skills/service-aroha-booking-email/SKILL.md). See the isolated pre-production contract and operations guide before activation.
