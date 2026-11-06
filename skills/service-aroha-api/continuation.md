## Preprod0.22.0 / API0.8.0 — issue83 (prepared)

Read [booking refinement contract](../../docs/booking-refinements-v1.md). New exclusive rate/one-approval flow, signed-in WhatsApp enquiry/account choices and privacy-safe availability calendar are preprod-only. Production remains0.21.7/API0.7.1. Use local/release-evidence/aroha-booking-refinements/handoff.md and actual provider receipts for deployment state. Preserve CMS/reservations/media and frozen email/PDF snapshots; full stage communications stay issue70.

## Website0.20.0 / API0.7.0 — issue65 (pre-production only, prepared)

Add isolated pre-production collections, tester-only booking API, separate Functions codebase/Hosting site, forced test inbox and separate RUM tag. Request acknowledgement/host review messages and approval confirmations with private versioned invoice PDFs use atomic jobs, idempotency, bounded retries and signed status webhooks. Central versioned runtime metadata controls environment-specific RUM/server destinations. Read [contract](../../docs/preproduction-email-contract.md) and [operations](../../docs/preproduction-email-operations.md).

Source implementation and emulator verification do not establish deployment or real Resend/tenant delivery. Production remains website0.19.0/API0.6.0; CMS8 and Natura0.6.1 remain intact. DNS/key setup awaits the scoped action-time approval. Real billing address/payment instructions remain missing; production mail stays blocked. Current task branch feat/preprod-booking-emails, issue65; evidence local/release-evidence/aroha-preprod-emails. No production records or media were changed. See email continuation for current check/deployment status.

## Website0.19.0 / API0.6.0 — issue63

One access-controlled `/admin/` shell retains Website changes and Bookings frames and unsaved editor drafts. People & access independently grants website access and booking viewer/manager capability; legacy defaults are preserved, owner/peer protections remain, module edits require expectedVersion, and server/storage checks enforce grants. `/admin/bookings/` redirects to `/admin/#bookings`. Internal module routes are not separate access domains.

Guest `/book/#profile` saves versioned name/international phone; verified Google email is server-derived. Final booking form inherits editable contacts and saves a per-reservation snapshot. New bookings require supplied or saved valid contact; existing reservations remain intact. Phone syntax is validated, not OTP verified. Exclusive dates include both first/last dates and reserve continuously first morning through final18:00, including intervening nights. Accommodation requires explicit host agreement. Existing single-day snapshots/prices/credits remain unchanged.

[Booking platform contract](../../docs/booking-platform-v2.md) owns details. New service-booking-observability owns provider aroha.booking schema2, server-enriched contact.phone, real trace correlation and scheduled durable outbox. Phone never enters OTLP attributes/logs/metrics, browser payloads or URLs; names/email/notes/ages excluded. Optional detailed form observations retain monitoring consent; essential server/transaction outcomes do not depend on optional analytics. Deploy rules/index metadata and exact worker query readiness before API+worker, then exact-source Hosting with pinned Natura. No CMS seed replacement, synthetic production bookings, email, payments or narration. Actual delivery evidence belongs to local/release-evidence/aroha-0.19.0; do not infer deployment from prepared source.

API0.5.0 / issue59 adds mixed booking policy. Read booking service continuation and approved product contract; preserve legacy records and existing CMS/member authorization. Existing status/departure index must support exact overdue query before publication. Deployment facts in local/release-evidence/aroha-0.18.0.

# Production booking API — 0.4.0 prepared

Issue50/PR51 adds verified guest booking routes alongside unchanged host-only content/member routes. Read [booking continuation](../service-aroha-booking/continuation.md), ready indexes before activation, preserve owner/secret configuration and remove emulator .env.local before deployment. The owner authorised production activation with no prior commitments and host-agreed pricing. Do not infer deployed state from this preparation note.

# Optional place photo variants — API 0.3.0

Issue41 adds only optional eveningImage/eveningImageAlt to validated tour stops. Non-empty trusted image URL requires a description; historical content remains valid. Existing permissions/expectedVersion/audit/rules remain unchanged. Upgrade API before saving/publishing the new CMS fields; runtime resource/instrument versions are0.3.0. No new secret/rule/index changes. Refer to current release/issue evidence for actual deployment.

# Living Map implementation — 0.9.0 / API 0.2.0

Issue #4. Read docs/website-map-direction.md. The separate map uses map-render.mjs/map.mjs/map-state.mjs/map.css and an optional validated storyMap object. The studio materializes legacy fallback stories privately and previews /map/?preview=1. Deploy API before Hosting; preserve stored content and existing roles. Current verification/deployment is recorded in the issue and release evidence; this preparation note is not deployment proof.

# Aroha API continuation

## Verified current deployment

Website 0.8.3 is live at https://aroharetreat.com from 9b4ca2f9cec559369e5db095cb1d4f91eeaff208, Hosting 71855ca361752379. API 0.1.1 is ACTIVE as arohaapi-00003-yah with its existing owner/secret configuration. Real owner sign-in/draft read and backend log/span/metric searchability are verified; publication/restore/uploads and native RUM linkage remain separate. Natura 0.6.1 profile downloads are retained. Read release-evidence/aroha-0.8.3 and issues #5/#8. Living Map #4 is next in milestone 0.9.0; it is not implemented in this release.


## Custom-domain production release

Website 0.8.2 / API 0.1.1 is prepared for issue #5: exact canonical API origin, canonical invite/SEO URLs, current optional content validation/video rules and guarded shared Hosting. Preserve the existing owner configuration and Secret Manager binding. Verify deployment facts from the issue/release evidence; this preparation note does not certify deployment. Living Map issue #4 is the separate next enhancement.


## Current repository ownership

Source now lives in ArohaRetreat/website. Import issue #1; remaining acceptance issue #2. Historical references to issue #16 and PR #17 below refer to ArohaRetreat/natura, where tracking is superseded by the repository separation. Read docs/repository-separation.md. Website build is independent; shared Hosting requires an explicit pinned Natura export and deployment guard. No deployment is part of this source move. Existing production secrets/owner settings remain outside this repo.

## Historical implementation and deployment record

Issue #16; Node 22 Firebase Functions v2 arohaApi, asia-south2. Prepared transactional drafts/publication/revisions, owner bootstrap from ignored runtime env, verified-email invitations and role-controlled membership. Every mutation re-checks membership within its transaction. Direct Firestore writes/draft reads and unauthorized Storage writes are denied. Bucket aroha-retreat.firebasestorage.app was provisioned in ASIA-SOUTH2 after the user enabled Blaze; production rules and function are now deployed.

The local emulator integration passed save/conflict/publish/restore, wrong/uninvited identity denial, editor publishing/access denial, immutable public image upload MIME checks, role escalation/owner protection, revocation and invitation cancellation. Browser studio checks used synthetic emulator Google identities, not actual OAuth. A synthetic OTLP collector verified separate trace/log/metric protobuf exports, bounded labels and exclusion of private enquiry text. Libraries are pinned with audited lockfiles; repeat affected checks after further changes.

Production owner addresses are configured only in ignored functions/.env.aroha-retreat. Never ship emulator .env.local. DYNATRACE_PLATFORM_TOKEN is in Secret Manager and export is enabled. Final deployed function revision arohaapi-00002-cel has tenant-searchable correlated logs/spans and request metrics for a real denial probe. RUM tag, browser linkage and authenticated production owner acceptance remain pending. Durable audits have no automated BizEvent/replay exporter; SDLC export also remains pending. Keep actual PR/CI/provider revision evidence in issue #16/release-evidence.

Deployed code 3088054b04f52dc59d1271c6dcff8281a06eda90; all three CI jobs passed. Read release-evidence/aroha-0.1.0/release.md and issue #16 for precise evidence and open criteria.

Illustration review adds optional hero worldImage/eveningImage/foregroundImage keys to schema 1, validated under the existing image URL allowlist. Legacy records remain valid; unsafe-host regression coverage passes. This source change is not yet deployed to the production API.

## Additive film tour contract, revision 0.5

functions/domain.mjs now validates optional tour content, bounded map positions, media/stop/film references and optional named walk sequences; existing schema 1 content remains accepted. Local MP4/WebM paths and the project's Storage media prefix are allowed, arbitrary video origins remain denied. Storage rules permit active editors to create immutable public MP4/WebM objects below 40 MiB; image caps remain unchanged. New studio upload controls choose the expected media kind. Integration fixture publishes the expanded tour and checks permitted editor video writes, denied anonymous writes and denied QuickTime uploads. Production rollout is separate from Hosting preview; preserve owner environment and Secret Manager bindings, never deploy the synthetic emulator owner configuration.

Website 0.6 adds optional `tour.nature` to the same schema 1 contract: bounded copy/statistics, two allowed image URLs and enabled/welcome booleans. Integration fixture now saves and publishes it through the isolated lifecycle. Deploy the reviewed validator with preserved production owner configuration before live CMS use. Preview Hosting does not deploy API or Storage rules.

Website 0.7 adds optional nature heroEveningImage/heroEveningAlt under the same image URL/text validation and role/version contracts. Integration fixtures include them. Production validator rollout is still separate from Hosting review previews.


API 0.2.1 adds optional tour.nature.hrudhi validation; prior content remains valid. Existing permissions/expectedVersion/telemetry unchanged. See docs/api/aroha-v1.md; deploy before website 0.13.0 studio.

API 0.2.2 accepts optional package availability, visit address/Google embed and guide walkSheet. Prior records remain valid. See docs/api/aroha-v1.md. Host auth/rules remain independent of new public Google sessions; deploy validator before website 0.14.0.

Issue93 restores preprod Website changes in API0.8.4, using existing environment-specific content/public/revisions/audit selection. Shared members remain read-only; access routes remain denied. Read docs/preproduction-cms-v1.md. One-time baseline copy must preserve current host publication and existing preprod documents, never the seed. Deployment and real-account checks need release evidence.

## External API work6November2026 — issue105

Scoped-token-first implementation is on feat/external-api-v1 from current preprod. Read docs/api/external-v1.md and its OpenAPI;39 facade operations delegate to shared booking policy, nine read MCP capabilities live in separate ArohaRetreat/mcp. No remote OAuth, financial ledger or feedback capability is implied. Synthetic HTTP integration passed locally; source/CI/merge/deployment evidence must be checked. Preserve all production bookings/CMS/media and existing mail; no historical replay.

## Optional non-expiring integration grants

Contract1.1.0/API0.11.0 accepts explicit expiresInHours:null, returns expiresAt:null and omits the grant TTL field. Default24h and finite1..168h remain. Null is the only permanent sentinel; malformed/missing expiry fails closed. Non-expiring grants count toward20active/50stored caps and remain revocable with current account/provider/role/scope/environment checks. No existing grant is extended or rewritten. Emulator coverage includes finite expiry, permanent read/revoke and permanent cap enforcement.
