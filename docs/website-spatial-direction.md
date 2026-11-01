# Aroha connected spatial journey (website 0.4)

The 0.3 illustration direction failed visual acceptance. This version changes the interaction model: one continuous WebGL farm with a reversible camera route, hinged gate, pond reflections, cottage doorway, meditation clearing, orchard, and final aerial view. The browser owns scrolling; there are no wheel/touch scroll interception handlers. Destination buttons travel along the same route. The cottage hotspot opens the existing real-photo dialog and enquiry flow without moving the camera. Text, package data and photos continue to use the validated CMS. Nature motion pauses behind dialogs, offscreen and in background tabs. Simple View/reduced motion and unavailable/context-lost WebGL use the accessible document.

## Reference inspection in Chrome, 1 November 2026

Chrome's tab connector was unavailable; native Chrome controls worked after the restart. Directly inspected:

- Overworld Audio `/` and `/studio`: entered without sound, scrolled across the continuous terrain, and opened Studio. Persistent navigation sits over the landscape; the reading panel preserves the world alongside it.
- Unbelievably Crap `/`: inspected the central figure at entry and through multiple scroll states. The subject persists as text and foreground surfaces transform around it.
- Studio Mirage `/`: inspected its opening scene, moved into the spatial project selector, and reversed scrolling. The visual stage remains continuous while navigation remains usable.
- BLUNT `/` and `/pages/umbrella-explore`: dismissed optional tracking and signup, inspected the film opening, editorial transition, text reveal and centered product scene.

The useful common principle is spatial continuity plus a steady reading/navigation layer. This does not mean copying their graphics, code, branding, sound or exact motion.

## Original scene and assets

Three.js 0.187.0 is pinned and locally bundled into a separate lazy-loaded scene chunk. Original geometry is authored in farm-world.mjs. Camera and look paths, gate timing, destination mapping and deterministic terrain live in farm-route.mjs. It is an artistic interpretation, not a surveyed property model.

Architecture, trunks, rocks, deck, path and pavilion are 3D meshes. Static geometry is merged by material; ground blades and crown foliage are instanced. Coconut crowns use an original generated alpha texture as camera-facing foliage, a standard real-time vegetation technique. The world is not composed of pre-rendered image panels. The pond reflects scene geometry at a bounded 512px target. Device pixel ratio is capped at 1.5. No proprietary models or copied reference assets are shipped.

Two original material assets were generated using the built-in image tool:

- `ground-moss-v1.webp`: seamless top-down tropical grass/moss over rich earth, flat diffuse lighting, no objects or baked shadows, muted olive/forest greens.
- `palm-crown-v1.webp`: isolated mature coconut-palm canopy, realistic leaflets, side view, entire crown with central growing tip and coconuts, no long trunk/ground/text, true alpha.

PNG masters remain under the Codex generated_images session directory and are copied to the local Aroha-Art-Production master folder. The WebP operation encodes the files and retains alpha; no generated tree is represented as an actual photograph of Aroha.

## Acceptance boundary

Automated camera tests cover continuity, terrain clearance, reversal and gate opening before crossing. Scene tests cover finite geometry, draw/triangle bounds, light/gate updates and resource disposal. These do not prove visual craft, frame rate or physical-device behavior. Browser evidence and deployed code SHA belong in release-evidence/aroha-0.4.0. Production remains separate from the review preview. Existing API optional-art fields still require their own production rollout before host publishing.
