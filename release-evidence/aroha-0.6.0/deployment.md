# Review deployment

- Preview: https://aroha-retreat--real-farm-048kl7ga.web.app
- Website: 0.6.0
- Deployed application revision: `948e9f636e23f8ed6defdf1c6ab85f916a4f92ff`
- Hosting version: `31f428e03faccab6`
- Channel: `real-farm`; expiry 8 November 2026 at 14:57:30 (CLI local time, Asia/Kolkata).
- Full shared build used `AROHA_BUILD_REVISION` with that exact committed revision. Root, admin and Natura design are in the same immutable Hosting artifact. No API/rules/production Hosting deployment was run.

## Verification

107 deployed files match local SHA-256 bytes, including root/admin/design HTML, release/runtime metadata, website JS/CSS/chunks, fonts/brand assets, the referenced real photo/video library and both new botanical derivatives. Release metadata identifies the exact application revision. A real video byte-range request returns 206 and the requested 1,024 bytes. See `preview-verification.json` for individual hashes and content range. Production's separately fetched release remains 0.1.0.

Native Chrome on the deployed preview shows the sprout welcome, automatic release to the shaped hero, successful Skip with focus transferred to Start your journey, the revolving photo gallery, destination change to parking and direct navigation to tree houses. Step inside opens the stairs film; selecting Open the door changes the selected film, and closing returns focus to Step inside at the same tree-house destination. `live-hero.png` is the final application revision. `live-tour.png` is the preceding 0.6 deployment, which has the same visual composition before the viewport-preservation fix; both are content-only native Chrome crops, not mockups. The viewport fix was directly checked locally across desktop → 390 × 844 → desktop, retaining tree houses throughout. Detailed responsive and Simple View checks are local iframe/native Chrome evidence described in `review.md`; no physical-device or FPS certification.

## GitHub checks on deployed code

- [foundation passed](https://github.com/ArohaRetreat/natura/actions/runs/41293186004/job/124808507491)
- [application passed](https://github.com/ArohaRetreat/natura/actions/runs/41293186063/job/124808508107)
- [website-integration passed](https://github.com/ArohaRetreat/natura/actions/runs/41293186063/job/124808508454)

Subsequent evidence-only commits do not change the deployed application. Their current-head check status is available on PR #17; do not infer it from the code checks above. PR is unmerged and issue #16 remains open. Production backend schema/video-rule rollout, real owner OAuth/publication, visual acceptance and full browser-to-backend RUM linkage remain separate open gates. Preview RUM is disabled by the ignored runtime override. No guest message, booking, payment or membership change was made during review.
