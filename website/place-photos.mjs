import { atmospherePreference, watchAtmosphere } from "./atmosphere.mjs";
export function placePhoto(stop, mode = "day", day = stop) {
  const evening = mode === "evening" && !!stop.eveningImage;
  return {
    image: evening ? stop.eveningImage : day.image,
    imageAlt: evening ? stop.eveningImageAlt || day.imageAlt : day.imageAlt,
  };
}
export function photoAttributes(stop, { esc, day = stop } = {}) {
  return `data-photo-day="${esc(day.image)}" data-photo-day-alt="${esc(day.imageAlt || "")}" data-photo-evening="${esc(stop.eveningImage || "")}" data-photo-evening-alt="${esc(stop.eveningImageAlt || day.imageAlt || "")}"`;
}
export function createPlacePhotos(
  root,
  { mode = atmospherePreference, watch = watchAtmosphere } = {},
) {
  const handlers = new Map();
  let disposed = false;
  function paint(img, dayFallback = false) {
    if (disposed) return;
    const evening =
      mode() === "evening" && !!img.dataset.photoEvening && !dayFallback;
    const src = evening ? img.dataset.photoEvening : img.dataset.photoDay;
    const alt = evening ? img.dataset.photoEveningAlt : img.dataset.photoDayAlt;
    if (!src) return;
    img.dataset.photoState = dayFallback
      ? "fallback"
      : evening
        ? "evening"
        : "day";
    if (img.dataset.photoDecorative !== "true") img.alt = alt || "";
    // Orbit panels retain their existing near-viewport loading boundary.
    if (img.dataset.orbitSrc !== undefined) {
      img.dataset.orbitSrc = src;
      if (img.hasAttribute("src") && img.getAttribute("src") !== src)
        img.src = src;
    } else if (img.getAttribute("src") !== src) img.src = src;
    const figure = img.closest("figure"),
      caption = figure?.querySelector("[data-photo-caption]");
    if (caption)
      caption.textContent = evening
        ? caption.dataset.photoEvening
        : caption.dataset.photoDay;
    const note = img.parentElement?.querySelector("[data-photo-note]");
    if (note) {
      note.hidden = !/AI-generated|artistic impression/i.test(alt || "");
      note.textContent = "ARTIST’S IMPRESSION";
    }
    if (!handlers.has(img)) {
      const error = () => {
        if (
          img.getAttribute("src") === img.dataset.photoEvening &&
          img.dataset.photoEvening
        )
          paint(img, true);
      };
      img.addEventListener("error", error);
      handlers.set(img, error);
    }
  }
  function refresh() {
    root.querySelectorAll("img[data-photo-day]").forEach((img) => paint(img));
  }
  const unwatch = watch(refresh);
  refresh();
  return {
    refresh,
    set(img, stop) {
      if (!img || disposed) return;
      Object.assign(img.dataset, {
        photoDay: stop.image,
        photoDayAlt: stop.imageAlt || "",
        photoEvening: stop.eveningImage || "",
        photoEveningAlt: stop.eveningImageAlt || stop.imageAlt || "",
      });
      paint(img);
    },
    destroy() {
      disposed = true;
      unwatch();
      handlers.forEach((fn, img) => img.removeEventListener("error", fn));
      handlers.clear();
    },
  };
}
