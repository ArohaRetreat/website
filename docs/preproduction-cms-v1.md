# Isolated Website changes in pre-production

API0.8.4 / website0.23.3 restores Website changes for verified, allowlisted, active shared members with website capability. Role checks and transaction-time capability checks match production. Pre-production routes select aroha_preprod_content, aroha_preprod_public, aroha_preprod_revisions and aroha_preprod_audit. Shared membership/invitation management remains denied; only production manages shared access.

The public frontend subscribes to the environment-specific public/site document. Anonymous clients can get that one document, cannot list collections, read drafts/history or write. Uploaded media remains immutable in the existing public media namespace; published references to existing originals are preserved. Pre-production never replaces or deletes those objects.

Initialize missing pre-production CMS once, transactionally, from the current production publication and its version. Initialize a matching draft and history baseline, preserving existing pre-production documents if present; never use the build seed or copy unpublished production drafts. Later pre-production edits/publication/restores stay isolated and require expectedVersion. This change does not promote test content to production.

Emulator coverage includes module admission, active membership/capability revocation, stale saves, publish/history/restore, anonymous read rules, access-management denial and unchanged production content/publication/history canaries. Real Google OAuth and physical-device acceptance are separate checks.
