---
name: service-aroha-booking-prototype
description: Maintain the isolated local Aroha booking review prototype.
---

# Aroha booking prototype

Owner: ArohaRetreat. Version 0.1.0, local review only. Source `prototypes/booking/`: `domain.mjs` owns allocation, quotes, promotions, tiers and state transitions; `server.mjs` owns the single-process serialised JSON adapter and synthetic HTTP-only cookie sessions; `app.mjs` and `style.css` own guest/host UI. Contract: [prototype API](../../docs/api/aroha-booking-prototype-v1.json); [plan](../../docs/booking-module-plan.md); [review guide](../../docs/booking-prototype-review.md); [continuation](continuation.md).

Run `npm run dev:booking`; guest entry http://127.0.0.1:8782/prototype/booking/ and host entry http://127.0.0.1:8782/prototype/studio/. Loopback binding and Host/Origin checks are intentional. Never bind to public interfaces or publish the demo account selector as production authentication. No Google login, Firebase access, external calendar, payment, email or tenant telemetry integration is present. Normal website build excludes this module entirely.

Current policy: overnight cap10, four active two-person placeholders; fifth room unidentified/inactive; four future five-person rooms inactive. Photos are existing farm photographs with explicit unit-identification limits. Rates/discounts/cancellation/approval windows are sample settings, not approved tariffs. Tier thresholds6/10 match the owner wording. Day visits stay disabled.

Mutations clone state, execute server-side policy, and atomically rename the persisted file only after success. A promise queue serialises competing local requests. This is a single-process prototype adapter, not production Firestore transaction proof. Pending approval expires by server time and releases inventory on read/mutation; checkout is exclusive. Final writes reprice and recheck availability. Idempotency keys bind actor, operation and body. Guests own their reservations; host mutations require synthetic host role. Configuration cannot close occupied rooms or reduce capacity below allocated occupancy. Date-change requests retain original allocation; replacement is checked at host approval. Terms snapshot on creation.

State file: OS temp directory `aroha-booking-review-v1.json`, never source controlled. Sessions reset at process restart; bookings persist. To reset review data, stop server, rename the state file to a backup, restart. Do not delete real content or touch production configuration. Only one process may own a state file; production needs distributed transactions, bounded durable storage, authenticated roles, pagination and expiry worker before launch.

Tests: `npm run test:booking`, `npm test`, `sh scripts/check.sh`, `npm run build`. HTTP test uses isolated temp state and loopback sockets. Browser verification is a separate evidence gate. Native dialogs, focus return, no scroll interception, reduced-motion support and small-screen readable controls must remain. No online payment or actual booking confirmation claims.

Audit/outbox rows are local committed lifecycle records, excluding private comments. Delivery is explicitly `not_configured`; no events are exported to Dynatrace and no emails are queued as sent. The application CI test glob includes this module; current-head CI and local execution are distinct. Review-only GitHub delivery is issue/PR linked; no production release, tag or merge is implied.
