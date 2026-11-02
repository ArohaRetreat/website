import { preference, setPreference } from "./preferences.mjs";
import { initializeMonitoring } from "./monitoring.mjs";
import { initializeAnalytics } from "./analytics.mjs";
import { openPrivacy } from "./guest-dialogs.mjs";
export function createConsentNotice(root, { show }) {
  if (
    preference("aroha-monitoring") !== null ||
    preference("aroha-analytics") !== null
  )
    return { destroy() {} };
  const notice = document.createElement("section");
  notice.className = "consent-garden";
  notice.setAttribute("aria-label", "Optional website monitoring");
  notice.innerHTML =
    '<div><p class="eyebrow">A LITTLE CARE FOR YOUR VISIT</p><h2>Help Aroha grow.</h2><p>Allow optional performance monitoring with Dynatrace and visit analytics with Google Analytics. Your choice does not affect exploring or signing in.</p></div><div class="consent-garden-actions"><button class="button" data-consent-all>Allow both</button><button class="text-link" data-consent-essential>Only essentials</button><button class="text-link" data-consent-choose>Choose settings</button></div>';
  const anchor =
    root.querySelector("#intro") || root.querySelector(".map-introduction");
  if (!anchor) return { destroy() {} };
  anchor.before(notice);
  const removeIfChosen = () => {
    if (
      preference("aroha-monitoring") !== null ||
      preference("aroha-analytics") !== null
    )
      notice.remove();
  };
  const choose = (value) => {
    setPreference("aroha-monitoring", value);
    setPreference("aroha-analytics", value);
    if (value === "allowed") {
      initializeMonitoring();
      initializeAnalytics();
    }
    notice.remove();
  };
  notice.querySelector("[data-consent-all]").onclick = () => choose("allowed");
  notice.querySelector("[data-consent-essential]").onclick = () =>
    choose("denied");
  notice.querySelector("[data-consent-choose]").onclick = () =>
    openPrivacy(show);
  window.addEventListener("aroha-consent-change", removeIfChosen);
  return {
    destroy() {
      notice.remove();
      window.removeEventListener("aroha-consent-change", removeIfChosen);
    },
  };
}
