import {hostShell,mountFrontDesk} from './frontdesk.mjs';
import {mountHostOperations,mountHostSummary,openManualBooking} from './host-operations.mjs';
import {auth} from './firebase-auth.mjs';
import {mountStayPanel} from './stay-panel.mjs';
import { journeyStep } from "./booking-journey.mjs";
import { bookingApi } from "./booking-api.mjs";
const app = document.querySelector("#app"),
  dialog = document.querySelector("#detail");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  n === null
    ? "Agreed with host"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(n / 100);
const day = (offset = 0) =>
  new Date(Date.now() + 19800000 + offset * 86400000)
    .toISOString()
    .slice(0, 10);
const add = (d, n) =>
  new Date(Date.parse(d + "T00:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const format = (d, options = { day: "numeric", month: "short" }) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-IN", {
    ...options,
    timeZone: "Asia/Kolkata",
  });
const pretty = (s) =>
  ({
    pending_approval: "Awaiting host approval",
    checked_in: "Checked in",
    no_show: "No show",
  })[s] || s?.replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase());
const badge = (status) =>
  `<span class="badge ${esc(status)}"><span></span>${esc(pretty(status))}</span>`;
let contactDraft;
let state,
  search = {
    kind: "private",
    arrival: day(3),
    departure: day(5),
    adults: 2,
    childrenAges: [],
    guests: 2,
  },
  selected = [],
  available,
  quote,
  note = "",
  promo = "",
  step = 1,
  bookingFilter = "upcoming",
  hostTab = "overview",
  calendarStart = day(),
  month = day().slice(0, 7),
  picking = "arrival",
  lastFocus,
  submitting = false;
const errors = {
  PREPROD_TESTER_REQUIRED: "This test site is available only to approved test accounts.",
  INVOICE_NOT_FOUND: "An invoice is not available for this booking yet.",
  INVOICE_NOT_PAYABLE: "This invoice was cancelled or replaced. Review the current booking details.",
  INVOICE_PRICE_REQUIRED: "Agree and record the booking price before approving it with an invoice.",
  MAIL_RECONCILIATION_REQUIRED: "Check this email with Resend before retrying; it may already have been sent.",
  CONTACT_REQUIRED:
    "Add your contact details before sending this booking request.",
  INVALID_CONTACT:
    "Enter your full name and a phone number with country code, for example +91 98765 43210.",
  VERSION_CONFLICT:
    "Your details changed in another window. Refresh and review them before saving.",
  INVALID_TIME_WINDOW:
    "This visit window has ended. Choose another date or contact your host.",
  RECONCILIATION_REQUIRED:
    "Your host needs to reconcile existing reservations before this change.",
  ROOM_PARTY_LIMIT:
    "Each selected room needs an adult and fits at most 2 adults and 2 under 10s. Adjust the party or rooms.",
  INVALID_CHILD_AGE:
    "Children must be age 0–9 on arrival. Age10+ uses an adult place.",
  PARTY_COUNT_MISMATCH: "Review your adult and child counts.",
  CHILDREN_REQUIRE_PRIVATE_ROOM:
    "Choose a private room when travelling with under 10 children.",
  EVENT_QUOTE_REQUIRED:
    "The guest must accept the host event offer before approval.",
  ROOM_TURNOVER_REQUIRED:
    "Mark the assigned room ready after cleaning before check-in.",

  PRICING_NOT_CONFIGURED:
    "Your host will agree the price with you. Offers become available after room rates are configured.",
  IDEMPOTENCY_CONFLICT:
    "This request may already have been saved. Check Your visits before trying again.",
  AVAILABILITY_CHANGED:
    "Those places or dates are no longer available. Review your party, room choice or date.",
  PARTY_CAPACITY_EXCEEDED:
    "Choose enough rooms for your group, within the retreat capacity.",
  SELECT_ROOMS: "Choose at least one room to continue.",
  INVALID_STAY_DATES:
    "Choose a future arrival and a departure within 31 nights.",
  PROMO_NOT_VALID: "That code is unavailable or outside its valid dates.",
  PROMO_EXHAUSTED: "This offer has reached its reservation limit.",
  LOYALTY_IS_BETTER:
    "Your loyalty benefit is already equal to or better than this code.",
  QUOTE_CHANGED: "The price or policy changed. Please review a fresh quote.",
  QUOTE_EXPIRED: "Your quote expired. Review the price again.",

  EXISTING_BOOKINGS_CONFLICT:
    "Existing reservations conflict with this change. Resolve them first.",
  ROOM_NOT_READY:
    "This room is not ready to open. Its details need host verification.",
  HOST_CANCELLATION_REQUIRED:
    "This stay is inside the cancellation window. Please contact the host.",
  STAY_NOT_STARTED_OR_FINISHED:
    "Check-in starts on arrival day; completion and no-show require the departure date.",
  INVALID_TIER_THRESHOLDS: "Family must begin after the Friend threshold.",
  SIGN_IN_REQUIRED: "Choose a guest to continue.",
  INVALID_TRANSITION: "This reservation has changed. Refresh its details.",
  BOOKINGS_PAUSED: "The host has paused new booking requests.",
  REQUEST_LIMIT: "This Google account already has three active requests.",
};
async function api(path, body, key = crypto.randomUUID()) {
  try {
    return await bookingApi(path, body, key, {
      admin: hostRoute(),
      start: calendarStart,
    });
  } catch (error) {
    throw Error(
      errors[error.code] ||
        error.message ||
        "Booking service is temporarily unavailable.",
    );
  }
}

function toast(message, error = false) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.className = error ? "show error" : "show";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.className = ""), 6500);
}
async function run(fn) {
  if (submitting) return;
  submitting = true;
  app.setAttribute("aria-busy", "true");
  try {
    await fn();
  } catch (e) {
    toast(e.message, true);
  } finally {
    submitting = false;
    app.removeAttribute("aria-busy");
  }
}
async function refresh() {
  const previous = state?.actor?.id;
  const selectedBooking=dialog.open?dialog.dataset.detailId:null;
  state = await api("state");
  if (previous && state.actor?.id !== previous) {
    dialog.close();dialog.replaceChildren();delete dialog.dataset.detailId;
    contactDraft = undefined;
    quote = null;
    note = "";
    promo = "";
    selected = [];
    step = 1;
  }else if(selectedBooking&&!state.bookings.some(b=>b.id===selectedBooking)){
    // List pagination is not a detail cache. Re-read just this authorised record.
    try{const current=await api('reservation-detail',{id:selectedBooking});state.bookings.push(current);}
    catch(e){dialog.close();dialog.replaceChildren();delete dialog.dataset.detailId;throw e;}
  }
}
const hostRoute = () =>
  location.pathname.startsWith("/admin/bookings/") ||
  location.pathname.startsWith("/admin/modules/bookings/");
// Short, interruptible transitions; rendering and focus never wait for an entrance.
const motionPreference = window.matchMedia?.(
  "(prefers-reduced-motion: reduce)",
);
const activeMotion = new Map();
let closingDialog = null,
  renderedView,
  keyboardInteraction = false;
window.addEventListener(
  "keydown",
  () => {
    keyboardInteraction = true;
  },
  { capture: true },
);
window.addEventListener(
  "pointerdown",
  () => {
    keyboardInteraction = false;
  },
  { capture: true },
);
function playMotion(key, element, frames, duration = 180) {
  activeMotion.get(key)?.cancel();
  activeMotion.delete(key);
  if (
    !element?.animate ||
    motionPreference?.matches ||
    keyboardInteraction ||
    document.hidden
  )
    return null;
  const animation = element.animate(frames, {
    duration,
    easing: "cubic-bezier(0.23, 1, 0.32, 1)",
  });
  activeMotion.set(key, animation);
  const clear = () => {
    if (activeMotion.get(key) === animation) activeMotion.delete(key);
  };
  animation.finished.then(clear, clear);
  return animation;
}
function closeDialog() {
  if (!dialog.open || closingDialog) return;
  const animation = playMotion(
    "dialog",
    dialog,
    [
      { opacity: 1, transform: "translateY(0) scale(1)" },
      { opacity: 0, transform: "translateY(8px) scale(.98)" },
    ],
    140,
  );
  if (!animation) {
    dialog.close();
    return;
  }
  closingDialog = animation;
  animation.finished.then(
    () => {
      if (closingDialog === animation) {
        closingDialog = null;
        dialog.close();
      }
    },
    () => {},
  );
}
function stopMotion() {
  for (const animation of activeMotion.values()) animation.cancel();
  activeMotion.clear();
  if (closingDialog) {
    closingDialog = null;
    dialog.close();
  }
}
motionPreference?.addEventListener("change", (e) => {
  if (e.matches) stopMotion();
});
window.addEventListener("pagehide", stopMotion);
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeDialog();
});

function open(markup) {
  if (!dialog.open) lastFocus = document.activeElement;
  closingDialog = null;
  dialog.innerHTML = `<button class="close" aria-label="Close dialog" data-close>×</button>${markup}`;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector("[data-close]").onclick = () => closeDialog();
  dialog.querySelector("h2")?.setAttribute("tabindex", "-1");
  dialog.querySelector("h2")?.setAttribute("id", "review-dialog-title");
  dialog.setAttribute("aria-labelledby", "review-dialog-title");
  dialog.querySelector("h2")?.focus();
  bindDialog();
  extendDetail();
  if(hostRoute() && state.actor?.bookingAccess === "viewer")dialog.querySelectorAll('form input,form select,form textarea,form button,[data-action],[data-cancel]').forEach(el=>{el.disabled=true;});
  playMotion(
    "dialog",
    dialog,
    [
      { opacity: 0, transform: "translateY(8px) scale(.98)" },
      { opacity: 1, transform: "translateY(0) scale(1)" },
    ],
    200,
  );
}
dialog.addEventListener("close", () => {
  closingDialog = null;
  activeMotion.get("dialog")?.cancel();
  activeMotion.delete("dialog");
  if (lastFocus?.isConnected) lastFocus.focus();
  else document.querySelector("#main")?.focus();
});
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeDialog();
  }
});
function login() {
  open(
    `<p class="eyebrow">YOUR AROHA ACCOUNT</p><h2>A familiar welcome.</h2><p>Sign in securely with Google to request a stay and manage your bookings. We use your Google name and verified email so authorised hosts can manage and discuss your stay. A request needs host approval. Published prices appear before submission; exclusive bookings show the daily rate and require one host availability approval.</p><button class="button full" id="google-booking-login">Continue with Google ↗</button>`,
  );
  dialog.querySelector("#google-booking-login").onclick = () =>
    run(async () => {
      await api("session", {});
      await refresh();
      closeDialog();
      render();
      toast("You’re signed in. Welcome to Aroha.");
    });
}

const brand = (width, height) =>
  `<span class="booking-brand"><img class="brand-day" src="/assets/brand/logo-forest.svg" alt="Aroha Retreat" width="${width}" height="${height}"><img class="brand-night" src="/assets/brand/logo-white.svg" alt="Aroha Retreat" width="${width}" height="${height}"></span>`;
function header() {
  return `<header class="guest-header"><a href="/" aria-label="Aroha Retreat home">${brand(160, 55)}</a><nav aria-label="Booking navigation"><a href="#plan" ${!["#visits", "#profile"].includes(location.hash) ? 'aria-current="page"' : ""}>Plan a stay</a><a href="#visits" ${location.hash === "#visits" ? 'aria-current="page"' : ""}>Your visits</a><a href="#profile" ${location.hash === "#profile" ? 'aria-current="page"' : ""}>Profile</a></nav><div class="header-actions"><a class="host-link" href="/admin/#bookings">Host Studio ↗</a><button class="account-button" id="account">${state.actor ? `<span class="avatar small">${esc(state.actor.name[0])}</span><span>${esc(state.actor.name.split(" ·")[0])}</span>` : "Sign in ↗"}</button></div></header>`;
}
const emailEnabled = () => state.delivery === "email_enabled";
const foot = () =>
  `<footer class="guest-footer">${brand(140, 48)}<span>A little time. A little closer to nature.</span><span>Host-approved stays · No online payments</span></footer>`;
const contactNotice =
  "Your contact number is used by authorised hosts and included in operational booking events in Dynatrace. Names, private requests and child ages are not sent. Profile edits do not change past booking contact records.";
function contactFields(value = contactDraft || state.profile || {}) {
  return `<div class="two-fields"><label>Full name<input name="contactName" autocomplete="name" value="${esc(value.name || state.actor?.name || "")}" minlength="2" maxlength="120" required></label><label>Phone number with country code<input name="contactPhone" type="tel" autocomplete="tel" placeholder="+91 98765 43210" value="${esc(value.phone || "")}" maxlength="32" required></label></div><label>Verified Google email<input type="email" value="${esc(state.profile?.email || "")}" readonly autocomplete="email"></label><p class="form-note">${contactNotice}</p>`;
}
function profilePage() {
  if (!state.actor)
    return `<section class="empty"><h1>Your guest profile.</h1><p>Sign in to save the contact details for your visits.</p><button class="button" id="profile-login">Sign in with Google</button></section>`;
  return `<section class="account-heading"><div><p class="eyebrow">YOUR AROHA</p><h1>Your guest profile.</h1><p>Save your contact details once. Review them before every visit.</p></div></section><form id="profile-form" class="paper">${contactFields(state.profile)}<button class="button" type="submit">Save profile</button><p role="status" id="profile-result"></p></form>`;
}
function dateInputs() {
  return `<div class="date-fields"><label class="date-field">${search.kind === "event" ? "Start date" : shortVisit() ? "Visit date" : "Arrival"}<input type="date" name="arrival" value="${search.arrival}" min="${day()}" required></label>${search.kind === "event" ? `<label class="date-field">End date<input type="date" name="eventEnd" value="${add(search.departure, -1)}" min="${search.arrival}" required></label>` : shortVisit() ? "" : `<label class="date-field">Departure<input type="date" name="departure" value="${search.departure}" min="${add(search.arrival, 1)}" required></label>`}<label>Adults · age 10+<input type="number" name="adults" value="${search.adults}" min="1" max="${["private", "individual"].includes(search.kind) ? policy().nightAdults : policy().siteAdults}" required></label><label>Children · under 10<input type="number" name="childCount" value="${search.childrenAges.length}" min="0" max="${search.kind === "individual" ? 0 : search.kind === "private" ? 18 : 100}" ${search.kind === "individual" ? "readonly" : ""} required></label></div>${search.childrenAges.length ? `<p class="form-note">Children’s ages are private to you and your hosts.</p><div class="child-ages">${search.childrenAges.map((age, i) => `<label>Child ${i + 1} age on arrival<input name="childAge" type="number" min="0" max="9" value="${age ?? ""}" required></label>`).join("")}</div>` : ""}`;
}
function calendar() {
  const first = month + "-01",
    start = add(first, -((new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7));
  return `<div class="date-calendar"><div class="calendar-heading"><button type="button" class="icon-button" data-month="-1" aria-label="Previous month">←</button><strong>${format(first, { month: "long", year: "numeric" })}</strong><button type="button" class="icon-button" data-month="1" aria-label="Next month">→</button></div><p class="calendar-hint">Choose your ${search.kind === "event" ? picking === "arrival" ? "start" : "end" : shortVisit() ? "visit" : picking === "arrival" ? "arrival" : "departure"} date</p><div class="month-grid">${["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span class="weekday">${d}</span>`).join("")}${Array.from(
    { length: 42 },
    (_, i) => {
      const d = add(start, i),
        inMonth = d.startsWith(month),
        disabled = d < day() || d > day(365);
      return `<button type="button" data-date="${d}" class="date-cell ${inMonth ? "" : "outside"} ${d === search.arrival || (!shortVisit() && d === calendarEnd()) ? "endpoint" : ""} ${!shortVisit() && d > search.arrival && d < calendarEnd() ? "in-range" : ""}" ${disabled ? "disabled" : ""} aria-label="${format(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${d === search.arrival ? search.kind === "event" ? ", start" : ", arrival" : !shortVisit() && d === calendarEnd() ? search.kind === "event" ? ", end" : ", departure" : ""}" aria-pressed="${d === search.arrival || (!shortVisit() && d === calendarEnd())}">${Number(d.slice(-2))}</button>`;
    },
  ).join("")}</div></div>`;
}
const kindLabel = (k) =>
  ({
    day: "Day outing",
    individual: "Individual stay",
    private: "Private room / Family stay",
    event: "Exclusive retreat",
  })[k] || "Overnight stay";
const shortVisit = () => search.kind === "day";
const endDateOf = (b) =>
  b.kind === "event" ? add(b.departure, -1) : b.departure;
const calendarEnd = () =>
  search.kind === "event" ? add(search.departure, -1) : search.departure;
const policy = () =>
  state.settings.products || {
    siteAdults: 35,
    nightAdults: 10,
    dayAdultRate: 120000,
    dayChildRate: 70000,
    individualRate: 350000,
    roomRate: 600000,
    extraChildRate: 150000,
    dayStart: "06:00",
    dayEnd: "18:00",
    stayStart: "11:00",
    stayEnd: "11:00",
  };
function productChoices() {
  const p = policy();
  return `<fieldset class="product-choices"><legend>How would you like to visit?</legend>${[
    [
      "day",
      "Day outing",
      money(p.dayAdultRate) +
        " / adult · " +
        money(p.dayChildRate) +
        " / under 10",
      "Breakfast and lunch · morning arrival to " + p.dayEnd,
    ],
    [
      "individual",
      "Individual stay",
      money(p.individualRate) + " / person / night",
      "A sleeping place in host-allocated, potentially shared accommodation",
    ],
    [
      "private",
      "Private room / Family stay",
      money(p.roomRate) + " / room / night",
      "Two occupants included · up to 2 adults and 2 children per room",
    ],
    [
      "event",
      "Exclusive retreat",
      money(p.eventDayRate) + " / day",
      "Private use · one host availability approval",
    ],
  ]
    .map(
      ([id, title, rate, copy]) =>
        `<label class="product-choice ${search.kind === id ? "selected" : ""}"><input type="radio" name="bookingKind" value="${id}" ${search.kind === id ? "checked" : ""}><strong>${title}</strong><span>${rate}</span><small>${copy}</small></label>`,
    )
    .join("")}</fieldset>`;
}
function planPage() {
  const p = policy();
  if (step === 1)
    return `<section class="hero"><div class="hero-copy"><p class="eyebrow">MAKE A LITTLE ROOM FOR YOURSELF</p><h1>A day away.<br>A little <em>longer.</em></h1><p>Come for the day, stay among the trees, or make the retreat your own.</p><div class="hero-facts"><span>Host-approved visits</span><span>${p.siteAdults} adult places · children counted separately</span><span>No online payment</span></div></div><figure class="hero-photo"><img src="/assets/retreat/hero-desktop.webp" alt="A-frame cottages surrounded by coconut palms at the retreat"><figcaption>Aroha, at your own pace.</figcaption></figure></section><section class="planning"><div class="section-heading"><div><p class="eyebrow">YOUR NEXT CHAPTER</p><h2>How shall we welcome you?</h2></div><span class="subtle">All times in India Standard Time</span></div>${productChoices()}<div class="planning-grid"><form id="search-form" class="date-panel">${dateInputs()}${calendar()}<button class="button full" type="submit">${search.kind === "event" ? "Explore exclusive dates" : "Find your little corner"} <span>→</span></button><p class="form-note">Every request needs host approval. Under 10 means age 0–9 on arrival; age 10+ uses an adult place.</p></form><aside class="stay-note"><span class="handwriting">Less rush. More room.</span><h3>${kindLabel(search.kind)}</h3><p>${search.kind === "day" ? `Flexible morning arrival from ${p.dayStart}, breakfast and lunch included, departure by ${p.dayEnd}. Meal service is coordinated with your hosts.` : search.kind === "individual" ? `You reserve a sleeping place, not a private room. Your host allocates compatible accommodation, which may be shared. Under 10s use the private-room option.` : search.kind === "event" ? `Reserve exclusive use continuously from ${p.dayStart} on the start date through ${p.dayEnd} on the end date. The published daily rate is ${money(p.eventDayRate)} per selected day; your host checks availability and approves once. Other guests cannot overlap the exclusive period. Overnight accommodation requires an explicit host agreement.` : `A dedicated room for your party. ${money(p.roomRate)} includes the first 2 occupants; ${money(p.extraChildRate)} per additional under 10 child per night. Maximum 2 adults and 2 children per room.`}</p><p>Overnight arrival ${p.stayStart} · checkout ${p.stayEnd}. Your host coordinates room readiness.</p><div class="sample-note">${state.settings.paused ? "New requests are paused." : `${state.units.filter((u) => u.active).length} verified rooms open. Unverified and future rooms remain closed.`} Adult day capacity adjusts to overnight occupancy, including departure morning.</div></aside></div></section>`;
  const selection = quote || search,
    description = `${selection.adults ?? selection.guests} adult(s) · ${selection.children ?? selection.childrenAges?.length ?? 0} under 10(s)`;
  const summary = `<aside class="summary"><p class="eyebrow">YOUR TIME AT AROHA</p><h3>${kindLabel(search.kind)}</h3><p>${format(search.arrival)}${shortVisit() ? "" : " — " + format(endDateOf(search))}</p><p>${description}</p><hr><dl>${(quote?.lineItems || []).map((x) => `<div><dt>${esc(x.label)}</dt><dd>${money(x.amount)}</dd></div>`).join("")}${quote?.discount ? `<div><dt>${esc(quote.offer)}</dt><dd>−${money(quote.discount)}</dd></div>` : ""}<div class="total"><dt>${quote ? "Request total" : "Room rate from"}</dt><dd>${quote ? money(quote.total) : money(p.roomRate)}</dd></div></dl><p class="form-note">No online payment or automatic email. ${search.kind === "event" ? "Pending requests hold the exclusive date range until the review deadline." : "Pending requests hold capacity until their review deadline."}</p>${(quote?.allocations || []).map((a) => `<p>${search.kind === "individual" ? "Host-allocated sleeping places" : esc(state.units.find((u) => u.id === a.unitId)?.name)} · ${a.adults} adult(s)${a.children ? " · " + a.children + " child(ren)" : ""}</p>`).join("")}</aside>`;
  return `<section class="wizard-heading"><button class="text-button" id="back-step">← ${step === 2 ? "Change dates" : search.kind === "private" ? "Back to rooms" : "Change visit"}</button><h1>${step === 2 ? "A little room for your family." : "Review your visit."}</h1><p>${description} · ${kindLabel(search.kind)}</p></section><div class="booking-layout"><div>${
    step === 2
      ? `<div class="room-list">${(available?.units || [])
          .filter((u) => u.active)
          .map(
            (u) =>
              `<article class="room-card ${selected.includes(u.id) ? "selected" : ""} ${u.available ? "" : "unavailable"}">${u.image ? `<img src="/assets/retreat/${esc(u.image)}" alt="Retreat accommodation; specific room views may vary">` : '<div class="room-placeholder">Room photograph not yet added</div>'}<div class="room-info"><p class="eyebrow">${esc(u.type)}</p><h2>${esc(u.name)}</h2><p>Up to 2 adults + 2 under 10s · Private whole room</p><div class="room-price"><span><strong>${money(u.rate)}</strong> / night<small>Two occupants included; child extras shown at review</small></span><button class="${selected.includes(u.id) ? "button" : "outline-button"}" type="button" data-room="${u.id}" aria-pressed="${selected.includes(u.id)}" ${u.available ? "" : "disabled"}>${u.available ? (selected.includes(u.id) ? "Selected ✓" : "Choose room +") : "Unavailable"}</button></div></div></article>`,
          )
          .join(
            "",
          )}</div><p class="form-note">Each occupied room needs an adult. We allocate your party within the room limits and show the child extras before submission.</p><button class="button continue-button" id="review" ${selected.length ? "" : "disabled"}>Review this stay →</button>`
      : `<form id="request-form" class="review-form"><div class="paper"><h2>A note to your hosts</h2><label for="note">Special requests (optional)</label><textarea id="note" maxlength="1000" rows="5" placeholder="Arrival plans or something you would like us to know…">${esc(note)}</textarea><p class="form-note">Private to you and your hosts. Please leave out sensitive personal information.</p></div>${search.kind !== "event" ? `<div class="paper"><h3>An invitation for your visit</h3><label for="promo">Invitation code</label><div class="promo-field"><input id="promo" maxlength="24" value="${esc(promo)}" placeholder="Optional"><button class="outline-button" type="button" id="apply-promo">Apply</button></div><p class="form-note">One offer applies. Day visits and events do not earn overnight stay credits.</p></div>` : ""}<div class="paper terms"><h3>Before you send your request</h3><p>${search.kind === "event" ? `Exclusive range: ${format(search.arrival)} at ${p.dayStart} to ${format(add(search.departure, -1))} at ${p.dayEnd}. Overnight accommodation is agreed with the host separately.` : shortVisit() ? `Morning arrival ${p.dayStart} · departure ${p.dayEnd}` : `Check-in ${p.stayStart} · check-out ${p.stayEnd}`} IST</p><p>Self-service cancellation up to ${state.settings.cancelHours} hours before arrival; later changes need your host.</p><label class="check"><input type="checkbox" id="terms" required><span>I understand the accommodation/sharing terms and price shown, that host approval is required, and no online payment is provided. ${emailEnabled() ? "Booking email updates are enabled." : "Automated email is not enabled."}</span></label></div><section class="paper"><h2>Your contact details</h2>${contactFields()}<label class="check"><input type="checkbox" id="save-booking-profile">Save these details to my guest profile for future visits</label></section><button class="button full" type="submit">${search.kind === "event" ? "Request an event quote" : "Send visit request"} →</button></form>`
  }</div>${summary}</div>`;
}
function visitsPage() {
  if (!state.actor)
    return `<section class="empty"><span class="handwriting">Your next chapter</span><h1>A little space of your own.</h1><p>Sign in with a guest to see reservations and your journey with Aroha.</p><button class="button" data-login>Choose guest ↗</button></section>`;
  if (state.actor.role === "host")
    return `<section class="empty"><h1>You’re in the host account.</h1><p>Open Host Studio to manage all reservations, or choose a guest account to review their experience.</p><a class="button" href="/admin/#bookings">Open Host Studio ↗</a><button class="text-button" id="switch-guest">Choose guest</button></section>`;
  const t = state.loyalty,
    next = t.nextAt ? t.nextAt - t.stays : 0;
  const bookings = state.bookings
    .filter((b) =>
      bookingFilter === "upcoming"
        ? ["pending_approval", "confirmed", "checked_in"].includes(b.status)
        : bookingFilter === "past"
          ? ["completed", "no_show"].includes(b.status)
          : ["cancelled", "declined", "expired"].includes(b.status),
    )
    .sort((a, b) => a.arrival.localeCompare(b.arrival));
  return `<section class="account-heading"><div><p class="eyebrow">YOUR AROHA</p><h1>Some places stay with you.</h1><p>Welcome back, ${esc(state.actor.name.split(" ·")[0])}. Your visits, all in one quiet corner.</p></div><a class="button" href="#plan">Plan another stay ↗</a></section><section class="loyalty-card"><div><p class="eyebrow">A LITTLE CLOSER EACH TIME</p><h2>${esc(t.name)} <span>· ${t.stays} completed stays</span></h2><p>${next ? `${next} more ${next === 1 ? "stay" : "stays"} until ${t.name === "Visitor" ? "Friend" : "Family"}.` : "You’re part of the Aroha Family."} ${t.discount ? `${t.discount}% stay benefit.` : "Every completed overnight visit brings you closer."}</p></div><div class="tier-path">${[
    ["Visitor", 0],
    ["Friend", state.settings.friendAt],
    ["Family", state.settings.familyAt],
  ]
    .map(
      ([name, at]) =>
        `<div class="${t.stays >= at ? "reached" : ""}"><span>${t.stays >= at ? "✓" : "○"}</span><strong>${name}</strong><small>${at === 0 ? "Your first visit" : at + "+ stays"}</small></div>`,
    )
    .join(
      "",
    )}</div></section><div class="tabs" role="group" aria-label="Booking filters">${["upcoming", "past", "cancelled"].map((f) => `<button data-filter="${f}" class="${bookingFilter === f ? "active" : ""}" aria-pressed="${bookingFilter === f}">${pretty(f)}</button>`).join("")}</div><div class="visits-list">${bookings.length ? bookings.map((b) => bookingCard(b)).join("") : `<div class="empty small-empty"><h2>${bookingFilter === "upcoming" ? "A new story is waiting." : "Nothing here just yet."}</h2><p>${bookingFilter === "upcoming" ? "Your next stay begins with a little room in the calendar." : "Reservations in this category will appear here."}</p><a class="outline-button" href="#plan">Explore dates →</a></div>`}</div>`;
}
function bookingCard(b, host = false) {
  return `<article class="visit-card"><div class="visit-date"><strong>${format(b.arrival, { day: "numeric" })}</strong><span>${format(b.arrival, { month: "short" })}</span></div><div class="visit-info"><div class="visit-top">${badge(b.status)}<span class="reference">${esc(b.reference)}</span></div><h3>${esc(b.source === "host_private" ? "Privately booked" : b.kind ? kindLabel(b.kind) : b.unitNames?.join(" + ") || b.units.join(", "))}</h3><p>${format(b.arrival)} — ${format(endDateOf(b))} · ${b.guestCountPending ? "Guest count to be arranged" : b.guests+" guests"}${host ? " · " + esc(b.guestName || state.users.find((u) => u.id === b.owner)?.name.split(" ·")[0] || "Guest") : ""}</p>${b.status === "pending_approval" ? `<p class="deadline">Host review by ${new Date(b.expiresAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} IST</p>` : ""}</div><div class="visit-action"><strong>${money(b.total)}</strong><button class="text-button" data-booking="${b.id}">View ${host ? "booking" : "details"} ↗</button></div></article>`;
}
function hostPage() {
  const nav = [
    ["overview", "Needs review", "◈"],
    ["calendar", "Retreat calendar", "▦"],
    ["reservations", "Reservations", "☷"],
    ["inventory", "Rooms & inventory", "⌂"],
    ["offers", "Rates & offers", "◇"],
    ["guests", "Customers", "♡"],
    ["loyalty", "Loyalty credits", "◇"],
    ["payments", "Payment ledger", "₹"],
    ["feedback", "Private feedback", "✎"],
    ["settings", "Booking policies", "⚙"],
  ].filter(([id])=>state.actor?.bookingAccess!=="viewer"||!["guests","loyalty","feedback"].includes(id));
  if(!nav.some(([id])=>id===hostTab))hostTab="overview";
  if (state.actor?.role !== "host")
    return `<div class="host-welcome"><img src="/assets/brand/logo-forest.svg" width="200" alt="Aroha Retreat"><p class="eyebrow">HOST STUDIO</p><h1>A thoughtful stay<br>starts with you.</h1><p>Explore your reservation desk with a host account.<br>Guest sessions do not have access to host booking controls.</p><button class="button" id="host-login">Sign in to Host Studio ↗</button><a class="text-button" href="/book/">← Back to guest experience</a></div>`;
  return hostShell({tab:hostTab,manager:state.actor.bookingAccess!=='viewer',content:hostContent()});
}
function hostContent() {
  if (["reservations","guests","loyalty","payments","feedback"].includes(hostTab)) return '<div data-host-operations></div>';
  const pending = state.bookings.filter((b) => b.status === "pending_approval"),
    active = state.bookings.filter((b) =>
      ["confirmed", "checked_in"].includes(b.status),
    ),
    rooms = state.units.filter((u) => u.active),
    title = (eye, h, p, action = "") =>
      `<div class="section-heading studio-title"><div><p class="eyebrow">${eye}</p><h1>${h}</h1><p>${p}</p></div>${action}</div>`;
  if (hostTab === "overview")
    return `<section class="desk-intro"><p class="eyebrow">YOUR BOOKING DESK</p><h1>Booking desk.</h1><p>Review requests, manage visits, or add a walk-in booking.</p></section><div data-host-summary></div><section class="desk-queue"><div data-host-operations></div></section>`;
  if (hostTab === "calendar")
    return `${
      (state.calendarDays || []).length
        ? `<div class="capacity-strip">${state.calendarDays
            .map(
              (d) =>
                `<article><strong>${format(d.date)}</strong><span>${d.adults}/${d.adultCapacity} adults · ${d.children} children (daily peaks)</span><small>${d.event ? "Exclusive retreat" : "Shared day capacity"}</small>${d.reservations
                  .filter((b) => ["day", "event"].includes(b.kind))
                  .map(
                    (b) =>
                      `<button class="text-button" data-detail="${b.id}">${esc(b.reference)} · ${esc(kindLabel(b.kind))} · ${b.adults} adult(s)</button>`,
                  )
                  .join("")}</article>`,
            )
            .join("")}</div>`
        : ""
    }${title("THE RETREAT, AT A GLANCE", "A little room in the calendar.", "Pending requests hold their rooms until the review deadline.")}<button class="outline-button" data-block-unit="site" data-block-date="${day(1)}">Close retreat dates</button><div class="calendar-tools"><button class="outline-button" id="calendar-prev">← Previous week</button><strong>${format(calendarStart)} — ${format(add(calendarStart, 13))}</strong><button class="outline-button" id="calendar-next">Next week →</button><button class="text-button" id="calendar-today">Today</button></div><div class="legend"><span>○ Available</span><span class="legend-pending">◐ Pending</span><span class="legend-confirmed">● Confirmed</span><span>▨ Maintenance</span></div><div class="timeline-scroll" tabindex="0" aria-label="Room availability timeline. Scroll horizontally for more dates."><table class="timeline"><caption class="sr-only">Fourteen-day room availability</caption><thead><tr><th scope="col">Accommodation</th>${Array.from({ length: 14 }, (_, i) => `<th scope="col">${format(add(calendarStart, i), { weekday: "short" })}<strong>${format(add(calendarStart, i), { day: "numeric", month: "short" })}</strong></th>`).join("")}</tr></thead><tbody>${rooms
      .map(
        (u) =>
          `<tr><th scope="row">${esc(u.name)}<small>Up to ${u.capacity} guests</small></th>${Array.from(
            { length: 14 },
            (_, i) => {
              const d = add(calendarStart, i),
                summary = state.calendarDays?.find((x) => x.date === d),
                rows = (summary?.reservations || state.bookings).filter(
                  (b) =>
                    ["pending_approval", "confirmed", "checked_in"].includes(
                      b.status,
                    ) &&
                    (b.units.includes(u.id) || b.kind === "event") &&
                    b.arrival <= d &&
                    (b.departure > d ||
                      (b.status === "checked_in" && b.departure <= day())),
                ),
                block = state.blocks.find(
                  (b) =>
                    (b.unitId === u.id || b.unitId === "site") &&
                    b.arrival <= d &&
                    b.departure > d &&
                    (!b.expiresAt || b.expiresAt > Date.now()),
                );
              return `<td>${rows.length ? rows.map((b) => `<button class="timeline-cell ${b.status}" data-booking="${b.id}"><span>${esc(b.source === "host_private" ? state.bookings.find(x=>x.id===b.id)?.guestName || "Privately booked" : b.reference || "Open reservation")}</span><small>${b.source === "host_private" ? "Privately booked" : b.kind === "event" ? "Whole retreat" : b.kind === "individual" ? "Shared" : "Private"} · ${b.guestCountPending ? "Attendance to arrange" : (b.allocations?.find((a) => a.unitId === u.id)?.adults ?? b.adults ?? b.guests)+" adult(s)"}</small></button>`).join("") : `<button class="timeline-cell ${block ? "blocked" : ""}" ${block ? `data-unblock="${block.id}"` : `data-block-unit="${u.id}" data-block-date="${d}"`} aria-label="${esc(u.name)}, ${format(d)}: ${block ? "closed; select to release" : "available; select to block"}">${block ? "▨" : "·"}</button>`}</td>`;
            },
          ).join("")}</tr>`,
      )
      .join(
        "",
      )}<tr class="occupancy-row"><th scope="row">Overnight adults<small>Limit ${policy().nightAdults}</small></th>${Array.from(
      { length: 14 },
      (_, i) => {
        const d = add(calendarStart, i),
          n = (
            state.calendarDays?.find((x) => x.date === d)?.reservations ||
            state.bookings
          )
            .filter(
              (b) =>
                ["pending_approval", "confirmed", "checked_in"].includes(
                  b.status,
                ) &&
                !["day", "event"].includes(b.kind) &&
                b.arrival <= d &&
                b.departure > d,
            )
            .reduce((n, b) => n + (b.adults ?? b.guests), 0);
        return `<td>${n} / ${policy().nightAdults}</td>`;
      },
    ).join(
      "",
    )}</tr></tbody></table></div><p class="form-note">Select a reservation to review it. Select an empty future cell to block a room for maintenance. All dates are IST. Checkout dates are available for the next stay.</p>`;
  if (hostTab === "inventory")
    return `${title("CARE FOR YOUR SPACES", "Rooms that are ready.", "Individual room capacities and the overall retreat limit are both enforced.")}<div class="notice-strip">${state.settings.capacity}-person overnight limit · ${rooms.reduce((n, u) => n + u.capacity, 0)} configured beds · ${state.units.filter((u) => u.type === "Unconfigured").length} awaiting identification · ${state.units.filter((u) => u.type === "Under construction").length} under construction</div><div class="inventory-grid">${state.units.map((u) => `<article class="inventory-card"><div class="inventory-art ${u.image ? "" : "future"}">${u.image ? `<img src="/assets/retreat/${esc(u.image)}" alt="Retreat accommodation photograph">` : "<span>⌂</span>"}<span class="inventory-state">${u.active ? "Open for requests" : u.type === "Under construction" ? "Under construction" : "Needs configuration"}</span></div><form data-unit-form="${u.id}"><p class="eyebrow">${esc(u.type)}</p><h3>${esc(u.name)}</h3><label>Room name<input name="name" maxlength="120" value="${esc(u.name)}" required></label><div class="two-fields"><label>Adult beds per room<input name="capacity" type="number" min="1" max="2" value="${u.capacity}" required></label><label>₹ / room / night (blank: default room rate)<input name="rate" type="number" min="100" max="1000000" value="${u.rate === null ? "" : u.rate / 100}"></label></div><label class="check"><input type="checkbox" name="active" ${u.active ? "checked" : ""} >Open for requests</label>${["Under construction", "Unconfigured"].includes(u.type) ? `<label class="check"><input type="checkbox" name="verified">I have verified this room is complete and ready for guests, and supplied its actual name.</label>` : ""}<button class="outline-button full" type="submit">Save room settings</button></form></article>`).join("")}</div>${state.blocks.length ? `<section class="host-section"><h2>Maintenance blocks</h2>${state.blocks.map((b) => `<div class="block-row"><span>${esc(state.units.find((u) => u.id === b.unitId)?.name || "Entire retreat")} · ${format(b.arrival)} — ${format(endDateOf(b))} · ${esc(b.reason)}</span><button class="text-button" data-unblock="${b.id}">Release block</button></div>`).join("")}</section>` : ""}`;
  if (hostTab === "offers")
    return `${title("A THOUGHTFUL LITTLE EXTRA", "Invitations to return.", "Room rates live under Rooms & inventory. Offers apply before host approval.", '<button class="button" id="new-promo">Create invitation code +</button>')}<div class="notice-strip">One best offer per stay · Pending requests reserve a redemption · Cancellation restores offer usage</div><div class="offers-grid">${state.promos.map((p) => `<article class="offer-card"><p class="eyebrow">${p.active ? "ACTIVE INVITATION" : "PAUSED INVITATION"}</p><h2>${esc(p.code)}</h2><strong class="offer-amount">${p.kind === "percent" ? p.value + "%" : money(p.value)} <span>off a stay</span></strong><p>${format(p.from)} — ${format(p.until, { day: "numeric", month: "short", year: "numeric" })}</p><div class="offer-bottom"><span>${p.maxUses} maximum redemptions</span><button class="text-button" data-toggle-promo="${p.id}">${p.active ? "Pause" : "Activate"} →</button></div></article>`).join("")}</div><div class="paper"><h3>Offer rules in this booking service</h3><p>Fixed or percentage discounts; date validity; total redemption limits; one offer per reservation. Loyalty applies automatically unless a promo is better. Offers require configured room rates. The initial launch uses prices agreed directly with hosts.</p></div>`;
  if (hostTab === "settings")
    return `${title("CLEAR TERMS, CALMER STAYS", "Your hosting rhythm.", "These booking policies affect new requests. Existing cancellation terms stay attached to their booking.")}<form id="settings-form" class="settings-form"><section class="paper"><h2>Capacity & approvals</h2><div class="two-fields"><input name="capacity" type="hidden" value="${state.settings.capacity}"><label>Host approval window (hours)<input name="approvalHours" type="number" min="1" max="72" value="${state.settings.approvalHours}" required></label><label>Free self-service cancellation before arrival (hours)<input name="cancelHours" type="number" min="0" max="336" value="${state.settings.cancelHours}" required></label></div><label class="check"><input type="checkbox" name="paused" ${state.settings.paused ? "checked" : ""}><span>Pause new requests. Existing bookings remain visible.</span></label><p class="form-note">Legacy bookings retain their original times. New products use the settings below.</p></section><section class="paper"><h2>Visit products & adult capacity</h2><div class="two-fields">${Object.entries(
      {
        siteAdults: "Simultaneous adult places",
        nightAdults: "Overnight adult limit",
        eventDayRate: "Exclusive retreat / day (₹)",
        dayAdultRate: "Day adult price (₹)",
        dayChildRate: "Day under 10 price (₹)",
        individualRate: "Individual / adult / night (₹)",
        roomRate: "Private room / night (₹)",
        extraChildRate: "Additional under 10 / night (₹)",
      },
    )
      .map(
        ([k, label]) =>
          `<label>${label}<input name="product-${k}" type="number" min="${k.endsWith("Adults") ? 1 : 0}" max="${k.endsWith("Adults") ? 100 : 1000000}" value="${policy()[k] / (k.endsWith("Rate") ? 100 : 1)}" required></label>`,
      )
      .join("")}${Object.entries({
      dayStart: "Morning arrival from",
      dayEnd: "Day departure by",
      stayStart: "Stay check-in",
      stayEnd: "Stay checkout",
    })
      .map(
        ([k, label]) =>
          `<label>${label} IST<input name="product-${k}" type="time" value="${policy()[k]}" required></label>`,
      )
      .join(
        "",
      )}</div><p class="form-note">Private room max 2 adults + 2 under 10s; first 2 occupants included. Changes apply to new quotes; existing bookings keep their terms. Children do not consume adult places.</p></section><section class="paper"><h2>Closer with each completed stay</h2><div class="two-fields"><label>Friend begins at (stays)<input type="number" name="friendAt" min="1" max="100" value="${state.settings.friendAt}" required></label><label>Family begins at (stays)<input type="number" name="familyAt" min="2" max="200" value="${state.settings.familyAt}" required></label><label>Friend discount (%)<input type="number" name="friendDiscount" min="0" max="50" value="${state.settings.friendDiscount}" required></label><label>Family discount (%)<input type="number" name="familyDiscount" min="0" max="50" value="${state.settings.familyDiscount}" required></label></div></section><button class="button" type="submit">Save booking policies →</button></form><section class="host-section"><h2>Recent operational history</h2><div class="audit-list">${
      state.audit.length
        ? state.audit
            .slice(0, 10)
            .map(
              (e) =>
                `<p><strong>${esc(pretty(e.type.replaceAll(".", " ")))}</strong><span>${new Date(e.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</span></p>`,
            )
            .join("")
        : "<p>No operational changes yet.</p>"
    }</div></section>`;
  return `${title("YOUR PUBLIC RETREAT", "Website changes.", "Website content stays separate from reservation operations.")}<div class="paper"><h2>Website content editor</h2><p>Manage website content in the existing editor. Booking operations are saved separately and never publish or overwrite website drafts.</p><div class="website-categories">${["Brand & welcome", "Page layout", "Farm tour & films", "Living Map stories", "Cottages", "Experiences", "Visit packages", "Contact & FAQs", "Design & motion", "Published history"].map((s) => `<div><span>${s}</span><small>Existing CMS editor</small></div>`).join("")}</div><a class="outline-button" href="https://aroharetreat.com/admin/" target="_blank" rel="noopener noreferrer">Open existing Host Studio ↗</a><p class="form-note">Opens the real Studio in a new tab and requires your existing host account. Publishing there affects the live site.</p></div>`;
}
function render() {
  document.documentElement.classList.toggle("frontdesk-v2",hostRoute());
  document.documentElement.classList.toggle("studio-embedded",hostRoute()&&window.parent!==window);
  const view = hostRoute()
    ? `host:${hostTab}`
    : location.hash === "#profile"
      ? "profile"
      : location.hash === "#visits"
        ? "visits"
        : `plan:${step}`;
  activeMotion.get("view")?.cancel();
  activeMotion.get("calendar")?.cancel();
  const focused = document.activeElement;
  const calendarFocus = focused?.dataset?.month
    ? ["month", focused.dataset.month]
    : focused?.dataset?.date
      ? ["date", focused.dataset.date]
      : null;
  document.title = hostRoute()
    ? "Host Studio · Aroha booking portal"
    : "Your time at Aroha · Booking";
  app.innerHTML = hostRoute()
    ? hostPage()
    : `${header()}<main id="main" class="guest-main" tabindex="-1">${location.hash === "#profile" ? profilePage() : location.hash === "#visits" ? visitsPage() : planPage()}</main>${foot()}`;
  bind();
  document.querySelector("#profile-login")?.addEventListener("click", login);
  document.querySelector("#profile-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(async () => {
      await api("profile", {
        name: String(f.get("contactName")),
        phone: String(f.get("contactPhone")),
        expectedVersion: state.profile?.version || 0,
      });
      await refresh();
      contactDraft = undefined;
      render();
      toast("Your profile is saved.");
    });
  });
  document
    .querySelectorAll('[name="contactName"], [name="contactPhone"]')
    .forEach((input) =>
      input.addEventListener("input", () => {
        contactDraft = {
          name: document.querySelector('[name="contactName"]')?.value || "",
          phone: document.querySelector('[name="contactPhone"]')?.value || "",
        };
      }),
    );
  extendPage();
  const operations=document.querySelector('[data-host-operations]');
  const identity=state.actor?.id;
  const call=async(operation,input,key)=>{if(auth.currentUser?.uid!==identity)throw {code:'SESSION_CHANGED'};const r=await bookingApi('platform',{operation,input},key);if(auth.currentUser?.uid!==identity)throw {code:'SESSION_CHANGED'};return r;};
  if(operations)void mountHostOperations(operations,{tab:hostTab,call,manager:state.actor?.bookingAccess!=='viewer',openBooking:async id=>run(async()=>{const b=await api('reservation-detail',{id});state.bookings=state.bookings.filter(x=>x.id!==id);state.bookings.push(b);detail(id);})});
  const desk=document.querySelector('[data-frontdesk]');
  const deskApi=async(operation,input,key)=>{if(auth.currentUser?.uid!==identity)throw {code:'SESSION_CHANGED',status:403};const r=await bookingApi(operation,input,key,{admin:true});if(auth.currentUser?.uid!==identity)throw {code:'SESSION_CHANGED',status:403};return r;};
  if(desk)void mountFrontDesk(desk,{tab:hostTab,call,api:deskApi,manager:state.actor?.bookingAccess!=='viewer',identity,onManual:done=>openManualBooking({identity,units:state.units,call,onBooked:async booked=>{await done(booked);toast('Booking confirmed. Check Messages for delivery.');}}),openLegacy:async id=>{const b=await api('reservation-detail',{id});state.bookings=state.bookings.filter(x=>x.id!==id);state.bookings.push(b);detail(id);}});
  document.querySelector('[data-desk-more]')?.addEventListener('click',()=>{const d=document.createElement('dialog');d.className='filter-dialog';d.innerHTML='<div class="dialog-head"><h2>More</h2><button data-close-more aria-label="Close navigation">×</button></div>'+[['payments','Payments'],['calendar','Room calendar'],['loyalty','Loyalty programme'],['feedback','Feedback'],['inventory','Rooms'],['offers','Offers'],['settings','Booking policies']].filter(([id])=>state.actor.bookingAccess!=='viewer'||!['loyalty','feedback'].includes(id)).map(([id,t])=>`<button data-go="${id}">${t}</button>`).join('');document.body.append(d);d.showModal();d.querySelector('[data-close-more]').onclick=()=>d.close();d.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{hostTab=b.dataset.go;d.close();render();});d.addEventListener('close',()=>d.remove(),{once:true});});

  if (hostRoute() && state.actor?.bookingAccess === "viewer") {
    document
      .querySelectorAll(
        "#main form:not([data-search]) input,#main form:not([data-search]) select,#main form:not([data-search]) textarea,#main form:not([data-search]) button,[data-action],[data-cancel],[data-unblock],[data-block-unit],[data-ready-unit],#manual-reservation",
      )
      .forEach((el) => {
        el.disabled = true;
      });
  }
  if (calendarFocus)
    document
      .querySelector(`[data-${calendarFocus[0]}="${calendarFocus[1]}"]`)
      ?.focus({ preventScroll: true });
  if (view !== renderedView) {
    playMotion("view", document.querySelector("#main"), [
      { opacity: 0, transform: "translateY(6px)" },
      { opacity: 1, transform: "translateY(0)" },
    ]);
    renderedView = view;
    if (hostRoute()) journeyStep("admin", "viewed");
    if (!hostRoute())
      journeyStep(
        location.hash === "#profile"
          ? "profile"
          : location.hash === "#visits"
            ? "visits"
            : step === 1
              ? "plan"
              : step === 2
                ? "rooms"
                : "review",
        "viewed",
        search.kind,
      );
  }
}
function detail(id) {
  dialog.querySelectorAll('[data-stay-panel]').forEach(el=>el.remove());
  dialog.dataset.detailId = id;
  const b = state.bookings.find((b) => b.id === id);
  if (!b) return;
  const isHost = state.actor?.role === "host",
    owner = state.users?.find((u) => u.id === b.owner);
  open(
    `<p class="eyebrow">${esc(b.reference)} ${isHost && owner ? "· " + esc(owner.name.split(" ·")[0]) : ""}</p><h2>${isHost ? (b.status === "pending_approval" ? "Review booking request" : "Booking details") : b.source === "host_private" ? "Privately booked" : "Your little corner of Aroha."}</h2>${isHost ? `<p class="host-guest-name">${esc(b.guestName || owner?.name?.split(" ·")[0] || "Guest")}</p>` : ""}${badge(b.status)}<div class="detail-dates"><strong>${format(b.arrival, { day: "numeric", month: "long" })} — ${format(endDateOf(b), { day: "numeric", month: "long", year: "numeric" })}</strong><p>${esc(b.kind ? kindLabel(b.kind) : b.unitNames.join(" + "))} · ${b.guestCountPending ? "Guest count to be arranged" : (b.adults ?? b.guests)+" adult(s) · "+(b.children ?? 0)+" under 10(s)"}</p></div>${b.source === "host_private" ? `<p>${esc(b.guestName)} · ${money(b.dayRate)} per day × ${b.days} days</p>` : ""}<dl class="detail-price"><div><dt>Visit subtotal</dt><dd>${money(b.subtotal)}</dd></div><div><dt>Offer</dt><dd>−${money(b.discount)}</dd></div><div class="total"><dt>Visit total</dt><dd>${money(b.total)}</dd></div></dl>${b.note ? `<div class="private-note"><p class="eyebrow">${b.source === "host_private" ? "HOST BOOKING NOTE" : "PRIVATE GUEST REQUEST"}</p><p>${esc(b.note)}</p></div>` : ""}${b.status === "pending_approval" ? `<div class="approval-note"><strong>${isHost ? "Your decision is needed" : "Awaiting your host’s approval"}</strong><p>Review deadline: ${new Date(b.expiresAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST. ${b.kind === "event" && !b.pricingVersion ? "Legacy event enquiries do not hold the property." : "Your places are held until then."}</p></div>` : ""}${isHost ? '<details class="booking-history"><summary>Booking history</summary>' : ""}<div class="status-history">${b.history.map((h) => `<div><span></span><p><strong>${esc(pretty(h.status))}</strong><small>${new Date(h.at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}</small></p></div>`).join("")}</div>${isHost ? "</details>" : ""}<div class="detail-actions">${isHost && b.status === "pending_approval" ? `<button class="button" data-action="approve" data-id="${b.id}" ${b.kind === "event" && !b.pricingVersion && !b.quoteAccepted ? "disabled" : ""}>Accept booking & email guest</button><button class="outline-button" data-action="decline" data-id="${b.id}">Decline request</button>` : ""}${isHost && b.status === "confirmed" ? `<button class="button" data-action="checkin" data-id="${b.id}">Check in</button><button class="text-button" data-action="no_show" data-id="${b.id}">Mark no-show</button>` : ""}${isHost && b.status === "checked_in" ? `<button class="button" data-action="complete" data-id="${b.id}">Check out</button>` : ""}${["pending_approval", "confirmed"].includes(b.status) && !(isHost && b.status === "pending_approval") ? `<button class="text-button danger" data-cancel="${b.id}">Cancel ${b.status === "pending_approval" ? "request" : "booking"}</button>` : ""}</div><p class="form-note">${emailEnabled() ? "Booking emails are enabled; check Email updates for delivery status." : "Email notifications are not enabled."} No online payment collected. Confirmed-stay cancellation cutoff: ${b.cancelHours ?? state.settings.cancelHours} hours before arrival. For later cancellation, contact the host.</p>`,
  );
  dialog.classList.toggle("host-booking-detail",isHost);
  if(isHost){
    const tools=document.createElement('div');tools.className='booking-tools';
    const actions=dialog.querySelector('.detail-actions');
    actions.querySelectorAll('button:not([data-action]):not([data-cancel])').forEach(button=>tools.append(button));
    if(tools.childElementCount)actions.after(tools);
    const allocation=dialog.querySelector('form.paper');
    if(allocation&&b.kind==='individual'){
      const fold=document.createElement('details');fold.className='booking-history';
      fold.innerHTML='<summary>Room allocation</summary>';allocation.before(fold);fold.append(allocation);
    }
  }
  const panel=document.createElement('div');panel.dataset.stayPanel='';dialog.querySelector('.dialog-content, #detail-content')?.append(panel);
  if(!panel.isConnected)dialog.append(panel);
  const manager=isHost&&state.actor?.bookingAccess!=='viewer';
  if(!isHost||b.status!=="pending_approval")void mountStayPanel(panel,{booking:b,manager,staff:isHost,call:(operation,input,key)=>bookingApi('platform',{operation,input},key),onMutation:async()=>{await refresh();render();}});

}
function bindDialog() {
  dialog.querySelectorAll("[data-action]").forEach(button => {
    let decisionRequest,decisionKey;
    button.onclick=()=>{
      const action=button.dataset.action;
      if(action==='decline'&&!button.dataset.reviewed){
        button.dataset.reviewed='1';
        const note=document.createElement('div');note.className='decline-review';note.setAttribute('role','status');
        note.innerHTML='<strong>Decline this request?</strong><p>This releases the held capacity and sends a decline email to the guest.</p><button type="button" class="text-button" data-keep-review>Keep reviewing</button>';
        button.before(note);button.textContent='Yes, decline request';
        note.querySelector('button').onclick=()=>{delete button.dataset.reviewed;button.textContent='Decline request';note.remove();};
        return;
      }
      run(async()=>{
        const booking=state.bookings.find(x=>x.id===button.dataset.id);
        const prompts={no_show:'Mark this guest as a no-show? No stay credits will be earned.',checkin:'Confirm the guest has arrived and check them in?',complete:'Check out this guest? Eligible night credits and the checkout statement will be recorded.'};
        if(prompts[action]&&!confirm(prompts[action]))return;
        decisionRequest ??= {id:booking.id,action,expectedVersion:booking.version};
        decisionKey ??= crypto.randomUUID();
        await api('booking-action',decisionRequest,decisionKey);
        await refresh();render();detail(booking.id);
        toast(action==='approve'?'Booking accepted. Check Email updates for delivery.':action==='decline'?'Request declined. Check Email updates for delivery.':'Booking updated.');
      });
    };
  });
  dialog.querySelectorAll("[data-cancel]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.cancel;
        open(
          `<p class="eyebrow">A CHANGE OF PLANS</p><h2>Cancel this ${state.bookings.find((b) => b.id === id).status === "pending_approval" ? "request" : "stay"}?</h2><p>This releases the reserved rooms. You can make a new request whenever you’re ready.</p><div class="detail-actions"><button class="button" id="confirm-cancel">Yes, cancel</button><button class="outline-button" id="keep-booking">Keep my stay</button></div>`,
        );
        dialog.querySelector("#keep-booking").onclick = () => detail(id);
        dialog.querySelector("#confirm-cancel").onclick = () =>
          run(async () => {
            const b = state.bookings.find((b) => b.id === id);
            await api("booking-action", {
              id,
              action: "cancel",
              expectedVersion: b.version,
            });
            await refresh();
            render();
            detail(id);
            toast("Reservation cancelled. The rooms are available again.");
          });
      }),
  );
}
function extendPage() {
  if (hostRoute() && state.actor?.role === "host" && hostTab === "inventory") {
    const box = document.createElement("section");
    box.className = "paper";
    box.innerHTML =
      "<h2>Room handover</h2><p>After departure, mark rooms ready once cleaning is complete. This controls check-in, not future room sales.</p>" +
      state.units
        .filter((u) => u.active)
        .map(
          (u) =>
            `<p>${esc(u.name)} · ${u.ready === false ? "Needs cleaning" : "Ready"} <button class="outline-button" data-ready-unit="${u.id}">${u.ready === false ? "Mark ready" : "Needs cleaning"}</button></p>`,
        )
        .join("");
    document.querySelector(".studio-main").append(box);
    box.querySelectorAll("[data-ready-unit]").forEach(
      (el) =>
        (el.onclick = () =>
          run(async () => {
            const u = state.units.find((u) => u.id === el.dataset.readyUnit);
            await api("readiness", {
              id: u.id,
              expectedVersion: u.version,
              ready: u.ready === false,
            });
            await refresh();
            render();
          })),
    );
  }

  if (state.nextCursor && !hostRoute()) {
    const more = document.createElement("button");
    more.className = "outline-button";
    more.textContent = "Load more reservations";
    more.onclick = () =>
      run(async () => {
        const next = await bookingApi("state", undefined, undefined, {
          admin: hostRoute(),
          start: calendarStart,
          cursor: state.nextCursor,
        });
        const rows = new Map(
          [...state.bookings, ...next.bookings].map((b) => [b.id, b]),
        );
        state = { ...next, bookings: [...rows.values()] };
        render();
      });
    document.querySelector("#main")?.append(more);
  }

  if (!hostRoute() || state.actor?.role !== "host") return;
  const header = document.querySelector(".studio-header");
  if (header) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "text-button";
    b.textContent = "Refresh workspace ↻";
    b.onclick = () =>
      run(async () => {
        if (
          app.querySelector("form") &&
          !confirm("Reload the workspace? Unsaved form edits will be lost.")
        )
          return;
        await refresh();
        render();
        toast("Workspace refreshed.");
      });
    header.insertBefore(b, header.lastElementChild);
  }
  if (state.actor?.bookingAccess!=="viewer") {
    const b = document.querySelector("#manual-reservation");
    if(!b)return;
    b.type = "button";
    b.className = "button";
    b.textContent = "+ Add booking";
    b.id = "manual-reservation";
    b.onclick = ()=>{const identity=state.actor.id;openManualBooking({identity,units:state.units,call:async(operation,input,key)=>{if(auth.currentUser?.uid!==identity)throw{code:'SESSION_CHANGED'};return bookingApi('platform',{operation,input},key);},onBooked:async booked=>{await refresh();render();if(!state.bookings.some(b=>b.id===booked.id))state.bookings.push(booked);detail(booked.id);toast('Booking confirmed. Check Email updates for delivery.');}});};

  }
}
async function showCommunications(b){
  const c=await api("communications",{id:b.id});
  const labels={queued:"Queued",sending:"Sending",retry:"Retry pending",accepted:"Accepted by email service",delivered:"Delivered to recipient mail server",bounced:"Delivery bounced",complained:"Reported as spam",failed:"Sending failed",suppressed:"Not sent after booking changed",needs_reconciliation:"Host review needed",delayed:"Delivery delayed"};
  open(`<p class="eyebrow">YOUR BOOKING UPDATES</p><h2>Email updates & invoice</h2><p>${esc(b.reference)}</p><div class="email-updates">${c.notifications.length?c.notifications.map(j=>`<article class="paper"><h3>${esc(pretty(j.channel))}</h3><p>${esc(labels[j.status]||"Status unavailable")}</p>${j.retryAllowed?`<button class="outline-button" data-retry-mail="${esc(j.id)}" data-version="${j.version}">Retry failed email</button>`:""}</article>`).join(""):"<p>No email updates have been queued for this booking.</p>"}</div>${c.invoice?`<section class="paper"><h3>${esc(c.invoice.number)}</h3><p>${c.invoice.test?"TEST DOCUMENT — DO NOT PAY · ":""}${esc(pretty(c.invoice.status))}</p><p>Amount payable: ${money(c.invoice.balanceDue)}</p>${!["void","superseded"].includes(c.invoice.status)?'<button class="button" id="download-invoice">Download invoice PDF</button>':"<p>This invoice is no longer payable.</p>"}</section>`:"<p>An invoice is issued after host confirmation.</p>"}<button class="text-button" id="back-to-booking">Back to booking</button>`);
  dialog.querySelector("#back-to-booking").onclick=()=>detail(b.id);
  dialog.querySelector("#download-invoice")?.addEventListener("click",()=>run(async()=>{const file=await api("invoice-download",{id:b.id});const bytes=Uint8Array.from(atob(file.contentBase64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"})),a=document.createElement("a");a.href=url;a.download=file.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}));
  dialog.querySelectorAll("[data-retry-mail]").forEach(el=>el.onclick=()=>run(async()=>{await api("email-resend",{id:b.id,jobId:el.dataset.retryMail,expectedVersion:Number(el.dataset.version)});await showCommunications(b);}));
}
function extendDetail() {
  if (!dialog.querySelector(".detail-dates")) return;
  const b = state.bookings.find((b) => b.id === dialog.dataset.detailId);
  if (b?.kind === "event" && !b.pricingVersion && b.status === "pending_approval") {
    const section = document.createElement("section");
    section.className = "paper";
    section.innerHTML = `<h3>Exclusive event offer</h3><p>${b.quoteAccepted ? "Guest accepted the current host offer. Approval still rechecks exclusivity." : b.total === null ? "A host quote is needed. This enquiry holds no inventory." : "This host offer needs guest acceptance before approval."}</p>`;
    if (state.actor?.role === "host") {
      section.innerHTML += `<form id="event-offer"><label class="check"><input type="checkbox" name="hold" checked>Hold exclusive availability with this offer, until the review deadline (up to 24 hours)</label><label>Event total (₹)<input name="amount" type="number" min="100" max="1000000" value="${b.total === null ? "" : b.total / 100}" required></label><button class="outline-button">Send host offer</button></form>`;
      section.querySelector("form").onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget),
          amount = Math.round(Number(formData.get("amount")) * 100);
        run(async () => {
          await api("booking-action", {
            id: b.id,
            expectedVersion: b.version,
            action: "offer_event",
            amount,
            ...(formData.get("hold") ? { holdHours: 24 } : {}),
          });
          await refresh();
          render();
          detail(b.id);
        });
      };
    } else if (b.total !== null && !b.quoteAccepted) {
      const accept = document.createElement("button");
      accept.className = "button";
      accept.textContent = "Accept " + money(b.total) + " host offer";
      accept.onclick = () =>
        run(async () => {
          await api("booking-action", {
            id: b.id,
            expectedVersion: b.version,
            action: "accept_event",
          });
          await refresh();
          render();
          detail(b.id);
        });
      section.append(accept);
    }
    dialog.querySelector(".detail-actions")?.before(section);
  }
  if (
    b?.kind === "individual" &&
    state.actor?.role === "host" &&
    ["pending_approval", "confirmed"].includes(b.status)
  ) {
    const form = document.createElement("form");
    form.className = "paper";
    form.innerHTML =
      "<h3>Assign shared sleeping places</h3><p>Select eligible rooms. This does not make the rooms private.</p>" +
      state.units
        .filter((u) => u.active)
        .map(
          (u) =>
            `<label class="check"><input type="checkbox" name="unit" value="${u.id}" ${b.units.includes(u.id) ? "checked" : ""}>${esc(u.name)}</label>`,
        )
        .join("") +
      '<button class="outline-button">Update allocation</button>';
    form.onsubmit = (e) => {
      e.preventDefault();
      const units = new FormData(form).getAll("unit");
      run(async () => {
        await api("booking-action", {
          id: b.id,
          expectedVersion: b.version,
          action: "assign_rooms",
          units,
        });
        await refresh();
        render();
        detail(b.id);
      });
    };
    dialog.querySelector(".detail-actions")?.before(form);
  }

  if (!b) return;
  if(emailEnabled() || b.invoiceId){
    const communications=document.createElement("button");communications.type="button";communications.className="outline-button";communications.textContent="Email updates & invoice";
    communications.onclick=()=>run(()=>showCommunications(b));dialog.querySelector(".detail-actions")?.append(communications);
  }
  if (state.actor.role === "host" || b.owner === state.actor.id) {
    const contact = document.createElement("button");
    contact.type = "button";
    contact.className = "outline-button";
    contact.textContent =
      state.actor.role === "host" ? "Guest contact" : "Booking contact details";
    contact.onclick = () =>
      run(async () => {
        const person = await api("guest-contact", { id: b.id });
        open(
          `<p class="eyebrow">PRIVATE BOOKING CONTACT</p><h2>${esc(person.name)}</h2><p data-dt-mask>${esc(person.email || "No contact address available.")}</p><p data-dt-mask>${esc(person.phone || "No phone number was recorded for this older booking.")}</p><p class="form-note">Use only to arrange this guest’s stay. ${emailEnabled() ? "Booking email status is available in Email updates." : "Automated email is not enabled."}</p>`,
        );
      });
    dialog.querySelector(".detail-actions").append(contact);
  }
  if (b.changeRequest) {
    const panel = document.createElement("div");
    panel.className = "approval-note";
    panel.innerHTML = `<strong>Date change awaiting host review</strong><p>${format(b.changeRequest.arrival)} — ${format(b.changeRequest.departure)} · ${b.changeRequest.guests} guests · ${money(b.changeRequest.total)}</p><p>Your original reservation remains in place. New dates are allocated only if the host approves.</p>`;
    dialog.querySelector(".detail-actions").before(panel);
    if (state.actor.role === "host") {
      for (const [action, label] of [
        ["approve_change", "Approve new dates"],
        ["decline_change", "Keep original dates"],
      ]) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "outline-button";
        el.textContent = label;
        el.onclick = () =>
          run(async () => {
            await api("booking-action", {
              id: b.id,
              expectedVersion: b.version,
              action,
            });
            await refresh();
            render();
            detail(b.id);
            toast("Date-change request updated.");
          });
        dialog.querySelector(".detail-actions").prepend(el);
      }
    }
  }
  if (
    state.actor.role === "guest" &&
    ["pending_approval", "confirmed"].includes(b.status)
  ) {
    const actions = dialog.querySelector(".detail-actions");
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "outline-button";
    edit.textContent = "Edit private request";
    edit.onclick = () => {
      open(
        `<p class="eyebrow">A NOTE TO YOUR HOSTS</p><h2>Make yourself at home.</h2><form id="edit-note"><label>Private request<textarea name="note" maxlength="1000" rows="5">${esc(b.note)}</textarea></label><p class="form-note">Requests are subject to host confirmation. Please leave out sensitive personal information.</p><button class="button full" type="submit">Save request</button></form>`,
      );
      dialog.querySelector("#edit-note").onsubmit = (e) => {
        e.preventDefault();
        run(async () => {
          await api("note", {
            id: b.id,
            expectedVersion: b.version,
            note: new FormData(e.currentTarget).get("note"),
          });
          await refresh();
          render();
          detail(b.id);
          toast("Your note has been saved.");
        });
      };
    };
    actions.prepend(edit);
    if (b.status === "confirmed" && b.kind !== "event") {
      const change = document.createElement("button");
      change.type = "button";
      change.className = "outline-button";
      change.textContent = "Request new dates";
      change.onclick = () => changeDates(b);
      actions.prepend(change);
    }
  }
}
function changeDates(b) {
  open(
    `<p class="eyebrow">A LITTLE CHANGE OF PLANS</p><h2>Find a new time.</h2><p>Your current rooms stay reserved while the host reviews your request. New dates are checked again at approval.</p><form id="change-form"><div class="two-fields"><label>New arrival<input name="arrival" type="date" min="${day(1)}" value="${b.arrival}" required></label><label>New departure<input name="departure" type="date" value="${b.departure}" required></label></div><label>Guests<input name="guests" type="number" min="1" max="200" value="${b.guests}" ${b.kind ? "readonly" : ""} required></label><button class="button full" type="submit">Review new dates →</button></form>`,
  );
  dialog.querySelector("#change-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(async () => {
      const q = await api("change-quote", {
        id: b.id,
        expectedVersion: b.version,
        arrival: f.get("arrival"),
        departure: ["day", "event"].includes(b.kind)
          ? add(f.get("arrival"), 1)
          : f.get("departure"),
        guests: Number(f.get("guests")),
        ...(b.kind
          ? { kind: b.kind, adults: b.adults, childrenAges: b.childrenAges }
          : {}),
        promo: b.promo,
      });
      open(
        `<p class="eyebrow">REVIEW YOUR CHANGE</p><h2>A new little chapter.</h2><p>${format(q.arrival)} — ${format(endDateOf(q))} · ${q.guests} guests</p><h3>${money(q.total)} stay total</h3><p>Same rooms. The host must approve the new dates and price. Your original booking stays valid until then.</p><button class="button full" id="send-change">Send change request →</button>`,
      );
      dialog.querySelector("#send-change").onclick = () =>
        run(async () => {
          await api("change-request", {
            id: b.id,
            expectedVersion: b.version,
            quoteId: q.id,
          });
          await refresh();
          render();
          detail(b.id);
          toast("Your date-change request is with the host.");
        });
    });
  };
}

function readDates(form) {
  const f = new FormData(form);
  search.arrival = f.get("arrival");
  search.departure =
    search.kind === "event"
      ? add(f.get("eventEnd"), 1)
      : shortVisit()
        ? add(search.arrival, 1)
        : f.get("departure");
  search.adults = Number(f.get("adults"));
  const count = Number(f.get("childCount") || 0),
    ages = f.getAll("childAge").map((x) => (x === "" ? null : Number(x)));
  search.childrenAges = Array.from(
    { length: count },
    (_, i) => ages[i] ?? null,
  );
  search.guests = search.adults + count;
}
function bind() {
  const section=document.querySelector('[data-host-section]');if(section)section.onchange=()=>{hostTab=section.value;render();document.querySelector('#main')?.focus();window.scrollTo(0,0);};
  for (const [id, stepName] of [["search-form", "dates"], ["request-form", "contact"], ["profile-form", "profile"]]) {
    let invalidReported = false;
    document.getElementById(id)?.addEventListener("invalid", () => { if (!invalidReported) { invalidReported = true; journeyStep(stepName, "failed", search.kind); queueMicrotask(() => {invalidReported = false;}); } }, true);
  }
  document.querySelectorAll('[name="bookingKind"]').forEach(
    (el) =>
      (el.onchange = () => {
        const oldShort = shortVisit();
        search.kind = el.value;
        journeyStep("plan", "selected", search.kind);
        if (shortVisit()) search.departure = add(search.arrival, 1);
        else if (oldShort) search.departure = add(search.arrival, 2);
        if (search.kind === "individual") search.childrenAges = [];
        search.guests = search.adults + search.childrenAges.length;
        selected = [];
        quote = null;
        picking = "arrival";
        render();
        document
          .querySelector(`[name="bookingKind"][value="${search.kind}"]`)
          ?.focus({ preventScroll: true });
      }),
  );
  document.querySelector("#account")?.addEventListener("click", () => {
    if (!state.actor) {
      login();
      return;
    }
    open(
      `<p class="eyebrow">YOUR AROHA ACCOUNT</p><h2>${esc(state.actor.name.split(" ·")[0])}</h2><p>You are signed in with Google. Your bookings are private to you and authorised hosts.</p><button class="button" id="account-logout">Sign out of Google account</button>`,
    );
    dialog.querySelector("#account-logout").onclick = () =>
      run(async () => {
        await api("logout", {});
        await refresh();
        closeDialog();
        render();
      });
  });
  document.querySelectorAll("[data-login]").forEach((b) => (b.onclick = login));
  document.querySelector("#switch-guest")?.addEventListener("click", login);
  document.querySelector("#host-login")?.addEventListener("click", () =>
    run(async () => {
      await api("session", {});
      await refresh();
      render();
    }),
  );
  document.querySelector("#logout")?.addEventListener("click", () =>
    run(async () => {
      await api("logout", {});
      await refresh();
      render();
    }),
  );
  document.querySelectorAll("[data-month]").forEach(
    (b) =>
      (b.onclick = () => {
        const d = new Date(month + "-01T12:00:00Z");
        d.setUTCMonth(d.getUTCMonth() + Number(b.dataset.month));
        month = d.toISOString().slice(0, 7);
        const direction = Number(b.dataset.month);
        render();
        playMotion(
          "calendar",
          document.querySelector(".month-grid"),
          [
            { opacity: 0.35, transform: `translateX(${direction * 8}px)` },
            { opacity: 1, transform: "translateX(0)" },
          ],
          160,
        );
      }),
  );
  document.querySelectorAll("[data-date]").forEach(
    (b) =>
      (b.onclick = () => {
        const d = b.dataset.date;
        if (search.kind === "event") {
          if (picking === "arrival") {
            search.arrival = d;
            if (search.departure <= d) search.departure = add(d, 1);
            picking = "departure";
          } else if (d < search.arrival) {
            search.arrival = d;
            search.departure = add(d, 1);
          } else {
            search.departure = add(d, 1);
            picking = "arrival";
          }
          render();
          return;
        }
        if (shortVisit()) {
          search.arrival = d;
          search.departure = add(d, 1);
          picking = "arrival";
          render();
          return;
        }
        if (picking === "arrival") {
          search.arrival = d;
          if (search.departure <= d) search.departure = add(d, 2);
          picking = "departure";
        } else {
          if (d <= search.arrival) {
            search.arrival = d;
            search.departure = add(d, 2);
          } else {
            search.departure = d;
            picking = "arrival";
          }
        }
        render();
      }),
  );
  document.querySelector("#search-form")?.addEventListener("change", (e) => {
    readDates(e.currentTarget);
    if (e.target.name === "childCount") {
      render();
      document
        .querySelector('[name="childAge"], [name="childCount"]')
        ?.focus({ preventScroll: true });
      return;
    }
    const departure = e.currentTarget.querySelector('[name="departure"]');
    if (departure) departure.min = add(search.arrival, 1);
    const eventEnd = e.currentTarget.querySelector('[name="eventEnd"]');
    if (eventEnd) eventEnd.min = search.arrival;
    document.querySelectorAll("[data-date]").forEach((cell) => {
      const d = cell.dataset.date,
        endpoint =
          d === search.arrival || (!shortVisit() && d === calendarEnd());
      cell.classList.toggle("endpoint", endpoint);
      cell.classList.toggle(
        "in-range",
        !shortVisit() && d > search.arrival && d < calendarEnd(),
      );
      cell.setAttribute("aria-pressed", String(endpoint));
      cell.setAttribute(
        "aria-label",
        format(d, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }) +
          (d === search.arrival
            ? search.kind === "event" ? ", start" : ", arrival"
            : d === calendarEnd()
              ? search.kind === "event" ? ", end" : ", departure"
              : ""),
      );
    });
  });
  document.querySelector("#search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    readDates(e.currentTarget);
    journeyStep("dates", "attempted", search.kind);
    if (!state.actor) {
      login();
      return;
    }

    run(async () => {
      available = await api("availability", search);
      if (search.kind !== "private") {
        quote = await api("quote", { ...search, units: [], promo });
        step = 3;
      } else step = 2;
      render();
      document.querySelector("#main").focus();
      window.scrollTo(0, 0);
    });
  });
  document.querySelector("#back-step")?.addEventListener("click", () => {
    if (step === 3) note = document.querySelector("#note")?.value || note;
    step = search.kind === "private" ? step - 1 : 1;
    quote = null;
    render();
    window.scrollTo(0, 0);
  });
  document.querySelectorAll("[data-room]").forEach(
    (b) =>
      (b.onclick = () => {
        journeyStep("rooms", "selected", search.kind);
        const id = b.dataset.room;
        selected = selected.includes(id)
          ? selected.filter((x) => x !== id)
          : [...selected, id];
        render();
        document.querySelector(`[data-room="${id}"]`)?.focus();
      }),
  );
  document.querySelector("#review")?.addEventListener("click", () =>
    run(async () => {
      quote = await api("quote", { ...search, units: selected, promo });
      step = 3;
      render();
      window.scrollTo(0, 0);
      document.querySelector("#main").focus();
    }),
  );
  document.querySelector("#apply-promo")?.addEventListener("click", () =>
    run(async () => {
      note = document.querySelector("#note").value;
      const nextPromo = document.querySelector("#promo").value.trim();
      const next = await api("quote", {
        ...search,
        units: selected,
        promo: nextPromo,
      });
      promo = nextPromo;
      quote = next;
      render();
      toast("Your stay total has been updated.");
    }),
  );
  document.querySelector("#request-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const body = {
      quoteId: quote.id,
      note: document.querySelector("#note").value,
      contact: {
        name: document.querySelector('[name="contactName"]').value,
        phone: document.querySelector('[name="contactPhone"]').value,
      },
    };
    run(async () => {
      journeyStep("contact", "attempted", search.kind);
      if (document.querySelector("#save-booking-profile")?.checked) {
        await api("profile", {
          ...body.contact,
          expectedVersion: state.profile?.version || 0,
        });
        await refresh();
      }
      journeyStep("submit", "attempted", search.kind);
      const b = await api("create", body, quote.id);
      journeyStep("contact", "succeeded", search.kind);
      contactDraft = undefined;
      await refresh();
      step = 1;
      selected = [];
      quote = null;
      note = "";
      promo = "";
      location.hash = "visits";
      render();
      open(
        `<div class="success-mark">✓</div><p class="eyebrow">A LITTLE SOMETHING TO LOOK FORWARD TO</p><h2>Your request is with your hosts.</h2><p>${esc(b.reference)} · ${format(b.arrival)} — ${format(endDateOf(b))}</p>${badge("pending_approval")}<p>${b.kind === "event" && !b.pricingVersion ? "Your event enquiry does not hold the retreat. A host offer needs your acceptance and approval." : "Your requested places are held until the host review deadline."} Follow the response in Your visits.</p><p class="form-note">${b.kind === "event" && !b.pricingVersion ? "No exclusive hold is made by an enquiry." : "This request reserves inventory until the review deadline."} Your host must approve it. ${emailEnabled() ? "An acknowledgement email has been queued. You can check its delivery status in your booking." : "No email has been sent."}</p><button class="button full" id="see-request">See my request →</button>`,
      );
      dialog.querySelector("#see-request").onclick = () => detail(b.id);
    });
  });
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        bookingFilter = b.dataset.filter;
        render();
      }),
  );
  document.querySelectorAll("[data-booking]").forEach(
    (b) =>
      (b.onclick = () =>
        run(async () => {
          if (!state.bookings.some((x) => x.id === b.dataset.booking))
            state.bookings.push(
              await api("reservation-detail", { id: b.dataset.booking }),
            );
          detail(b.dataset.booking);
        })),
  );
  document.querySelectorAll("[data-host-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        hostTab = b.dataset.hostTab;
        render();
        document.querySelector("#main")?.focus();
        window.scrollTo(0, 0);
      }),
  );
  document.querySelector("#calendar-prev")?.addEventListener("click", () => {
    calendarStart = add(calendarStart, -7);
    run(async () => {
      await refresh();
      render();
    });
  });
  document.querySelector("#calendar-next")?.addEventListener("click", () => {
    calendarStart = add(calendarStart, 7);
    run(async () => {
      await refresh();
      render();
    });
  });
  document.querySelector("#calendar-today")?.addEventListener("click", () => {
    calendarStart = day();
    run(async () => {
      await refresh();
      render();
    });
  });
  document.querySelectorAll("[data-unit-form]").forEach(
    (form) =>
      (form.onsubmit = (e) => {
        e.preventDefault();
        const f = new FormData(form),
          u = state.units.find((u) => u.id === form.dataset.unitForm);
        run(async () => {
          await api("unit", {
            id: u.id,
            name: f.get("name"),
            verified: f.get("verified") === "on",
            expectedVersion: u.version,
            capacity: Number(f.get("capacity")),
            rate:
              f.get("rate") === ""
                ? null
                : Math.round(Number(f.get("rate")) * 100),
            active: f.get("active") === "on",
          });
          await refresh();
          render();
          toast("Room settings saved.");
        });
      }),
  );
  document.querySelector("#settings-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      body = {
        expectedVersion: state.settings.version,
        paused: f.get("paused") === "on",
      };
    for (const field of [
      "capacity",
      "approvalHours",
      "cancelHours",
      "friendAt",
      "familyAt",
      "friendDiscount",
      "familyDiscount",
    ])
      body[field] = Number(f.get(field));
    body.products = { ...policy() };
    for (const k of Object.keys(body.products)) {
      const v = f.get("product-" + k);
      if (v !== null)
        body.products[k] = k.endsWith("Rate")
          ? Math.round(Number(v) * 100)
          : k.endsWith("Adults")
            ? Number(v)
            : v;
    }
    run(async () => {
      await api("settings", body);
      await refresh();
      render();
      toast("Booking policies saved.");
    });
  });
  document.querySelectorAll("[data-toggle-promo]").forEach(
    (b) =>
      (b.onclick = () =>
        run(async () => {
          const p = state.promos.find((p) => p.id === b.dataset.togglePromo);
          await api("promo", {
            code: p.code,
            expectedVersion: p.version,
            active: !p.active,
          });
          await refresh();
          render();
          toast("Offer updated.");
        })),
  );
  document.querySelector("#new-promo")?.addEventListener("click", () => {
    open(
      `<p class="eyebrow">AN INVITATION TO SLOW DOWN</p><h2>Create an offer.</h2><form id="promo-form"><label>Invitation code<div class="promo-field"><input name="code" id="generated-code" value="AROHA${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}" pattern="[A-Za-z0-9]{4,24}" maxlength="24" required><button class="outline-button" type="button" id="generate-code">Generate</button></div></label><div class="two-fields"><label>Offer type<select name="kind"><option value="percent">Percentage off</option><option value="fixed">Fixed amount (₹)</option></select></label><label>Discount value<input type="number" name="value" min="1" max="100000" value="10" required></label><label>Valid from<input type="date" name="from" value="${day()}" required></label><label>Valid until<input type="date" name="until" value="${day(90)}" required></label><label>Total redemption limit<input type="number" name="maxUses" value="20" min="1" max="100" required></label></div><button class="button full" type="submit">Create invitation code →</button></form>`,
    );
    dialog.querySelector("#generate-code").onclick = () =>
      (dialog.querySelector("#generated-code").value =
        "AROHA" +
        crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase());
    dialog.querySelector("#promo-form").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget),
        kind = f.get("kind");
      run(async () => {
        await api("promo", {
          code: f.get("code"),
          kind,
          value: Number(f.get("value")) * (kind === "fixed" ? 100 : 1),
          from: f.get("from"),
          until: f.get("until"),
          maxUses: Number(f.get("maxUses")),
        });
        await refresh();
        closeDialog();
        render();
        toast("Invitation code created.");
      });
    };
  });
  document.querySelectorAll("[data-block-unit]").forEach(
    (b) =>
      (b.onclick = () => {
        open(
          `<p class="eyebrow">CARE FOR YOUR SPACES</p><h2>Block a room.</h2><p>${esc(state.units.find((u) => u.id === b.dataset.blockUnit)?.name || "Entire retreat")}</p><form id="block-form"><div class="two-fields"><label>From<input name="arrival" type="date" min="${day(1)}" value="${b.dataset.blockDate}" required></label><label>Until (exclusive)<input name="departure" type="date" value="${add(b.dataset.blockDate, 1)}" required></label></div><label>Reason<input name="reason" maxlength="120" placeholder="Maintenance, host use…" required></label><button class="button full" type="submit">Block room →</button></form>`,
        );
        dialog.querySelector("#block-form").onsubmit = (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(async () => {
            await api("block", {
              unitId: b.dataset.blockUnit,
              arrival: f.get("arrival"),
              departure: f.get("departure"),
              reason: f.get("reason"),
            });
            await refresh();
            closeDialog();
            render();
            toast("Maintenance block saved.");
          });
        };
      }),
  );
  document.querySelectorAll("[data-unblock]").forEach(
    (b) =>
      (b.onclick = () => {
        open(
          `<p class="eyebrow">ROOM AVAILABILITY</p><h2>Release this maintenance block?</h2><p>The room will accept requests again for these dates.</p><button class="button" id="release-block">Release block</button>`,
        );
        dialog.querySelector("#release-block").onclick = () =>
          run(async () => {
            await api("unblock", { id: b.dataset.unblock });
            await refresh();
            closeDialog();
            render();
            toast("Room block released.");
          });
      }),
  );
  const filter = () => {
    const q = document.querySelector("#reservation-search").value.toLowerCase(),
      status = document.querySelector("#reservation-status").value;
    document.querySelector("#reservation-results").innerHTML =
      state.bookings
        .filter(
          (b) =>
            (status === "all" || b.status === status) &&
            `${b.reference} ${b.unitNames.join(" ")} ${b.guestName || state.users.find((u) => u.id === b.owner)?.name || ""}`
              .toLowerCase()
              .includes(q),
        )
        .map((b) => bookingCard(b, true))
        .join("") || '<div class="paper">No matching reservations.</div>';
    document.querySelectorAll("[data-booking]").forEach(
      (b) =>
        (b.onclick = () =>
          run(async () => {
            if (!state.bookings.some((x) => x.id === b.dataset.booking))
              state.bookings.push(
                await api("reservation-detail", { id: b.dataset.booking }),
              );
            detail(b.dataset.booking);
          })),
    );
  };
  document
    .querySelector("#reservation-search")
    ?.addEventListener("input", filter);
  document
    .querySelector("#reservation-status")
    ?.addEventListener("change", filter);
}
window.addEventListener("hashchange", () => {
  if (location.hash === "#visits") {
    run(async () => {
      await refresh();
      render();
      window.scrollTo(0, 0);
    });
    return;
  }
  if (location.hash === "#plan") {
    step = 1;
    quote = null;
  }
  render();
  window.scrollTo(0, 0);
});
window.addEventListener("pageshow", () => {
  if (state && !dialog.open)
    run(async () => {
      await refresh();
      render();
    });
});
// Refresh on returning to the tab without replacing a form the reviewer is editing.
window.addEventListener("focus", () => {
  if (state && !dialog.open)
    run(async () => {
      await refresh();
      if (
        (hostRoute() && !app.querySelector("form")) ||
        (!hostRoute() && location.hash === "#visits")
      )
        render();
    });
});
try {
  await refresh();
  render();
} catch (e) {
  app.innerHTML = `<main class="empty"><h1>The booking service is taking a moment.</h1><p>${esc(e.message)}</p><a class="button" href="/book/">Try again</a></main>`;
}

if (location.pathname.startsWith("/admin/modules/")) {
  document.documentElement.dataset.embedded = "true";
  window.addEventListener("message", (e) => {
    if (
      e.origin === location.origin &&
      e.source === parent &&
      e.data?.type === "aroha-studio-visibility" &&
      !e.data.visible
    )
      stopMotion();
  });
}
