import {installMaterialControls, confirmMaterial} from './material-controls.mjs';
installMaterialControls();
import { bookingApi } from "./booking-api.mjs";
import { journeyStep } from "./booking-journey.mjs";
import { auth, observeAuth } from "./firebase-auth.mjs";
import {
  atmospherePreference,
  setAtmosphere,
  watchAtmosphere,
} from "./atmosphere.mjs";
import { startConcierge } from "./booking-concierge.mjs";
try {
  const portal = await startConcierge({
    api: bookingApi,
    onEnquire: async show => {
      const [{openEnquiry},{readPublishedSite}] = await Promise.all([import('./guest-dialogs.mjs'),import('./firebase-public.mjs')]);
      const content=await readPublishedSite();
      await openEnquiry(content,show);
    },
    journeyStep,
    getAtmosphere: atmospherePreference,
    setAtmosphere,
    watchAtmosphere,
    getIdentity: () => auth.currentUser?.uid,
    expectedEnvironment: __AROHA_ENVIRONMENT__,
  });
  observeAuth((user) => void portal.identity(user));
} catch (error) {
  console.warn(JSON.stringify({service:"aroha-booking-ui",code:["WRONG_ENVIRONMENT","PREPROD_TESTER_REQUIRED"].includes(error?.code)?error.code:"BOOKING_STARTUP_FAILED"}));
  journeyStep("plan", "failed");
  document.querySelector("#app").innerHTML =
    '<main id="main" class="wrap" tabindex="-1"><h1>We couldn’t open booking just now.</h1><p class="lead">Please reload this page or return to the retreat website. Your existing bookings are unchanged.</p><div class="inline-actions"><button class="primary" id="reload-booking">Try again</button><a href="/">Explore Aroha ↗</a></div></main>';
  document.querySelector("#reload-booking").onclick = () => location.reload();
  if (error?.code === "PREPROD_TESTER_REQUIRED") {
    document.querySelector("#main h1").textContent =
      "This account is not approved for pre-production.";
    document.querySelector("#main .lead").textContent =
      "Use the approved test Google account. No production booking was created.";
    const button = document.querySelector("#reload-booking");
    button.textContent = "Use another account";
    button.onclick = async () => {
      await bookingApi("logout");
      location.reload();
    };
  }
}
