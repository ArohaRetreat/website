---
name: service-aroha-booking-email
description: Maintain Resend booking notifications, private invoice PDFs, delivery retries and signed webhooks.
---

# Booking email and invoices

Owner ArohaRetreat. API0.7.0, website0.20.0 prepared under issue65. Read [contract](../../docs/preproduction-email-contract.md), [operations](../../docs/preproduction-email-operations.md) and [continuation](continuation.md). Implementation functions/email; runtime entrypoints functions/index.mjs API webhook and arohaBookingEmailDispatch/Retry. Firebase Admin Firestore/Storage, PDFKit and Resend are dependencies. Shared booking policy remains functions/booking; do not duplicate allocation or approval rules here.

Request and confirmation jobs commit atomically with booking changes. Deterministic environment/event/channel IDs and provider idempotency prevent repeated sends. A 23-hour uncertainty cutoff requires reconciliation; never blind-resend an old uncertain acceptance. A definitive rejected send may retry; accepted/provider-tracked failures require provider reconciliation. Cancellation suppresses stale confirmations; replaced invoices cannot be sent as current. Preserve immutable snapshots/private PDFs and invoice numbering. No payment collection, paid receipt claim or invented tax details.

Production mail requires complete issuer address/payment instructions; it remains disabled for this task. Pre-production uses isolated aroha_preprod_* collections, billing/pre-prod paths, verified tester allowlist and forced approved test inbox with TEST subjects/PDF. Shared Auth/membership/CMS reads grant no production content/access writes. Download requires owner or active booking host, no public Storage URL. Keep existing deny-all private rules. Do not replay historical booking outbox or erase ledgers when rolling back.

mailSettings owns server configuration. Sending-only RESEND_API_KEY_PREPROD and RESEND_WEBHOOK_SECRET_PREPROD stay in Secret Manager. Production names are RESEND_API_KEY and RESEND_WEBHOOK_SECRET, only activate after explicit promotion/setup. Signed raw-body webhooks verify replay/recipient/environment and monotonic delivery state. Provider acceptance, delivery event, actual inbox and browser acceptance are separate evidence.

Email worker service aroha-booking-emails[-pre-prod]; all runtime signals carry deployment.environment.name. Canonical aroha.booking email/invoice events use bounded booking/job/invoice/provider IDs; exclude names, email, bodies/PDFs/payment instructions from telemetry. Existing validated contact.phone is a business-event-only boundary. Runtime metadata config/observability-runtime.json is published with CAS to the private shared runtime document; public endpoint exposes only the environment's RUM tag/version. Never fall back to the production tag in pre-production.

Run npm test, npm run test:preprod (demo emulators, local collector only), synthetic OTLP and foundation checks. CI also runs the existing production-contract emulator suite with mail disabled. Render/inspect PDFs including Kannada and multi-page cases. Prepare/deploy via the scoped scripts in operations; exact source and independent production baseline checks precede preprod publication. Stop new sends for provider/config failure, retain jobs, inspect signed status, repair then resume; do not redeploy Hosting solely to repair delivery telemetry.
