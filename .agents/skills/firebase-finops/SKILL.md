---
name: firebase-finops
description: Estimate, audit, and reduce the cost of Firebase features and releases. Use when a change adds media, recurring jobs, public traffic, cloud services, storage retention, or usage-based billing.
---

Keep total incremental spend near zero. When zero is unrealistic, present the cheapest option that preserves the required behavior, along with its limits and the cost at ordinary and peak load. Follow the project's authorized environment and release boundaries.

1. **Measure first.** Identify project, sites, bucket and region, service accounts, environments, quotas and shared billing account resources. Use provider metrics for quantities and billing exports for net charges. Label cost estimates, measured usage, and billed spend separately. Shared fees are unallocated until evidence supports a split.
2. **Prefer Firebase application services.** Use static Hosting for the shell, Cloud Storage for optimized public media, Firestore and Auth for application state and identity, and Firebase Functions for backend work. Use an existing service before adding another. Account for automatically provisioned Cloud Run, Build, Artifact Registry, Scheduler, Eventarc, secrets and logs. Do not add separately managed Google Cloud infrastructure when a Firebase path meets the requirement.
3. **Model marginal and steady-state cost.** Include reads, writes, invocations, CPU/memory, egress, storage generations, preview retention and CI. A free invocation allowance does not cover the whole stack. Confirm live rates and region eligibility in official docs. Compare total across services before moving traffic.
4. **Build in a guard.** Set a measurable build byte budget, bounded queries and retries, scale to zero, and explicit retention or a reason to retain. Prefer event-driven work and one bounded retry sweep over separate frequent empty polls. Preserve business events, email, private objects, rollback and authenticated flows.
5. **Prove the cheaper path.** In pre-production, record matching before/after traffic and release timings, provider checks, rollout, and rollback. Test normal, failure and abuse paths. Alert thresholds are not universal spending caps. Never apply shared policies or deploy to production under pre-production approval.

Read [Firebase cost playbook](references/firebase-cost-playbook.md) when making a budget, moving media, consolidating scheduled work or planning a release.
