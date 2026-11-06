> Historical initial-slice record. Current contract1.2.0/API0.12.0 is specified in [platform-v1.2](platform-v1.2.md) and the canonical [OpenAPI](external-v1.json). It adds explicit scoped CRUD, financial/lifecycle/feedback and CMS/access/media/privacy operations; the read-only token ceiling remains unchanged.

# Scoped external API v1 — implementation slice

Issue105. External contract1.1.0; application API0.11.0. Base `/api/external/v1`, matching production/preprod host. The existing `/api/v1/booking/*` remains compatible and owns the same transaction policy.

## Access

After normal verified Google sign-in, use `/api/v1/integration-tokens`: GET lists up to50 own metadata records, POST creates a token once, DELETE `/:id` revokes. POST accepts `name`, explicit `scopes`, `purpose:integration|mcp-readonly`, `rowAccess:own|all`, `expiresInHours:1..168` (default24), or explicit `expiresInHours:null` for a token that never expires and an Idempotency-Key. Non-expiring grants return `expiresAt:null` and omit the Firestore TTL field; existing grants retain their deadlines. They remain subject to every revocation, account, scope, role and environment check, and count toward the active-token cap. Missing or malformed stored expiry fails closed. See the [token management schemas](../../functions/external/token-contract.json). Only20 active grants per user and50 stored records are permitted pending managed cleanup. Reusing issuance key returns409 TOKEN_ALREADY_ISSUED; cleartext is never stored/recoverable. No service identities or managed OAuth are exposed in this initial slice.

Tokens are environment-bound random256-bit secrets stored only as SHA256 hashes. Every request verifies token/grant/user status and current Google provider/email; mutation transactions recheck grant version/revocation and membership before replay/commit. `all` requires current booking staff; manager actions require all-row manager access. Revocation or account token-valid-after changes invalidate credentials. Read-only MCP tokens accept only seven low-sensitivity read scopes and nine allowlisted operation IDs. Scopes do not imply roles or ownership.

## Transport

Exact schemas/routes/scopes are in [OpenAPI](external-v1.json) and functions/external/routes.mjs. API reads never call the legacy state path that may create/update a profile. GET availability invokes shared pure policy in a read transaction with bounded active records; it creates no quote or hold. Page defaults25/max50; opaque15minute cursors bind token/user/version/view/limit and environment. Only typed declared query keys are permitted on paged/availability routes; arbitrary database queries are absent.

Mutation bodies retain current booking request fields, with server-injected id/action/expectedVersion removed from the external input. Requests cannot override those transport fields. All booking writes use existing bookingCommand; ETag/If-Match bridges to expectedVersion. Missing If-Match428, stale412, idempotency conflict409. Domain remains authoritative for capacity/prices/contact/cancellation/readiness/expiry and transactional outboxes. Booking create/quote return201; actions200. Timeout recovery keeps the original key and payload.

Private responses are no-store; bounded errors `{error:{code,requestId,retryable}}`, X-Request-Id and ETag where relevant. A narrowly enumerated developer-site origin can use CORS; no browser-supplied identity or environment is trusted. New communication pagination indexes must be READY before dependent queries. Browser Firestore denies all grant/booking access.

## Availability versus broader CRUD plan

This slice exposes39 current read/booking/profile/inventory-setting/offer/change operations. Some resource updates use complete current domain field sets rather than arbitrary JSON Patch. It does not expose unsafe raw storage CRUD. Full new-room create/retire, versioned note/contact edits, CMS/access-management facade, retention-aware erasure, payment ledger/receipts/financial summaries and feedback remain future shared-domain slices. Existing website CMS and access controls remain available. Unknown/unimplemented external routes return404, not fabricated data or successful stubs. Issue105 stays open until its remaining accepted coverage is delivered; lifecycle work remains issue70.

## Observability and verification

Every facade request participates in existing native API logs/metrics/traces using bounded `external.<operationId>` identity, real W3C context and request ID. Mutations preserve existing server-confirmed audit/outbox events. Grant create/revoke has server-side audit without cleartext secret. No arguments/contact/notes/token values enter logs/traces/metrics. MCP has its own separately versioned native SDK telemetry and service identity in ArohaRetreat/mcp; API traces alone do not establish MCP exporter ingestion.

Local evidence: scoped HTTP emulator integration passed (synthetic Google emulator identities, actual Auth/Firestore/Functions), covering mint/hash, own/all, read purity, fixed pricing/create/replay/conflict/approval/cancel, ETags, revocation and cross-environment/user denial. Unit contracts and existing app suites are separate. No production records or real mail were created by these tests. Backend/Hosting deployment, fresh real sign-in, real-user ownership, tenant searchability and native linkage require actual separate evidence.

Sensitive contact reads require both contact and reservation-read scopes and write a required security audit without contact values. Imported reservations with no linked Firebase identity retain authorized contact snapshot access; verifiedEmail stays empty rather than inventing verification.
