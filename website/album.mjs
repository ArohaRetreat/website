export const ALBUM_SIZE = 5;
export function albumPage(media, filter = "all", page = 0) {
  const kind = ["photo", "video"].includes(filter) ? filter : "all";
  const items = media.filter((m) => kind === "all" || m.kind === kind);
  const pages = Math.max(1, Math.ceil(items.length / ALBUM_SIZE));
  const index = Math.min(
    pages - 1,
    Math.max(0, Number.isFinite(page) ? Math.floor(page) : 0),
  );
  const start = index * ALBUM_SIZE;
  return {
    filter: kind,
    page: index,
    pages,
    total: items.length,
    start,
    items: items.slice(start, start + ALBUM_SIZE),
    ids: items.map((m) => m.id),
  };
}
export function albumRange(state) {
  if (!state.total) return "0 moments";
  const label =
    state.filter === "photo"
      ? "photograph"
      : state.filter === "video"
        ? "film"
        : "moment";
  const end = state.start + state.items.length;
  const range =
    state.start + 1 === end ? String(end) : `${state.start + 1}–${end}`;
  return `${range} of ${state.total} ${label}${state.total === 1 ? "" : "s"}`;
}
export function renderAlbum(tour, { esc, picture }) {
  const first = albumPage(tour.media);
  const filters = [
    ["all", "All"],
    ["photo", "Photos"],
    ["video", "Films"],
  ]
    .map(
      ([kind, label]) =>
        `<button type="button" data-album-filter="${kind}" aria-pressed="${kind === "all"}">${label}<span>${tour.media.filter((m) => kind === "all" || m.kind === kind).length}</span></button>`,
    )
    .join("");
  const controls = `<div class="album-controls"><span id="album-range" role="status" aria-live="polite" aria-atomic="true">${albumRange(first)}</span><nav aria-label="Album pages"><button type="button" id="album-previous" aria-label="Previous album page" aria-controls="album-spread" aria-disabled="true"><span aria-hidden="true">←</span> Previous</button><span id="album-page">01 / ${String(first.pages).padStart(2, "0")}</span><button type="button" id="album-next" aria-label="Next album page" aria-controls="album-spread" aria-disabled="${first.pages <= 1}">Next <span aria-hidden="true">→</span></button></nav></div>`;
  const prints = tour.media
    .map(
      (m, i) =>
        `<figure class="album-print" data-album-id="${esc(m.id)}" data-album-kind="${m.kind}" ${i < ALBUM_SIZE ? `data-album-slot="${i}"` : "hidden"}><button type="button" data-media="${esc(m.id)}" aria-label="${m.kind === "video" ? "Watch" : "View"}: ${esc(m.name)}">${picture(m.image, m.name)}${m.kind === "video" ? '<span class="journal-play" aria-hidden="true">▷</span>' : ""}<span class="album-open" aria-hidden="true">↗</span><span class="album-type">${m.kind === "video" ? "FILM" : "PHOTOGRAPH"}</span></button><figcaption>${esc(m.name)}</figcaption></figure>`,
    )
    .join("");
  return `<div class="journal-toolbar album-toolbar"><div class="album-filters" role="group" aria-label="Journal filter">${filters}</div>${controls}</div><div class="album-spread" id="album-spread" data-count="${first.items.length}" role="group" aria-label="Farm photo album">${prints}</div><p class="album-empty" ${tour.media.length ? "hidden" : ""}>The hosts will add more moments here soon.</p><noscript><style>.album-spread{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:none}.album-spread figure[hidden]{display:block!important}.album-spread .album-print{grid-column:auto!important;grid-row:auto!important;transform:none!important}.album-spread .album-print button{height:220px}.album-print figcaption{display:block!important}.album-controls,.album-filters{display:none!important}</style></noscript>`;
}
export function createAlbum(root, media, { resume, motion = false } = {}) {
  const section = root.querySelector("#gallery");
  if (!section)
    return { state: resume, ids: media.map((m) => m.id), destroy() {} };
  const grid = section.querySelector("#album-spread");
  const prints = [...section.querySelectorAll("[data-album-id]")];
  const filters = [...section.querySelectorAll("[data-album-filter]")];
  const previous = section.querySelector("#album-previous"),
    next = section.querySelector("#album-next");
  let state = albumPage(media, resume?.filter, resume?.page),
    animation;
  const listeners = [];
  const listen = (el, fn) => {
    el.addEventListener("click", fn);
    listeners.push(() => el.removeEventListener("click", fn));
  };
  function paint(animate = false) {
    const slots = new Map(state.items.map((m, i) => [m.id, i]));
    prints.forEach((p) => {
      p.hidden = !slots.has(p.dataset.albumId);
      if (!p.hidden) p.dataset.albumSlot = String(slots.get(p.dataset.albumId));
      else delete p.dataset.albumSlot;
    });
    grid.dataset.count = String(state.items.length);
    filters.forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.albumFilter === state.filter),
      ),
    );
    previous.setAttribute("aria-disabled", String(state.page === 0));
    next.setAttribute("aria-disabled", String(state.page === state.pages - 1));
    section.querySelector("#album-range").textContent = albumRange(state);
    section.querySelector("#album-page").textContent =
      `${String(state.page + 1).padStart(2, "0")} / ${String(state.pages).padStart(2, "0")}`;
    section.querySelector(".album-empty").hidden = state.total > 0;
    animation?.cancel();
    if (animate && motion) {
      animation = grid.animate(
        [
          { opacity: 0.55, transform: "translateY(5px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 220, easing: "cubic-bezier(.23,1,.32,1)" },
      );
    }
  }
  filters.forEach((b) =>
    listen(b, () => {
      state = albumPage(media, b.dataset.albumFilter, 0);
      paint(true);
    }),
  );
  listen(previous, () => {
    if (state.page > 0) {
      state = albumPage(media, state.filter, state.page - 1);
      paint(true);
    }
  });
  listen(next, () => {
    if (state.page < state.pages - 1) {
      state = albumPage(media, state.filter, state.page + 1);
      paint(true);
    }
  });
  paint();
  return {
    reveal(id) {
      let index = state.ids.indexOf(id);
      if (index < 0) {
        index = media.findIndex((m) => m.id === id);
        if (index < 0) return false;
        state = albumPage(media, "all", Math.floor(index / ALBUM_SIZE));
      } else
        state = albumPage(media, state.filter, Math.floor(index / ALBUM_SIZE));
      paint();
      return true;
    },
    get state() {
      return { filter: state.filter, page: state.page };
    },
    get ids() {
      return state.ids;
    },
    destroy() {
      animation?.cancel();
      listeners.forEach((fn) => fn());
    },
  };
}
