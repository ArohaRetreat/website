// Pure navigation helpers shared by rendering/controller tests.
export function placeFromHash(hash, places) {
  let id;
  try {
    id = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return null;
  }
  return places.some((p) => p.id === id) ? id : null;
}
export function adjacentPlace(places, id, direction) {
  const index = places.findIndex((p) => p.id === id);
  return (
    places[Math.max(0, Math.min(places.length - 1, index + direction))]?.id ||
    null
  );
}
export function treeDescent(top, height, viewport) {
  return Math.max(
    0,
    Math.min(1, (viewport * 0.45 - top) / Math.max(1, height)),
  );
}

// Fill a connection only as its gap enters the reading area; native reverse scroll unwinds it.
export function timelineProgress(gapTop, gapHeight, viewportHeight) {
  return Math.max(
    0,
    Math.min(1, (viewportHeight * 0.75 - gapTop) / Math.max(1, gapHeight)),
  );
}
