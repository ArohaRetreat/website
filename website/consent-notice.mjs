import { preference, setPreference } from "./preferences.mjs";
import { initializeMonitoring } from "./monitoring.mjs";
import { initializeAnalytics } from "./analytics.mjs";
import { openPrivacy } from "./guest-dialogs.mjs";
let dismissed = false;
export function createConsentNotice(root, { show }) {
  const chosen = () => preference("aroha-monitoring") !== null || preference("aroha-analytics") !== null;
  let remembered = false;
  try { remembered = sessionStorage.getItem("aroha-consent-dismissed") === "1"; } catch {}
  if (chosen() || dismissed || remembered) return { destroy() {} };
  const notice = document.createElement("section");
  notice.className = "consent-garden";
  notice.setAttribute("popover", "manual");
  notice.setAttribute("role", "region");
  notice.setAttribute("aria-label", "Optional website monitoring");
  notice.innerHTML = '<button class="consent-dismiss" aria-label="Dismiss monitoring notice">×</button><div><p class="eyebrow">A LITTLE CARE FOR YOUR VISIT</p><h2>Help Aroha grow.</h2><p>Allow optional performance monitoring with Dynatrace and visit analytics with Google Analytics. Your choice does not affect exploring or signing in.</p></div><div class="consent-garden-actions"><button class="button" data-consent-all>Allow both</button><button class="text-link" data-consent-essential>Only essentials</button><button class="text-link" data-consent-choose>Choose settings</button></div>';
  root.append(notice);
  let opened = false, disposed = false;
  const observer = new MutationObserver(openWhenReady);
  function openWhenReady() {
    if (disposed || opened || chosen()) return;
    if (document.querySelector("#aroha-welcome:not(.is-finished)") || root.inert || root.querySelector("dialog[open], .public-menu.is-open")) return;
    opened = true;
    observer.disconnect();
    if (notice.showPopover) notice.showPopover(); else notice.classList.add("consent-visible");
  }
  function hide() {
    opened = true;
    observer.disconnect();
    notice.hidePopover?.();
    notice.classList.remove("consent-visible");
  }
  function dismiss() {
    dismissed = true;
    try { sessionStorage.setItem("aroha-consent-dismissed", "1"); } catch {}
    hide();
  }
  const removeIfChosen = () => { if (chosen()) hide(); };
  const choose = value => {
    setPreference("aroha-monitoring", value);
    setPreference("aroha-analytics", value);
    if (value === "allowed") { initializeMonitoring(); initializeAnalytics(); }
    hide();
  };
  notice.querySelector(".consent-dismiss").onclick = dismiss;
  notice.querySelector("[data-consent-all]").onclick = () => choose("allowed");
  notice.querySelector("[data-consent-essential]").onclick = () => choose("denied");
  notice.querySelector("[data-consent-choose]").onclick = () => { dismiss(); openPrivacy(show); };
  const key = e => { if (e.key === "Escape" && notice.matches(":popover-open, .consent-visible")) dismiss(); };
  observer.observe(document.documentElement, { attributes:true, attributeFilter:["class"] });
  root.addEventListener("toggle", openWhenReady, true);
  window.addEventListener("keydown", key);
  window.addEventListener("aroha-consent-change", removeIfChosen);
  openWhenReady();
  return { destroy() {
    disposed = true;
    observer.disconnect();
    notice.remove();
    root.removeEventListener("toggle", openWhenReady, true);
    window.removeEventListener("keydown", key);
    window.removeEventListener("aroha-consent-change", removeIfChosen);
  } };
}
