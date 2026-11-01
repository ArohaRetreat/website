# Aroha API continuation

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
