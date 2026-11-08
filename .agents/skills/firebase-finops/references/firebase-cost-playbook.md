# Firebase cost playbook

| Change | Prefer | Verify |
| --- | --- | --- |
| Photos, video, downloadable art | Immutable versioned objects in Cloud Storage for Firebase, correct cache and MIME metadata, responsive renditions, lazy offscreen loading | Anonymous access to approved public objects, private objects denied, 206 seek/range, old CMS paths, per-session cold and repeat bytes. Compare Hosting and Storage combined. |
| Static frontend | A bounded Hosting shell and two usable releases | Built bytes, provider version, full hashes of the small shell and bounded media probes. Hosting already deduplicates identical upload hashes. Measure packaging, deploy and verification separately from CI. |
| Asynchronous work | Firebase event trigger when prompt delivery is necessary, then one bounded sweep for delayed work and retries | Lease and idempotency, quota and failure isolation, queue oldest age, scheduler job count. A paused Scheduler job can still incur its monthly charge. |
| API traffic and Firestore | Scale-to-zero Firebase Functions and paginated indexed reads | Count/latency, duration, memory, index reads, egress, no caching of authenticated data. Check unauthenticated abuse and daily peaks. |
| Deployment history | Retain only rollback and source integrity evidence you need | Shared Artifact Registry and Hosting scope, active artifact references, immutable rollback source, generation count and soft-delete. Dry-run shared policy changes before applying. |

For a media budget, estimate `views × bytes per view` for low, ordinary, and peak traffic. Add operation counts, expected cache misses, range requests, and rollout overlap. Apply the correct region and shared allowance before comparing spend. A 2 MB clip served 1,000 times is roughly 2 GB before caching. Moving it between products changes which quota absorbs it. A cheaper variant should meet the same usability and accessibility requirements. Preserve retained CMS and rollback references before expiring objects.

For jobs, multiply schedule frequency by days and jobs, then compare with actual billed time, not just requests. Retrying at five minutes changes recovery latency. Keep immediate delivery event-driven when it matters and measure backlog age before replacing the old worker.

Evidence to retain: exact revision, environment, period, units, provider counts/bytes, estimate assumptions, net cost/credits if available, cost and UX thresholds, and rollback test. Project-level budgets can affect multiple environments. Prefer non-destructive limits, alerts, and stopping optional workload where appropriate.

Recheck [Firebase pricing](https://firebase.google.com/pricing), [Hosting quotas](https://firebase.google.com/docs/hosting/usage-quotas-pricing), [Storage region eligibility](https://firebase.google.com/docs/storage/locations), [Cloud Run](https://cloud.google.com/run/pricing), [Cloud Scheduler](https://cloud.google.com/scheduler/pricing), [Functions artifact cleanup](https://firebase.google.com/docs/functions/manage-functions), and [budget scope](https://cloud.google.com/billing/docs/how-to/budgets) before using rates or limits.
