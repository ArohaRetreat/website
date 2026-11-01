---
name: service-delivery-observability
description: Maintain trusted GitHub execution and Firebase Hosting delivery telemetry for Aroha.
---

# Aroha delivery observability

Owner ArohaRetreat. Sources `scripts/delivery/`, observer workflow and bounded source report hooks. Contract [delivery observability](../../docs/delivery-observability.md); [continuation](continuation.md). Read app-launchpad and dt-obs for the owning delivery/privacy rules.

Entries: report-run.mjs for automatic/exact-attempt replay, deployment.mjs through the guarded deploy script, transport.mjs for separate ingest receipts. CI identity aroha-ci-observer; release identity aroha-delivery; namespace aroha-retreat, version 1.0.0. Reuse API's pinned OTel SDK dependencies and explicitly pinned protobuf transformer; no additional network agent or production API migration is required.

Never execute/check out a PR head with export credentials. Default-branch observer only, contents/actions read, no deployment/write/OIDC grants. Validate source repository/workflow/attempt and parse untrusted report archives in memory with strict limits. Never export names, assertions, output, command text, environment, credentials, emails or raw provider errors. Original source attempt/time and replay reporting attempt remain distinct. Stable event IDs support deduplication, not an exactly-once guarantee.

Test `node --test tests/delivery-observability.test.mjs`, `npm test`, `AROHA_TEST_REPORTS=1 sh scripts/check.sh`, native report runner, isolated existing API/OTLP checks and current-head CI. CI needs `npm ci` and `npm ci --prefix functions --ignore-scripts`; local SDK behavior must remain compatible with the pinned serializer. Treat rejected signals, missing reports, partial deployments and failed live verification explicitly.

Secrets: encrypted Actions DT_DELIVERY_TOKEN only in observer; local production uses existing Secret Manager DYNATRACE_PLATFORM_TOKEN through Firebase CLI authentication. Never print it or pass it in command arguments. Production release writes a bounded outbox, checks authoritative provider release, verifies live hashes and emits native deployment success only for actual releases. Export failure never rolls back/repeats the deployed site. Repair through report-only replay; keep source/result receipts separate. Actions receipts/reports retain 14 days; operator outboxes require managed retention.

No browser, content schema, memberships, Firestore/rules or RUM consent change. Preview deployment reporting, automatic CI production promotion, issue/review webhooks, runtime business-event outbox and native RUM linkage are separate scope. Update this skill, catalog, contract and continuation when changing trust/source/transport or deploy semantics.
