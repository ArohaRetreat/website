import { spatialStories, renderSpatialFacts } from "./spatial-content.mjs";
import { esc } from "./render.mjs";
import * as T from "three";
import { createFarmWorld } from "./farm-world.mjs";
import { FARM_STOPS, clamp, sampleRoute } from "./farm-route.mjs";

export async function createSpatial(
  root,
  content,
  { cottage, enquiry, experience, guide, track, error, resumeAt = 0 },
) {
  const section = root.querySelector("#farm-journey"),
    canvas = root.querySelector("#farm-canvas");
  if (
    !section ||
    !content.sections.some((s) => s.id === "journey" && s.visible)
  )
    return null;
  let renderer,
    world,
    disposed = false,
    ready = false,
    active = true,
    visible = true,
    last = 0,
    elapsed = 0,
    target = 0,
    current = 0,
    stop = -1,
    light = 0,
    yaw = 0,
    pitch = 0,
    drag,
    frames = 0,
    frameTime = 0,
    reducedQuality = false,
    viewportWidth=0;
  const story = root.querySelector(".spatial-story"),
    title = root.querySelector("#spatial-title"),
    desc = root.querySelector("#spatial-description"),
    kicker = root.querySelector("#spatial-kicker"),
    action = root.querySelector("#spatial-action"),
    status = root.querySelector(".spatial-feedback"),
    hotspot = root.querySelector("#spatial-hotspot"),
    hotspotName = root.querySelector("#spatial-hotspot-name"),
    next = root.querySelector("#spatial-next"),
    nextLabel = root.querySelector("#spatial-next-label"),
    clock = root.querySelector("#farm-light"),
    progress = root.querySelector(".spatial-progress span"),
    compass = root.querySelector(".spatial-compass svg"),
    nav = [...root.querySelectorAll("[data-destination]")],
    stage = root.querySelector(".spatial-stage");
  const camera = new T.PerspectiveCamera(48, 1, 0.12, 230),
    sample = { position: new T.Vector3(), look: new T.Vector3() },
    look = new T.Vector3(),
    project = new T.Vector3();
  const heading = (target, text) => {
    target.replaceChildren(
      ...String(text)
        .split("\n")
        .flatMap((s, i) => {
          const span = document.createElement("span");
          span.textContent = s;
          return i ? [document.createElement("br"), span] : [span];
        }),
    );
  };
  const stories = spatialStories(content);
  const facts = root.querySelector("#spatial-facts"),
    more = root.querySelector("#spatial-more");
  function measure() {
    if (disposed) return;
    const r = section.getBoundingClientRect();
    visible = r.bottom > 0 && r.top < innerHeight;
    target = clamp(-r.top / Math.max(1, section.offsetHeight - innerHeight));
    root.classList.toggle("spatial-inland", r.bottom < 95);
    resume();
  }
  function resize() {
    if (!renderer || disposed) return;
    const w = stage.clientWidth,
      h = stage.clientHeight;
    const keepPosition=ready&&visible&&Math.abs(w-viewportWidth)>2;
    viewportWidth=w;
    camera.aspect = w / Math.max(1, h);
    camera.fov = w < 600 ? 61 : 48;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if(keepPosition)window.scrollTo({top:scrollY+section.getBoundingClientRect().top+(section.offsetHeight-innerHeight)*current,behavior:"instant"});
    measure();
  }
  function goto(i) {
    const s = FARM_STOPS[Math.max(0, Math.min(FARM_STOPS.length - 1, i))];
    window.scrollTo({
      top:
        scrollY +
        section.getBoundingClientRect().top +
        (section.offsetHeight - innerHeight) * s.at,
      behavior: "smooth",
    });
  }
  const hotspotAction = () =>
    stop === 2 && content.cottages[0] ? cottage(content.cottages[0].id) : guide(stop);
  function openDetail() {
    if (stop === 0 || stop === 1) goto(stop + 1);
    else guide(stop);
  }
  const showMore = () => guide([0, 1, 5, 5, 5, 0][Math.max(0, stop)]);
  const factAction = (e) => {
    const b = e.target.closest("button");
    if (b?.dataset.spatialCottage) cottage(b.dataset.spatialCottage);
    else if (b?.dataset.spatialExperience)
      experience(b.dataset.spatialExperience);
  };
  function updateStory(i) {
    if (stop === i) return;
    stop = i;
    const s = stories[i];
    heading(title, s.t);
    desc.textContent = s.d;
    kicker.textContent = s.k;
    action.firstChild.textContent = s.a + " ";
    facts.innerHTML = renderSpatialFacts(s.facts, esc);
    more.firstChild.textContent = s.more + " ";
    nextLabel.textContent =
      i === 5
        ? "Continue to real Aroha"
        : i === 0
          ? "Scroll to enter"
          : "Scroll to wander";
    nav.forEach((b, n) => {
      if (n === i) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    story.animate(
      [
        { opacity: 0, transform: "translateY(10px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 240, easing: "cubic-bezier(0.23,1,0.32,1)" },
    );
    const dock = nav[i].parentElement;
    dock.scrollTo({
      left: Math.max(
        0,
        nav[i].offsetLeft - dock.clientWidth / 2 + nav[i].clientWidth / 2,
      ),
      behavior: "smooth",
    });
    status.textContent = FARM_STOPS[i].name;
    track("journey.stop", { section: FARM_STOPS[i].id });
  }
  function frame(ms) {
    if (disposed) return;
    if (last && ms - last < 250 && !reducedQuality) {
      frames++;
      frameTime += ms - last;
      if (frames === 120 && frameTime / frames > 30) {
        reducedQuality = true;
        renderer.setPixelRatio(1);
        resize();
      }
    }
    const dt = Math.min(0.05, (ms - last) / 1000 || 0.016);
    last = ms;
    const modal = !!document.querySelector("dialog[open]");
    if (!active || !visible || document.hidden || modal) {
      renderer.setAnimationLoop(null);
      last = 0;
      return;
    }
    elapsed += dt;
    current += (target - current) * (1 - Math.exp(-dt * 8));
    if (Math.abs(target - current) < 0.00005) current = target;
    sampleRoute(current, sample);
    camera.position.copy(sample.position);
    look.copy(sample.look);
    look.x += yaw * 4;
    look.y += pitch * 2;
    camera.lookAt(look);
    camera.updateMatrixWorld();
    world.update(elapsed, sample.gate, camera.quaternion);
    if (current < 0.18) renderer.shadowMap.needsUpdate = true;
    updateStory(sample.stop);
    progress.style.transform = `scaleX(${current})`;
    compass.style.transform = `rotate(${(Math.atan2(look.x - camera.position.x, look.z - camera.position.z) * -180) / Math.PI}deg)`;
    const source =
      stop === 2
        ? world.landmarks.cottage
        : stop === 3
          ? world.landmarks.meditation
          : stop === 4
            ? world.landmarks.farm
            : null;
    if (source) {
      project.copy(source).project(camera);
      const onscreen =
        project.z > -1 &&
        project.z < 1 &&
        Math.abs(project.x) < 0.84 &&
        Math.abs(project.y) < 0.75;
      hotspot.hidden = !onscreen;
      if (onscreen) {
        hotspot.style.transform = `translate3d(${Math.max(12, Math.min((project.x * 0.5 + 0.5) * stage.clientWidth, stage.clientWidth - 210))}px,${(-project.y * 0.5 + 0.5) * stage.clientHeight}px,0)`;
        hotspotName.textContent =
          stop === 2
            ? "Open the cottage"
            : stop === 3
              ? "Find stillness"
              : "Meet the farm";
      }
    } else hotspot.hidden = true;
    renderer.render(world.scene, camera);
  }
  function resume() {
    if (renderer && active && visible && !document.hidden && !disposed)
      renderer.setAnimationLoop(frame);
  }
  function lightChange() {
    light = Number(clock.value) / 100;
    world.setLight(light);
    clock.setAttribute(
      "aria-valuetext",
      light < 0.25 ? "Morning" : light > 0.75 ? "Evening" : "Afternoon",
    );
    renderer.shadowMap.needsUpdate = true;
    resume();
  }
  function lost(e) {
    e.preventDefault();
    error("SPATIAL_CONTEXT_LOST");
    fallback();
  }
  function fallback() {
    if (disposed) return;
    section.hidden = true;
    if (root.querySelector("#farm-canvas") === canvas) {
      root.classList.remove("spatial-ready");
      root.querySelector(".brand").href = "#home";
      const link = root.querySelector('nav a[href="#farm-journey"]');
      if (link) link.href = "#journey";
    }
    dispose();
  }
  function down(e) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, yaw, pitch };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-dragging");
  }
  function move(e) {
    if (!drag) return;
    yaw = clamp(drag.yaw + (e.clientX - drag.x) / stage.clientWidth, -1, 1);
    pitch = clamp(
      drag.pitch - (e.clientY - drag.y) / stage.clientHeight,
      -0.5,
      0.5,
    );
    resume();
  }
  function up() {
    drag = null;
    canvas.classList.remove("is-dragging");
  }
  const visibility = () => {
    if (document.hidden) {
      renderer.setAnimationLoop(null);
      last = 0;
    } else {
      measure();
      resume();
    }
  };
  const modalObserver = new MutationObserver(() => {
    if (!document.querySelector("dialog[open]")) resume();
  });
  const navFns = nav.map((b, i) => {
    const fn = () => goto(i);
    b.addEventListener("click", fn);
    return fn;
  });
  const nextFn = () =>
    stop === 5
      ? document
          .getElementById("cottages")
          ?.scrollIntoView({ behavior: "smooth" })
      : goto(stop + 1);
  let observer;
  function dispose() {
    if (disposed) return;
    disposed = true;
    active = false;
    renderer?.setAnimationLoop(null);
    observer?.disconnect();
    modalObserver.disconnect();
    window.removeEventListener("scroll", measure);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", visibility);
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", up);
    clock.removeEventListener("input", lightChange);
    action.removeEventListener("click", openDetail);
    hotspot.removeEventListener("click", hotspotAction);
    more.removeEventListener("click", showMore);
    facts.removeEventListener("click", factAction);
    next.removeEventListener("click", nextFn);
    nav.forEach((b, i) => b.removeEventListener("click", navFns[i]));
    world?.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
  try {
    renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "default",
      failIfMajorPerformanceCaveat: true,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    world = createFarmWorld();
    const previous = [...root.querySelectorAll("main > section")].find((el) => {
      const r = el.getBoundingClientRect();
      return r.top <= 120 && r.bottom > 120 && !el.hidden;
    });
    const previousOffset = previous?.getBoundingClientRect().top || 0;
    section.hidden = false;
    root.classList.add("spatial-ready");
    resize();
    if (previous?.id === "journey")
      window.scrollTo({
        top:
          scrollY +
          section.getBoundingClientRect().top +
          (section.offsetHeight - innerHeight) * resumeAt,
        behavior: "instant",
      });
    else if (
      previous &&
      !["home", "intro", "farm-journey"].includes(previous.id)
    )
      window.scrollTo({
        top: scrollY + previous.getBoundingClientRect().top - previousOffset,
        behavior: "instant",
      });
    measure();
    sampleRoute(target, sample);
    current = target;
    camera.position.copy(sample.position);
    camera.lookAt(sample.look);
    // Compile once while fallback remains available; no artificial loading gate.
    await renderer.compileAsync(world.scene, camera);
    if (
      !canvas.isConnected ||
      root.querySelector("#farm-canvas") !== canvas ||
      disposed
    ) {
      dispose();
      return null;
    }
    ready = true;
    root.querySelector(".brand").href = "#farm-journey";
    const farmNav = root.querySelector('nav a[href="#journey"]');
    if (farmNav) farmNav.href = "#farm-journey";
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibility);
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    clock.addEventListener("input", lightChange);
    action.addEventListener("click", openDetail);
    hotspot.addEventListener("click", hotspotAction);
    more.addEventListener("click", showMore);
    facts.addEventListener("click", factAction);
    next.addEventListener("click", nextFn);
    observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting;
        if (visible) resume();
        else renderer.setAnimationLoop(null);
      },
      { threshold: 0 },
    );
    observer.observe(section);
    modalObserver.observe(root.querySelector("dialog"), {
      attributes: true,
      attributeFilter: ["open"],
    });
    const loader = new T.TextureLoader();
    loader.load(
      "/assets/retreat/palm-crown-v1.webp",
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        world.crownTexture(texture);
        world.setLight(light);
        resume();
      },
      undefined,
      () => {},
    );
    loader.load(
      "/assets/retreat/ground-moss-v1.webp",
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        world.groundTexture(texture);
        resume();
      },
      undefined,
      () => {},
    );
    loader.load(
      "/assets/brand/logo-white.svg",
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = T.SRGBColorSpace;
        const sign = new T.Mesh(
          new T.PlaneGeometry(2.7, 0.8),
          new T.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
          }),
        );
        sign.position.set(0, 4.13, 18.26);
        world.world.add(sign);
        resume();
      },
      undefined,
      () => {},
    );
    measure();
    resume();
    return {
      destroy: dispose,
      get progress() {
        return current;
      },
    };
  } catch (e) {
    error("SPATIAL_UNAVAILABLE");
    fallback();
    return null;
  }
}
