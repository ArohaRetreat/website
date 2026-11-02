# Compatible photo variants — API 0.3.0

Tour stops optionally accept `eveningImage` (existing trusted image URL policy, empty means use day) and `eveningImageAlt` (text, at most600characters). A non-empty evening image requires a non-empty description. Older records remain valid. Existing viewer/editor/admin permissions, expectedVersion conflicts, audit events and publish boundary apply unchanged. No rules/index/membership or secret changes. The host studio materializes empty optional fields and offers the existing image upload control. Only a saved and published variant becomes public. Invalid URLs/descriptions are rejected before a transaction.

# Aroha administration API v1

Base `/api/v1`, JSON over HTTPS. Every route requires a Firebase bearer ID token. `/session` accepts verified Google identities only; other routes require active membership. Errors use `{error:{code,requestId}}`, with the request ID also in `X-Request-Id`. Responses are not cached.

| Method / route | Permission | Contract |
| --- | --- | --- |
| POST `/session` | Verified Google identity | `{}` → accepted membership; consumes invitation or bootstraps configured owner |
| GET `/draft` | Viewer+ | Current content/version or null |
| POST `/draft` | Editor+ | `{content,expectedVersion}` → next version |
| POST `/publish` | Admin+ | `{expectedVersion}` → published version and revision |
| GET `/revisions?cursor=N` | Viewer+ | 25 descending versions and next cursor |
| POST `/restore` | Admin+ | `{revision,expectedVersion}` → new draft; public site unchanged |
| GET `/members?cursor=ID` | Admin+ | Up to 50 members and next cursor |
| POST `/members/:uid` | Role-dependent manager | `{role,active}`; no self/owner changes or super-admin elevation |
| GET `/invitations?cursor=ID` | Admin+ | Up to 50 invitations and next cursor |
| POST `/invitations` | Role-dependent manager | `{email,role}` → seven-day copyable invitation; no email sent |
| DELETE `/invitations/:id` | Role-dependent manager | Revoke invitation |

Super-admin manages non-super-admin roles; admin manages editors/viewers. Editor saves drafts/uploads media but cannot publish or manage people. Viewer cannot write. Mutation transactions re-check active membership before commit.

Version 1 content contains brand, hero desktop/mobile images, intro, ordered/visible sections, journey, cottages, experiences, packages, gallery, visit, FAQs, theme/motion and SEO. `functions/domain.mjs` is the shared authoritative validator. Reject unknown fields, duplicate IDs, invalid prices/dates/URLs/roles and oversize strings/arrays. Rendered text is escaped. Media is restricted to local retreat derivatives or this project's Storage media prefix. No executable HTML/CSS/scripts are accepted.

Draft creation starts at expectedVersion 0. Concurrent saves/publish/restore return VERSION_CONFLICT (409) on stale input without overwriting the client draft. Publication transactionally creates the immutable revision and audit; retrying the same version returns ALREADY_PUBLISHED. Restoring requires a separate publish. Stable invitation IDs hash normalized emails; existing members must be managed rather than re-invited. Revocation takes effect at the next authorization check.

Bounded errors include SIGN_IN_REQUIRED/INVALID_SESSION (401), INVITATION_REQUIRED/ACCESS_REVOKED/FORBIDDEN (403), NOT_FOUND/NO_DRAFT (404), VERSION_CONFLICT/ALREADY_PUBLISHED/MEMBER_EXISTS (409), PAYLOAD_TOO_LARGE (413), JSON_REQUIRED (415), DEPENDENCY_QUOTA/DEPENDENCY_UNAVAILABLE (503), DEPENDENCY_TIMEOUT (504), TRANSACTION_ABORTED (409) and validation codes (400). No raw provider error, body or token is returned/logged.

Limits: HTTP 220 KB; content 180 KB; 12 cottages/packages/stops; 24 experiences; 36 gallery photos; 30 FAQs; 12 interiors per cottage. Storage accepts new JPEG/PNG/WebP/AVIF objects below 10 MiB. Uploaded media is immediately public and cannot be overwritten/deleted by browser clients. No live availability, booking record, payment or automated confirmation is implemented.

## Additive tour/media fields (website 0.5)

Optional `tour` preserves existing schema 1 records. It includes eyebrow/title/description/mapNote, up to 20 ordered stops and 100 media entries. Stops have id/name/title/description/detail/image/imageAlt, featured film ID, bounded 0–100 map positions, up to eight nearby stop IDs, and an existing section target. Optional `onMap` can omit a farm-wide experience from the physical diagram. Optional `walk` provides up to twelve named film references. Media has id, kind (`photo` or `video`), name/description, image/poster, video src (empty for photos), and stop ID. Shared validation verifies uniqueness, relationships, allowed local media paths/project Storage prefix, size and text bounds; arbitrary markup/executable fields remain rejected.

Storage additionally accepts immutable MP4/WebM below 40 MiB from active editor/admin/superadmin members. Anonymous, viewer and revoked-member writes remain forbidden. The studio exposes upload controls and the public/immutable disclosure before upload. The API validator and Storage rules must reach production before publishing this field; a Hosting preview alone does not update them.

## Additive nature settings (website 0.6)

Optional `tour.nature` has `enabled` (default true: hero botanical composition and nature section), `welcome` (default true: document-entry sprout), `welcomeTitle`, `welcomeLabel`, `leafImage`, `plantImage`, `eyebrow`, `title`, `description`, and up to five `items` with `value`, `name`, `description`. The shared validator rejects unknown keys, executable/external image URLs and excessive strings/arrays. Text is escaped. Default content is website/nature-content.json; old records fall back to it. Titles/labels are bounded to 240 characters, description to 2,000; item value/name/description limits are 80/150/1,200. Same draft/edit/publish permissions and version-conflict semantics apply. The studio exposes the two image upload settings and both booleans. No new authentication, membership or telemetry scope is introduced.

Published nature content replaces the public page after Firebase metadata loads. The first paint, document-entry welcome and social tags use the build seed and change with a Hosting rebuild. Motion is additionally constrained by each visitor’s Simple View/reduced-motion preference; visibility of content does not depend on animation completion. No network response is required to release the welcome.

Website 0.7 adds optional `tour.nature.heroEveningImage` and `heroEveningAlt` (250 characters). The image follows the existing local/project Storage media policy. The studio merges these defaults into older nature settings; validation remains backward compatible. The chosen photograph is fetched only when the visitor selects After sunset. No permissions, business events, guest records or booking behavior change. As with previous optional tour fields, the reviewed backend validator must be rolled out before production CMS saves can include them.

## Canonical production host (website 0.8.2 / API 0.1.1)

The canonical host is https://aroharetreat.com. Exact apex and the two original Firebase origins are admitted; lookalike/suffix/HTTP origins remain denied. www is a Hosting redirect and is not an API origin. No-Origin requests still require verified authentication/membership. Invitation URLs use the canonical host. Emulator origins stay emulator-only.

## Living Map extension (API 0.2.0)

Content schema remains 1. An optional `storyMap` object adds `eyebrow`, `title`, `invitation`, `description`, `rootTitle`, `chapters` and `places`. Existing records without it remain valid. Records supplying it must include `tour`, so references can be validated on the server. There are 1–4 unique chapters (`id`, `title`, `invitation`, `description`) and 1–20 unique places (`id`, `chapter`, `title`, `paragraphs`, `facts`, `media`, `caption`). Each chapter must contain a place. Place IDs must exist in `tour.stops`; chapter IDs must exist in the map; a nonempty media ID must belong to that same stop in `tour.media`. Empty media uses the stop photograph.

Paragraphs: 1–4 strings of at most 2,500 characters. Facts: at most 3 strings of at most 180 characters. Place titles: 200; captions: 1,500; identifiers: 48. Unknown fields/executable markup configuration and dangling references are rejected. The full existing content-size cap still applies. Rendering escapes text. Root geometry and animation code are fixed application assets, not executable CMS content.

The extension uses existing `/draft`, `/publish` and history/restore routes. There is no new write endpoint or public write permission. Viewers read; editors save/upload; admins and super-admins publish. Expected-version conflicts and their audit/OTel classifications remain unchanged. Invalid references return `INVALID_MAP_REFERENCE`/400 without saving a revision. The emulator lifecycle exercises map saves and publication plus a rejected invalid map. Public clients continue to read only `aroha_public/site`.

## Illustrated welcome (API 0.2.1 / website 0.13.0)

Optional `tour.nature.hrudhi` contains `enabled` (boolean), `invitation` (240 characters), `description` (1,200), `bioTitle` (150), `bio` and `role` (2,000 each), `poster`, `still`, `portrait` (existing image URL policy), and `film`, `mobileFilm` (existing video URL policy). All fields are required when the object is supplied; older records without it remain valid and receive website defaults. Unknown fields are rejected. Text is escaped; media stays local or in the project’s immutable public Storage media path.

Existing draft/save/publish/history routes, role checks, audit events, pagination, errors, expected-version conflicts and size limits remain unchanged. Deploy validator 0.2.1 before the new studio. Changes require explicit publication. No public write endpoint, guest record, live chat or personal biography is introduced. The illustrated guide is clearly distinguished from real farm hosts.

## Visit details and guide assets (API 0.2.2 / website 0.14.0)

Content schema remains 1. Each package optionally accepts `availability`: `available` or `coming-soon`. Missing values retain a backward-compatible product default: wellness is coming soon, other packages are available. The studio materialises defaults for editing; changing launch state requires normal explicit publication. Coming-soon packages cannot produce a dated enquiry (`PACKAGE_COMING_SOON`); visitors may ask the hosts about launch plans through a separate reviewed WhatsApp link.

Optional `visit.address` is escaped text, under the existing string/content limits. Optional `visit.mapEmbedUrl` must be HTTPS at exactly www.google.com/maps/embed with a pb query; malformed/untrusted origins are `INVALID_MAP_URL`. An empty URL disables the embed. Existing location defaults are used for older publications. The standard Google Maps public share embed was obtained from the existing verified pin. It is loaded only when requested; this does not grant geolocation access or require an API key.

Optional `tour.nature.hrudhi.walkSheet` follows the existing image URL policy. The asset format is a 4-by-2 equal-cell walk cycle; animation code remains fixed, not executable CMS content. Existing nature/guide records without it remain valid.

No new backend route, guest database record, permission, membership, index or migration is added. Guest Google sessions are Firebase Auth identities only; every host API call still requires current active membership. Authenticated non-members remain denied by independent server/rules checks. Deploy the validator before studio/Hosting. Existing draft conflict/audit and observability contracts remain intact.
