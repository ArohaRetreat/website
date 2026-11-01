# Aroha website 0.1.0 — deployed verification

Issue #16; PR #17. Deployed application revision: `3088054b04f52dc59d1271c6dcff8281a06eda90`. Documentation-only follow-up commits do not change this deployment identity.

Firebase Hosting released 1,234 files, including root website, `/admin/` and retained `/design/`. Thirty root/website and critical design files matched local SHA-256. Root, admin and design returned 200; protected API returned 401 SIGN_IN_REQUIRED with no-store. Production browser fresh navigation loaded the edited photographs and protected Google sign-in screen; the enquiry correctly revealed overnight fields. No browser warning/error logs were observed. No message was sent.

Cloud Function arohaApi is ACTIVE in asia-south2, Node 22, revision `arohaapi-00002-cel`, maxInstances 3, secret binding enabled. Firestore/Storage rules were released. Artifact Registry cleanup is set to seven days. The first CLI command reported cleanup configuration failure after successful function creation; policy setup and final update subsequently succeeded.

Current deployed-code CI: foundation 13s, application 30s, website-integration 63s, all SUCCESS. Runs: https://github.com/ArohaRetreat/natura/actions/runs/41265185706 and https://github.com/ArohaRetreat/natura/actions/runs/41265185691. Includes 63 application tests, 21 foundation tests, real API/rules emulator lifecycle and synthetic protobuf three-signal checks.

Dynatrace: authorized token stored only in Secret Manager; empty trace/log/metric authentication probes each returned 200. Separately, DQL found the final revision's real 401 probe log and GET draft span with matching trace ID `00c13645efb6a1af0f2f167fcae28d92`, request ID `29bbe7c2-5f3d-4c08-9520-8f079a8a60bf`, version 0.1.0. `aroha.api.requests` also returned one request for route draft / status_class 4xx / faas.version arohaapi-00002-cel. These are operator verification requests, not guest activity or authenticated business success. No production customer mutation was used for verification.

RUM configuration endpoints returned 401/403 with the supplied token; public JavaScript tag requested from the owner. Browser RUM, browser-to-backend linkage, authenticated production owner acceptance, physical-device review, automatic BizEvent/replay and GitHub lifecycle export remain open. The photographic journey does not claim a surveyed gate/route walkthrough. Correctly matched cottage interiors and final prices/copy still require owner review. PR is open and unmerged; issue remains open for these acceptance criteria.
