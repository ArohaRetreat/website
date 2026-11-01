# Repository separation evidence — 1 November 2026

New authoritative source: https://github.com/ArohaRetreat/website. Website packaging version 0.8.1 imports the reviewed 0.8.0 experience; it is not a runtime deployment.

Local checks:
- 45 website/domain/motion/gallery/monitoring/repository-boundary tests pass.
- 21 foundation tests, local Markdown links and the ready discovery gate pass.
- Independent website build passes with no sibling checkout or Natura application source. All pinned fonts/logos/nature-runtime files verify against their SHA-256 manifest.
- All 90 authorised website media/asset files match original source bytes. The source-import manifest covers every tracked website/API file; only the two nature-runtime import paths change during import.
- Shared Hosting composition consumes the export built from Natura main `699788a726e0ddd2fd011a6c63dd4a1a3cd45e05`; 1,324 files are composed, including both applications and font notices. Missing, modified, incomplete, wrong-revision, self-copy and symlink cases are rejected by boundary tests.
- Separate Natura checkout: 52 application tests and 21 foundation tests pass. Its independent design export build passes. The design-only deploy entry point is disabled to protect the shared site.

The isolated Auth/Functions/Firestore/Storage lifecycle passes from this repository, as does the synthetic OTLP protobuf trace/log/metric collector test. The temporary synthetic owner file was removed after execution. GitHub import/handoff PR checks and merge identities are recorded in the migration issues after those transitions occur; no older receipt is used as a claim of current execution.

No deployment, secret/owner environment copy, backend/rules mutation, new Firebase project, billing or auth-domain change was performed. Historical release-evidence files retain their original deployed revision facts. The existing production/preview versions are not relabelled as new-repository releases. Unfinished acceptance criteria remain in website issue #2.
