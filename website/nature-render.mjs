import defaults from "./nature-content.json" with { type: "json" };
import { sceneSvg } from "../vendor/natura/runtime/nature-scenes.js";
export const natureContent = (tour) => ({ ...defaults, ...tour.nature });
export function welcomeMarkup(c, n, esc) {
  return `<div id="aroha-welcome" class="aroha-welcome" role="region" aria-label="Welcome to Aroha"><svg class="welcome-veil" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><defs><mask id="welcome-leaf-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><rect width="100%" height="100%" fill="white"/><g class="welcome-aperture-anchor" transform="translate(500 400)"><g class="welcome-aperture"><path d="M-20 135C-160 80-160-80-130-150C10-160 170-80 140 55C100 140 30 160-20 135Z" fill="black"/></g></g></mask></defs><rect width="100%" height="100%" class="welcome-paper" mask="url(#welcome-leaf-mask)"/></svg><span class="welcome-orbit welcome-copy" aria-hidden="true"></span><div class="welcome-botany" aria-hidden="true">${sceneSvg("seed")}</div><p class="eyebrow welcome-copy">${esc(n.welcomeLabel)}</p><p class="welcome-title welcome-copy">${esc(n.welcomeTitle)}</p><span class="welcome-copy" lang="kn">${esc(c.brand.kannada)}</span><button id="welcome-skip" type="button">Skip welcome <span aria-hidden="true">↗</span></button></div>`;
}
export function heroGarden(c, n, { esc, picture }) {
  if (!n.enabled) return "";
  return `<div class="hero-garden" aria-hidden="true"><div class="hero-light"></div><svg class="hero-canopy-lines" viewBox="0 0 1000 700"><path d="M-100 660Q140 710 210 400T650-100M1100 610Q850 710 820 400T450-100"/></svg><div class="hero-frond hero-frond-right">${picture(n.leafImage, "")}</div><div class="hero-frond hero-frond-left">${picture(n.leafImage, "")}</div></div>`;
}
export function natureStory(n, { esc, lines, picture }) {
  if (!n.enabled) return "";
  return `<section class="nature-story" aria-labelledby="nature-story-title"><div class="nature-story-heading"><p class="eyebrow">${esc(n.eyebrow)}</p><h2 id="nature-story-title">${lines(n.title)}</h2><p>${esc(n.description)}</p></div><div class="nature-growing-world"><div class="nature-contour" aria-hidden="true"><span></span><span></span><span></span></div><div class="nature-photo-petal petal-one">${picture("/assets/retreat/DSC_3890.webp", "Fresh green leaves at Aroha")}</div><div class="nature-photo-petal petal-two">${picture("/assets/retreat/DSC_3878.webp", "Green fields near the farm")}</div><div class="nature-photo-petal petal-three">${picture("/assets/retreat/DSC_3897.webp", "The leafy canopy at Aroha")}</div><div class="nature-plant">${picture(n.plantImage, "Botanical illustration of a young plant, with leaves and roots")}</div><span class="nature-art-caption">A STUDY IN GROWTH / BOTANICAL ILLUSTRATION</span><svg class="nature-connecting-line" viewBox="0 0 800 700" aria-hidden="true"><path pathLength="1" d="M400 585 C200 610 90 495 133 353 S320 60 500 130 S768 322 671 474 S380 682 400 585"/></svg></div><div class="nature-facts">${n.items.map((x, i) => `<article data-nature-fact="${i}"><span class="nature-fact-number">${esc(x.value)}</span><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p></article>`).join("")}</div></section>`;
}
export function orbitGallery(tour, { esc, picture }) {
  return `<div class="tour-orbit-stage" aria-hidden="true"><div class="tour-orbit-scene">${tour.stops.map((s, i) => `<div class="tour-orbit-panel" data-orbit-panel="${i}"><div class="orbit-panel-image"><img data-orbit-src="${esc(s.image)}" alt="" width="1800" height="1200" decoding="async"></div><span class="orbit-panel-caption">${String(i + 1).padStart(2, "0")} / ${esc(s.name)}</span></div>`).join("")}</div><div class="tour-orbit-floor"></div><span class="tour-orbit-caption">A LITTLE WORLD OF ITS OWN</span></div>`;
}

export function heroTitle(title, esc) {
  const parts = title.split("\n");
  return parts
    .map(
      (line, i) =>
        `<span class="hero-line ${i === parts.length - 1 && parts.length > 1 && line.trim().split(/\s+/).length <= 6 && line.length <= 42 && /^[\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}]+$/u.test(line) ? "hero-handwritten" : ""}"><span>${esc(line)}</span></span>`,
    )
    .join("");
}
export function heroEvening(n, esc) {
  if (!n.enabled) return "";
  return `<div class="hero-night" aria-hidden="true"><img data-src="${esc(n.heroEveningImage)}" alt="${esc(n.heroEveningAlt)}" width="2560" height="1707" decoding="async"></div>`;
}
export function heroMoments(n) {
  if (!n.enabled) return "";
  return `<div class="hero-moments" role="group" aria-label="Explore the farm in daylight or after sunset"><button type="button" data-hero-moment="day" aria-pressed="true"><span aria-hidden="true">☼</span> Under the palms</button><button type="button" data-hero-moment="evening" aria-pressed="false"><span aria-hidden="true">☾</span> After sunset</button></div><span id="hero-moment-status" class="sr-only" role="status"></span>`;
}
