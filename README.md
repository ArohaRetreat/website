# Aroha Retreat Website

The public Aroha Retreat website, Google-authenticated host studio and Firebase content/access API. This is the authoritative website repository. [Natura](https://github.com/ArohaRetreat/natura) owns the separate design standards, character and farm-atlas tooling.

Template version: **1.9.0** · [template changelog](docs/template-changelog.md) · [licence boundaries](THIRD-PARTY-NOTICES.md)

Website version **0.10.1** connects the shared nature menu with leaf-shaped page transitions and a consistent photographic footer to the public retreat and Living Map pages. See [public navigation](docs/website-navigation.md) for the page registry, motion and accessibility behavior. The production site is https://aroharetreat.com. See [repository separation](docs/repository-separation.md), [source provenance](docs/repository-import.json) and [open acceptance work](https://github.com/ArohaRetreat/website/issues/2).

## Develop and verify

Use Node 22+ and Python 3; emulator integration also requires Java 21 and Firebase CLI 15.34.1.

```sh
npm ci
npm ci --prefix functions
npm test
npm run build
sh scripts/check.sh
npm run dev
```

The build works from this repository alone: `dist/` contains `/`, `/admin/`, the public runtime configuration and website media. It verifies the pinned fonts, logos and nature runtime in `vendor/natura/`. It does not build the Natura studio or require a sibling checkout. Original photograph masters, credentials and machine-specific runtime overrides are excluded.

For the isolated Firebase lifecycle, use only the synthetic project and temporary owner configuration documented in [testing](docs/website-testing.md). Never deploy emulator owner settings. The existing [API](docs/api/aroha-v1.md), [host guide](docs/website-host-guide.md), [observability](docs/website-observability.md) and [design direction](docs/website-living-direction.md) remain authoritative within their scopes.

## Hosting ownership

The existing Firebase project/site is still `aroha-retreat`. Because its root website and `/design/` share one Hosting release, a standalone website build must not be deployed directly. The website repository owns composition and the deployment guard; Natura supplies a pinned design export.

```sh
AROHA_BUILD_REVISION=$(git rev-parse HEAD) npm run build
npm run build:hosting -- --design-dir /absolute/path/to/natura/dist/design
npm run deploy -- --channel real-farm
```

Build the design export from the Natura revision in [config/natura-hosting.json](config/natura-hosting.json). Composition checks its release identity and refuses symbolic links, then records SHA-256 hashes of every Hosting file. Deployment verifies both apps, exact website revision and all hashes before invoking Firebase. Production requires the explicit `--production` option and separate release authorization. Do not bypass the guard with a raw partial Firebase Hosting deploy. No new Firebase project, backend, data or auth domain is created by this repository split.

## Source and delivery

- [Website service](skills/service-aroha-website/SKILL.md): public journey, media, accessibility, motion and host UI.
- [API service](skills/service-aroha-api/SKILL.md): content, publication, membership, media policy and observability.
- [Migration issue](https://github.com/ArohaRetreat/website/issues/1) and [remaining acceptance](https://github.com/ArohaRetreat/website/issues/2).
- [Historical Natura issue](https://github.com/ArohaRetreat/natura/issues/16) and [unmerged original PR](https://github.com/ArohaRetreat/natura/pull/17).

`release-evidence/aroha-*` records historical builds/deployments from the old source revisions. Those files do not claim that a new-repository commit is deployed. The source split itself does not promote the preview or alter production. Runtime secrets stay in the existing server-side secret store; private tokens never enter this repository or browser bundles.

The Living Map is a separate `/map/` journey. See [direction and CMS contract](docs/website-map-direction.md).
