// A guest-controlled change of real photographs. No clock/weather simulation.
export function createHeroAtmosphere(root) {
  const hero = root.querySelector(".field-hero");
  const day = root.querySelector(".hero-day");
  const night = root.querySelector(".hero-night");
  const image = night?.querySelector("img");
  const buttons = [...root.querySelectorAll("[data-hero-moment]")];
  const status = root.querySelector("#hero-moment-status");
  let generation = 0,
    dead = false;
  function apply(value) {
    hero.classList.toggle("is-dusk", value === "evening");
    day?.setAttribute("aria-hidden", String(value === "evening"));
    night?.setAttribute("aria-hidden", String(value !== "evening"));
    buttons.forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.heroMoment === value));
      b.removeAttribute("aria-busy");
    });
  }
  async function choose(event) {
    const value = event.currentTarget.dataset.heroMoment;
    const token = ++generation;
    if (status) status.textContent = "";
    if (value === "day") {
      apply(value);
      return;
    }
    event.currentTarget.setAttribute("aria-busy", "true");
    try {
      if (!image.getAttribute("src")) image.src = image.dataset.src;
      await image.decode();
      if (!dead && token === generation) apply(value);
    } catch {
      if (dead || token !== generation) return;
      image.removeAttribute("src");
      apply("day");
      if (status)
        status.textContent =
          "The evening photograph could not load. Please try again.";
    }
  }
  buttons.forEach((b) => b.addEventListener("click", choose));
  return {
    destroy() {
      dead = true;
      generation++;
      buttons.forEach((b) => b.removeEventListener("click", choose));
    },
  };
}
