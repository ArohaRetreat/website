import defaults from "./location-content.json" with { type: "json" };
export const locationContent = (c) => ({ ...defaults, ...c.visit });
export function renderLocationMap(c, { esc }) {
  const v = locationContent(c);
  return `<div class="reach-location"><a class="reach-address" href="${esc(v.mapUrl)}" target="_blank" rel="noopener noreferrer"><span class="eyebrow">FIND YOUR WAY TO THE FARM</span><strong>${esc(v.address)}</strong><span>Open directions in Google Maps ↗</span></a>${v.mapEmbedUrl ? `<div class="location-map-shell"><div class="location-map-placeholder"><span class="location-map-mark" aria-hidden="true">⌖</span><p>Hrudhi Farms · Kanakapura</p><button class="button" data-load-location-map>Show Google map ↗</button><small>Loads Google Maps from Google when opened.</small></div><iframe title="Aroha Retreat at Hrudhi Farms on Google Maps" data-map-src="${esc(v.mapEmbedUrl)}" hidden loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : ""}</div>`;
}
export function createLocationMap(root) {
  const button = root.querySelector("[data-load-location-map]");
  if (!button) return { destroy() {} };
  const frame = root.querySelector("iframe[data-map-src]");
  const load = () => {
    frame.src = frame.dataset.mapSrc;
    frame.hidden = false;
    button.closest(".location-map-placeholder").hidden = true;
  };
  button.addEventListener("click", load);
  return {
    destroy() {
      button.removeEventListener("click", load);
      frame.removeAttribute("src");
    },
  };
}
