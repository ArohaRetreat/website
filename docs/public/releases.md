# Aroha Retreat website release notes

[Website](https://aroharetreat.com) · [Roadmap](roadmap.md) · [Source changelog](../../CHANGELOG.md)

Publication dates are from verified Firebase Hosting records and use IST. The [test site](https://aroha-retreat-preprod.web.app) serves the latest pre-prod release. Earlier source entries without a publication record here remain [changelog history](../../CHANGELOG.md).

## Version index

- **Production** — [0.33.1](#website-0331), [0.32.3](#website-0323), [0.32.2](#website-0322), [0.32.1](#website-0321), [0.31.2](#website-0312), [0.31.1](#website-0311), [0.30.3](#website-0303), [0.9.0](#website-090).
- **Pre-prod** — [0.33.2](#website-0332), [0.33.0](#website-0330), [0.32.4](#website-0324).

## Production

### Website 0.33.1

**10 November 2026.** Hosts see progress while booking actions run, and the dashboard stays visible during refresh. The release also brings early checkout to Host Studio. The live booking API is 0.18.0. [Hosting verification](https://github.com/ArohaRetreat/website/actions/runs/42769452901)

### Website 0.32.3

**10 November 2026.** The Natura design pages retain their links while photos and other media load from Firebase Storage. [Hosting verification](https://github.com/ArohaRetreat/website/actions/runs/42672062980)

### Website 0.32.2

**9 November 2026.** Host Studio shows the Aroha Retreat logo and keeps legal links visible at the bottom of the workspace. [Hosting verification](https://github.com/ArohaRetreat/website/actions/runs/42612277802)

### Website 0.32.1

**9 November 2026.** Studio opens on the arrivals, departures and booking request dashboard. Hosts can search guest profiles and browse payment, invoice and sent-email records. Guests can download issued invoices and receipts from their profiles. [Hosting verification](https://github.com/ArohaRetreat/website/actions/runs/42583428948)

### Website 0.31.2

**9 November 2026.** Guests can keep newly saved ID photos for reuse at future check-ins. [Hosting verification](https://github.com/ArohaRetreat/website/actions/runs/42558355224)

### Website 0.31.1

**9 November 2026.** Guests can manage private ID photos, and booking managers can review them from active bookings. The release adds guest numbering and improves booking details on smaller screens. [Hosting verification](https://github.com/ArohaRetreat/website/actions/runs/42524656912)

### Website 0.30.3

**8 November 2026.** Public retreat media moved to Firebase Storage, reducing the files shipped with the site. [Hosting verification](https://github.com/ArohaRetreat/website/actions/runs/42503353224)

### Website 0.9.0

**2 November 2026.** The [Living Map](https://aroharetreat.com/map/) introduced an illustrated farm route with eleven places to explore and a Reading View. [Versioned deployment record](../../release-evidence/aroha-0.9.0/deployment.md)

## Pre-prod

### Website 0.33.2

**13 November 2026.** Compatible updates to Firebase, Resend and OpenTelemetry are available for pre-prod review with booking API 0.18.1. Production promotion is tracked separately. [Hosting verification](https://github.com/ArohaRetreat/website/actions/runs/43418614235) · [Promotion PR](https://github.com/ArohaRetreat/website/pull/166)

### Website 0.33.0

**10 November 2026.** Pre-prod introduced a review step for early checkout. When a host confirms an early departure, the booking records the checkout time. The feature reached production in [0.33.1](#website-0331). [Hosting verification](https://github.com/ArohaRetreat/website/actions/runs/42765380160)

### Website 0.32.4

**10 November 2026.** Pre-prod showed the scheduled checkout opening time in the booking drawer and explained why early checkout was unavailable. [Hosting verification](https://github.com/ArohaRetreat/website/actions/runs/42761928743)
