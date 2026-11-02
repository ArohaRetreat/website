// Native details semantics remain available without JS. Keep the answer visible
// until the closing motion finishes; rapid reversals start at the rendered height.
export function createFaqMotion(root, { enabled = true } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const items = [...root.querySelectorAll(".field-faqs details")].map(detail => {
    const summary = detail.querySelector("summary");
    let animation, target = detail.open;
    function settle() {
      animation?.cancel();
      animation = undefined;
      detail.open = target;
      detail.style.height = "";
      detail.style.overflow = "";
      summary.setAttribute("aria-expanded", String(target));
    }
    function click(event) {
      event.preventDefault();
      const from = detail.getBoundingClientRect().height;
      target = !target;
      // Freeze before cancelling the prior effect to avoid a reversal jump.
      detail.style.height = `${from}px`;
      animation?.cancel();
      animation = undefined;
      summary.setAttribute("aria-expanded", String(target));
      if (!enabled || reduced.matches || !detail.animate) { settle(); return; }
      detail.open = true;
      detail.style.height = "auto";
      const expanded = detail.getBoundingClientRect().height;
      detail.open = false;
      const collapsed = detail.getBoundingClientRect().height;
      detail.open = true;
      const to = target ? expanded : collapsed;
      detail.style.height = `${from}px`;
      detail.style.overflow = "hidden";
      animation = detail.animate([{height:`${from}px`},{height:`${to}px`}], {
        duration: 420, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards",
      });
      animation.onfinish = settle;
    }
    summary.setAttribute("aria-expanded", String(target));
    summary.addEventListener("click", click);
    return { settle, destroy() { settle(); summary.removeEventListener("click", click); summary.removeAttribute("aria-expanded"); } };
  });
  const settleAll = () => items.forEach(x=>x.settle());
  reduced.addEventListener("change", settleAll);
  window.addEventListener("resize", settleAll);
  return { destroy() { items.forEach(x=>x.destroy()); reduced.removeEventListener("change", settleAll); window.removeEventListener("resize", settleAll); } };
}
