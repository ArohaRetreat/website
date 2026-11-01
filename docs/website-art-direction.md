# Aroha illustrated farm — website 0.3 review

The public experience is an authored, explorable farm illustration with a morning/evening crossfade, four scroll-controlled destinations, cottage collection, native experience disclosures, an illustrated visit ledger, and actual farm photography. Natura Lora, Source Sans and Kannada typography and the existing Aroha logo remain in use.

## Art production

Six original assets were created using the built-in image generation tool. These are artistic impressions, not a surveyed property map or evidence of actual interiors. Transparent PNG masters are preserved in the sibling `Art-Production/masters` directory. Website derivatives are lossily encoded WebP with alpha retained; originals and edited farm photographs are untouched.

Prompt set:

1. **World dawn:** a sophisticated physical architectural maquette of a Karnataka working farm, ivory red-roofed A-frame cottages among coconut palms, granite boulders, pond, curved stone paths, ox and sheep, restrained natural material detail, warm daylight, isolated with true transparent background, no lettering, no cartoon or low-poly treatment.
2. **World dusk:** edit the same world while preserving its exact composition and transparency; blue-hour foliage, warm cottage window and pathway lighting, restrained pond reflections.
3. **Foreground palms:** a matching isolated coconut-palm cluster for subtle foreground depth, realistic foliage and natural materials, transparent background.
4. **Cottage vignette:** a close architectural maquette of a red-roofed cottage with verandah, stone steps, tropical planting and coconut palms, matching the world style, transparent background.
5. **Farm-life vignette:** a mango tree, farm ox, sheep and wooden bullock cart on a small planted terrain island, matching the world style and daylight, transparent background.
6. **Stillness vignette:** Karnataka granite boulder hill, coconut palms and a quiet linen meditation mat clearing, matching the world style, transparent background.

Saved website files: `website/assets/retreat/art-{world-dawn,world-dusk,palm-foreground,stay-vignette,farm-vignette,stillness-vignette}-v1.webp`.

The optional hero worldImage/eveningImage/foregroundImage fields are editable in the host studio and validated by the existing media URL policy. Existing schema-1 records remain accepted. Journey imagery is editable through the existing CMS. Simple View and reduced motion remove spatial movement; native navigation and disclosures remain available. Switching view retains the current section.

## Verification and release boundary

65 application tests passed locally, including legacy content acceptance and rejection of unsafe illustration URLs. The website build passed. Desktop and narrow-screen browser composition, hotspot chapter navigation, time-of-day control and native detail/enquiry interactions are checked separately from production OAuth and physical-device acceptance.

This direction is delivered for visual review on a Firebase preview channel. Production promotion and authenticated publishing of the optional illustration fields are separate from this review. No claims are made for exact property layout, verified cottage interiors, physical-device performance or RUM-to-backend linkage.
