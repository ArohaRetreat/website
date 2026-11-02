# Website 0.15.0 impact

Issue #39. Frontend-only update to guide rendering/controllers, optional browser telemetry bootstrap/identity, guest account popover and non-overlay consent card. Add one transparent four-view WebP derivative; the new voiced video stays outside website source/build. API remains0.2.2, Natura consumer0.6.1. No Firestore schema, indexes, storage rules, roles, secrets or backend deployment changes. Existing CMS custom walk sheets remain compatible. Use the pinned Natura export for shared Hosting composition.

Gates: gait/heading/path and consent/identity race tests; guest display-name/custom-asset compatibility; all app/foundation checks and build; phone/desktop walk/turn/reverse, dialog pause, name-menu/Escape/focus, consent and lazy Analytics checks. PR-linked CI/review before merge; observed Hosting-only deploy; live hash/draft-denial verification; each delivery receipt; fresh custom-domain user.events and signed-in UID tagging, plus GA tag behavior separately from GA dashboard ingestion. No new video integration.

Rollback: rebuild/redeploy prior immutable website source and the same pinned Natura export using the observed deployment wrapper. No user data rollback. Existing consent choices remain stored and optional. New tag/guide assets can be reverted without changing account access.

# Release impact and verification plan

Status: pending decisions and implementation. This is not deployment authorization.

Record issue URL/acceptance criteria, verified issue-to-PR relationship and resolution state, version, source revision, PR/checked head/merge SHA, workflow/run/attempt, target environment and authorized scope. List affected UI, modules/contracts/policies, settings, data/indexes/migrations, secret bindings, telemetry, docs/screenshots and rollback consequences. Define executable predeploy gates and separate postdeploy checks for the chosen stack.

Postdeploy evidence must include exact version/SHA/service revisions; public/protected-route checks; independent docs checks; per-signal transport and partial rejection counts; tenant queries for events/logs/traces/actual metric samples; actual native RUM linkage status; failures/limits. No customer writes without explicit authorization. Never label these pending checks passed.

Track SDLC events from intake/development through review/checks/merge, release/deployment, runtime verification and rollback. Document source authority, stable IDs, safe fields, delivery/recovery, and source-to-tenant proof separately from application signal evidence.

## 0.9.0 — Living Map / API 0.2.0

Adds standalone `/map/`, generated botanical artwork, eleven editable stories/four chapters, native-scroll tree entrance and physical map, deep links/history, Reading View and consent-controlled map signals. Home design and Natura export remain intact. Affected: website renderer/controller/styles/build/SEO, admin map editor/preview, optional server content validation, API version/telemetry, tests/docs. No new secrets, roles, indexes or rules. Deploy API first, then the checked composed website artifact containing pinned Natura 0.6.1. Retain previous Hosting version and API source for rollback; stored content/history is preserved. Preview/browser review, real device acceptance and RUM linkage are distinct gates.
