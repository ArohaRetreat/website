---
name: service-aroha-api
description: Maintain Aroha content publishing, membership, invitations and safe telemetry.
---

# Aroha API

Owner: ArohaRetreat. Node 22 Functions v2, codebase aroha-website, function arohaApi, region asia-south2. Entries: functions/index.mjs, domain.mjs and telemetry.mjs. Read [API](../../docs/api/aroha-v1.md), [observability](../../docs/website-observability.md) and [continuation](continuation.md).

Server-verify Google ID tokens including revocation. Session admission requires verified Google email plus active membership, pending matching invitation or configured owner identity. SUPER_ADMIN_EMAILS belongs in ignored runtime configuration. Owners cannot be demoted through the API. Invitations are hashed by normalized email, expire after seven days and do not send mail. Revoked members cannot rejoin through old invitations. Admins manage only editors/viewers; super-admins manage admins.

All content and membership writes pass through the API. Mutation transactions re-read active membership before commit. expectedVersion prevents overwrite; publish atomically writes public content, revision and audit; restore creates a new draft. Firestore denies direct client drafts/membership/audit reads and all writes. Storage checks active editor membership, MIME and size for immutable public media. Admin SDK bypasses rules, so API validation remains mandatory.

Collections: aroha_content, aroha_public, aroha_revisions, aroha_members, aroha_invitations, aroha_audit. Guest enquiries are not stored. HTTP body cap 220 KB, content cap 180 KB, member/invitation pages 50, revision pages 25. Errors and telemetry are bounded; preserve quota, timeout and contention classifications. Resource caps: three instances, 256 MiB, 30 seconds; these are not a distributed per-user rate limiter.

Install npm ci --prefix functions. Run npm run test:website. Integration requires Java 21 and Firebase Auth/Firestore/Functions/Storage emulators with project demo-aroha; functions/tests/integration.mjs refuses production. Run node --test functions/tests/telemetry.mjs against its synthetic local protobuf collector. OTel versions are pinned as compatible 2.12.0/0.223.0 packages.

Deploy rules/function before root Hosting with the official Firebase CLI and project aroha-retreat. Keep production owner env separate from emulator .env.local. Optional export requires DT_EXPORT_ENABLED=true and Secret Manager DYNATRACE_PLATFORM_TOKEN, followed by redeployment. Telemetry failure cannot undo commits. Local logs and durable audits remain available; ingestion, tenant searchability and browser linkage need separate evidence.
