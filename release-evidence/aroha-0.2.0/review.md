# Aroha website 0.2.0 review

Continues issue #16 / PR #17 after owner rejected the initial public visual experience. The prototype is used as a spatial interaction reference; supplied photo/typography references guide the composition. The CMS schema remains 1 and backend API remains 0.1.0.

Local source checks: all 64 application tests passed. Browser interactions verified opening the threshold, its return to rotateY(0deg) on navigation back, explicit next-chapter navigation, real evening photograph selection, correct cottage dialog, Simple View, mobile journey/gallery and a CMS preview with the journey hidden. Enquiry still opens with the journey hidden. Nominal 320/390 iframe layouts report no horizontal document overflow; these are not physical-device/FPS acceptance. Main standalone local page produced no warning/error logs. The iframe review surface also emitted MutationObserver errors not present in the shipped bundle; no application-source attribution is claimed.

Motion review: one existing scroll RAF drives direct transforms/opacity. Geometry is read before visual writes, only visible compositions update, and reveal observers disconnect when content is replaced. First/last chapter captions stay readable. Reduced motion and Simple View bypass spatial movement. Hidden hero controls leave keyboard focus order; view switching restores focus. No new animation dependency, generated room, inventory behavior or property-map claim is introduced. The threshold and progress route are artistic narrative elements.

The approved browser RUM tag was deployed separately in 98db958 and checked absent before opt-in, inserted with the exact supplied URL/crossorigin after opt-in, and absent after withdrawal/reload. This is tag/consent evidence, not beacon/session/linkage acceptance.

The entrance screenshot is a local design review capture. Final build/CI/deployment and live verification are recorded separately in issue #16. Owner aesthetic acceptance, real Google owner sign-in, physical-device performance, matched room interiors and complete browser/server telemetry linkage remain open.
