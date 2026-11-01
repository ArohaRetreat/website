import { createScenePlayer } from "../vendor/natura/runtime/nature-scenes.js";

// A single continuous arrival: germination → growing leaf aperture → live hero.
export function unfurlWelcome(welcome) {
  const veil = welcome.querySelector(".welcome-veil");
  const aperture = welcome.querySelector(".welcome-aperture");
  const anchor = welcome.querySelector(".welcome-aperture-anchor");
  const plant = welcome.querySelector(".welcome-botany");
  const leaf = welcome.querySelector(".seed-leaf-left");
  const r = leaf.getBoundingClientRect();
  const w = innerWidth,
    h = innerHeight;
  const x = r.left + r.width * 0.7,
    y = r.top + r.height * 0.7;
  veil.setAttribute("viewBox", `0 0 ${w} ${h}`);
  anchor.setAttribute("transform", `translate(${x} ${y})`);
  const scale = Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) / 90 + 1;
  const options = {
    duration: 2200,
    easing: "cubic-bezier(.65,0,.35,1)",
    fill: "forwards",
  };
  const animations = [
    aperture.animate(
      [
        { transform: "rotate(-28deg) scale(.015)" },
        { transform: `rotate(-12deg) scale(${scale})` },
      ],
      options,
    ),
    plant.animate(
      [
        { transform: "scale(1)", opacity: 1 },
        { transform: "scale(2.4)", opacity: 1, offset: 0.36 },
        { transform: "scale(9)", opacity: 0.55, offset: 0.75 },
        { transform: "scale(14)", opacity: 0 },
      ],
      options,
    ),
    ...[...welcome.querySelectorAll(".welcome-copy")].map((el) =>
      el.animate(
        [
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 0, transform: "translateY(15px)" },
        ],
        {
          duration: 500,
          easing: "cubic-bezier(.23,1,.32,1)",
          fill: "forwards",
        },
      ),
    ),
  ];
  return {
    finished: Promise.all(animations.map((a) => a.finished)),
    cancel() {
      animations.forEach((a) => a.cancel());
    },
  };
}

export function startWelcome(
  root,
  n,
  {
    enabled = true,
    scenePlayer = createScenePlayer,
    reveal = unfurlWelcome,
  } = {},
) {
  const welcome = document.getElementById("aroha-welcome");
  if (!welcome) return () => {};
  const html = document.documentElement;
  let player,
    opening,
    phase = "growing",
    growthDeadline,
    deadline;
  const skip = welcome.querySelector("#welcome-skip");
  function finish() {
    if (phase === "done") return;
    phase = "done";
    clearTimeout(growthDeadline);
    clearTimeout(deadline);
    document.removeEventListener("visibilitychange", visibility);
    opening?.cancel();
    player?.dispose();
    root.inert = false;
    html.classList.remove("arrival-opening");
    html.classList.add("welcome-complete");
    if (document.activeElement === skip)
      root.querySelector("#start-journey")?.focus({ preventScroll: true });
    welcome.classList.add("is-finished");
    welcome.setAttribute("aria-hidden", "true");
    welcome.inert = true;
    setTimeout(() => welcome.remove(), 200);
  }
  function visibility() {
    if (document.hidden) finish();
  }
  function open() {
    if (phase !== "growing") return;
    phase = "opening";
    clearTimeout(growthDeadline);
    try {
      // Hold the fully grown sprout. Disposing here would visibly reset its leaves.
      player?.seek?.(1);
      html.classList.add("arrival-opening");
      opening = reveal(welcome);
      opening.finished.then(finish, finish);
    } catch {
      finish();
    }
  }
  if (
    !enabled ||
    document.hidden ||
    !n.welcome ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    welcome.remove();
    html.classList.add("welcome-complete");
    return () => {};
  }
  root.inert = true;
  skip.onclick = finish;
  document.addEventListener("visibilitychange", visibility);
  growthDeadline = setTimeout(open, 3200);
  deadline = setTimeout(finish, 6100);
  try {
    player = scenePlayer(welcome, "seed", ({ state }) => {
      if (state === "complete") open();
    });
    player.play({ speed: 1.9 });
  } catch {
    finish();
  }
  return finish;
}
