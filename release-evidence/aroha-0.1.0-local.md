# Aroha website 0.1.0 local verification

Issue: https://github.com/ArohaRetreat/natura/issues/16

- 63 application tests passed, including schema injection/limits, URL restrictions, role escalation, protected-owner policy, version conflicts and enquiry calendar/package rules.
- Emulator API/rules integration passed: verified Google identities, invitation acceptance/revocation, protected owners, read-only/editor/admin separation, transactional publish/history/restore, stale version rejection, direct Firestore write denial, anonymous/revoked/wrong-type Storage denial and permitted media upload.
- OTLP synthetic collector passed separate HTTP/protobuf trace, log and metric exports, semantic mutation span, bounded dimensions and private-text exclusion. This does not certify live Dynatrace ingestion.
- 21 foundation tests passed; foundation discovery/structure/local links passed.
- Complete local build passed, preserving original Hrudhi source identity and Natura design output. Production website bundle check excludes synthetic emulator identity controls.
- Local browser: edited hero and mobile composition inspected; enquiry/cottage dialogs, Simple View and draft save/reload/private preview/publish checked. Nominal 320/390 px iframe public and studio views showed no horizontal document overflow. Synthetic emulator identities only; no actual Google owner authentication or physical-device acceptance claimed.
- Source review: server auth and verified provider required; member roles reread within mutation transaction; unknown content keys rejected and HTML escaped; uploads immutable; private collections denied by rules; credentials excluded from source/build; publish explicit and version checked. Upload target changes during upload are guarded. No independent reviewer approval claimed.

Release, current-head CI, deployment, production OAuth, tenant-searchable telemetry and RUM linkage remain separate verification stages. Real gate/route geometry and matched room interiors still require source assets. No messages or invitation emails were sent.
