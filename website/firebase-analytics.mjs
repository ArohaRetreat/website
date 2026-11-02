import { app, isEmulator } from "./firebase-app.mjs";
import {
  initializeAnalytics,
  isSupported,
  setAnalyticsCollectionEnabled,
  logEvent,
} from "firebase/analytics";
let analytics;
export async function enable(consented) {
  if (isEmulator || !(await isSupported()) || !consented()) return;
  window["ga-disable-G-D4WTRKW4N9"] = false;
  if (!analytics) {
    const page = location.origin + location.pathname;
    let referrer = "";
    try {
      const u = new URL(document.referrer);
      referrer = u.origin + u.pathname;
    } catch {}
    analytics = initializeAnalytics(app, {
      config: {
        send_page_view: false,
        page_location: page,
        page_referrer: referrer,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      },
    });
    if (consented())
      logEvent(analytics, "page_view", {
        page_location: page,
        page_title: document.title,
      });
  }
  setAnalyticsCollectionEnabled(analytics, consented());
}
export function disable() {
  window["ga-disable-G-D4WTRKW4N9"] = true;
  if (analytics) setAnalyticsCollectionEnabled(analytics, false);
}
