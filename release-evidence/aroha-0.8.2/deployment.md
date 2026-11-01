# Canonical production launch — website 0.8.2 / API 0.1.1

Production https://aroharetreat.com serves the reviewed homepage; www redirects to the apex with HTTP 301 and valid HTTPS. Application source cfe963fe907165ab1d656a46c269141247c37f94 was tested and composed before deployment. PR #7 merged it as 2edeb143a3890bf6b7c71a1a6782132662d75c80.

- Hosting version: d0605a1140fbb584, released 2026-11-01T18:39:46.206Z.
- Composed payload: 1,328 files, plus the composition manifest; Natura 0.6.1 export d2a170f6b42ed46635879873629abb5e9c467447 retains all three new profile-picture PNG downloads.
- 116 deployed critical files match local SHA-256 bytes, including all source-referenced media, root/admin/design HTML, chunks/styles/fonts, sitemap and the three profile PNGs. Video range returns 206 for exactly 1,024 requested bytes.
- Prior live Hosting version: 0374c43edcfc1a27. A Hosting rollback does not roll back memberships/content or the additive API/rules rollout.
- API runtime: arohaapi-00003-yah, Node 22, ACTIVE. Storage video policy and optional tour/nature/evening validation deployed before Hosting. Existing owner configuration matches its previous remote value, and DYNATRACE_PLATFORM_TOKEN remains bound to secret version 1. No emulator owner file was deployed; the temporary private deployment environment copy was removed afterward.
- Firebase Auth has exactly one additional authorised domain, aroharetreat.com; previous domains remain. Canonical-origin requests without authentication return 401 SIGN_IN_REQUIRED; a lookalike origin returns 403 ORIGIN_DENIED.

46 application tests, 21 foundation/link checks and the synthetic OTLP collector pass on local disk. All three current-head GitHub jobs pass, including the isolated Firebase lifecycle. The earlier local external-drive dependency-link attempt failed before meaningful integration execution; it is not claimed as successful evidence.

Deployed-head checks: foundation run 41337409937; application/integration run 41337409967. Merge-head checks also pass: foundation run 41337566003; application/integration run 41337565400.

Chrome verified the real homepage, canonical link and successful owner Google sign-in to the superadmin studio with a readable draft. No draft was saved or published during verification. The owner reported slow initial sign-in/startup, tracked in #8. Direct admin HTML measured about 0.35s and unauthenticated API about 0.53s; tenant-visible successful session handlers were about 0.4–1.4s. These measurements do not establish full Google/browser latency. Published history and access-list reads returned 200. A private owner screenshot was not published.

Browser monitoring had zero injected tags before consent, inserted one approved js-cdn tag after opt-in, and returned to zero after withdrawal/reload. No inspected homepage warnings/errors were present. This verifies consent/insertion, not beacon or native RUM/backend linkage. Tenant queries found a real new-revision denial span, its correlated log by trace_id/span_id/request.id and request-counter values; see observability.json. The old API version was not used as proof of new-revision ingestion.

Remaining acceptance: actual owner publication/restore/upload checks, physical-device/Safari review, complete browser RUM linkage and development-lifecycle export remain in issue #2/#5. Living Map #4 is approved for the next enhancement and is outside this release.
