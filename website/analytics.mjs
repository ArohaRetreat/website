import { preference } from "./preferences.mjs";
let pending, adapter;
export function analyticsPageAllowed(url) {
  try {const u=new URL(url);return u.origin === "https://aroharetreat.com" && ["/","/map/"].includes(u.pathname) && !u.searchParams.has("preview");} catch {return false;}
}
export async function initializeAnalytics({
  load = () => import("./firebase-analytics.mjs"),
  enabled = typeof location !== "undefined" && analyticsPageAllowed(location.href),
} = {}) {
  if (!enabled || preference("aroha-analytics") !== "allowed") return;
  if (pending) return pending;
  pending = (async () => {
    try {
      const next = adapter || (await load());
      if (preference("aroha-analytics") !== "allowed") return;
      adapter = next;
      await adapter.enable(() => preference("aroha-analytics") === "allowed");
    } catch {
      /* Optional analytics cannot block a visit. */
    } finally {
      pending = null;
    }
  })();
  return pending;
}
export function withdrawAnalytics() {
  adapter?.disable();
  // Disable immediately even while an already-loaded tag finishes a request.
  window["ga-disable-G-D4WTRKW4N9"] = true;
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.trim().split("=")[0];
    if (!/^_ga(?:_|$)/.test(name)) continue;
    for (const domain of ["", location.hostname, "." + location.hostname])
      document.cookie = `${name}=; Max-Age=0; path=/;${domain ? ` domain=${domain};` : ""} SameSite=Lax`;
  }
}
