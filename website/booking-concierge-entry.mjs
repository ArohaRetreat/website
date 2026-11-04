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
    journeyStep,
    getAtmosphere: atmospherePreference,
    setAtmosphere,
    watchAtmosphere,
    getIdentity: () => auth.currentUser?.uid,
  });
  observeAuth((user) => void portal.identity(user));
} catch (error) {
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
