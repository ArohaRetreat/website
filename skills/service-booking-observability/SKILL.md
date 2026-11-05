---
name: service-booking-observability
description: Maintain private booking business-event capture, durable delivery and real trace correlation.
---

Current state and test workflow: read the first section of [continuation](continuation.md) and [preprod acceptance contract](../../docs/preprod-booking-e2e-v1.md). Earlier version/disabled-email statements below describe historical releases.

# Aroha booking business observability

Owner ArohaRetreat; API/worker0.6.0, website0.19.0. Read app-launchpad, dt-obs business-events/OTel instructions, docs/booking-platform-v2.md and continuation.md. Source functions/booking/observability.mjs, functions/index.mjs scheduled arohaBookingEvents, functions/telemetry.mjs and website/booking-journey.mjs. Provider aroha.booking, namespace aroha-retreat. API identity aroha-api; worker aroha-booking-events via FUNCTION_TARGET. No fake browser parents: events retain real capture trace/span and request/journey/transaction correlation; worker delivery is a distinct internal span.

Owner explicitly requests phone in business events. Accept phone only from server-validated profile/booking snapshots and disclose on forms. Never accept phone/identity/free text in client step envelopes. Names/email/notes/addresses/ages/tokens not exported. Phone belongs only in the contact.phone business field, never OTLP log/metric/trace attributes, URLs or baggage. Detailed browser observations respect existing monitoring consent; essential server outcomes/atomic audit continue independently. Browser event authority is client-reported; HTTP result server-observed; transaction event server-confirmed. Do not equate browser observation with completed booking.

Canonical events queue atomically with business writes; response/client observations deduplicate by stable event ID. New server-only aroha_observability_outbox uses leases/attempts/nextAttemptAt and bounded scheduled delivery;202 alone accepted. Honor Retry-After, retain failures with backoff, delete nextAttemptAt on delivery, delivered TTL7days. Existing legacy booking/email outbox is NOT replayed. API response capture has bounded direct delivery fallback if the application database is unavailable; both paths can duplicate and consumers deduplicate stable IDs. Do not roll back booking results for monitoring failure. No claimed zero-loss browser network delivery. Monitor capture failures and backlog.

Secret DYNATRACE_PLATFORM_TOKEN stays server-side. Same existing indiacs tenant, no new third-party sharing destinations. Scheduler/function/Firestore/ingestion usage disclosed; avoid unbounded batches and retries. Run npm test, foundation checks, isolated demo-aroha integration, synthetic OTLP privacy check, real worker queue query and provider readiness before deployment. Never create synthetic production reservations. Synthetic observability verification must be explicitly marked and must not affect booking/conversion totals. Verify ingest acceptance, each OTLP signal and tenant searchability separately. No email/payment/audio activation.
