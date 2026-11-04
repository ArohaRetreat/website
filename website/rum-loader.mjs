import { environment } from "./environment.mjs";
let metadataTag;
export function monitoringPageAllowed(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (environment.preprod
        ? [
            "aroha-retreat-preprod.web.app",
            "aroha-retreat-preprod.firebaseapp.com",
          ]
        : ["aroharetreat.com", "aroha-retreat.web.app"]
      ).includes(u.hostname) &&
      !u.pathname.startsWith("/design/") &&
      !u.searchParams.has("preview")
    );
  } catch {
    return false;
  }
}
export function bootstrapRum(url = metadataTag) {
  try {
    if (
      !monitoringPageAllowed(location.href) ||
      localStorage.getItem("aroha-monitoring") !== "allowed"
    )
      return;
    if (typeof url !== "string") return;
    if (url !== metadataTag) return;
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

let metadataRequest;
export async function bootstrapRuntimeRum() {
  if (!monitoringPageAllowed(location.href)) return;
  if (metadataTag) return bootstrapRum(metadataTag);
  if (!metadataRequest)
    metadataRequest = (async () => {
      try {
        const r = await fetch("/api/v1/runtime-config", {
          credentials: "omit",
          signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) return;
        const c = await r.json();
        if (
          c.environment !== environment.name ||
          typeof c.rumScriptUrl !== "string" ||
          !/^https:\/\/js-cdn\.dynatrace\.com\/jstag\/[a-zA-Z0-9]+\/[a-zA-Z0-9]+\/[a-zA-Z0-9_]+\.js$/.test(
            c.rumScriptUrl,
          )
        )
          return;
        metadataTag = c.rumScriptUrl;
        return bootstrapRum(metadataTag);
      } catch {
        /* Missing metadata disables collection; never use the other environment's tag. */
      }
    })();
  return metadataRequest;
}
