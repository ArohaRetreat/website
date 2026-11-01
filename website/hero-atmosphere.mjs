import { atmospherePreference, setAtmosphere, watchAtmosphere } from './atmosphere.mjs';
// A guest-controlled change of real photographs. No clock/weather simulation.
export function createHeroAtmosphere(root, { initial = atmospherePreference(), onChange = setAtmosphere, subscribe = watchAtmosphere } = {}) {
  const hero = root.querySelector(".field-hero");
  const day = root.querySelector(".hero-day");
  const night = root.querySelector(".hero-night");
  const image = night?.querySelector("img");
  const buttons = [...root.querySelectorAll("[data-hero-moment]")];
  const status = root.querySelector("#hero-moment-status");
  let selected = initial;
  let generation = 0,
    dead = false;
  function apply(value, chosen = value) {
    hero.classList.toggle("is-dusk", value === "evening");
    day?.setAttribute("aria-hidden", String(value === "evening"));
    night?.setAttribute("aria-hidden", String(value !== "evening"));
    buttons.forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.heroMoment === chosen));
      b.removeAttribute("aria-busy");
    });
  }
  async function chooseValue(value, persist = true) {
    selected = value;
    const token = ++generation;
    if (persist) onChange(value);
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.heroMoment === value)));
    if (status) status.textContent = "";
    if (value === "day") {
      apply(value);
      return;
    }
    if (!image) { apply("day", value); return; }
    buttons.find(b => b.dataset.heroMoment === value)?.setAttribute("aria-busy", "true");
    try {
      if (!image.getAttribute("src")) image.src = image.dataset.src;
      await image.decode();
      if (!dead && token === generation) apply(value);
    } catch {
      if (dead || token !== generation) return;
      image.removeAttribute("src");
      apply("day", value);
      if (status)
        status.textContent =
          "The evening photograph could not load. Sunset colours are still on; please try again for the photograph.";
    }
  }
  const choose = event => chooseValue(event.currentTarget.dataset.heroMoment);
  const unsubscribe = subscribe(value => { if (value !== selected) chooseValue(value, false); });
  buttons.forEach((b) => b.addEventListener("click", choose));
  if (initial === "evening") chooseValue(initial, false);
  return {
    destroy() {
      dead = true;
      generation++;
      unsubscribe();
      buttons.forEach((b) => b.removeEventListener("click", choose));
    },
  };
}
