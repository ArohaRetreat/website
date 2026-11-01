# Review deployment — website 0.7.0

Preview: https://aroha-retreat--real-farm-048kl7ga.web.app

- Deployed application revision: `5bdd193875f9c385c0853b6fbaf2ad0c3b524cf8`
- Hosting version: `f10feb476e8f5f94`
- Channel: `real-farm`, expires 8 November 2026, 15:30:37 (CLI local time, Asia/Kolkata).
- Full shared build used the exact committed revision in `AROHA_BUILD_REVISION`. The same artifact preserves root, host studio and Natura `/design/`. Production remains website 0.1.0; no backend/rule/access deployment was performed.

110 deployed files match local SHA-256 bytes, including root/admin/design HTML, website bundles/chunks/styles, actual photo/video media, the new arrival CSS and the local Allura WOFF2/OFL. Video byte-range request returns 206 with exactly the requested 1,024 bytes. See `preview-verification.json` for individual hashes and the fetched production release.

Chrome's extension observed `arrival-opening` while `#site` retained the inert attribute, then `welcome-complete` with the overlay removed and inert attribute released. Reload/Skip released the page immediately. After sunset selected the actual evening photograph, computed type for the invitation is `Allura, cursive`, and the inspected console contained no errors/warnings. The native Mac locked during the deployed intermediate-frame capture; the browser extension remained available and completed the live verification. The intermediate native frame sequence in this folder is the local source-equivalent capture described in `review.md`, not a claimed deployed native recording. `live-hero.png` is the actual deployed page captured through Chrome's extension.

Deployed-code GitHub checks passed:

- [foundation](https://github.com/ArohaRetreat/natura/actions/runs/41295488917/job/124815364746)
- [application](https://github.com/ArohaRetreat/natura/actions/runs/41295488908/job/124815364779)
- [website integration](https://github.com/ArohaRetreat/natura/actions/runs/41295488908/job/124815365005)

Later evidence-only commits do not alter this deployed application revision; current-head status is visible on PR #17 and must be read separately. The PR remains unmerged and issue #16 remains open. Visual acceptance, physical-device performance, the production optional tour/nature validator/video-rule rollout, real owner OAuth/publication and full RUM linkage remain separate. The preview uses the existing ignored monitoring-off override; no private telemetry credential or synthetic owner environment was promoted.
