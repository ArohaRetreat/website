# Pre-production Firebase FinOps and production gates

Pre-production implementation for #130. Production promotion requires its own approval and release. The application uses Firebase Hosting, Functions, Storage, Firestore and Auth. Firebase provisions supporting Google Cloud resources for Functions. Existing Resend and Dynatrace integrations are separate from the Google Cloud architecture constraint.

## Pre-production release

- Run `node scripts/prepare-preprod-media.mjs` with FFmpeg and WebP tools only when source media changes. Review output, manifest and decoded playback. Upload the six pilot objects with `node scripts/upload-preprod-media.mjs --pre-prod --apply --pilot`, then upload the manifest if anonymous metadata, content type, immutable caching and byte ranges pass. A digest mismatch or unexpected existing object blocks release.
- The release build copies the shell and rewrites static page and CSS media URLs. Generated Hosting redirects preserve relative URLs in stored CMS and dynamically rendered views. They are scoped to the pre-production Hosting site, return 302 for rollback safety, and keep old release versions usable. Private billing objects keep the existing deny rules. Current publication never changes or deletes live CMS revisions or Storage objects in place. Originals are retained in the source archive.
- The shell fails the build above 3,000,000 bytes or if binary media is copied back. Deploy preflight verifies all Storage metadata. Live verification hashes the shell and probes representative one-byte reads and legacy redirects. Firebase still deduplicates same-content deployment uploads, so compare upload and live verification separately from the full GitHub run.
- Deploy the prepared pre-production `arohaBookingEmailRetryPreprod` Function before retiring `arohaBookingEventsPreprod`. Verify the five-minute job, run outcomes and both independent queue paths. Retire only the old pre-production Function and its associated schedule. Firebase's standard CLI removes associated schedules on a function delete. Immediate email dispatch, API version and provider configuration stay on their existing policies.
- Hosting rollback restores the previous retained release. Keep its manifest and files usable. For scheduled-worker rollback, restore the prior one-minute retry and deploy the previous separate event worker before restoring its schedule. Do not replay old mail or telemetry manually.

## Production planning

1. Soak pre-production for at least seven representative days. Compare Hosting plus Storage bytes/cost, cache and range behavior, cold and repeat mobile loads, queued email and telemetry latency, Scheduler wakeups, and pipeline times. Reconcile October/November billing by project/service/SKU. Measure bytes per visit or play so differing traffic volumes do not masquerade as savings.
2. Review the public hosting plan independently of Natura. The production site also serves the pinned Natura design kit under `/design/`. Inventory ZIPs, public media and retained preview channels with their owners. Preserve public links, checksums and the approved design release. No production shell target can be asserted until that scope is agreed.
3. Choose the serving bucket and delivery path using India latency and actual combined costs. Delhi is outside the Cloud Storage Always Free regions. Verify the rollback path and public/private boundary before any production move. Retain the private billing objects and template CID artwork.
4. Review shared Artifact Registry cleanup and any budget controls as their own decision. Check active revisions and rollback first. A project cap can affect both environments. Keep native cost alerts, bounded scaling and opt-out for optional load. Do not add another managed Google Cloud service to achieve an apparent saving.
5. Use an independently reviewed production PR and exact-source release. Promote the media manifest and worker only after production approval. Verify mobile, desktop, booking and Studio permissions, immediate and deferred email, secure invoices, telemetry and rollback before closing the rollout.

## Production cutover for #132

Production reuses the immutable objects verified in pre-production. The object names retain their original staging prefix, and both release manifests are owners for retention. `DSC_3815.webp` is also mapped in production because a saved CMS revision still references it. Keep the original bytes of the photo and preserve those paths on restore.

The 3 MB guard covers the retreat website, booking and Studio shell. Natura is a separately pinned distribution under `/design/` with its own public kit downloads and preservation gate. Its files and publication remain byte-for-byte intact. Production keeps the existing Firebase Storage bucket and rules. The promotion adds no independent Google Cloud service. Validate all media metadata in bounded batches and probe the deployed routes without re-downloading full assets.

Deploy only `arohaBookingEmailRetry` from the merged, environment-guarded production package. Check its scheduler and a successful real request against the new revision. Once the successor is healthy, retire only `arohaBookingEvents` and verify that its scheduler was removed. Immediate dispatch and the booking API retain their deployed revisions. Both drains run independently with existing leases and limits.

The previous production Hosting version remains the rollback target. Restore the prior Hosting release and prior worker definitions independently if needed. Keep the corresponding source revision and provider receipts. Apply the longer usage observation after this owner-authorized promotion. Use actual Hosting, Storage and runtime metrics and billed SKUs before claiming net savings. The shared Artifact Registry policy and budgets are outside this cutover.

## Natura Hosting cutover

The website workflow stages the pinned Natura export in pre-production before publishing it to production. The build verifies every file in the design shell against `config/natura-export-files.json`. It limits the Natura shell to 650 KB and keeps the website’s 3 MB shell guard separate. Hosting retains Natura’s HTML, scripts, styles, core catalogue data, captions and the farm icon sprite. The sprite needs same-origin access for SVG references.

Serve the remaining approved design files from immutable objects in the existing Firebase Storage bucket. Generate temporary redirects from the exact export pin so established asset paths and ZIP checksums work. Future Hosting builds restore only the small pinned shell. They verify a bounded set of media types, legacy URLs and byte ranges without fetching the archives.

For a pin update, verify the new upstream build against the published raw export hashes. Upload the objects with `scripts/publish-natura-media.mjs --pre-prod --apply --source <absolute-natura-export>`, test pre-production links and browser downloads, then promote the same bytes. `scripts/configure-natura-cors.mjs` adds GET and HEAD only for the selected environment's Hosting origins. Each rule uses a metadata generation precondition. Existing private object permissions continue to apply.

Keep the live and a known-good rollback version for each site. Check release references before removing older versions or expired preview channels. Hosting storage samples can lag version deletion, and bandwidth already transferred remains in that billing period. Use Hosting domain counters for volume and request logs for URL attribution where available.
