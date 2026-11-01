// Finite WAAPI effects stay with the native dialog. Reverse the same effects on
// close so a quick second action continues from the frame already on screen.
export function createMenuMotion(
  dialog,
  { enabled = () => true, styles = () => getComputedStyle(dialog) } = {},
) {
  let effects = [],
    generation = 0,
    pendingClose;
  const reset = () => {
    generation++;
    pendingClose = null;
    effects.splice(0).forEach((a) => a.cancel());
    delete dialog.dataset.menuPhase;
  };
  const finish = () => {
    const done = pendingClose;
    reset();
    done?.();
  };
  return {
    enter() {
      reset();
      if (!enabled() || !dialog.animate) return;
      const css = styles();
      const duration =
        Number.parseFloat(css.getPropertyValue("--motion-menu")) || 800;
      const content =
        Number.parseFloat(css.getPropertyValue("--motion-content")) || 520;
      const curve =
        css.getPropertyValue("--ease-drawer").trim() ||
        "cubic-bezier(0.32, 0.72, 0, 1)";
      const out =
        css.getPropertyValue("--ease").trim() ||
        "cubic-bezier(0.23, 1, 0.32, 1)";
      dialog.dataset.menuPhase = "opening";
      effects.push(
        dialog.animate(
          [
            { clipPath: "ellipse(8% 10% at 94% 5%)", opacity: 0.7 },
            { clipPath: "ellipse(75% 75% at 50% 50%)", opacity: 1 },
          ],
          { duration, easing: curve, fill: "both" },
        ),
      );
      const parts = dialog.querySelectorAll(
        ".menu-top, .menu-invitation, .menu-pages > a, .menu-sections, .menu-visit, .menu-bottom",
      );
      parts.forEach((part, i) =>
        effects.push(
          part.animate(
            [
              { opacity: 0, transform: "translateY(18px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            {
              duration: content,
              delay: 80 + i * 40,
              easing: out,
              fill: "both",
            },
          ),
        ),
      );
      const current = generation;
      Promise.allSettled(effects.map((a) => a.finished)).then(() => {
        if (current === generation && !pendingClose)
          dialog.dataset.menuPhase = "open";
      });
    },
    exit(done, immediate = false) {
      if (pendingClose) return;
      if (immediate || !enabled() || !effects.length) {
        reset();
        done();
        return;
      }
      pendingClose = done;
      dialog.dataset.menuPhase = "closing";
      const current = ++generation;
      effects.forEach((a) => {
        // Reverse finished effects as well as an interrupted entrance. No reset
        // to a keyframe, timeout, or forced navigation delay is involved.
        a.updatePlaybackRate(-2);
        a.play();
      });
      Promise.allSettled(effects.map((a) => a.finished)).then(() => {
        if (current === generation) finish();
      });
    },
    finish,
    reset,
    destroy: reset,
  };
}
