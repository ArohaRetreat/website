const image = (name) => `/assets/retreat/${name}-v1.webp`;
export const ADDITIONAL_MEDIA = [
  ["farm-friends-welcome", "Friends sharing a welcome at the farm"],
  ["farm-family-grove", "A family afternoon beneath the farm trees"],
  ["farm-campfire-evening", "Conversations around the evening campfire"],
  ["farm-friends-under-palms", "Friends together among the palms"],
  ["farm-rooftop-greenery", "Terracotta roofs tucked into the green"],
  ["farm-family-walk", "A family walk through the farm"],
  ["farm-boulder-family", "Together on the boulder hills"],
  ["farm-valley-family", "A family pause above the valley"],
].map(([id, name]) => ({
  id: `p-${id}`,
  kind: "photo",
  name,
  description: `${name}. Photograph supplied by the Aroha hosts.`,
  image: image(id),
  src: "",
  stop: "farm",
}));
for (const [id, name] of [
  ["farm-hilltop-view", "Across the valley from the boulder hills"],
  ["farm-campfire", "An evening around the campfire"],
  ["farm-canopy-view", "A view through the palms and cottage roofs"],
])
  ADDITIONAL_MEDIA.push({
    id: `v-${id}`,
    kind: "video",
    name,
    description: `${name}. A silent web edition of footage supplied by the Aroha hosts.`,
    image: image(`${id}-poster`),
    src: `/assets/retreat/${id}-v1.mp4`,
    stop: "farm",
  });
ADDITIONAL_MEDIA.push({
  id: "p-meditation-evening",
  kind: "photo",
  name: "The meditation hall after sunset",
  description:
    "The meditation hall and its broad curved steps after sunset. Photograph supplied by the Aroha hosts.",
  image: image("meditation-evening"),
  src: "",
  stop: "meditation",
});
export function refreshFarmMedia(
  input,
  { poolImage = "/assets/retreat/pool-completion-impression-v1.webp" } = {},
) {
  const c = structuredClone(input),
    tour = c.tour;
  if (!tour?.stops || !c.storyMap?.places) throw Error("TOUR_AND_MAP_REQUIRED");
  const stops = new Map(tour.stops.map((s) => [s.id, s])),
    places = new Map(c.storyMap.places.map((p) => [p.id, p]));
  const library = stops.get("library");
  if (library)
    Object.assign(library, {
      image: image("library-impression"),
      imageAlt:
        "AI-generated artistic impression of a quiet library reading corner inspired by Aroha’s materials and greenery.",
    });
  const libraryPlace = places.get("library");
  if (libraryPlace)
    Object.assign(libraryPlace, {
      media: "",
      caption:
        "Artistic impression of a library reading corner, inspired by Aroha. This is a generated scene, not a photograph of the existing interior.",
    });
  const dining = stops.get("kitchen");
  if (dining)
    Object.assign(dining, {
      image: "/assets/retreat/DSC_3779.webp",
      imageAlt: "Aroha’s dining pavilion glowing beneath warm lights at night.",
    });
  const diningPlace = places.get("kitchen");
  if (diningPlace)
    Object.assign(diningPlace, {
      media: "",
      caption:
        "The dining pavilion at the main house, photographed after sunset.",
    });
  const meditation = stops.get("meditation");
  if (meditation)
    Object.assign(meditation, {
      eveningImage: image("meditation-evening"),
      eveningImageAlt:
        "The meditation hall and its broad curved steps after sunset. Photograph supplied by the Aroha hosts.",
    });
  tour.media = tour.media.filter(
    (m) => m.id !== "p-dsc-3815" && !m.image.endsWith("/DSC_3815.webp"),
  );
  for (const m of ADDITIONAL_MEDIA)
    if (!tour.media.some((x) => x.id === m.id))
      tour.media.push(structuredClone(m));
  const diningMedia = tour.media.find((m) => m.id === "p-dsc-3779");
  if (diningMedia)
    Object.assign(diningMedia, {
      stop: "kitchen",
      name: "The dining pavilion after sunset",
      description:
        "The dining pavilion at the main house, photographed after sunset.",
    });
  for (const p of c.storyMap.places) if (p.media === "p-dsc-3815") p.media = "";
  if (c.gallery)
    c.gallery = c.gallery.filter((m) => !m.image?.endsWith("/DSC_3815.webp"));
  for (const e of c.experiences || [])
    if (e.image?.endsWith("/DSC_3815.webp"))
      Object.assign(e, {
        image: meditation.image,
        imageAlt: meditation.imageAlt,
      });
  if (poolImage) {
    const pool = stops.get("pool"),
      place = places.get("pool");
    if (pool)
      Object.assign(pool, {
        image: poolImage,
        imageAlt:
          "AI-generated artistic impression of the completed swimming pool, based on Aroha’s construction footage.",
      });
    if (place)
      Object.assign(place, {
        media: "",
        caption:
          "Artistic impression of the completed pool based on construction footage. Ask the hosts about current progress and availability.",
      });
  }
  return c;
}
