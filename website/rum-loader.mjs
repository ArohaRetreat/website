export const APPROVED_RUM_SCRIPT =
  "https://js-cdn.dynatrace.com/jstag/18b1df4492a/bf12470wrz/224aa943b980c761_complete.js";
export function monitoringPageAllowed(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      ["aroharetreat.com", "aroha-retreat.web.app"].includes(u.hostname) &&
      !u.pathname.startsWith("/design/") &&
      !u.searchParams.has("preview")
    );
  } catch {
    return false;
  }
}
export function bootstrapRum(url = APPROVED_RUM_SCRIPT) {
  try {
    if (
      !monitoringPageAllowed(location.href) ||
      localStorage.getItem("aroha-monitoring") !== "allowed"
    )
      return;
    if (url !== APPROVED_RUM_SCRIPT) return;
    const previous = document.querySelector("script[data-aroha-rum]");
    if (previous) return previous;
    const script = document.createElement("script");
    script.dataset.arohaRum = "true";
    script.dataset.rumState = "loading";
    script.src = url;
    script.crossOrigin = "anonymous";
    script.async = true;
    const notify = (state) => {
      script.dataset.rumState = state;
      window.dispatchEvent(new Event("aroha-rum-change"));
    };
    script.onload = () => {
      if (localStorage.getItem("aroha-monitoring") !== "allowed") {
        window.dtrum?.disable?.();
        return;
      }
      window.dtrum?.disableSessionReplay?.();
      notify("loaded");
    };
    script.onerror = () => notify("failed");
    document.head.append(script);
    return script;
  } catch {
    /* Optional collection cannot block the retreat. */
  }
}
