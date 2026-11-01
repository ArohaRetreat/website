import defaults from "./map-content.json" with { type: "json" };
import { tourContent } from "./field-render.mjs";
import { esc } from "./render.mjs";
import { farmMapArt } from "./map-art.mjs";
export const mapDefaults = defaults;
export function mapContent(c) {
  const tour = tourContent(c);
  // Old publications remain valid. Never bind a fallback story to an unrelated renamed stop.
  const map = c.storyMap || defaults;
  const places = map.places
    .filter((p) => tour.stops.some((s) => s.id === p.id))
    .map((p) =>
      c.storyMap
        ? p
        : {
            ...p,
            media: tour.media.some((m) => m.id === p.media && m.stop === p.id)
              ? p.media
              : "",
          },
    );
  return {
    ...map,
    places,
    chapters: map.chapters.filter((ch) =>
      places.some((p) => p.chapter === ch.id),
    ),
  };
}
export function mapMedia(place, tour) {
  const stop = tour.stops.find((s) => s.id === place.id);
  const media = tour.media.find(
    (m) => m.id === place.media && m.stop === place.id,
  );
  return (
    media || {
      kind: "photo",
      image: stop?.image || "",
      description: stop?.imageAlt || "",
      src: "",
    }
  );
}
function tree() {
  return `<div class="tree-camera"><img class="living-tree" src="/assets/retreat/living-tree-v1.webp" width="1024" height="1536" alt="" fetchpriority="high"></div>`;
}
function story(place, tour) {
  const m = mapMedia(place, tour);
  const stop = tour.stops.find((s) => s.id === place.id);
  const walk = (stop.walk || [])
    .map((w) => ({
      ...w,
      media: tour.media.find((m) => m.id === w.film && m.stop === place.id),
    }))
    .filter((w) => w.media);
  return `<article class="place-story" id="${esc(place.id)}" data-story="${esc(place.id)}"><div class="story-heading"><span class="eyebrow">${esc(stop.name)}</span><h3 tabindex="-1">${esc(place.title)}</h3></div><figure class="story-window">${m.image ? `<img src="${esc(m.image)}" alt="${esc(m.description)}" width="960" height="640" loading="lazy">` : ""}${m.kind === "video" ? `<button class="map-film-button" data-film="${esc(m.id)}" aria-label="Play film: ${esc(m.name)}"><span aria-hidden="true">▷</span> Watch this moment</button>` : ""}${walk.length ? `<div class="map-film-strip" aria-label="Walk through this place">${walk.map((w) => `<button data-film="${esc(w.film)}">${esc(w.name)} ↗</button>`).join("")}</div>` : ""}<figcaption>${esc(place.caption)}</figcaption></figure><div class="story-prose">${place.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div><ul class="story-facts">${place.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul><a class="map-text-link" href="/#visit">Ask the hosts about ${esc(stop.name.toLowerCase())} ↗</a></article>`;
}
export function renderMap(c) {
  const map = mapContent(c),
    tour = tourContent(c);
  return `<a class="skip-link" href="#map-stories">Skip to place stories</a><header class="map-header"><a href="/" aria-label="Aroha Retreat home"><img src="/assets/brand/logo-forest.svg" alt="${esc(c.brand.name)}" width="152" height="52"></a><nav aria-label="Main navigation"><a href="/">The retreat</a><a href="/map/" aria-current="page">Living Map</a><a class="map-visit-link" href="/#visit">Plan a visit ↗</a></nav></header><main><div class="living-layout" id="map-start"><div class="map-scene" aria-label="Illustrated farm map with the host-described route"><div class="scene-light" aria-hidden="true"></div>${tree()}<div class="physical-map">${farmMapArt(map, tour)}<div class="farm-key"><span>THE FARM / FOLLOW THE PATH</span><p>Gate → Pond → House → Stays → Hall</p><small>Relative layout from the hosts · indicative, not to scale</small></div></div><div class="scene-annotation"><span class="eyebrow">NATURE · MEDITATION · FARM LIFE</span><p>A thousand little connections.<br>One place to belong.</p></div><span class="scene-stage" aria-hidden="true">01 / CANOPY</span><div class="scene-caption"><span class="map-calligraphy">Rooted in togetherness</span><span>A botanical story of Aroha · indicative, not to scale</span></div><div class="leaf-drift" aria-hidden="true"><i></i><i></i><i></i></div></div><div class="map-narrative"><section class="map-introduction"><p class="eyebrow">${esc(map.eyebrow)}</p><p class="map-calligraphy">${esc(map.invitation)}</p><h1>${esc(map.title)}</h1><p class="map-lede">${esc(map.description)}</p><a class="map-follow" href="#${esc(map.places[0]?.id || "map-stories")}">Enter the farm map <span aria-hidden="true">↓</span></a><p class="map-intro-note">From the tree into the farm.<br>Follow the path. Stay for the stories.</p><span lang="kn" class="map-kannada">${esc(c.brand.welcomeKannada)}</span></section><div class="map-descent" aria-hidden="true"><span class="eyebrow">02 / THE TRUNK</span><p class="map-calligraphy">Come a little closer</p><p>Different places.<br>A shared sense of home.</p><span class="descent-line"></span></div><div id="map-stories"><div class="map-stories-heading"><p class="eyebrow">03 / THE FARM, CONNECTED</p><h2>${esc(map.rootTitle)}</h2><p>Follow the illustrated path or choose a place.</p></div>${map.chapters
    .map(
      (ch, i) =>
        `<section class="map-chapter" id="chapter-${esc(ch.id)}" data-map-chapter="${esc(ch.id)}"><header><span class="eyebrow">CHAPTER ${String(i + 1).padStart(2, "0")} / ${esc(ch.title)}</span><h2>${esc(ch.invitation)}</h2><p>${esc(ch.description)}</p></header><svg class="chapter-branch" viewBox="0 0 100 22" aria-hidden="true"><path d="M50 0C50 12 15 8 15 22M50 0V22M50 0C50 12 85 8 85 22"/></svg><nav class="chapter-places" aria-label="${esc(ch.title)} places">${map.places
          .filter((p) => p.chapter === ch.id)
          .map(
            (p) =>
              `<a href="#${esc(p.id)}" data-map-place="${esc(p.id)}">${esc(tour.stops.find((s) => s.id === p.id).name)}</a>`,
          )
          .join("")}</nav>${map.places
          .filter((p) => p.chapter === ch.id)
          .map((p) => story(p, tour))
          .join(
            "",
          )}<div class="map-place-controls" hidden><button data-map-previous aria-label="Previous place">←</button><span data-place-count></span><button data-map-next aria-label="Next place">→</button></div></section>`,
    )
    .join(
      "",
    )}</div><section class="map-ending"><p class="map-calligraphy">A little closer to nature</p><h2>${esc(c.brand.welcome)}</h2><p>${esc(c.brand.tagline)}</p><a class="map-follow" href="/#visit">Make the visit your own ↗</a><a class="map-text-link" href="#map-overview" data-map-overview>See the whole farm ↗</a></section></div></div><aside class="map-tools" aria-label="Map controls"><a href="#map-overview" data-map-overview>↑ Overview</a><label class="sr-only" for="place-chooser">Choose a place</label><select id="place-chooser"><option value="">Choose a place</option>${map.places.map((p) => `<option value="${esc(p.id)}">${esc(tour.stops.find((s) => s.id === p.id).name)}</option>`).join("")}</select><button data-map-resume hidden>Back to story ↗</button><button data-reading aria-pressed="false">Reading view</button></aside><footer class="map-footer"><a href="/">Aroha Retreat — ${esc(c.brand.kannada)}</a><a href="/admin/">Host studio</a><details class="map-privacy"><summary>Privacy & monitoring</summary><p>Optional performance monitoring excludes enquiry details and personal information. No session replay.</p><button data-monitoring="allowed">Allow monitoring</button><button data-monitoring="denied">Decline / withdraw</button></details></footer></main><p class="sr-only" id="map-status" role="status" aria-live="polite"></p>`;
}
