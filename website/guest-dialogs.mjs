import { initializeAnalytics, withdrawAnalytics } from "./analytics.mjs";
import { preference } from "./preferences.mjs";
import { esc } from "./render.mjs";
import { enquiryText, packageAvailability } from "../functions/domain.mjs";
import { track, initializeMonitoring, withdrawMonitoring, monitoringStatus } from "./monitoring.mjs";
import { setPreference } from "./preferences.mjs";
export function openEnquiry(content, show, packageId = "", cottageId = "") {
  show(
    `<div class="dialog-copy"><p class="eyebrow">LET’S PLAN YOUR VISIT</p><h2 id="dialog-title">A conversation comes first.</h2><p>Tell your hosts a little about your visit. They will personally confirm availability and the details.</p><form class="enquiry-form"><label>How would you like to visit?<select name="package" required><option value="">Choose a package</option>${content.packages.filter(p => packageAvailability(p) === "available").map((p) => `<option value="${esc(p.id)}" ${p.id === packageId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label><label>Guests<input name="guests" type="number" min="1" max="100" value="2" required></label><label>Visit / check-in date<input name="checkin" type="date" min="${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}" required></label><label data-overnight>Check-out date<input name="checkout" type="date"></label><label data-overnight class="full">Preferred cottage<select name="cottage"><option value="">Please advise</option>${content.cottages.map((x) => `<option value="${esc(x.id)}" ${x.id === cottageId ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><label>Your name<input name="name" autocomplete="name" maxlength="100" required></label><label>Phone / WhatsApp<input name="phone" type="tel" autocomplete="tel" maxlength="30" required></label><label class="full">Anything you would like us to know? <small>(optional)</small><textarea name="message" rows="3" maxlength="1000"></textarea></label><p class="full form-note">Your details will be included in a WhatsApp message. You review and send it there. This does not reserve a room, confirm a booking or make a payment.</p><p class="full form-error" role="alert" hidden></p><button class="button full" type="submit">Continue to WhatsApp <span aria-hidden="true">↗</span></button></form></div>`,
  );
  const form = document.querySelector(".enquiry-form"),
    select = form.elements.package;
  function change() {
    const overnight =
      content.packages.find((p) => p.id === select.value)?.overnight ?? false;
    form
      .querySelectorAll("[data-overnight]")
      .forEach((el) => (el.hidden = !overnight));
    form.elements.checkout.required = overnight;
  }
  select.onchange = change;
  change();
  form.elements.checkin.onchange = () => {
    form.elements.checkout.min = form.elements.checkin.value;
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    try {
      const data = Object.fromEntries(new FormData(form));
      const text = enquiryText(content, data);
      const url =
        "https://wa.me/" +
        content.visit.phone +
        "?text=" +
        encodeURIComponent(text);
      track("enquiry.prepared", { section: data.package, outcome: "prepared" });
      // Keep the private reviewed message out of DOM link URLs, which optional
      // automatic outbound-link analytics could otherwise observe.
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      const box = form.querySelector(".form-error");
      box.hidden = false;
      box.textContent =
        {
          PACKAGE_COMING_SOON: "This retreat is coming soon. Please ask your hosts about launch plans.",
          CHOOSE_PACKAGE: "Choose a package.",
          CHOOSE_DATE: "Choose a visit date.",
          INVALID_CHECKOUT: "Choose a check-out date after check-in.",
          CONTACT_DETAILS_REQUIRED: "Enter your name and a valid phone number.",
        }[error.message] || "Please check your visit details.";
    }
  };
}

export function openPrivacy(show) {
  show(`<div class="dialog-copy privacy-choices"><h2 id="dialog-title">Privacy & optional analytics</h2><p>Choose what helps us improve Aroha. You can explore and sign in without optional analytics.</p><label><input type="checkbox" id="monitoring-choice" ${preference("aroha-monitoring") === "allowed" ? "checked" : ""}><span><strong>Performance monitoring</strong><small>Dynatrace measures page performance and errors. If signed in, an internal account ID tags your session. Session replay is disabled.</small></span></label><label><input type="checkbox" id="analytics-choice" ${preference("aroha-analytics") === "allowed" ? "checked" : ""}><span><strong>Website analytics</strong><small>Google Analytics measures visits and use of the site. We do not send account names, email addresses, phone numbers or enquiry messages.</small></span></label><p class="monitoring-status" role="status">${monitoringStatus()}</p><p>Google sign-in is requested only when you choose it. Booking requests store your account identity, verified contact email, stay details and private requests for you and authorised hosts. Optional analytics are not required to book. Our optional Google map loads only when you open its view.</p><div class="guest-account-actions"><button class="button" id="save-privacy">Save choices</button><button class="text-link" id="deny-monitoring">Decline / withdraw all</button></div></div>`);
  function save(deny=false) {
    const wasMonitoring = preference("aroha-monitoring") === "allowed";
    const monitoring = !deny && document.querySelector("#monitoring-choice").checked;
    const analytics = !deny && document.querySelector("#analytics-choice").checked;
    setPreference("aroha-monitoring", monitoring ? "allowed" : "denied");
    setPreference("aroha-analytics", analytics ? "allowed" : "denied");
    if(analytics) initializeAnalytics(); else withdrawAnalytics();
    if(monitoring) initializeMonitoring(); else withdrawMonitoring();
    window.dispatchEvent(new Event("aroha-consent-change"));
    document.querySelector("#details-dialog").close();
    if(wasMonitoring && !monitoring) location.reload();
  }
  document.querySelector("#save-privacy").onclick=()=>save();
  document.querySelector("#deny-monitoring").onclick=()=>save(true);
}
export function openUpcoming(content, show, id) {
 const p=content.packages.find(p=>p.id===id); if(!p)return;
 show(`<div class="dialog-copy"><p class="eyebrow">COMING SOON</p><h2 id="dialog-title">${esc(p.name)}</h2><p>This retreat is being prepared. Ask your hosts about launch plans before making arrangements.</p><a class="button" href="https://wa.me/${esc(content.visit.phone)}?text=${encodeURIComponent("I’m interested in the upcoming "+p.name+". Could you share the launch details?")}" target="_blank" rel="noopener noreferrer">Ask your hosts ↗</a></div>`);
}
