# Review deployment — website 0.8.0

Preview: https://aroha-retreat--real-farm-048kl7ga.web.app

- Deployed application revision: `56f8df43f42c4c3467cea7d887031b32022334dc`
- Hosting version: `5ad0e783f0876c06`
- Channel: `real-farm`, expires 8 November 2026, 17:55:16 (CLI local time, Asia/Kolkata).
- Full shared build used the exact committed revision in `AROHA_BUILD_REVISION`. Root, host studio and Natura `/design/` are preserved. Production remains website 0.1.0. No backend, rules, billing, OAuth domain or CORS changes were deployed.

111 deployed files match the immutable local artifact by SHA-256, including root/admin/design HTML, website chunks and styles, the new collections CSS, local fonts and source-referenced photo/video media. Video byte-range retrieval returns 206 with exactly the requested 1,024 bytes. `preview-verification.json` contains individual hashes and the fetched production release.

Live Chrome opened the gallery directly after the continuous welcome reveal and showed all five loaded photographs/posters. Filters measured equal 44px heights and approximately 123.3px widths. Next changed the range to 6–10/56; Films reset to the first five clips; opening the pond film produced exactly one `video[src]`, which had readyState 4 and was removed on close. Pricing price-band tops matched at the reviewed desktop viewport and computed shadows were present on every card. The inspected console contained no errors/warnings. `live-album.png` and `live-pricing.png` are actual deployed captures. Earlier phone captures are source-equivalent local iframe emulation at 320/390 widths, not physical devices.

92 application tests, 37 website subset tests, 21 foundation tests/link checks, the isolated Firebase Auth/Functions/Firestore/Storage lifecycle and synthetic OTLP collector test pass. Complete shared build verifies all 30 immutable Hrudhi masters.

Deployed-code GitHub checks passed:

- [foundation](https://github.com/ArohaRetreat/natura/actions/runs/41306373561/job/124847490935)
- [application](https://github.com/ArohaRetreat/natura/actions/runs/41306373578/job/124847491254)
- [website integration](https://github.com/ArohaRetreat/natura/actions/runs/41306373578/job/124847490977)

Later evidence-only commits do not change the deployed application revision; their PR checks are tracked separately. The PR remains unmerged and issue #16 remains open. Physical-device performance, Safari certification, visual acceptance, production optional tour/nature schema/video-rule rollout, real owner OAuth/publication and full RUM linkage remain separate. This gallery/pricing revision adds no new API fields or telemetry contract. Preview monitoring remains disabled through the existing ignored runtime override; no private telemetry token or synthetic owner configuration is promoted.
