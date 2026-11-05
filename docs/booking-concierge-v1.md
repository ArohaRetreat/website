## Preprod0.22.0 refinement

Issue83 supersedes event quote/acceptance and calendar restrictions below for new requests: read [refinement contract](booking-refinements-v1.md). API0.8.0 supplies published exclusive daily pricing, one host approval, and an anonymous date/available-only calendar. Existing legacy event terms remain. The shared public enquiry form now requires current sign-in; account separates Enquire/Book. Production remains on0.21.7/API0.7.1 pending owner acceptance.

# Guest booking concierge — website 0.21.0, API 0.7.0

Issue70; initial activation was pre-production only. Issue72/website0.21.1 promotes the approved dates/party → suitable options → contact/review flow to both guest environments. Host Studio retains its existing entry. The service APIs, data schemas, approved capacity/pricing, consent, identities and environment isolation are unchanged. No fixture service, fixed closure, sample identity or in-memory booking write is included in the deployed guest entry.

## Interaction and authority

`booking-concierge-entry.mjs` binds real Firebase Google/session identity, existing bookingApi and atmosphere clock to `booking-concierge.mjs`. `booking-options.mjs` ranks feasible private room sets from the authenticated availability response; it does not grant a hold, issue a quote or supply displayed prices. The API generates the private and optional individual quotes and revalidates every create transaction. Configured host unit rates, child charges, adult caps and opening/check-in/out times are used prospectively. Ready/available rooms only; no construction inventory. One adult is needed in each selected room; each permits up to2adults/2under10s and the first two occupants are included. The API remains authoritative if inventory changes between availability and quote.

Individual accommodation is excluded for children. Couples can compare full private/shared totals; solo guests retain individual places. Day visits skip rooms. Exclusive enquiries use inclusive first/last dates in the UI and exclusive next-day departure in the API, ending at the configured final-day time. Exclusive events require a host offer, guest acceptance and host approval; enquiries alone hold no inventory. No event tariff is invented.

## Existing v1 operations and permissions

- `public/state/session/logout`: configured public rates, approved preprod tester sign-in, own profile and bounded history. Verified email is server-derived and readonly in forms.
- `availability`, `quote`: own authenticated availability/actor-scoped ten-minute quotes; at most two product quotes per comparison. A stale quote requires fresh review, never silent repricing and automatic submission. Optional invitation code is server-validated; no client discount is trusted.
- `profile`: explicit save with expectedVersion, name and international phone. Review inherits editable contact but does not overwrite old booking snapshots. Per-reservation contact phone is disclosed as part of existing essential server-owned business events; no free text or phone is added to frontend events or OTLP.
- `create`: uses the server quote ID as the retained idempotency key. Interrupted response keeps the exact original request snapshot and offers the same retry or history review. It never automatically creates a new quote/request on an uncertain outcome. Bookings are committed by the existing transaction, not the browser. Approval/cancellation cutoffs and saved terms remain applicable.
- `reservation-detail`, `booking-action`, `note`, `change-quote/change-request`: own booking detail, cancellation, host-offer acceptance, notes and date changes. Existing booking version guards and ownership checks remain server-enforced. Original dates stay reserved pending a date-change approval. Exclusive date changes require a new enquiry/accepted offer.
- `communications/invoice-download`: existing own mail status and private PDF access. Current transactional templates remain unchanged; the approved email/PDF designs are frozen review baselines, not activated by this guest release.

Existing API validation/error codes, idempotency, private cursors/pagination, data/index/TTL and capacity/audit contracts stay unchanged. No REST/MCP policy fork or new public unauthenticated capacity endpoint. Host management permissions are not broadened. Authentication changes clear private UI immediately and suppress stale in-flight private responses. Client-side state is not saved to localStorage; existing Auth remains session-scoped.

## Observation and environment

The guest entry uses `journeyStep` and existing bookingApi instrumentation, with only approved step/outcome/kind enums and real request correlation. Client observations respect monitoring consent; server response and committed events retain existing authority. No second RUM tag/exporter or fake trace ancestry. Runtime metadata still selects the preprod tag and service environment. Existing server log/metric/trace and business-event transport is unchanged. Capture/delivery acceptance, tenant searchability and native RUM linkage are distinct evidence.

## Release, validation and rollback

Root application version0.21.1; API remains0.7.0. No booking policy/data migration, host CMS publish or original media change. Build includes the new bundle/CSS for `/book/` in both environments; unified Studio keeps booking.mjs/css. Shared production Natura export remains pinned and independently composed. Read [environment delivery](environment-delivery.md) for the compatible production backend upgrade, branch guards and explicit email activation boundary. Roll back the matching Hosting release if necessary, retaining reservations and ledgers. Do not seed/restore data or replay historic outboxes.

Tests cover policy-parity recommendation/rates/occupancy, party edits, day/exclusive date semantics, contact, cancellation, uncertain retry, stale quote and account-change masking. Existing emulator API/Auth/Storage and synthetic OTLP suites remain required. Local emulator UI and actual Google/device/inbox/RUM acceptance are separate. Production activation is explicitly authorised in issue72; deployment evidence is separate from this source contract.
