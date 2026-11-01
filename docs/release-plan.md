# Release impact and verification plan

Status: pending decisions and implementation. This is not deployment authorization.

Record issue URL/acceptance criteria, verified issue-to-PR relationship and resolution state, version, source revision, PR/checked head/merge SHA, workflow/run/attempt, target environment and authorized scope. List affected UI, modules/contracts/policies, settings, data/indexes/migrations, secret bindings, telemetry, docs/screenshots and rollback consequences. Define executable predeploy gates and separate postdeploy checks for the chosen stack.

Postdeploy evidence must include exact version/SHA/service revisions; public/protected-route checks; independent docs checks; per-signal transport and partial rejection counts; tenant queries for events/logs/traces/actual metric samples; actual native RUM linkage status; failures/limits. No customer writes without explicit authorization. Never label these pending checks passed.

Track SDLC events from intake/development through review/checks/merge, release/deployment, runtime verification and rollback. Document source authority, stable IDs, safe fields, delivery/recovery, and source-to-tenant proof separately from application signal evidence.

## 0.9.0 — Living Map / API 0.2.0

Adds standalone `/map/`, generated botanical artwork, eleven editable stories/four chapters, native-scroll tree entrance and physical map, deep links/history, Reading View and consent-controlled map signals. Home design and Natura export remain intact. Affected: website renderer/controller/styles/build/SEO, admin map editor/preview, optional server content validation, API version/telemetry, tests/docs. No new secrets, roles, indexes or rules. Deploy API first, then the checked composed website artifact containing pinned Natura 0.6.1. Retain previous Hosting version and API source for rollback; stored content/history is preserved. Preview/browser review, real device acceptance and RUM linkage are distinct gates.
