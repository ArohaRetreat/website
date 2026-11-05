# Foundation checks

Python 3.11+ and a POSIX shell; standard library only:

```sh
sh scripts/check.sh
python3 scripts/check_foundation.py --json
python3 scripts/check_foundation.py --ready --json
```

The shared entrypoint runs metadata/version/skill validation, local Markdown links and unit tests. README, catalog and CI use that same entrypoint. JSON output has `ok`, deterministic `errors`, and `ready` (whether discovery checks were requested); failures exit nonzero in either mode.

The [schemas](../schemas/README.md) own field shapes. The Python gate adds internal-path/reference/dependency checks and ready/active semantics. Tests cover multi-error diagnostics, malformed structures, schema/constant parity, SemVer, service generation and rollback, link failures, CI command agreement and ruleset dry-run behavior.

For actual application suites follow the [test contract](../.agents/skills/app-launchpad/references/testing.md) and [evidence rules](../.agents/skills/app-launchpad/references/evidence.md). Record real commands/prerequisites in the relevant service skill after stack selection. `examples/` is synthetic reference material and never execution proof or a cataloged service. Raw local artifacts remain ignored under `qa/local/` or `qa/raw/`.


## Preprod booking acceptance (issue101)

Read [contract and evidence boundaries](preprod-booking-e2e-v1.md). Use `node scripts/testing/public-preprod.mjs` for live anonymous calendar/runtime/auth-denial probes. Use `npm run test:preprod` with FIREBASE_CLI_PATH and Java21 for isolated demo-aroha HTTP/auth/Firestore/Storage, request/approval/invoice/webhook and reusable scenario execution. Reports are private under local/test-evidence; emulator output must never be called real Google/live inventory acceptance.

The preprod build alone emits `/admin/testing/`. Navigate in the already authenticated host tab (Firebase uses tab-scoped session persistence). Run with an existing manager, keep the tab open and download its sanitized report. Interrupted runs expose Recover unfinished run; verify ownership and run marker before any cancellation. Do not edit guest profiles, global settings, CMS, existing bookings or production. A normal guest UI journey and cross-account check remain separate manual checks.

Export an actual sanitized report using `node scripts/testing/export.mjs <report-path>` with the configured Firebase CLI session. It reads active server-owned preprod destinations and Secret Manager; report content never supplies a destination or credential. Test authority is runner-observed; OTel spans are explicitly report-processing. Metrics have bounded execution/status labels; run/case/booking IDs are excluded. Verify accepted signals and then searchability in Dynatrace separately. Preserve failed attempts and blocked features in the final report.
