# Aroha website 0.5: real places, moving viewpoints

The owner rejected the visual craft and factual layout of the procedural 0.4 world. Its simplified architecture is no longer the public entry experience. The current public renderer is field-render.mjs, its native-scroll controller is field-journey.mjs, and its typography/layout is field.css. The older scene remains in source for comparison and its own regression tests; no Three.js world is loaded by the new public entry point.

## Reference and approach

Inspected Studio Mirage's Maison Margiela case-study entry film in Chrome on 1 November 2026. The case study describes a purpose-built WebGL garden, explorable stories and a consistent experience across screen sizes: https://studiomirage.io/works/margiela. The live campaign link did not complete loading in the controlled browser. Do not claim its complete interaction was verified or that Aroha reproduces its 3D production quality.

This revision uses authentic photographic environments, gentle native-scroll depth, two opening threshold panels, photographic crossfades, locally encoded films, a persistent named destination rail and an indicative route diagram. A curated, guest-controlled sequence follows the actual tree-house stairs, doorway, interior and return to the garden. This is a connected film-led tour, not a seamless 3D reconstruction or surveyed property model. No reference-site graphics, footage or code are copied.

## Host-described route

Gate → parking branch on the right → large pond on the right beside the S-shaped road → main house at the pond's far end. Kitchen in front of the main house, library beside it. Stairs on the right lead to two raised tree-house rooms; cottages sit farther behind. Meditation hall is at the upper end; swimming pool is toward its left. Trees and lawn are on the left of the entrance road. Farm life is a side discovery rather than a fabricated physical destination on a surveyed trail.

The map omits compass bearings and exact scale. The owner's step counts are approximate. The pond and parking positions are relationships, not measured boundaries. Kitchen, library and pool have no identified dedicated photograph in this source set; contextual imagery retains its actual caption, rather than depicting another space as those facilities.

## Information and motion

Lora is the editorial typeface, Source Sans 3 handles navigation, marker labels and body copy, and Noto Sans Kannada preserves the brand language. Chapter text stays still while its environment moves. All content below the tour remains accessible by normal scrolling: stays, experiences, complete package inclusions and group/child notes, a 56-item journal, directions and enquiries. Modal details preserve the tour position and original focus through nested views. Videos pause behind dialogs, outside the viewport and in hidden tabs. All clips are silent web editions and user-controlled players remain available. Save-Data prevents automatic playback. Simple View and reduced motion use a document route with the same destination details.

No wheel/touch interception, full-library video preload, forced audio or booking/availability simulation is used. Only the active tour film receives a source. Opening a journal clip loads that selected film. Native video controls and descriptive text accompany the source footage.

## CMS and deployment contract

Schema 1 remains backward compatible. Optional `tour` has editable copy, ordered stops, positions, relationships, journal media and optional room-walk sequences. The build seed is tour-content.json. Existing published records without this field use that seed; the host studio attaches it to an old draft for subsequent editing. Shared server validation rejects unknown fields, unsafe URLs, invalid references and excessive arrays. Video upload allows MP4/WebM below 40 MiB only for active editors; existing image limits remain 10 MiB, and media remains immutable/public after upload.

Backend validator and Storage rules must be deployed before the new tour can be saved on production. Preview Hosting deploys do not deploy these prerequisites and do not expand OAuth domains. A successful preview does not certify owner OAuth, production publishing, visual acceptance, physical-device performance or RUM-to-backend linkage.

## Source assets

All 35 photographs and 21 videos from the supplied folder are represented in the CMS-backed tour/journal. Ten previously approved Adobe-edited masters are reused; the other 25 received separate night, day and interior Adobe tonal/colour adjustments. Original files are untouched. All films were sampled at four points, then converted from HDR10 PQ through linear-light Hable tone mapping into SDR BT.709 H.264 24fps with fast-start metadata, no audio, and maximum dimension 1280 pixels. The 21 web films total 58,628,161 bytes rather than loading the multi-gigabyte originals.

Edited PNG masters and private Adobe URLs remain outside the public repo in Documents/Codex/Aroha-Media-Production. Source/output hashes, dimensions and treatment notes are in website-media-manifest.json. Photo orientation was verified after Adobe output; it already normalized EXIF rotations. Lossless source masters remain separate from WebP web derivatives. Clipped lamp cores and motion blur have not been falsely reconstructed.
