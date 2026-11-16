const archive = document.querySelector("#release-archive");
const toolbar = document.querySelector("#release-filters");
const buttons = Array.from(toolbar.querySelectorAll("button"));
const lists = Array.from(archive.querySelectorAll("[data-channel]"));
const count = document.querySelector("#release-count");
const versions = document.querySelector("#version-index");

function applyFilter(filter) {
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.value === filter));
  }

  let visible = 0;
  for (const list of lists) {
    list.hidden = filter !== "all" && list.dataset.channel !== filter;
    if (!list.hidden) visible += list.querySelectorAll(".release-card").length;
  }

  count.textContent = visible === 1 ? "1 release" : `${visible} releases`;
}

function showLinkedRelease(hash) {
  const release = document.getElementById(hash.slice(1));
  const list = release?.closest("[data-channel]");
  if (!list?.hidden) return;

  applyFilter("all");
  return release;
}

if (matchMedia("(max-width: 840px)").matches) {
  versions.open = false;
}

for (const button of buttons) {
  button.addEventListener("click", () => applyFilter(button.value));
}

document.addEventListener("click", event => {
  const link = event.target.closest('a[href^="#"]');
  if (link) showLinkedRelease(link.hash);
});
window.addEventListener("hashchange", () => showLinkedRelease(location.hash)?.scrollIntoView());
applyFilter("all");
toolbar.hidden = false;
