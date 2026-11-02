import { createMenuMotion } from './menu-motion.mjs';
import { atmospherePreference, setAtmosphere, watchAtmosphere } from './atmosphere.mjs';
import { publicDestination } from "./page-transitions.mjs";

import { PUBLIC_PAGES } from "./public-pages.mjs";
export { PUBLIC_PAGES } from "./public-pages.mjs";

export function sectionLinks(content) {
  return [
    ["journey", "The farm"],
    ["cottages", "Stay among the palms"],
    ["experiences", "Farm experiences"],
    ["packages", "Ways to visit"],
    ["gallery", "The farm journal"],
    ["visit", "Plan your visit"],
  ]
    .filter(([id]) => content.sections.some((s) => s.id === id && s.visible))
    .map(([id, label]) => ({ href: "/#" + id, label }));
}
const leaves =
  '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M19 29C8 29 5 18 8 9C20 7 27 16 19 29Z"/><path d="M21 24C20 13 29 8 36 10C38 20 30 27 21 24Z"/><path class="menu-leaf-stem" d="M13 15Q22 25 18 35M29 15L20 26"/></svg>';
export function renderPublicHeader(
  c,
  { esc, mode = "home", path = mode === "home" ? "/" : "/map/" },
) {
  const current = path;
  return `<header class="${mode === "home" ? "field-header" : "map-header"} public-header"><a href="/" class="field-brand" aria-label="${esc(c.brand.name)} home"><img src="/assets/brand/logo-white.svg" width="190" height="65" alt="${esc(c.brand.name)}"></a><nav class="public-quick-links" aria-label="Main navigation">${PUBLIC_PAGES.map((p) => `<a href="${p.href}" ${p.href === current ? 'aria-current="page"' : ""}>${esc(p.label)}</a>`).join("")}</nav><div class="public-header-actions"><button class="guest-account-trigger" id="guest-account-header" data-guest-account>Sign in</button><button class="field-header-enquire public-visit" data-enquire="">Plan a visit ↗</button><button id="public-menu-toggle" class="public-menu-toggle" aria-label="Open menu" aria-controls="nature-menu" aria-expanded="false"><span class="menu-leaf-icon">${leaves}</span><span>Menu</span></button></div></header>`;
}
export function renderPublicMenu(
  c,
  { esc, mode = "home", path = mode === "home" ? "/" : "/map/" },
) {
  const current = path;
  return `<dialog id="nature-menu" class="nature-menu" aria-labelledby="nature-menu-title"><div class="menu-top"><a href="/" aria-label="${esc(c.brand.name)} home"><img src="/assets/brand/logo-white.svg" width="156" height="54" alt="${esc(c.brand.name)}"></a><button class="nature-menu-close" aria-label="Close menu"><span>Close</span><span aria-hidden="true">×</span></button></div><div class="menu-botanical" aria-hidden="true"><img data-menu-src="/assets/retreat/nature-frond-v1.webp" alt="" width="1024" height="1536" hidden></div><div class="menu-water" aria-hidden="true"><span class="water-drop"></span><i></i><i></i></div><div class="menu-content"><div class="menu-invitation"><p class="eyebrow">NATURE · MEDITATION · FARM LIFE</p><h2 id="nature-menu-title">Take the<br><em>scenic way.</em></h2><p>${esc(c.brand.welcome)}</p><span lang="kn">${esc(c.brand.welcomeKannada)}</span></div><div class="menu-links"><nav class="menu-pages" aria-label="Explore Aroha">${PUBLIC_PAGES.map((p, i) => `<a href="${p.href}" ${p.href === current ? 'aria-current="page"' : ""}><span class="menu-number">0${i + 1}</span><span><strong>${esc(p.label)}</strong><small>${esc(p.description)}</small></span><span class="menu-droplet" aria-hidden="true">↗</span></a>`).join("")}</nav><nav class="menu-sections" aria-label="Discover the retreat">${sectionLinks(
    c,
  )
    .map(
      (p) =>
        `<a href="${p.href}">${esc(p.label)} <span aria-hidden="true">↗</span></a>`,
    )
    .join(
      "",
    )}</nav><div class="menu-visit"><button data-menu-enquire>Let’s plan your visit <span aria-hidden="true">↗</span></button><a href="tel:+${esc(c.visit.phone)}">+${esc(c.visit.phone)}</a></div></div></div><div class="menu-bottom"><span>${esc(c.brand.tagline)}</span>${mode === "map" ? '<button data-menu-reading>Reading view</button>' : ""}<button data-menu-atmosphere aria-pressed="false">☾ After sunset</button><button id="guest-account-menu" data-guest-account>Guest sign in</button><a href="/admin/">Host studio ↗</a></div></dialog>`;
}
export function createPublicMenu(
  root,
  { onOpen = () => {}, onClose = () => {}, motion = true } = {},
) {
  const dialog = root.querySelector("#nature-menu"),
    toggle = root.querySelector("#public-menu-toggle");
  if (!dialog || !toggle) return { whenClosed: async () => {}, destroy() {} };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const listeners = [];
  const scene = createMenuMotion(dialog, {enabled: () => motion && !reduced.matches && !dialog.classList.contains("menu-still")});
  let opener, afterClose;
  const atmosphereButton = dialog.querySelector('[data-menu-atmosphere]');
  function syncAtmosphere(value) {
    atmosphereButton.setAttribute('aria-pressed', String(value === 'evening'));
    atmosphereButton.textContent = value === 'evening' ? '☼ Return to daylight' : '☾ After sunset';
  }
  syncAtmosphere(atmospherePreference());
  const unwatchAtmosphere = watchAtmosphere(syncAtmosphere);
  const listen = (el, type, fn) => {
    el.addEventListener(type, fn);
    listeners.push(() => el.removeEventListener(type, fn));
  };
  function close(action, immediate = false) {
    if (!dialog.open || dialog.dataset.menuPhase === "closing") return;
    afterClose = action;
    scene.exit(() => { if (dialog.open) dialog.close(); }, immediate);
  }
  function open(event) {
    if (dialog.open) return;
    opener = document.activeElement;
    toggle.setAttribute("aria-expanded", "true");
    const image = dialog.querySelector("[data-menu-src]");
    if (!image.src) {
      image.src = image.dataset.menuSrc;
      image.hidden = false;
    }
    const view =
      root.querySelector("[data-reading]");
    const modeButton = dialog.querySelector(
      "[data-menu-reading]",
    );
    if (view && modeButton) modeButton.textContent = view.textContent;
    dialog.classList.toggle("menu-still", !motion || reduced.matches || event?.detail === 0);
    dialog.showModal();
    document.body.classList.add("public-menu-open");
    root.querySelectorAll("video").forEach((v) => v.pause());
    onOpen();
    dialog.querySelector(".nature-menu-close").focus({ preventScroll: true });
    scene.enter();
  }
  listen(reduced, "change", () => { if (reduced.matches) scene.finish(); });
  listen(dialog, "cancel", e => { e.preventDefault(); close(undefined, true); });
  listen(toggle, "click", open);
  listen(atmosphereButton, 'click', () => setAtmosphere(atmospherePreference() === 'evening' ? 'day' : 'evening'));
  listen(dialog.querySelector(".nature-menu-close"), "click", e => close(undefined, e.detail === 0));
  listen(dialog, "close", () => {
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("public-menu-open");
    scene.reset();
    onClose();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    const action = afterClose;
    afterClose = null;
    if (action) requestAnimationFrame(action);
  });
  listen(dialog, "click", (e) => {
    const link = e.target.closest("a[href]");
    // Keep the forest scene in the outgoing native snapshot. Back/forward restore
    // recreates the controllers and closes the stale dialog through the renderer.
    if (!link || e.defaultPrevented) return;
    const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || link.target === "_blank" || link.hasAttribute("download");
    const to = new URL(link.href, location.href);
    // A local fragment moves only after the menu has folded away. Different
    // public documents remain native links and retain the forest snapshot.
    if (!modified && to.origin === location.origin && to.pathname === location.pathname && to.search === location.search && to.hash) {
      e.preventDefault();
      close(() => location.assign(to.href), e.detail === 0);
    } else if (!publicDestination(link.href, location.href) || modified) close(undefined, e.detail === 0);
  });
  listen(dialog.querySelector("[data-menu-enquire]"), "click", e =>
    close(() => root.querySelector("#footer-enquire")?.click(), e.detail === 0),
  );
  const modeButton = dialog.querySelector(
    "[data-menu-reading]",
  );
  if (modeButton) listen(modeButton, "click", e =>
    close(() =>
      root
        .querySelector(
          "[data-reading]",
        )
        ?.click(),
      e.detail === 0,
    ),
  );
  return {
    whenClosed() { return new Promise(resolve => { if (!dialog.open) return resolve(); dialog.addEventListener("close", resolve, {once:true}); close(); }); },
    destroy() {
      unwatchAtmosphere();
      listeners.forEach((fn) => fn());
      scene.destroy();
      document.body.classList.remove("public-menu-open");
    },
  };
}
