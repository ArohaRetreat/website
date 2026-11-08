# Skills catalog

Read [catalog.json](catalog.json), choose relevant workflow/service skills, then open the affected continuation. [AGENTS.md](../AGENTS.md) routes tools here even when they only auto-discover `.agents/skills`.

| Task | Skill |
| --- | --- |
| Overall lifecycle | [App Launchpad](../.agents/skills/app-launchpad/SKILL.md) |
| Product/UI/contracts | [Design](project-design/SKILL.md) |
| Code | [Implementation](project-implementation/SKILL.md) |
| Tests | [Testing](project-testing/SKILL.md) |
| Release/rollback | [Deployment](project-deployment/SKILL.md) |
| Firebase cost and deployment budgets | [Firebase FinOps](../.agents/skills/firebase-finops/SKILL.md) |
| Dynatrace | [Observability](project-observability/SKILL.md) |
| Resume/continue | [Handoff](project-handoff/SKILL.md) |
| README/docs | [Documentation](project-documentation/SKILL.md) |
| Useful explanatory images | [Ian Xiaohei](ian-xiaohei-illustrations/SKILL.md) |
| Booking business observability | [Booking business events](service-booking-observability/SKILL.md) |
| Foundation tooling | [Foundation tooling](service-foundation-tooling/SKILL.md) |

## Register a service

```sh
python3 scripts/add_service_skill.py --id SERVICE_ID --source-path ACTUAL_SOURCE_DIRECTORY --dry-run
python3 scripts/add_service_skill.py --id SERVICE_ID --source-path ACTUAL_SOURCE_DIRECTORY
```

Replace arguments with the actual architecture. The command creates a planned service skill, continuation and metadata; it does not create application code. Read the [owning service policy](../.agents/skills/app-launchpad/references/services.md) for required upkeep and the [tooling skill](service-foundation-tooling/SKILL.md) for mechanics/recovery.

## Contracts and examples

- [Catalog schema](../schemas/catalog.schema.json), [project schema](../schemas/project.schema.json), [evidence schema](../schemas/evidence.schema.json) own metadata fields; see [schema maintenance](../schemas/README.md).
- [Policy ownership map](../docs/policy-map.md) routes cross-cutting rules.
- [Synthetic examples](../examples/README.md) demonstrate completed shapes; they are not registered services or actual evidence.
- Run `sh scripts/check.sh`. See [checks](../docs/testing.md) and [inventory](../docs/services.md).

Application services: [Website and host studio](service-aroha-website/SKILL.md), [Firebase API](service-aroha-api/SKILL.md). Natura is an external pinned asset dependency.

Review module: [Local booking prototype](service-aroha-booking-prototype/SKILL.md), excluded from production builds. See the [review guide](../docs/booking-prototype-review.md).

Production overnight reservations: [Aroha booking](service-aroha-booking/SKILL.md), distinct from the isolated synthetic prototype.

Booking communications: [Resend email and private invoices](service-aroha-booking-email/SKILL.md). See the isolated pre-production contract and operations guide before activation.
