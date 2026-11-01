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
  return `<header class="${mode === "home" ? "field-header" : "map-header"} public-header"><a href="/" class="field-brand" aria-label="${esc(c.brand.name)} home"><img src="/assets/brand/logo-white.svg" width="190" height="65" alt="${esc(c.brand.name)}"></a><nav class="public-quick-links" aria-label="Main navigation">${PUBLIC_PAGES.map((p) => `<a href="${p.href}" ${p.href === current ? 'aria-current="page"' : ""}>${esc(p.label)}</a>`).join("")}</nav><div class="public-header-actions">${mode === "home" ? '<button id="view-toggle" aria-pressed="false">Simple view</button>' : ""}<button class="field-header-enquire public-visit" data-enquire="">Plan a visit ↗</button><button id="public-menu-toggle" class="public-menu-toggle" aria-label="Open menu" aria-controls="nature-menu" aria-expanded="false"><span class="menu-leaf-icon">${leaves}</span><span>Menu</span></button></div></header>`;
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
    )}</nav><div class="menu-visit"><button data-menu-enquire>Let’s plan your visit <span aria-hidden="true">↗</span></button><a href="tel:+${esc(c.visit.phone)}">+${esc(c.visit.phone)}</a></div></div></div><div class="menu-bottom"><span>${esc(c.brand.tagline)}</span><button ${mode === "home" ? "data-menu-simple" : "data-menu-reading"}>${mode === "home" ? "Simple view" : "Reading view"}</button><a href="/admin/">Host studio ↗</a></div></dialog>`;
}
export function createPublicMenu(
  root,
  { onOpen = () => {}, onClose = () => {}, motion = true } = {},
) {
  const dialog = root.querySelector("#nature-menu"),
    toggle = root.querySelector("#public-menu-toggle");
  if (!dialog || !toggle) return { destroy() {} };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const listeners = [],
    animations = [];
  let opener, afterClose;
  const listen = (el, type, fn) => {
    el.addEventListener(type, fn);
    listeners.push(() => el.removeEventListener(type, fn));
  };
  function close(action) {
    afterClose = action;
    if (dialog.open) dialog.close();
  }
  function open() {
    if (dialog.open) return;
    opener = document.activeElement;
    toggle.setAttribute("aria-expanded", "true");
    const image = dialog.querySelector("[data-menu-src]");
    if (!image.src) {
      image.src = image.dataset.menuSrc;
      image.hidden = false;
    }
    const view =
      root.querySelector("#view-toggle") ||
      root.querySelector("[data-reading]");
    const modeButton = dialog.querySelector(
      "[data-menu-simple],[data-menu-reading]",
    );
    if (view && modeButton) modeButton.textContent = view.textContent;
    dialog.classList.toggle("menu-still", !motion || reduced.matches);
    dialog.showModal();
    document.body.classList.add("public-menu-open");
    root.querySelectorAll("video").forEach((v) => v.pause());
    onOpen();
    dialog.querySelector(".nature-menu-close").focus({ preventScroll: true });
    if (motion && !reduced.matches) {
      animations.push(
        dialog.animate(
          [
            { clipPath: "ellipse(8% 10% at 94% 5%)", opacity: 0.6 },
            { clipPath: "ellipse(150% 160% at 50% 50%)", opacity: 1 },
          ],
          { duration: 280, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
        ),
      );
    }
  }
  listen(toggle, "click", open);
  listen(dialog.querySelector(".nature-menu-close"), "click", () => close());
  listen(dialog, "close", () => {
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("public-menu-open");
    animations.splice(0).forEach((a) => a.cancel());
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
    if (link && (!publicDestination(link.href, location.href) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) close();
  });
  listen(dialog.querySelector("[data-menu-enquire]"), "click", () =>
    close(() => root.querySelector("#footer-enquire")?.click()),
  );
  const modeButton = dialog.querySelector(
    "[data-menu-simple],[data-menu-reading]",
  );
  listen(modeButton, "click", () =>
    close(() =>
      root
        .querySelector(
          modeButton.hasAttribute("data-menu-simple")
            ? "#view-toggle"
            : "[data-reading]",
        )
        ?.click(),
    ),
  );
  return {
    destroy() {
      listeners.forEach((fn) => fn());
      animations.splice(0).forEach((a) => a.cancel());
      document.body.classList.remove("public-menu-open");
    },
  };
}
