# Delivery observability contract — version 1

Owner: ArohaRetreat. Source: `scripts/delivery/`, `.github/workflows/delivery-observability.yml`. Issue #22. This covers source-owned workflow/check/step/test outcomes, guarded production Hosting releases and their live verification. Runtime API telemetry, browser RUM and Firestore business audits remain separate.

## Trust and credentials

The completion observer runs from the repository's trusted default branch with contents/actions read permissions. It never checks out a source PR revision, executes artifacts, imports source-run code, reads Actions logs or exports raw step names/commands. Source workflow, repository, event, head repository, completed state and execution attempt are checked against allowlists. Foreign forks are refused; this is an explicit coverage boundary. The source PR CI has no Dynatrace secret and uploads only bounded JSONL test reports.

`DT_DELIVERY_TOKEN` is an encrypted Actions repository secret used only by the observer. Operators use the existing `DYNATRACE_PLATFORM_TOKEN` Secret Manager value through Firebase CLI authentication; no token is copied into files, browser bundles or process arguments. The setup command streams it to `gh secret set` via stdin. Do not add secrets to source CI, `pull_request_target`, artifacts or logs. Reporter dependencies are the pinned API OTel packages; install with `npm ci --prefix functions --ignore-scripts`. The explicitly pinned protobuf transformer API is covered by collector/partial-rejection tests.

The observer uses `https://indiacs.live.dynatrace.com`: `/api/v2/otlp/v1/{traces,logs,metrics}`, `/api/v2/bizevents/ingest`; production releases additionally use `/api/v2/events/ingest`. Trace/log/metric transport is HTTP/protobuf with delta metrics. Each response is checked separately, including decoded protobuf partial rejections. Business-event HTTP acceptance and native marker results are separate receipts. No response bodies/headers are printed.

## Events and identities

Provider `aroha.sdlc`, namespace `aroha-retreat`, schema `sdlc.schema.version=1`. CI service `aroha-ci-observer`; production release service `aroha-delivery`; both reporter versions `1.0.0`. API service remains `aroha-api` version `0.2.0`. CI environment is `ci`; Hosting environment is `production`. Their traces do not claim browser/API ancestry.

Events: `sdlc.workflow.completed`, `sdlc.check.completed`, `sdlc.step.completed`, `sdlc.test.report`, `sdlc.test.completed`, `sdlc.deployment.completed`, `sdlc.runtime.verified`. Preserve source run/attempt, repository, SHA, public run URL, job ID and bounded job alias, step number, actual conclusion and source times. Test events are explicitly runner-reported; names, assertions, output and fixture data are excluded. Case identities are hashes and the safe suite/ordinal links them to source artifacts. Missing reports are emitted as missing, never as passing cases. Original execution attempt is distinct from reporting attempt.

`sdlc.event.id` is SHA-256 of repository plus source identity: run/execution-attempt/job/step/case, or recorded Hosting deployment ID. Reporting retries reuse these IDs and original `sdlc.occurred_at`; observed time is separate. Dynatrace may assign its own timestamp/ID, so consumers must deduplicate on `sdlc.event.id`. Matching commits are correlation metadata, not trace parentage. Reconstruction spans are labelled `ci.observation.kind=retrospective`; reporter work is labelled observer-executed. Workflow/job/step spans form the observed execution hierarchy, with correlated summary logs. `aroha.delivery.outcomes` and `aroha.delivery.duration` have bounded kind/status/environment dimensions; run/case/commit IDs stay out of metrics.

The upstream [OTel CI/CD action](https://github.com/dash0hq/otel-cicd-action) was reviewed. This observer uses a source-owned bounded exporter to combine sanitized test artifacts, exact-attempt replay and verified Hosting receipts while excluding actor data, raw logs and free-text step commands.

## Test reports and recovery

Node reports come from actual native runner events alongside normal console output. Python reports come from unittest result callbacks. No PASS-string scraping is used. `if: always()` uploads JSONL reports even after failed tests; artifact names include execution attempt. Artifacts expire after 14 days. The trusted parser never extracts ZIPs: it rejects unexpected paths, symlinks, duplicate entries, >8 entries, >2 MiB archive/expanded total, >1 MiB per file, compression ratios >200, >2500 cases, duplicate case IDs and invalid fields/status/durations. Unknown private fields are stripped.

GitHub APIs provide actual job/step outcomes, including failure/cancellation/skip. The observer has independent status: a failed exporter does not alter the original workflow result. Sanitized outbox/receipt JSON is retained as an observer artifact for 14 days. Operator outboxes under ignored `local/delivery-outbox/` remain available until explicitly removed. This is finite retention, not a permanent queue. Report-only recovery never reruns source tests or a deployment:

```sh
gh workflow run delivery-observability.yml --repo ArohaRetreat/website -f run_id=ACTUAL_RUN_ID -f execution_attempt=ACTUAL_ATTEMPT
node scripts/delivery/report-run.mjs --run-id ACTUAL_RUN_ID --attempt ACTUAL_ATTEMPT
npm run deploy -- --replay-telemetry /absolute/path/to/local/delivery-outbox/deployment-ID.json
```

Local commands require authenticated `gh`, installed functions dependencies and `FIREBASE_CLI_PATH` pointing to the installed `firebase-tools/lib/bin/firebase.js`. HTTP 429/5xx/network retries are bounded to three attempts with the same payload; persistent 4xx and partial rejection need correction and replay. Repeated OTLP export may duplicate spans/logs/metrics; do not sum replayed metrics as an exactly-once ledger.

## Deployment and verification

`npm run deploy -- --production` retains the existing composition/hash guard, then requires export credentials before changing production. It writes a sanitized attempt receipt before invoking Firebase. A release is called deployed only when the provider reports a new live DEPLOY version/time. A CLI error is retained separately: an already successful release is not relabelled failed just because notification failed. A failed/unconfirmed deployment is `failed-or-partial`; no native success marker is created.

Live verification checks expected website version/SHA and SHA-256 of the root/map/admin/design, public runtime configuration, styles/scripts and all generated shared chunks, plus protected draft denial. CDN propagation has bounded retries. Verification failure is a separate event from successful deployment. A native `CUSTOM_DEPLOYMENT` marker is sent only for a provider-confirmed successful Hosting release, with website version, commit, Hosting version and verification state. It is environment-level and does not falsely imply that the unchanged backend was deployed. Preview channel reporting, automatic production deployment from Actions, issue/review webhooks and server business-audit delivery are outside this contract.

Source references: [Dynatrace business-event ingest](https://docs.dynatrace.com/docs/observe/business-observability/bo-events-capturing/bo-events-capturing-external-sources), [native deployment event API](https://docs.dynatrace.com/docs/dynatrace-api/environment-api/events-v2/post-event).

## Queries

```dql
fetch bizevents, from:now()-24h
| filter event.provider == "aroha.sdlc"
| dedup sdlc.event.id
| summarize records=count(), latest=max(timestamp), by:{event.type,sdlc.status}
```

```dql
fetch spans, from:now()-24h
| filter service.name == "aroha-ci-observer" or service.name == "aroha-delivery"
| summarize records=count(), by:{service.name,span.name}
```

```dql
fetch logs, from:now()-24h
| filter service.name == "aroha-ci-observer" or service.name == "aroha-delivery"
| fields timestamp,service.name,workflow.run.id,workflow.execution.attempt,sdlc.status,trace_id
```

```dql
timeseries outcomes=sum(aroha.delivery.outcomes), from:now()-24h, by:{kind,status}
```

Check exact run/attempt, event IDs, source SHA, Hosting version and native marker independently before declaring end-to-end delivery coverage. HTTP acceptance alone is not tenant searchability. Full RUM session visibility/browser-to-API linkage and server-confirmed business outcomes remain explicitly separate.
