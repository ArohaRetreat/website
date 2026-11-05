---
name: service-aroha-booking-email
description: Maintain Resend booking notifications, private invoice PDFs, delivery retries and signed webhooks.
---

# Booking email and invoices

Owner ArohaRetreat. API0.7.0, website0.20.0 prepared under issue65. Read [contract](../../docs/preproduction-email-contract.md), [operations](../../docs/preproduction-email-operations.md) and [continuation](continuation.md). Implementation functions/email; runtime entrypoints functions/index.mjs API webhook and arohaBookingEmailDispatch/Retry. Firebase Admin Firestore/Storage, PDFKit and Resend are dependencies. Shared booking policy remains functions/booking; do not duplicate allocation or approval rules here.

Request and confirmation jobs commit atomically with booking changes. Deterministic environment/event/channel IDs and provider idempotency prevent repeated sends. A 23-hour uncertainty cutoff requires reconciliation; never blind-resend an old uncertain acceptance. A definitive rejected send may retry; accepted/provider-tracked failures require provider reconciliation. Cancellation suppresses stale confirmations; replaced invoices cannot be sent as current. Preserve immutable snapshots/private PDFs and invoice numbering. No payment collection, paid receipt claim or invented tax details.

Production mail requires complete issuer address/payment instructions; it remains disabled for this task. Pre-production uses isolated aroha_preprod_* collections, billing/pre-prod paths, verified tester allowlist and explicit server-owned recipientMode with TEST subjects/PDF. Owner now requires booking-mode delivery to actual verified guest and configured host; test-inbox remains the compatible default/emergency mode. Shared Auth/membership/CMS reads grant no production content/access writes. Download requires owner or active booking host, no public Storage URL. Keep existing deny-all private rules. Do not replay historical booking outbox or erase ledgers when rolling back.

mailSettings owns server configuration. Sending-only RESEND_API_KEY_PREPROD and RESEND_WEBHOOK_SECRET_PREPROD stay in Secret Manager. Production names are RESEND_API_KEY and RESEND_WEBHOOK_SECRET, only activate after explicit promotion/setup. Signed raw-body webhooks verify replay/recipient/environment and monotonic delivery state. Provider acceptance, delivery event, actual inbox and browser acceptance are separate evidence.

Email worker service aroha-booking-emails[-pre-prod]; all runtime signals carry deployment.environment.name. Canonical aroha.booking email/invoice events use bounded booking/job/invoice/provider IDs; exclude names, email, bodies/PDFs/payment instructions from telemetry. Existing validated contact.phone is a business-event-only boundary. Runtime metadata config/observability-runtime.json is published with CAS to the private shared runtime document; public endpoint exposes only the environment's RUM tag/version. Never fall back to the production tag in pre-production.

Run npm test, npm run test:preprod (demo emulators, local collector only), synthetic OTLP and foundation checks. CI also runs the existing production-contract emulator suite with mail disabled. Render/inspect PDFs including Kannada and multi-page cases. Prepare/deploy via the scoped scripts in operations; exact source and independent production baseline checks precede preprod publication. Stop new sends for provider/config failure, retain jobs, inspect signed status, repair then resume; do not redeploy Hosting solely to repair delivery telemetry.

Website0.23.0/API0.8.1 issue86: read [guest navigation/mail parity](../../docs/guest-mail-parity-v1.md). Recipient policy is snapshotted per new job; old jobs retain their addresses. Production activation stays separate; same provider account/sender/host inbox is reusable.

## Approved email-v3 integration — issue88

Website0.23.1/API0.8.2 integrates the frozen email body into real new-job delivery. Read [contract](../../docs/approved-email-templates-v1.md). New jobs snapshot templateVersion=email-v3; old jobs keep their original body/idempotency payload. CID logo/photo/stage artwork coexist with confirmation PDF. Preprod only; production unchanged. Remaining lifecycle triggers and frozen PDF renderer remain issue70. Read actual local/release-evidence/aroha-approved-email-templates/HANDOFF.md for deployment and inbox limits.
