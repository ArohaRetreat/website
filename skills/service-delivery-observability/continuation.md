# Booking delivery — website0.17.0 / API0.4.0 prepared

Issue50/PR51 extends live immutable verification to /book/, /admin/bookings/, booking.js and booking.css, plus independent unauthenticated booking denial. Source API is deployed before Hosting, after READY indexes. Hosting must preserve pinned Natura0.6.1 and CMSv8. No new delivery exporter or browser SDK is introduced. Read current release receipts for actual provider/verification/ingest/tenant outcomes.

# Mobile gate repair — 0.14.1

Issue #31: 0.14.0 mobile-v2 MP4 was overwritten by metadata JSON in a one-off export script. Re-encode from the original 24fps source without optical-flow blending; validate all bundled films before dist generation and test manifest sizes/hashes. Hash matching alone did not establish valid media playback. API 0.2.2 and Natura 0.6.1 remain unchanged. Current PR/release receipts establish deployment status.

# Delivery observability — verified production rollout

Issue #22, implementation PR #23 merged as 872393140f98c45af2f2e14d39dccfef2680ed30. Website 0.12.0 was deployed through the observed Hosting command at 2026-11-01T22:32:56.521Z; provider version 48c08d6816bf20f6, deployment ID d49f9c54-caf2-4462-a7cf-55dab92202fa. Live verification matched 22 immutable files and denied unauthenticated draft access (401). API 0.2.0 and pinned Natura 0.6.1 remain unchanged.

Main source Actions runs 41357543032 (foundation) and 41357543036 (application/integration) passed. Automatic trusted reporting runs 41357567140 and 41357643060 passed with independent BizEvents/traces/logs/metrics receipts, zero OTLP partial rejection, and bounded receipt artifacts. Exact CI and deployment records, logs, spans, metrics and the native CUSTOM_DEPLOYMENT marker were independently queried in India CS. This certifies delivery reporting, not native RUM-to-API linkage or authenticated business writes. Original host/device/RUM acceptance remains open.

Recovery: read docs/delivery-observability.md. Keep original execution and reporting attempts separate; replay reporting only, never a successful deployment. Preserve ignored production configuration/owner. Safe local receipts are under local/release-evidence/aroha-0.12.0; GitHub receipt artifacts expire after 14 days. All executable production source remains the PR #23 merge; later documentation commits are not additional Hosting deployments.

Website 0.13.0 extends live immutable hash verification to hrudhi-gate.css and the five gate/guide web assets. Transport, event identities and replay policy are unchanged.

Website 0.14.0 extends immutable live hashes to guest-experience.css, hrudhi-guide.css, v2 gate films and the transparent guide walk sheet. Backend prerequisite is API 0.2.2; no exporter identity/transport change.
