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
