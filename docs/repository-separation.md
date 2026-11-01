# Website repository separation — 1 November 2026

Requested by Vishruth: the website must have a separate repository, with a milestone closed in Natura. Public visibility was explicitly selected. Source destination: [ArohaRetreat/website](https://github.com/ArohaRetreat/website).

## Ownership

| Repository | Owns |
| --- | --- |
| ArohaRetreat/website | Public website, host studio, Functions API, content/access contracts, Firestore/Storage rules, web media, website tests, shared Hosting composition |
| ArohaRetreat/natura | Natura design studio, tokens, illustrations, Hrudhi, farm atlas, design exports and their own tests |

The website 0.8.0 source/evidence head was `6da2b8c8e1a5d80f8fbe732eb9f24faf15970af9`. The deployed application revision was `56f8df43f42c4c3467cea7d887031b32022334dc`. This import is version 0.8.1 for packaging/ownership changes. [repository-import.json](repository-import.json) records source and imported hashes for every website/API/media file; the only imported application-source changes are the two nature-runtime import paths. Historical release evidence remains unchanged and refers to its actual old commits.

Only tracked authorised application files were imported. Ignored `.env*`, production owner settings, private telemetry credentials, local override files, dependencies and build output were excluded. The original feature branch/PR remain preserved in Natura for history; the website PR is closed without merging its application code into Natura main. Natura main never contained that website feature.

## Reproducible design dependency

The minimal Natura assets used by the website are exported into `vendor/natura/`: four font families/OFL notices, brand logos and the two nature-scene runtime modules. The manifest pins origin revision and individual SHA-256 bytes. Build verification fails if these exports change without a reviewed manifest update. No sibling checkout is needed for website tests/build.

Shared Firebase Hosting is a separate composition step. Build Natura from the exact [pinned revision](../config/natura-hosting.json); pass its `dist/design` directory to `npm run build:hosting -- --design-dir ...`. This consumes an export, not Natura application source. Composition records all deployed file hashes, checks release identity and rejects symlinks. Deployment refuses absent, stale, incomplete or modified composition. A rebuild of the website clears old composition. Natura’s normal deploy command is disabled for the shared site, preventing a design-only release from erasing the website.

## Tracking and completion boundary

- [Natura separation milestone](https://github.com/ArohaRetreat/natura/milestone/1), [migration issue #18](https://github.com/ArohaRetreat/natura/issues/18), original [website issue #16](https://github.com/ArohaRetreat/natura/issues/16) and [PR #17](https://github.com/ArohaRetreat/natura/pull/17).
- [Website import #1](https://github.com/ArohaRetreat/website/issues/1) owns the validated import.
- [Website acceptance #2](https://github.com/ArohaRetreat/website/issues/2) stays open for visual acceptance, physical-device/Safari review, production optional schema/video-rule rollout, owner OAuth/publication, RUM linkage and eventual production promotion.

Closing the Natura tracking records repository handoff, not completion of those acceptance gates. No Hosting/Functions/rules deployment, data migration, OAuth/access change, monitoring token transfer or production promotion is part of the split. Runtime evidence and production remain at their existing revisions until an explicitly authorised later deployment.
