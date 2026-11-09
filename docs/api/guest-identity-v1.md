# Guest identity and numbering

Production starts at website 0.31.1 and API 0.16.1. Pre-production uses synthetic adult ID photos. Public API clients and MCP do not receive an ID scope or documents.

## Contract

The Firebase API accepts JSON `POST /api/v1/guest-identity/{action}`. Every action needs a verified Google Firebase session with the tester allowlist applied in pre-production. Every response is private and `no-store`. A guest omits `bookingId` and can only access their own verified profile. A booking manager passes a booking UUID. Review and preview are limited to confirmed or checked-in bookings; staff can upload only when an active walk-in booking has no saved ID. A view-only staff account cannot access an ID.

| Action | Additional request fields | Success |
| --- | --- | --- |
| `status` | none | Guest number (or null), document summary (or null), and access flags |
| `upload` | `version` (null on first upload), `consent: true`, optional `consentPolicy`, `contentType`, `contentBase64` | New pending-review document and guest number |
| `preview` | current document `version` | Private JPEG bytes encoded as base64 |
| `verify` | current document `version`; manager plus active `bookingId` | Document status and verification time |
| `retain` | current document `version`, `consent: true`, `consentPolicy: "guest-id-v2"`; guest only | The same document with no fixed expiry |
| `remove` | current document `version`; guest only | Null document and unchanged guest number |

A summary contains an opaque version, upload time, expiry time or null and review status. A newer image resets review. Version conflicts return 409; reload before retrying. Missing or invalid sessions return 401, staff without access receive 403, malformed fields or images return 422, and requests are limited to 12/minute per caller. No storage path, original filename, ID number or public URL is returned. Mutations have version preconditions, so a client with an interrupted response can resolve through status. Verify marks a staff decision; the system does not authenticate the document or independently establish the guest’s identity.

Consent is optional. The guest or booking manager must cover document numbers before upload; the server cannot detect Aadhaar or read redactions. Do not upload Aadhaar or children’s documents. The app accepts JPG/PNG up to 1 MiB, decodes a single image (12 MP input cap), removes metadata by re-encoding to JPEG and stores it under a private environment-specific prefix. Only the authenticated Function can return bytes; browser previews use revocable in-memory URLs. No image, filename, document ID, guest name or email is included in request telemetry. Private audit captures the action, actor, request ID and timestamp.

New website uploads send `guest-id-v2` after the guest agrees to private storage for future check-ins. These photos have no fixed expiry and are retired on replacement, removal or profile erasure. Photos under `guest-id-v1` retain their 90-day expiry. An upload without a policy still uses `guest-id-v1` for older clients. Guests can opt in from their profile while an older photo is still active. The version and verification status stay the same.

The existing five-minute retry worker removes up to 20 due blobs per run. Interrupted uploads expire from its queue after one day. Shared bucket soft-delete can retain deleted object generations beyond application access. After any `guest-id-v2` upload, preserve API 0.16.2 or later when rolling back Hosting so the active photo stays visible and removable.

## Guest numbering and production cutover

Check-in and numbering use the same Firestore transaction. Allocate to the booking’s lead customer profile, using the existing verified email binding for walk-ins. Repeat bookings, same-key retries, and verified account linking retain the same number. Numbers are never reassigned. A guest number is a sequence label, not an authentication credential or proof of identity. Additional unnamed occupants do not receive a number.

Before a separately authorized production launch, reconcile the first official booking reference supplied privately against the production owner and checked-in or completed state. In one reviewed transaction, require an empty production sequence and no assignment for that verified customer or its linked alias, set that customer’s guest number to 1 using the historical check-in timestamp, and initialize the production counter with `last: 1` and `firstGuestSeeded: true`. The allocator leaves the sequence idle until it sees this marker. Do not replay check-in, send mail, or move any pre-prod data. Verify the reservation/profile association before enabling numbering for new check-ins. Any additional historical assignments require a separate reconciliation. A missing or conflicting record must abort the seed rather than assigning a second number.

## Cost

No new service, scheduler or public asset. At 1,000 active uploads the hard upper bound is roughly 1 GiB of current images, excluding soft-deleted versions. Each preview sends one bounded image (base64 overhead on HTTP); frequent preview traffic, replacements, request compute and Storage retention can cost money. The existing worker adds one bounded Firestore query per tick, and a zero-result query can still incur a read. No production cost savings or zero-cost guarantee is claimed. See [Firebase pricing](https://firebase.google.com/pricing).
