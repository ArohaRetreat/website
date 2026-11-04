import {environment} from "./environment.mjs";
import { bootstrapRuntimeRum, monitoringPageAllowed } from "./rum-loader.mjs";
import { createRumIdentity } from "./rum-identity.mjs";
import { preference, setPreference } from "./preferences.mjs";
const names = new Set([
  "journey.started",
  "hrudhi.introduction.opened",
  "hrudhi.gate.started",
  "hrudhi.gate.completed",
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
  if (
    name.startsWith("map.") &&
    (![
      "map",
      "arrival",
      "parking",
      "pond",
      "house",
      "kitchen",
      "library",
      "treehouses",
      "cottages",
      "meditation",
      "pool",
      "farm",
    ].includes(attributes.section) ||
      ![
        "reading",
        "immersive",
        "overview",
        "selected",
        "media-failed",
        "art-failed",
      ].includes(attributes.outcome))
  )
    return;
  const safe = {
    schemaVersion: 1,
    "event.authority": "client-observed",
    "event.provider": "aroha.website",
    "deployment.environment.name":environment.name,
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
    if (typeof window.dynatrace?.sendBizEvent === "function")
      window.dynatrace.sendBizEvent(name, safe);
    else
      window.dynatrace?.sendEvent?.({
        "event_properties.action": name,
        "event_properties.authority": "client-observed",
        "event_properties.environment":environment.name,
        ...(safe.section ? { "event_properties.section": safe.section } : {}),
        ...(safe.outcome ? { "event_properties.outcome": safe.outcome } : {}),
      });
  } catch {
    /* Monitoring must never interrupt the guest. */
  }
}
const identity = createRumIdentity({
  consented: () =>
    preference("aroha-monitoring") === "allowed" &&
    monitoringPageAllowed(location.href),
});
if (
  typeof window !== "undefined" &&
  typeof window.addEventListener === "function"
) {
  window.addEventListener("aroha-rum-change", () => identity.sync());
  window.addEventListener("pageshow", () => identity.sync());
  window.addEventListener("pagehide", () => identity.suspend());
}
export const setMonitoringUser = (user) => identity.setUser(user);
export async function initializeMonitoring() {
  bootstrapRuntimeRum();
  identity.sync();
}
export function withdrawMonitoring() {
  identity.withdraw();
  try {
    window.dtrum?.disable?.();
  } catch {}
}
export function monitoringStatus() {
  if (preference("aroha-monitoring") !== "allowed")
    return "Off — performance monitoring has not been allowed.";
  if (!monitoringPageAllowed(location.href))
    return "Monitoring is limited to the live website.";
  const state = document.querySelector("script[data-aroha-rum]")?.dataset
    .rumState;
  return state === "loaded"
    ? "Dynatrace script loaded. Browser or network settings may still block collection."
    : state === "failed"
      ? "The Dynatrace script could not load. Check browser blocking or network access."
      : "Loading the Dynatrace monitoring script…";
}
export function reportError(code) {
  try {
    window.dtrum?.reportCustomError?.(code, "Aroha website operation failed");
  } catch {}
}
