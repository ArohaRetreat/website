# Aroha Retreat Website

The public Aroha Retreat website, Google-authenticated host studio and Firebase content/access API. This is the authoritative website repository. [Natura](https://github.com/ArohaRetreat/natura) owns the separate design standards, character and farm-atlas tooling.

Template version: **1.9.0** · [template changelog](docs/template-changelog.md) · [licence boundaries](THIRD-PARTY-NOTICES.md)

Website **0.19.0** / API **0.6.0** adds guest contact profiles, continuous exclusive-event dates, a unified permission-controlled Host Studio and durable booking business observability. See the [booking platform contract](docs/booking-platform-v2.md). Trusted Actions reporting and observed production Hosting releases preserve the public design and sunset experience. Read the [delivery observability contract](docs/delivery-observability.md). See [repository separation](docs/repository-separation.md), [source provenance](docs/repository-import.json) and [open acceptance work](https://github.com/ArohaRetreat/website/issues/2).

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

- [Public roadmap](docs/public/roadmap.md) and [website release notes](docs/public/releases.md).
- [Website service](skills/service-aroha-website/SKILL.md): public journey, media, accessibility, motion and host UI.
- [API service](skills/service-aroha-api/SKILL.md): content, publication, membership, media policy and observability.
- [Migration issue](https://github.com/ArohaRetreat/website/issues/1) and [remaining acceptance](https://github.com/ArohaRetreat/website/issues/2).
- [Historical Natura issue](https://github.com/ArohaRetreat/natura/issues/16) and [unmerged original PR](https://github.com/ArohaRetreat/natura/pull/17).

`release-evidence/aroha-*` records historical builds/deployments from the old source revisions. Those files do not claim that a new-repository commit is deployed. The source split itself does not promote the preview or alter production. Runtime secrets stay in the existing server-side secret store; private tokens never enter this repository or browser bundles.

The Living Map is a separate `/map/` journey. See [direction and CMS contract](docs/website-map-direction.md).

Production deployment now requires installed functions dependencies and `FIREBASE_CLI_PATH` for authenticated Firebase/Secret Manager access. `npm run deploy -- --production` records provider release, live verification and separate telemetry receipts. A reporting failure returns exit code 2 without repeating or rolling back an already successful release. Repair it using the report-only commands in the delivery contract.

## Visits and bookings

Website0.18.0 / API0.5.0 supports Google-authenticated day outings, individual shared stays, private family rooms and exclusive event enquiries at `/book/`. Every request needs host approval. Published rates are ₹1,200/day adult, ₹700/day child under10, ₹3,500/individual/night and ₹6,000/private room/night including two occupants, plus ₹1,500/additional child (maximum two adults and two children per room). Events require a host offer and guest acceptance.

Hosts manage calendars, rates, inventory, room readiness, offers and loyalty at `/admin/bookings/`; website editing remains at `/admin/`. The shared capacity is35 adults onsite and10 overnight, with children counted separately. The Master room is the fifth operating room; future rooms remain closed. Existing bookings keep their agreed prices and terms. No online payment or automatic email. Read the [mixed booking rules](docs/booking-products-contract.md), [API contract](docs/api/aroha-booking-v1.json), [host guide](docs/website-host-guide.md) and [service guide](skills/service-aroha-booking/SKILL.md). The local prototype is separate from production.

Prepared website0.20.0/API0.7.0 pre-production booking communications: [contract](docs/preproduction-email-contract.md), [operations](docs/preproduction-email-operations.md). This source version is not evidence of production activation.
