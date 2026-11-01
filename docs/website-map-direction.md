# The Living Map — 0.9.0

Issue: https://github.com/ArohaRetreat/website/issues/4. The owner approved implementation and then clarified during visual review that locations must appear on a large farm map, with stories over the illustration. Decorative roots must not suggest the physical location of buildings.

`/map/` is a separate, pre-rendered document. The homepage gains navigation links; it does not import the tree, stories or controller (enforced by a build dependency-graph guard). A botanical tree is the entrance. Native scrolling descends and crossfades into a full-viewport illustrated farm with story panels over it. All eleven location markers remain visible on desktop. An Overview control removes the story overlay and centres the complete map; selecting a marker restores its story. The highlighted path follows the walking sequence, without implying measured distances.

`map-art.mjs` draws schematic buildings, lawn/groves, water, approach/parking, stairs and the S-shaped road. Markers reuse the same `tour.stops.mapX/mapY` coordinates as the homepage. The relative layout follows the owner: gate/right parking, pond right/S-shaped road, house at the pond end, kitchen in front/library beside, stairs right to two raised rooms, cottages behind, hall at the upper end and pool to its left. The parking branch curves below the pond rather than crossing the water. Buildings, plant spacing, boundary shape and paths are indicative symbols, not surveyed footprints. Kitchen/library/pool proxy photos are explicitly captioned.

Eleven places share four chapter panels, so every marker does not add another full-screen stage. Selecting a marker, chapter link or place chooser reveals a story and changes the fragment. Back/Forward restores a place; manual scrolling can retake control during smooth navigation. The scene remains separate from reading text. Lora, Source Sans 3, Kannada and short Allura invitations use the existing local Natura font assets.

On phones the sticky map crops around the active location and its neighbours; Overview shows the entire route with numbered points. The labelled desktop map is not squeezed into a tiny phone diagram. Reading View exposes every story as an ordinary document; reduced motion defaults to this view. Pre-rendered HTML contains all stories and links for JavaScript failure/no-JS access. Artwork failure leaves navigation/text intact. Films are guest-triggered and sources assigned on demand. Only one film plays; hidden/offscreen/page-hidden films pause. Controllers, listeners, RAF, observer and subscription dispose/recreate across CMS paints and back-forward cache restoration.

## Content and rollout

The optional `storyMap` extension to schema 1 is defined in `functions/domain.mjs` and `docs/api/aroha-v1.md`. Seed stories in `map-content.json` are used when the publication lacks it. The studio exposes bounded copy, facts, chapters, media IDs and captions; Preview opens `/map/?preview=1`. Existing sender/origin checks, expected versions, history and roles remain enforced. The studio materializes fallback stories privately. No production content migration/overwrite is needed. Deploy API 0.2.0 before the new studio. Roll back Hosting/API together if withdrawing it; preserve stored content/history/memberships.

## Artwork

Built-in imagegen produced the entrance botanical plate: a complete mature Indian shade-tree, believable branching, textured trunk, restrained green foliage and tapering roots, fine engraving/gouache detail, transparent margins and no text/buildings. The inspected PNG was encoded with `cwebp -q 83 -m 6` to `assets/retreat/living-tree-v1.webp` (852,258 bytes). Original master stays in local website design working files. It is generated artwork, not a farm photograph. Physical map artwork is deterministic SVG owned by this application. Incremental initial raster art stays below the approximate 1 MB budget; secondary photos are lazy and film sources absent initially. These are asset facts, not device performance certification.

## Verification

Run unit/foundation/OTLP tests, emulator save/publish/rules integration, graph guards and pinned shared Hosting composition. Browser checks cover desktop descent/locations/overview, 320/390-width layouts, reading, direct fragments/history, rapid selection, reverse scrolling, keyboard/focus and film play/pause. Physical-device behavior, final host copy/geometry acceptance and native RUM session/API linkage need separate evidence. Source/CI, preview, production and tenant visibility remain distinct.

## Forest canvas and connected cards (0.9.2)

The map keeps the opening forest green throughout its header, scene, reading backdrop and footer. Explanations float in opaque white cards, with a low-opacity CSS leaf/vein watermark matching the homepage pricing-card treatment. No new raster art is needed. Five decorative connectors link the story heading and successive chapter cards to the closing invitation. The existing native-scroll RAF measures their gaps and writes only `scaleY` on each line; growing lines reverse with scrolling and adapt when story height changes. Reading View, reduced motion and globally disabled motion use steady connections. Decorations are noninteractive and hidden from assistive technology. Route coordinates, media, permissions and API0.2.0 are unchanged.
