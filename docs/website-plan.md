# Aroha website and host studio — implementation in progress

Tracking: https://github.com/ArohaRetreat/natura/issues/16
Branch: `feat/aroha-website-admin`.

## Current human direction

Prepare photographs for their intended compositions before continuing the website build. The initial implementation began too early and was paused for photographic review. The user subsequently delegated the treatment choice; ten full-resolution edits and web compositions are now complete and integration has resumed. Do not deploy the unfinished site or interpret prepared code as verified functionality. Preserve Natura at `/design/` in every shared Hosting deployment.

The public journey is enquiry-led. Brand/welcome → introduction → photographic journey → cottages → experiences → packages → gallery → practical visit information → host enquiry. Keep direct navigation, a Simple View, reduced motion, and guest access to enquiry without completing a journey. No live inventory, booking confirmation, payment or room holds. Gate and route geometry require real references; do not fabricate a surveyed walkthrough.

## Photography first

Thirty original JPEGs are in the user-selected Downloads/Aroha directory; originals must remain untouched. Selected production candidates: DSC_3795 (cottages/hero), DSC_3916 (path), DSC_3823 (farm), DSC_3780 and DSC_3779 (evening), DSC_3890/3894/3897 (botanical detail), DSC_3878 (landscape), DSC_3892 (architectural detail). The other cottage categories still require accurately matched photographs.

The initial Adobe review samples established the following production direction:

- Daylight DSC_3795: 1200 × 800 preview, auto tone, Color - Natural preset, highlights -35, darks +20, saturation -7, vibrance +8, contrast +5. Retain original geometry: automatic straightening incorrectly rotated the image and that result was rejected.
- Daylight desktop: 1200 × 675; mobile: 640 × 800 focused on the left cottage. Inspect actual framing, not tool success alone.
- Evening DSC_3780: 1200 × 800 preview directly from original geometry; highlights -45, darks +25, exposure +0.15, saturation -3. The more heavily auto-toned alternatives were rejected for changing the night atmosphere.
- Automatic canopy selection was inaccurate; narrower palm-frond selection failed. No production-ready foliage clipping is claimed. Finish masks with appropriate manual/Photoshop controls before using them as animation layers.
- Review samples are saved outside this public repository in the sibling `Photo-Review` directory. The user explicitly delegated final treatment selection after reviewing the samples.

Completed: ten full-resolution Adobe edits, ten 1800 × 1200 compositions and separate 2400 × 1350 desktop / 1200 × 1500 mobile hero crops. The website WebPs are encoded from these edited exports. Originals remain untouched; hashes and edit provenance are saved in the sibling Photo-Production directory. A foliage cutout was rejected for edge fringing and is excluded from the website. See website-photography.md.

## Dynamic content and access

User requested Google sign-in, protected super-admin identities, invitations, additional users and access control. Exact bootstrap identity values belong in ignored runtime environment configuration, never public docs or source. All other accounts require a pending invitation matching their verified Google email.

- Super-admin: content publishing and all non-super-admin membership management.
- Admin: content publishing and management of editors/viewers.
- Editor: content drafts and media upload; no publish or access management.
- Viewer: read-only studio.
- Invitations expire after seven days and may be revoked. Initial implementation provides a copyable link; it does not send email.

Firestore is already provisioned in `asia-south2`. Blaze was reverified enabled and the default Storage bucket was provisioned in ASIA-SOUTH2. The API uses the same region with bounded instances. Content edits, publishing, membership and invitations go through an authenticated, validated `/api/v1` function. Direct client content/membership writes are denied. Public clients read only the published site document. Storage media uploads are immutable and public immediately, disclosed in the studio. Draft content remains private. Publishing creates a revision and audit record transactionally. Expected versions prevent silent overwrite; restore creates a new draft.

Editable controls cover brand, headings, body text, photographs/alt text, section visibility/order, journey chapters, cottages, experiences, packages, contact details, FAQs, SEO and theme/motion. Arbitrary executable code is excluded.

## Implementation state and remaining checks

Source exists in `website/`, `functions/`, rules, build scripts and Firebase config. Local unit/integration/OTLP and browser checks have been run; final head/build/CI/deployment evidence is recorded separately. Admin bootstrap env is configured in an ignored file. No access provisioning has been performed. No invitation emails or messages have been sent.

Dependency installation on the external volume stalled. A local dependency workspace exists at `/tmp/aroha-site-runtime`; a source preview mirror was prepared at `/tmp/aroha-dev`. Inspect their actual state before reuse. Lockfiles were generated separately. Resolve dependency audit findings, complete builds and security tests before publishing. A temporary Java 21 runtime for Firebase emulator tests was downloaded to `/tmp/aroha-jre/Contents/Home`.

Required verification: unauthenticated/uninvited/revoked denial; verified-email invitation acceptance; role escalation prevention; owner protection; draft save/reload/conflict; publish/restore history; Storage access/type/size rules; actual Google sign-in; desktop/mobile public and studio workflows; accessible dialogs/focus; enquiry date/package rules; fresh reload; shared `/design/` preservation.

## Observability

Dynatrace target is the user-selected India CS tenant. Never reuse the privileged token pasted into chat in source, builds or reports. The server credential is now stored in Secret Manager and production export is enabled. Public RUM script configuration remains pending because the supplied token cannot access the RUM configuration APIs. Browser integration is consent-controlled and explicitly client-observed; enquiry preparation is not enquiry receipt. Google Analytics and session replay are disabled. API logs have safe structured operation/status/duration/request IDs. Durable Firestore audits are part of the write transactions. Optional server OpenTelemetry spans, logs and metrics have passed a synthetic protobuf collector test. Server log/span/metric searchability is verified for the deployed revision. RUM configuration, browser linkage and lifecycle export remain incomplete. Treat local checks, deployed configuration, ingestion acceptance, tenant searchability and linkage as separate evidence states.

## Deployed release

Website/API 0.1.0 is deployed from 3088054b04f52dc59d1271c6dcff8281a06eda90; root, admin and retained design routes verified. All three code-head CI jobs passed. PR #17 and issue #16 remain open. See release-evidence/aroha-0.1.0/release.md for deployment/telemetry evidence and remaining acceptance criteria.

## Revised visual direction — website 0.2.0

Owner rejected the first public design as too basic. Rebuild follows the spatial behavior of the supplied HTML prototype and the immersive photographic/type hierarchy of the supplied references. A botanical two-leaf threshold opens and closes with scroll; a deliberate entry action opens it before visitors continue. Morning/evening toggling uses real approved photographs. The photographic journey has camera motion, chapter controls, progress and contextual exploration links. Cottage browsing becomes an arched scroll-snap collection, experiences use native disclosures, and gallery photographs form a moving layered composition. Reading/booking controls remain stable. Transform/opacity dominate motion; reduced motion and Simple View preserve all content. No new library, fake inventory, generated facility or surveyed route is introduced. The CMS schema/API stay unchanged.

## Revision 0.5: actual farm route and complete media

The owner supplied the missing spatial relationships and rejected the 0.4 scene's craft. Follow [the current film-led direction](website-film-direction.md), replacing the procedural public entry with authentic moving viewpoints, a readable destination rail, host-described map and tree-house interior sequence. Include all 35 supplied photographs and 21 films in the dynamic journal. Library is beside the main house; guest kitchen is in front. Extend the protected studio with validated tour, media and video fields. Preserve existing auth/membership, enquiry, consent and design routes. Keep preview visual review separate from production promotion; no surveyed or seamless reconstructed 3D claim.

The current 0.8 motion and album direction and settings are documented in [living direction](website-living-direction.md), layered over the [real farm film route](website-film-direction.md). See current release evidence for the actual review deployment.
