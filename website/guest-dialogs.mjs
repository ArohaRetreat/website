import { esc } from "./render.mjs";
import { enquiryText } from "../functions/domain.mjs";
import { track, initializeMonitoring } from "./monitoring.mjs";
import { setPreference } from "./preferences.mjs";
export function openEnquiry(content, show, packageId = "", cottageId = "") {
  show(
    `<div class="dialog-copy"><p class="eyebrow">LET’S PLAN YOUR VISIT</p><h2 id="dialog-title">A conversation comes first.</h2><p>Tell your hosts a little about your visit. They will personally confirm availability and the details.</p><form class="enquiry-form"><label>How would you like to visit?<select name="package" required><option value="">Choose a package</option>${content.packages.map((p) => `<option value="${esc(p.id)}" ${p.id === packageId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label><label>Guests<input name="guests" type="number" min="1" max="100" value="2" required></label><label>Visit / check-in date<input name="checkin" type="date" min="${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}" required></label><label data-overnight>Check-out date<input name="checkout" type="date"></label><label data-overnight class="full">Preferred cottage<select name="cottage"><option value="">Please advise</option>${content.cottages.map((x) => `<option value="${esc(x.id)}" ${x.id === cottageId ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><label>Your name<input name="name" autocomplete="name" maxlength="100" required></label><label>Phone / WhatsApp<input name="phone" type="tel" autocomplete="tel" maxlength="30" required></label><label class="full">Anything you would like us to know? <small>(optional)</small><textarea name="message" rows="3" maxlength="1000"></textarea></label><p class="full form-note">Your details will be included in a WhatsApp message. You review and send it there. This does not reserve a room, confirm a booking or make a payment.</p><p class="full form-error" role="alert" hidden></p><button class="button full" type="submit">Continue to WhatsApp <span aria-hidden="true">↗</span></button></form></div>`,
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
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (error) {
      const box = form.querySelector(".form-error");
      box.hidden = false;
      box.textContent =
        {
          CHOOSE_PACKAGE: "Choose a package.",
          CHOOSE_DATE: "Choose a visit date.",
          INVALID_CHECKOUT: "Choose a check-out date after check-in.",
          CONTACT_DETAILS_REQUIRED: "Enter your name and a valid phone number.",
        }[error.message] || "Please check your visit details.";
    }
  };
}

export function openPrivacy(show) {
  show(
    '<div class="dialog-copy"><h2 id="dialog-title">Privacy & monitoring</h2><p>Optional Dynatrace monitoring helps us understand page performance and errors. Enquiry messages, names and phone numbers are excluded. Google Analytics and session replay are not enabled.</p><p>You can use the site without optional monitoring. Essential Google sign-in is used only in the host portal.</p><button class="button" id="allow-monitoring">Allow monitoring</button> <button class="text-link" id="deny-monitoring">Decline / withdraw</button></div>',
  );
  document.querySelector("#allow-monitoring").onclick = () => {
    setPreference("aroha-monitoring", "allowed");
    initializeMonitoring();
    document.querySelector("#details-dialog").close();
  };
  document.querySelector("#deny-monitoring").onclick = () => {
    setPreference("aroha-monitoring", "denied");
    location.reload();
  };
}
