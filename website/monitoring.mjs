import { preference, setPreference } from "./preferences.mjs";
const names = new Set([
  "journey.started",
  "journey.stop",
  "cottage.opened",
  "gallery.opened",
  "enquiry.prepared",
  "admin.saved",
  "admin.published",
  "admin.access-changed",
  "map.opened",
  "map.place-opened",
  "map.mode-changed",
  "map.fallback",
]);
export function track(name, attributes = {}) {
  if (!names.has(name) || preference("aroha-monitoring") !== "allowed") return;
  if (name.startsWith("map.") &&
      (!['map','arrival','parking','pond','house','kitchen','library','treehouses','cottages','meditation','pool','farm'].includes(attributes.section) ||
       !['reading','immersive','overview','selected','media-failed','art-failed'].includes(attributes.outcome))) return;
  const safe = {
    schemaVersion: 1,
    "event.authority": "client-observed",
    "event.provider": "aroha.website",
    ...Object.fromEntries(
      Object.entries(attributes).filter(
        ([k, v]) =>
          ["section", "outcome"].includes(k) &&
          typeof v === "string" &&
          v.length < 50,
      ),
    ),
  };
  try {
    window.dynatrace?.sendBizEvent?.(name, safe);
  } catch {
    /* Monitoring must never interrupt the guest. */
  }
}
let loading = false;
export async function initializeMonitoring() {
  if (preference("aroha-monitoring") !== "allowed" || loading ||
      document.querySelector("script[data-aroha-rum]")) return;
  loading = true;
  try {
    const config = await fetch("/runtime-config.json").then((r) => r.json());
    if (!config.rumScriptUrl) return;
    const url = new URL(config.rumScriptUrl);
    if (
      url.protocol !== "https:" ||
      !["js-cdn.dynatrace.com"].includes(url.hostname)
    )
      return;
    // Consent may have changed while configuration was being fetched.
    if (preference("aroha-monitoring") !== "allowed") return;
    const script = document.createElement("script");
    script.dataset.arohaRum = "true";
    script.src = url.href;
    script.crossOrigin = "anonymous";
    document.head.append(script);
  } catch {
    /* Optional monitoring must not interrupt the site. */
  } finally {
    loading = false;
  }
}
export function reportError(code) {
  try {
    window.dtrum?.reportCustomError?.(code, "Aroha website operation failed");
  } catch {}
}
