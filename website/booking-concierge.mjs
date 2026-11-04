import { recommendPrivate } from "./booking-options.mjs";
export async function startConcierge({
  api,
  journeyStep = () => {},
  getAtmosphere = () => "day",
  setAtmosphere = () => {},
  watchAtmosphere = () => () => {},
  getIdentity,
  expectedEnvironment = "production",
}) {
  if (!["production", "pre-prod"].includes(expectedEnvironment))
    throw { code: "WRONG_ENVIRONMENT" };
  const today = () =>
    new Date(Date.now() + 19800000).toISOString().slice(0, 10);
  const add = (d, n) =>
    new Date(Date.parse(d + "T00:00:00Z") + n * 86400000)
      .toISOString()
      .slice(0, 10);
  document.querySelector("#app").innerHTML =
    '<header class="header"><a href="#plan" id="home" aria-label="Plan a visit at Aroha"><img id="logo" src="/assets/brand/logo-forest.svg" alt="Aroha Retreat"></a><nav aria-label="Your account"><button id="help">Need a hand?</button><button id="visits">Your visits</button><button id="profile">Profile</button><button id="atmosphere" aria-pressed="false">Sunset</button><button id="account" disabled>Opening…</button></nav></header><aside id="pending-request"></aside><main id="main" tabindex="-1"><div class="loading" role="status">Opening your booking portal…</div></main><div id="mobile-action"></div><div id="toast" role="status" aria-live="polite"></div><dialog id="sheet" aria-label="Booking details"><button class="close" aria-label="Close dialog">×</button><div id="sheet-content"></div></dialog><footer><img src="/assets/brand/logo-forest.svg" alt=""><span>Small enough to feel personal.<br>Aroha Retreat · Kanakapura</span><a href="/" >Explore Aroha ↗</a><a href="/admin/#bookings">Host Studio ↗</a></footer>';
  const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)];
  const S = {
    view: "find",
    kind: "stay",
    arrival: add(today(), 3),
    departure: add(today(), 4),
    lastDay: add(today(), 4),
    hasDates: false,
    adults: 2,
    ages: [],
    selected: null,
    data: null,
    name: "",
    email: "",
    phone: "",
    notes: "",
    occasion: "",
    error: "",
    busy: false,
    record: null,
    custom: false,
    draftUnits: [],
    roomDirty: false,
    account: null,
    filter: "upcoming",
    promo: "",
    submitKey: null,
    requestBody: null,
    submitting: false,
  };
  let identityGeneration = 0;
  const transport = api;
  api = async (...args) => {
    const op = args[0],
      privateCall = !["state", "public", "session", "logout"].includes(op),
      uid = S.account?.actor?.id,
      generation = identityGeneration;
    const current = () => (getIdentity ? getIdentity() : S.account?.actor?.id);
    if (privateCall && (!uid || uid !== current()))
      throw { code: "SESSION_CHANGED" };
    const result = await transport(...args);
    if (privateCall && (generation !== identityGeneration || uid !== current()))
      throw { code: "SESSION_CHANGED" };
    if (op === "state" && (generation !== identityGeneration ||
      (getIdentity && (result.actor?.id || null) !== (getIdentity() || null))))
      throw { code: "SESSION_CHANGED" };
    return result;
  };
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const cash = (n) =>
    n === null
      ? "Host quote"
      : "₹" + (n / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const dateLabel = (d) =>
    d
      ? new Intl.DateTimeFormat("en-IN", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }).format(new Date(d + "T00:00:00Z"))
      : "Choose a date";
  const nights = () =>
    Math.round((Date.parse(S.departure) - Date.parse(S.arrival)) / 86400000);
  const tripDates = () =>
    !S.hasDates
      ? "Choose dates"
      : S.kind === "day"
        ? dateLabel(S.arrival)
        : dateLabel(S.arrival) +
          " – " +
          dateLabel(S.kind === "event" ? S.lastDay : S.departure);
  const party = () =>
    `${S.adults} adult${S.adults === 1 ? "" : "s"}${S.ages.length ? " · " + S.ages.length + " child" + (S.ages.length === 1 ? "" : "ren") : ""}`;
  const kindLabel = () =>
    S.kind === "day"
      ? "Day outing"
      : S.kind === "event"
        ? "Exclusive retreat"
        : "Overnight stay";
  const offer = () =>
    S.kind === "stay"
      ? S.selected === "private"
        ? S.data?.private
        : S.data?.shared
      : S.data?.offer;
  const primary = (label, act, disabled = false) =>
    `<button class="primary" data-act="${act}" ${disabled ? "disabled" : ""}>${label}</button>`;
  function toast(t) {
    $("#toast").textContent = t;
    $("#toast").classList.add("show");
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(
      () => $("#toast").classList.remove("show"),
      4000,
    );
  }
  function view(v) {
    if (v === "find" && S.busy) {
      requestVersion++;
      S.busy = false;
    }
    if (S.submissionUnknown && ["find", "options"].includes(v)) {
      toast(
        "A request response is unresolved. Check Your visits or retry the same request before planning another.",
      );
      return;
    }
    S.view = v;
    const hash =
      v === "visits" || v === "confirmation"
        ? "#visits"
        : v === "profile"
          ? "#profile"
          : "#plan";
    history.replaceState(null, "", hash);
    journeyStep(
      v === "find"
        ? "plan"
        : v === "options"
          ? "rooms"
          : v === "confirmation" || v === "visits"
            ? "visits"
            : v === "profile"
              ? "profile"
              : "review",
      "viewed",
      apiKind(),
    );
    render();
    $("#main").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function progress(n) {
    return `<nav class="progress" aria-label="Booking progress"><button data-act="find" ${n === 0 ? 'aria-current="step"' : ""}>01 · Dates & guests</button><i></i><button data-act="options" ${n === 1 ? 'aria-current="step"' : ""} ${n < 1 ? "disabled" : ""}>02 · Your visit</button><i></i><span ${n === 2 ? 'aria-current="step"' : ""}>03 · Review request</span></nav>`;
  }
  function find() {
    return `<section class="landing reveal"><div class="welcome"><div class="welcome-copy"><span class="eyebrow">YOUR TIME AT AROHA</span><h1>Make time<br>for yourself.</h1><p>Start with the people and the dates. We’ll help you find the right way to stay.</p>${S.account?.settings.paused ? '<p class="disabled-notice">Your hosts have paused new requests. Your existing visits remain accessible.</p>' : ""}${S.error ? '<p class="form-error" role="alert">' + esc(S.error) + "</p>" : ""}<div class="planner"><div class="intent" aria-label="Kind of visit">${[
      ["stay", "Stay overnight"],
      ["day", "Visit for the day"],
      ["event", "The whole retreat"],
    ]
      .map(
        ([id, t]) =>
          `<button data-kind="${id}" aria-pressed="${S.kind === id}">${t}</button>`,
      )
      .join(
        "",
      )}</div><div class="searchfields"><button class="fieldbutton" data-act="dates"><small>${S.kind === "day" ? "Your day" : S.kind === "event" ? "First day → last day" : "Arrival → departure"}</small><strong>${tripDates()}</strong></button><button class="fieldbutton" data-act="guests"><small>Who’s coming?</small><strong>${party()}</strong></button></div>${primary(S.kind === "day" ? "Plan my day →" : S.kind === "event" ? "Plan my gathering →" : "Find my stay →", "search")}<p class="planner-note">${S.kind === "day" ? cash(policy().dayAdultRate) + " / adult · " + cash(policy().dayChildRate) + " / child under 10. Breakfast & lunch included." : S.kind === "event" ? "A personal host quote. Continuous dates, exclusively for your group." : "Individual places from " + cash(policy().individualRate) + ". Private rooms from " + cash(policy().roomRate) + " / night."}</p></div><div class="trust"><span>Host-reviewed requests</span><span>No online payment</span><span>Clear prices before you send</span></div></div><div class="welcome-photo"><img src="/assets/retreat/hero-desktop.webp" alt="A moment around Aroha Retreat"><span>AWAY FROM THE HURRY. CLOSER TO EACH OTHER.</span></div></div><div class="how"><div><b>Tell us your plans.</b><p>Dates and guests. No need to work out rooms yourself.</p></div><div><b>Choose what feels right.</b><p>Compare privacy, space and the complete price.</p></div><div><b>Your hosts take it from here.</b><p>Send a request. Receive confirmation after host review.</p></div></div></section>`;
  }
  function tripbar() {
    return `<div class="tripbar"><div><span>${kindLabel()}</span><button data-act="dates">${tripDates()} · Edit dates</button><button data-act="guests">${party()} · Edit guests</button></div><button data-act="find">Change visit type</button></div>`;
  }
  function bill(q = offer()) {
    if (!q) return "<p>Choose an option to see your total.</p>";
    return `<div class="eyebrow">YOUR VISIT, WITHOUT THE GUESSWORK</div><h3>${S.kind === "event" ? "A personal host quote" : S.selected === "private" ? q.units.length + " private room" + (q.units.length > 1 ? "s" : "") : S.kind === "day" ? "A day at Aroha" : "Individual accommodation"}</h3>${q.lineItems
      .filter((l) => l.amount > 0)
      .map(
        (l) =>
          `<div class="billrow"><span>${esc(l.label)}</span><span>${cash(l.amount)}</span></div>`,
      )
      .join(
        "",
      )}${q.discount ? `<div class="billrow"><span>${esc(q.offer)}</span><span>−${cash(q.discount)}</span></div>` : ""}<div class="billtotal"><span>${q.total === null ? "Price" : "Total for your visit"}</span><strong>${cash(q.total)}</strong></div><p class="detailnote">${S.kind === "event" ? "Your hosts quote the complete date range. Overnight accommodation and special arrangements are agreed separately." : S.kind === "stay" ? nights() + " night" + (nights() > 1 ? "s" : "") + " · Check in " + policy().stayStart + " · check out " + policy().stayEnd + " IST." : "Breakfast & lunch included · " + policy().dayStart + "–" + policy().dayEnd + " IST."}</p><p class="detailnote">No online payment. Your request needs host approval. Prices and availability are rechecked when you send.</p>`;
  }
  function sidebar(review = false) {
    return `<aside class="quote">${bill()}${primary(review ? (S.needsQuote ? "Refresh options →" : S.submissionUnknown ? "Retry same request →" : "Send request →") : S.kind === "event" ? "Review enquiry →" : "Review request →", review ? "submit" : "review", !offer() || S.roomDirty || S.busy)}<p class="detailnote">${review ? "Acknowledgement first. Confirmation follows host review." : "You can edit your plans on the next screen."}</p></aside>`;
  }
  function privateCard(q) {
    const recommended = S.data.recommended === "private",
      selected = S.selected === "private";
    let shared = S.data.shared;
    let reason = S.ages.length
      ? "Children need private rooms. We’ve worked out a suitable room combination for your party."
      : shared && q.total < shared.total
        ? `For your party, private rooms cost ${cash(shared.total - q.total)} less than individual places for this visit.`
        : "Your room is reserved for your party, with up to 2 adults and 2 children per room.";
    return `<article class="offer ${selected ? "selected" : ""}"><div class="offer-top"><div><span class="badge">${S.custom ? "YOUR ROOM CHOICE" : recommended ? "RECOMMENDED FOR YOUR PARTY" : "YOUR OWN SPACE"}</span><h3>${q.units.length === 1 ? "A room of your own." : q.units.length + " rooms, for your people."}</h3><p>${q.units.length === 1 ? "A private room for your party. No shared-room allocation." : "Private rooms together in one request, with one clear total."}</p></div><div class="offerrate"><strong>${cash(q.total)}</strong><small>${nights()} night${nights() > 1 ? "s" : ""} · entire party</small></div></div><ul class="offerlist"><li>${q.units.length} private room${q.units.length > 1 ? "s" : ""}</li><li>${party()}</li><li>Host approval required</li></ul><p>${reason}</p><div class="offer-bottom"><p>${esc(q.unitNames.join(" · "))}<br>Suggested allocation, subject to host approval.</p><button class="secondary" data-select="private">${selected ? "✓ Private stay selected" : "Choose private rooms"}</button></div>${selected ? `<div style="margin-top:17px"><button class="textbutton" data-act="rooms">${S.custom ? "Hide room choices" : "Prefer particular rooms? Choose them yourself"}</button></div>${S.custom ? roomChoices() : ""}` : ""}</article>`;
  }
  function sharedCard(q) {
    let selected = S.selected === "individual";
    return `<article class="offer ${selected ? "selected" : ""}"><div class="offer-top"><div><span class="badge">${S.data.recommended === "individual" ? "RECOMMENDED FOR YOUR PARTY" : "ANOTHER WAY TO STAY"}</span><h3>A place for each of you.</h3><p>${cash(policy().individualRate)} per adult / night. Your hosts allocate the sleeping places; a dedicated room is not promised.</p></div><div class="offerrate"><strong>${cash(q.total)}</strong><small>${nights()} night${nights() > 1 ? "s" : ""} · entire party</small></div></div><ul class="offerlist"><li>${S.adults} adult place${S.adults > 1 ? "s" : ""}</li><li>Host-allocated accommodation</li></ul><div class="offer-bottom"><p>Choose a private room if you want a room exclusively for your party.</p><button class="secondary" data-select="individual">${selected ? "✓ Individual stay selected" : "Choose individual stay"}</button></div></article>`;
  }
  function roomChoices() {
    return `<div class="roomchoices"><p style="font-size:13px">Choose rooms, then update the price. Each room allows up to 2 adults and 2 children under 10.</p>${S.data.roomChoices.map((r) => `<label><span><input type="checkbox" data-room="${r.id}" ${S.draftUnits.includes(r.id) ? "checked" : ""}>${esc(r.name)}</span><small>${r.type === "Room" ? "Main house" : esc(r.type)}</small></label>`).join("")}${S.error ? `<p class="form-error" role="alert">${esc(S.error)}</p>` : ""}<div class="inline-actions">${primary("Update rooms & price", "applyrooms", !S.draftUnits.length || S.busy)}</div></div>`;
  }
  function simpleOffer(q) {
    let day = S.kind === "day";
    return `<article class="offer selected"><span class="badge">${day ? "EVERYONE, IN ONE SIMPLE REQUEST" : "PERSONAL PLANNING WITH YOUR HOSTS"}</span><h3>${day ? "A day outside, together." : "The retreat, just for your people."}</h3><p>${day ? "Arrive from " + policy().dayStart + " IST, enjoy breakfast and lunch, and finish your visit by " + policy().dayEnd + " IST. No room selection needed." : "Your enquiry covers the whole retreat continuously from " + policy().dayStart + " IST on the first day to " + policy().dayEnd + " IST on your last selected day."}</p><ul class="offerlist"><li>${tripDates()}</li><li>${party()}</li><li>${day ? "Breakfast & lunch" : "Continuous date range"}</li></ul><div class="help-line">${day ? "No overnight room is included. Children under 10 are " + cash(policy().dayChildRate) + " each; guests aged 10 and above are " + cash(policy().dayAdultRate) + "." : "An exclusive enquiry does not block the retreat. Your hosts prepare a quote; you accept it before they can approve the booking."}</div>${day ? `<div class="offerrate"><strong>${cash(q.total)}</strong><small>entire party · one day</small></div>` : "<p>Overnight accommodation, meals and special arrangements will be agreed in the quote.</p>"}</article>`;
  }
  function options() {
    if (S.busy)
      return `<div class="wrap">${progress(1)}<div class="loading" role="status">Finding the right fit for your party…</div></div>`;
    if (!S.data?.available) return unavailable();
    let title =
      S.kind === "day"
        ? "Your day, made simple."
        : S.kind === "event"
          ? "A gathering, made personal."
          : "Here’s what fits your plans.";
    let qs = S.data;
    let cards =
      S.kind === "stay"
        ? (qs.recommended === "individual"
            ? [
                qs.shared && sharedCard(qs.shared),
                qs.private && privateCard(qs.private),
              ]
            : [
                qs.private && privateCard(qs.private),
                qs.shared && sharedCard(qs.shared),
              ]
          )
            .filter(Boolean)
            .join("")
        : simpleOffer(qs.offer);
    return `<section class="wrap reveal">${progress(1)}<span class="eyebrow">${S.kind === "stay" ? "OPTIONS FOR YOUR PARTY" : "YOUR VISIT"}</span><h1 style="font-size:42px;margin-top:12px">${title}</h1><p class="lead">${S.kind === "stay" ? "Compare complete prices, not just “from” rates. Your hosts confirm the final allocation." : "One request for everyone. Clear arrangements before you send."}</p>${tripbar()}<div class="split"><div>${cards}${S.ages.length && S.kind === "stay" ? '<p class="help-line">Individual accommodation is not offered for children. Private rooms keep your family together.</p>' : ""}<button class="textbutton" data-act="help">Questions about room sharing, children or arrival?</button></div>${sidebar()}</div></section>`;
  }
  function unavailable() {
    let cap = S.data?.reason === "overnight_limit";
    return `<section class="wrap">${progress(1)}<h1 style="font-size:40px">Let’s find a better fit.</h1>${tripbar()}<div class="empty"><h2>${cap ? "Your group is larger than our overnight capacity." : "These dates don’t have a suitable option."}</h2><p>${cap ? "Aroha currently accommodates up to " + Math.min(policy().nightAdults, S.account.settings.capacity) + " overnight adults. You can plan a day outing or ask about an exclusive retreat; overnight accommodation still needs a separate host agreement." : "Your plans are kept. Try different dates, fewer guests or a different visit type. Availability can change while you plan."}</p><div class="inline-actions">${cap ? primary("Plan a day outing", "switchday") : ""}<button class="secondary" data-act="dates">Choose different dates</button></div></div></section>`;
  }
  function review() {
    return `<section class="wrap reveal">${progress(2)}<span class="eyebrow">YOUR REQUEST, READY FOR A HUMAN WELCOME</span><h1 style="font-size:42px;margin-top:12px">A few details, then over to us.</h1>${tripbar()}<div class="split"><div><section class="reviewpanel"><h3>${S.kind === "event" ? "Your exclusive-retreat enquiry" : S.selected === "private" ? "Your private stay" : S.kind === "day" ? "Your day outing" : "Your individual stay"}</h3><p>${party()} · ${tripDates()}${S.kind === "stay" ? "<br>" + esc(offer().unitNames.join(" · ")) : ""}</p><div class="inline-actions"><button class="textbutton" data-act="options">Change your option</button></div><p class="help-line">${S.kind === "event" ? "Your hosts will prepare a quote. This enquiry is not an exclusive booking or a hold." : "The price is shown in full. Your request is confirmed only after your hosts approve it."}</p></section><section class="reviewpanel"><h3>So we can welcome you.</h3><div class="profile-note"><span>Filled from your guest profile. Edit name and phone for this visit; Google verifies your email.</span></div><form id="contact"><fieldset style="border:0;padding:0;margin:0;min-width:0" ${S.submissionUnknown ? "disabled" : ""}><div class="columns"><label class="field">Your name<input id="name" autocomplete="name" minlength="2" required maxlength="120" value="${esc(S.name)}"></label><label class="field">Phone number<input id="phone" type="tel" autocomplete="tel" placeholder="+91 98765 43210" required maxlength="32" value="${esc(S.phone)}"></label></div><label class="field">Email for your booking updates<input id="email" type="email" autocomplete="email" readonly value="${esc(S.email)}"></label>${S.kind === "event" ? `<label class="field">What are you planning?<select id="occasion"><option value="">Choose an occasion (optional)</option>${["Family gathering", "Celebration", "Team outing", "Something else"].map((t) => `<option ${S.occasion === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>` : ""}<label class="field">Anything you’d like your hosts to know? <small>Optional</small><textarea id="notes" maxlength="${S.kind === "event" ? 950 : 1000}" placeholder="Arrival plans, a celebration, or something that would help us welcome you…">${esc(S.notes)}</textarea></label><label class="checkline"><input id="save-profile" type="checkbox" ${S.saveProfile ? "checked" : ""}>Save name and phone to my profile for future visits</label><p class="planner-note">Your contact number is used by authorised hosts and included in operational booking events in Dynatrace. Names, private notes and child ages are not sent. Profile edits do not change past booking contacts.</p><label class="checkline"><input id="terms" type="checkbox" required ${S.terms ? "checked" : ""}><span>I understand the accommodation, sharing terms and price shown, that host approval is required, and no online payment is collected. Self-service cancellation is available ${cutoff(S.account.settings.cancelHours)}; later cancellations need the host.</span></label></fieldset></form><small>Contact changes apply to this request. Previous booking contacts are not overwritten.</small></section><section class="reviewpanel"><h3>What happens after I send?</h3><p>First, an acknowledgement. Then your hosts review ${S.kind === "event" ? "the scope and prepare a quote for your acceptance" : "the dates and arrangements"}. Confirmation follows host approval. No payment is taken on this page.</p></section>${S.kind !== "event" ? `<div class="reviewpanel"><details><summary>Have an invitation code?</summary><label class="field">Invitation code<input id="promo-code" maxlength="32" value="${esc(S.promo)}"></label><button class="secondary" data-act="applypromo">Apply code</button></details></div>` : ""}${S.error ? `<p class="form-error" role="alert">${esc(S.error)}</p>` : ""}</div>${sidebar(true)}</div></section>`;
  }
  function confirmation() {
    const r = S.record;
    if (!r) return visits();
    const cancelled = ["cancelled", "declined", "expired", "no_show"].includes(
      r.status,
    );
    return `<section class="confirmation reveal"><div class="emblem">${cancelled ? "×" : r.status === "pending_approval" ? "✓" : "⌂"}</div><span class="eyebrow">${esc(r.reference)} · ${esc(statusLabel(r.status))}</span><h1>${cancelled ? "Your plans, updated." : r.status === "pending_approval" ? "Your hosts take it from here." : "Your time at Aroha."}</h1><p>${r.status === "pending_approval" ? (r.kind === "event" ? "Your enquiry is with your hosts. It holds no inventory. A host quote needs your acceptance before approval." : "Your request is awaiting host review. Capacity is held until the review deadline; this is not yet a confirmed booking.") : esc(statusLabel(r.status))}</p><div class="reviewpanel" style="margin-top:25px"><h3>${esc(productLabel(r.kind))}</h3><p>${dateLabel(r.arrival)} – ${dateLabel(r.kind === "event" ? add(r.departure, -1) : r.departure)} · ${r.adults ?? r.guests} adults · ${r.children ?? 0} under 10s</p><p>${esc(r.unitNames?.join(" · ") || "")}</p><div class="billrow"><span>Visit total</span><span>${cash(r.total)}</span></div>${r.note ? '<p style="margin-top:15px">' + esc(r.note) + "</p>" : ""}${r.expiresAt && r.status === "pending_approval" ? '<p style="margin-top:15px">Host review by ' + esc(new Date(r.expiresAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })) + " IST.</p>" : ""}</div>${r.kind === "event" && r.status === "pending_approval" && r.total !== null && !r.quoteAccepted ? `<div class="reviewpanel"><h3>Your host’s offer.</h3><p>${cash(r.total)} for the exclusive date range. Review the host’s arrangements before accepting. Approval still checks exclusivity.</p><div class="inline-actions">${primary("Accept host offer", "acceptoffer")}</div></div>` : ""}${r.changeRequest ? `<div class="reviewpanel"><h3>Date change awaiting host review.</h3><p>${dateLabel(r.changeRequest.arrival)} – ${dateLabel(r.changeRequest.departure)} · ${cash(r.changeRequest.total)}</p><p>Your original booking remains valid until the host approves.</p></div>` : ""}<div class="inline-actions">${["pending_approval", "confirmed"].includes(r.status) ? '<button class="secondary" data-act="changedates">Request date change</button><button class="textbutton" data-act="editnote">Edit private note</button><button class="textbutton" data-act="cancel">Cancel booking</button>' : ""}<button class="secondary" data-act="communications">Email updates & invoice</button><button class="textbutton" data-act="visits">All visits</button></div><small>Self-service cancellation ${cutoff(r.cancelHours ?? S.account.settings.cancelHours)}; contact your host for later cancellations. No online payment is collected.</small></section>`;
  }
  function visits() {
    const a = S.account;
    if (!a.actor)
      return `<section class="wrap"><h1>Your Aroha visits.</h1><p class="lead">Sign in to see your bookings and stay benefits.</p><div class="inline-actions">${primary("Continue with Google", "account")}</div></section>`;
    const t = a.loyalty;
    const rows = a.bookings.filter((b) =>
      S.filter === "upcoming"
        ? ["pending_approval", "confirmed", "checked_in"].includes(b.status)
        : S.filter === "past"
          ? ["completed", "no_show"].includes(b.status)
          : ["cancelled", "declined", "expired"].includes(b.status),
    );
    return `<section class="wrap reveal"><span class="eyebrow">YOUR AROHA VISITS</span><h1 style="font-size:42px;margin-top:12px">Something to look forward to.</h1><p class="lead">${esc(t?.name || "Visitor")} · ${t?.stays || 0} completed stays.${t?.nextAt ? " " + Math.max(0, t.nextAt - t.stays) + " more stays to your next tier." : ""}${t?.discount ? " " + t.discount + "% overnight benefit." : ""}</p><div class="inline-actions">${primary("Plan another visit", "find")}${["upcoming", "past", "cancelled"].map((f) => `<button class="secondary" data-filter="${f}" aria-pressed="${S.filter === f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join("")}</div>${rows.length ? rows.map((b) => `<article class="reviewpanel visit-item"><span class="pill">${esc(statusLabel(b.status))}</span><h3>${esc(productLabel(b.kind))}</h3><p>${dateLabel(b.arrival)} – ${dateLabel(b.kind === "event" ? add(b.departure, -1) : b.departure)} · ${b.adults ?? b.guests} adults · ${b.children ?? 0} under 10s</p><p>${esc(b.reference)} · ${cash(b.total)}</p><div class="inline-actions"><button class="textbutton" data-booking="${esc(b.id)}">View booking ↗</button></div></article>`).join("") : '<div class="empty"><h2>No visits in this category yet.</h2><p>New requests and confirmed visits will appear here.</p></div>'}${a.nextCursor ? '<button class="secondary" data-act="morevisits">Load more history</button>' : ""}</section>`;
  }
  function profile() {
    return `<section class="wrap"><span class="eyebrow">YOUR GUEST PROFILE</span><h1 style="font-size:42px;margin-top:12px">So we can welcome you.</h1><form id="profile-form" class="reviewpanel" style="margin-top:25px"><div class="columns"><label class="field">Full name<input id="profile-name" minlength="2" maxlength="120" autocomplete="name" required value="${esc(S.account.profile?.name || S.account.actor?.name)}"></label><label class="field">Phone with country code<input id="profile-phone" type="tel" autocomplete="tel" required maxlength="32" placeholder="+91 98765 43210" value="${esc(S.account.profile?.phone)}"></label></div><label class="field">Verified Google email<input type="email" readonly value="${esc(S.account.profile?.email)}"></label><p class="planner-note">Your phone is used by authorised hosts and included in operational booking business events in Dynatrace. Names, private notes and child ages are not sent. Existing booking contacts stay unchanged.</p><div class="inline-actions">${primary("Save profile", "saveprofile")}</div></form></section>`;
  }
  function render() {
    $("#pending-request").innerHTML = S.submissionUnknown
      ? '<div class="disabled-notice"><strong>An earlier request response was interrupted.</strong><p>Check Your visits or resolve the same request before starting another. Its original contact and price snapshot are preserved.</p>' +
        primary("Resolve previous request", "resolve") +
        "</div>"
      : "";
    if (S.view === "review") syncContact();
    $("#main").innerHTML = (
      { find, options, review, confirmation, visits, profile }[S.view] || find
    )();
    let visible =
      ["options", "review"].includes(S.view) && S.data?.available && !S.busy;
    $("#mobile-action").className = visible ? "active" : "";
    $("#mobile-action").innerHTML = visible
      ? `<button class="mobile-price" data-act="bill"><strong>${offer() ? cash(offer().total) : "Choose an option"}</strong>${S.kind === "event" ? "Quote details" : "Total · price details"}</button>${primary(S.view === "review" ? (S.needsQuote ? "Refresh options →" : S.submissionUnknown ? "Retry same request →" : "Send request →") : S.kind === "event" ? "Review enquiry →" : "Review request →", S.view === "review" ? "submit" : "review", !offer() || S.roomDirty)}`
      : "";
    updateAccount();
  }
  function syncContact() {
    for (const [id, k] of [
      ["name", "name"],
      ["email", "email"],
      ["phone", "phone"],
      ["notes", "notes"],
      ["occasion", "occasion"],
    ])
      if ($("#" + id)) S[k] = $("#" + id).value;
  }
  let requestVersion = 0;
  async function payload(kind, units = []) {
    return {
      kind,
      arrival: S.arrival,
      departure:
        S.kind === "day"
          ? add(S.arrival, 1)
          : S.kind === "event"
            ? add(S.lastDay, 1)
            : S.departure,
      adults: S.adults,
      childrenAges: [...S.ages],
      guests: S.adults + S.ages.length,
      units,
    };
  }
  async function quoted(kind, units = []) {
    return api("quote", { ...(await payload(kind, units)), promo: S.promo });
  }
  async function refresh() {
    const previous = S.account?.actor?.id;
    const account = await api("state");
    if (account.environment !== expectedEnvironment) throw { code: "WRONG_ENVIRONMENT" };
    if (previous && previous !== account.actor?.id) {
      clearPrivate();
    }
    S.account = account;
    if (account.actor && !S.contactDirty) {
      S.name = account.profile?.name || account.actor.name || "";
      S.phone = account.profile?.phone || "";
      S.email = account.profile?.email || "";
    }
    if (account.actor) S.email = account.profile?.email || "";
    return account;
  }
  function clearPrivate() {
    identityGeneration++;
    requestVersion++;
    if ($("#sheet").open) $("#sheet").close();
    $("#sheet-content").replaceChildren();
    if (S.account)
      S.account = {
        ...S.account,
        actor: null,
        profile: null,
        bookings: [],
        loyalty: null,
        nextCursor: null,
      };
    S.data = null;
    S.record = null;
    S.name = "";
    S.email = "";
    S.phone = "";
    S.notes = "";
    S.promo = "";
    S.contactDirty = false;
    S.submitKey = null;
    S.requestBody = null;
    S.selected = null;
    S.view = "find";
    S.submissionUnknown = false;
    S.needsQuote = false;
    S.terms = false;
    S.saveProfile = false;
    S.submitting = false;
    S.busy = false;
    S.error = "";
    S.custom = false;
    S.roomDirty = false;
    S.changeQuote = null;
    S.communications = null;
    S.ages = [];
    S.adults = 2;
    S.hasDates = false;
    S.arrival = add(today(), 3);
    S.departure = add(today(), 4);
    S.lastDay = S.departure;
  }
  async function signIn() {
    if (S.authBusy) return;
    S.authBusy = true;
    try {
      await api("session", {});
      await refresh();
      render();
      return true;
    } catch (e) {
      toast(message(e));
      return false;
    } finally {
      S.authBusy = false;
    }
  }
  async function search(units) {
    syncContact();
    if (!S.hasDates) {
      openDates();
      return;
    }
    if (!S.account?.actor && !(await signIn())) return;
    const version = ++requestVersion;
    S.busy = true;
    S.error = "";
    S.submitKey = null;
    S.requestBody = null;
    S.view = "options";
    journeyStep("dates", "attempted", apiKind());
    render();
    try {
      await refresh();
      if (version !== requestVersion) return;
      let data;
      if (S.kind === "stay") {
        const [pa, sa] = await Promise.all([
          api("availability", await payload("private")),
          S.ages.length
            ? null
            : api("availability", await payload("individual")),
        ]);
        if (version !== requestVersion) return;
        const fit = units?.length
          ? { units }
          : recommendPrivate(
              pa.units,
              S.adults,
              S.ages.length,
              nights(),
              policy().extraChildRate,
            );
        const results = await Promise.allSettled([
          fit ? quoted("private", fit.units) : Promise.resolve(null),
          sa?.available ? quoted("individual") : Promise.resolve(null),
        ]);
        if (version !== requestVersion) return;
        const acceptable = new Set([
          "AVAILABILITY_CHANGED",
          "ROOM_PARTY_LIMIT",
          "SELECT_ROOMS",
        ]);
        for (const r of results)
          if (r.status === "rejected" && !acceptable.has(r.reason.code))
            throw r.reason;
        const [p, q] = results.map((r) =>
          r.status === "fulfilled" ? r.value : null,
        );
        data = {
          private: p,
          shared: q,
          roomChoices: pa.units.filter((u) => u.active && u.available),
          recommended:
            S.ages.length || !q || (p && p.total <= q.total)
              ? "private"
              : "individual",
          available: !!(p || q),
          reason:
            S.adults >
            Math.min(policy().nightAdults, S.account.settings.capacity)
              ? "overnight_limit"
              : "dates_unavailable",
        };
      } else {
        const a = await api("availability", await payload(S.kind));
        const q = a.available ? await quoted(S.kind) : null;
        data = { offer: q, available: !!q, reason: "dates_unavailable" };
      }
      if (version !== requestVersion) return;
      S.data = data;
      S.selected = S.kind === "stay" ? data.recommended : S.kind;
      S.draftUnits = data.private?.units || [];
      S.custom = false;
      S.roomDirty = false;
      S.busy = false;
      S.needsQuote = false;
      S.terms = false;
      journeyStep(
        "availability",
        data.available ? "succeeded" : "failed",
        apiKind(),
      );
      view("options");
    } catch (e) {
      if (version !== requestVersion) return;
      S.busy = false;
      S.view = "find";
      S.error = message(e);
      render();
      toast(S.error);
    }
  }
  let dateDraft, guestDraft;
  function modal(html) {
    syncContact();
    $("#sheet-content").innerHTML = html;
    if (!$("#sheet").open) $("#sheet").showModal();
  }
  function openDates() {
    dateDraft = {
      a: S.hasDates ? S.arrival : "",
      b: S.hasDates ? (S.kind === "event" ? S.lastDay : S.departure) : "",
      target: "a",
      month: +S.arrival.slice(5, 7) - 1,
      year: +S.arrival.slice(0, 4),
    };
    if (S.hasDates) {
      dateDraft.month = Number(S.arrival.slice(5, 7)) - 1;
      dateDraft.year = Number(S.arrival.slice(0, 4));
    }
    drawDates();
  }
  const iso = (year, month, n) =>
    new Date(Date.UTC(year, month, n)).toISOString().slice(0, 10);
  function month(y, m) {
    const start = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7,
      last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return `<section class="month"><h3>${new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m, 1)))}</h3><div class="grid">${["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span>${d}</span>`).join("")}${"<span></span>".repeat(start)}${Array.from(
      { length: last },
      (_, i) => {
        let d = iso(y, m, i + 1),
          sel = d === dateDraft.a || (S.kind !== "day" && d === dateDraft.b);
        return `<button data-day="${d}" class="${sel ? "sel" : d > dateDraft.a && d < dateDraft.b ? "between" : ""}" aria-label="${d}${sel ? ", selected" : ""}" aria-pressed="${sel}" tabindex="${d === (dateDraft.a || iso(y, m, 1)) ? "0" : "-1"}" ${d < today() || d > add(today(), 365) ? "disabled" : ""}>${sel ? '<svg viewBox="0 0 60 50" aria-hidden="true"><path fill="currentColor" d="M5 31C2 11 24 6 53 3c-2 18-6 39-27 41-10 2-17-3-21-13Z"/><path d="M9 41 43 13M17 34l-3-12m13 3 0-12m0 12 13 0" stroke="var(--paper)" opacity=".3" fill="none" stroke-width="1"/></svg>' : ""}${i + 1}</button>`;
      },
    ).join("")}</div></section>`;
  }
  function drawDates() {
    modal(
      `<span class="eyebrow">${S.kind === "day" ? "ONE GOOD DAY" : "A LITTLE TIME AWAY"}</span><h2>${S.kind === "day" ? "Which day is yours?" : "When would you like to visit?"}</h2><p class="sheet-intro">${S.kind === "stay" ? "Choose arrival, then departure. Check in " + policy().stayStart + " · check out " + policy().stayEnd + " IST." : S.kind === "event" ? "Choose the first and last day. Your enquiry covers the continuous range through " + policy().dayEnd + " IST on the last day." : "Arrive from " + policy().dayStart + " IST. Breakfast and lunch are included; your visit finishes by " + policy().dayEnd + " IST."}</p><div class="date-tabs"><button data-target="a" aria-pressed="${dateDraft.target === "a"}"><small>${S.kind === "day" ? "Visit date" : "Arrival"}</small>${dateLabel(dateDraft.a)}</button>${S.kind === "day" ? "" : `<button data-target="b" aria-pressed="${dateDraft.target === "b"}"><small>${S.kind === "event" ? "Last day" : "Departure"}</small>${dateLabel(dateDraft.b)}</button>`}</div><div class="calendar-top"><button data-act="previousmonth" aria-label="Previous month">←</button><small>${S.kind === "day" ? "Select your visit date" : dateDraft.target === "a" ? "Select arrival" : "Select " + (S.kind === "event" ? "last day" : "departure")}</small><button data-act="nextmonth" aria-label="Next month">→</button></div><div class="calendars">${month(dateDraft.year, dateDraft.month)}${month(dateDraft.month === 11 ? dateDraft.year + 1 : dateDraft.year, (dateDraft.month + 1) % 12)}</div><div class="sheet-foot"><span>${S.kind === "day" ? "One day" : dateDraft.a && dateDraft.b ? (S.kind === "event" ? "Continuous date range" : Math.round((Date.parse(dateDraft.b) - Date.parse(dateDraft.a)) / 86400000) + " night(s)") : "Select your dates"}</span>${primary("Use these dates", "applydates", !dateDraft.a || (S.kind !== "day" && !dateDraft.b))}</div>`,
    );
  }
  function openGuests() {
    guestDraft = { adults: S.adults, ages: [...S.ages] };
    drawGuests();
  }
  function drawGuests() {
    modal(
      `<span class="eyebrow">ROOM FOR YOUR PEOPLE</span><h2>Who’s coming with you?</h2><p class="sheet-intro">Ages are counted on arrival. We’ll suggest the right room combination—you don’t have to work it out.</p><div class="counter-row"><div><strong>Adults</strong><small>Ages 10 and above</small></div><div class="counter"><button data-counter="adults:-1" aria-label="Remove adult" ${guestDraft.adults <= 1 ? "disabled" : ""}>−</button><span>${guestDraft.adults}</span><button data-counter="adults:1" aria-label="Add adult" ${guestDraft.adults >= policy().siteAdults ? "disabled" : ""}>+</button></div></div><div class="counter-row"><div><strong>Children</strong><small>Under 10 years on arrival</small></div><div class="counter"><button data-counter="children:-1" aria-label="Remove child" ${!guestDraft.ages.length ? "disabled" : ""}>−</button><span>${guestDraft.ages.length}</span><button data-counter="children:1" aria-label="Add child" ${guestDraft.ages.length >= 100 ? "disabled" : ""}>+</button></div></div>${guestDraft.ages.length ? `<div class="ages">${guestDraft.ages.map((a, i) => `<label class="field">Child ${i + 1} age<select data-age="${i}" aria-label="Child ${i + 1} age"><option value="">Choose age</option>${Array.from({ length: 10 }, (_, n) => `<option value="${n}" ${a === n ? "selected" : ""}>${n === 0 ? "Under 1" : n + (n === 1 ? " year" : " years")}</option>`).join("")}</select></label>`).join("")}</div>` : ""}<p class="sheet-intro" style="margin:20px 0 0">${S.kind === "stay" ? "Up to " + Math.min(policy().nightAdults, S.account.settings.capacity) + " adults can stay overnight. Children need private rooms; each room allows up to 2 adults and 2 children." : "Up to " + policy().siteAdults + " adults can visit at once. Children under 10 do not count toward that adult limit."}</p><div class="sheet-foot"><span>${guestDraft.adults} adults · ${guestDraft.ages.length} children</span>${primary("Use these guests", "applyguests")}</div>`,
    );
  }
  document.addEventListener("change", (e) => {
    if (e.target.id === "terms") S.terms = e.target.checked;
    if (e.target.id === "save-profile") S.saveProfile = e.target.checked;
    if (e.target.dataset.age !== undefined)
      guestDraft.ages[+e.target.dataset.age] =
        e.target.value === "" ? null : +e.target.value;
    if (e.target.dataset.room) {
      let id = e.target.dataset.room;
      S.draftUnits = e.target.checked
        ? [...S.draftUnits, id]
        : S.draftUnits.filter((x) => x !== id);
      S.roomDirty = true;
      syncContact();
      render();
    }
  });
  document.addEventListener(
    "pointerdown",
    () => delete document.documentElement.dataset.bookingKeyboard,
  );
  document.addEventListener("keydown", (e) => {
    document.documentElement.dataset.bookingKeyboard = "true";
    let b = e.target.closest("[data-day]");
    if (
      !b ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    )
      return;
    e.preventDefault();
    let offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[
      e.key
    ];
    let next = new Date(Date.parse(b.dataset.day) + offset * 86400000)
      .toISOString()
      .slice(0, 10);
    if (next < today() || next > add(today(), 365)) return;
    let el = $('[data-day="' + next + '"]');
    if (!el || getComputedStyle(el.closest(".month")).display === "none") {
      dateDraft.month = +next.slice(5, 7) - 1;
      dateDraft.year = +next.slice(0, 4);
      drawDates();
      el = $('[data-day="' + next + '"]');
    }
    if (el && !el.disabled) el.focus();
  });
  document.addEventListener("submit", (e) => e.preventDefault());
  document.addEventListener("click", async (e) => {
    if (!S.account) return;
    if (e.target.closest("#home")) {
      e.preventDefault();
      syncContact();
      view("find");
      return;
    }
    let b = e.target.closest("button");
    if (!b || mutationBusy) return;
    syncContact();
    if (b.classList.contains("close")) return $("#sheet").close();
    if (b.dataset.booking) {
      await openBooking(b.dataset.booking);
      return;
    }
    if (b.dataset.filter) {
      S.filter = b.dataset.filter;
      render();
      return;
    }
    if (b.dataset.kind) {
      requestVersion++;
      S.busy = false;
      journeyStep(
        "plan",
        "selected",
        b.dataset.kind === "stay" ? "private" : b.dataset.kind,
      );
      let oldKind = S.kind;
      S.kind = b.dataset.kind;
      if (S.hasDates) {
        if (S.kind === "stay")
          S.departure =
            oldKind === "event" && S.lastDay > S.arrival
              ? S.lastDay
              : new Date(Date.parse(S.arrival) + 86400000)
                  .toISOString()
                  .slice(0, 10);
        if (S.kind === "event")
          S.lastDay = oldKind === "stay" ? S.departure : S.arrival;
      }
      S.data = null;
      S.error = "";
      render();
      return;
    }
    if (b.dataset.select) {
      journeyStep("rooms", "selected", b.dataset.select);
      S.selected = b.dataset.select;
      S.custom = false;
      S.roomDirty = false;
      S.draftUnits = S.data.private?.units || [];
      render();
      toast(
        S.selected === "private"
          ? "Private stay selected. Your full price is shown."
          : "Individual stay selected. Accommodation is allocated by your hosts.",
      );
      return;
    }
    if (b.dataset.target) {
      dateDraft.target = b.dataset.target;
      drawDates();
      return;
    }
    if (b.dataset.day) {
      let d = b.dataset.day;
      if (S.kind === "day") {
        dateDraft.a = d;
      } else if (dateDraft.target === "a") {
        dateDraft.a = d;
        if (dateDraft.b <= d) dateDraft.b = "";
        dateDraft.target = "b";
      } else {
        if (!dateDraft.a) {
          dateDraft.a = d;
          dateDraft.target = "b";
        } else if (
          d < dateDraft.a ||
          (S.kind === "stay" && d === dateDraft.a)
        ) {
          dateDraft.a = d;
          dateDraft.b = "";
          dateDraft.target = "b";
        } else dateDraft.b = d;
      }
      drawDates();
      $('#sheet-content [data-day="' + d + '"]')?.focus();
      return;
    }
    if (b.dataset.counter) {
      let [what, change] = b.dataset.counter.split(":");
      if (what === "adults") guestDraft.adults += +change;
      else if (+change > 0) guestDraft.ages.push(null);
      else guestDraft.ages.pop();
      drawGuests();
      let target = $(
        '#sheet-content [data-counter="' + b.dataset.counter + '"]',
      );
      if (target && !target.disabled) target.focus();
      return;
    }
    let a = b.dataset.act || b.id;
    if (a === "find" || a === "home") {
      if (a === "home") e.preventDefault();
      if ($("#sheet").open) $("#sheet").close();
      view("find");
    }
    if (a === "dates" && !S.submissionUnknown) openDates();
    if (a === "guests" && !S.submissionUnknown) openGuests();
    if (a === "search") await search();
    if (a === "options") {
      if (S.data && !S.promo) view("options");
      else await search();
    }
    if (a === "atmosphere") {
      setAtmosphere(getAtmosphere() === "evening" ? "day" : "evening");
      updateAtmosphere();
    }
    if (a === "previousmonth" || a === "nextmonth") {
      dateDraft.month += a === "nextmonth" ? 1 : -1;
      if (dateDraft.month < 0) {
        dateDraft.month = 11;
        dateDraft.year--;
      }
      if (dateDraft.month > 11) {
        dateDraft.month = 0;
        dateDraft.year++;
      }
      drawDates();
    }
    if (a === "applydates") {
      requestVersion++;
      S.busy = false;
      journeyStep("dates", "selected", apiKind());
      let end = S.kind === "event" ? dateDraft.b : dateDraft.b;
      let diff = (Date.parse(end) - Date.parse(dateDraft.a)) / 86400000;
      if (
        S.kind !== "day" &&
        (diff > (S.kind === "event" ? 30 : 31) ||
          diff < 0 ||
          (S.kind === "stay" && !diff))
      )
        return toast(
          "Choose up to 31 nights for a stay, or 31 calendar days for an exclusive retreat.",
        );
      S.arrival = dateDraft.a;
      if (S.kind === "event") S.lastDay = dateDraft.b;
      else if (S.kind === "stay") S.departure = dateDraft.b;
      S.hasDates = true;
      $("#sheet").close();
      if (["options", "review"].includes(S.view)) await search();
      else render();
    }
    if (a === "applyguests") {
      requestVersion++;
      S.busy = false;
      journeyStep("dates", "selected", apiKind());
      if (guestDraft.ages.some((x) => x === null)) {
        journeyStep("dates", "failed", apiKind());
        return toast(
          "Choose an age for each child. Guests aged 10 and above count as adults.",
        );
      }
      S.adults = guestDraft.adults;
      S.ages = [...guestDraft.ages];
      $("#sheet").close();
      if (["options", "review"].includes(S.view)) await search();
      else render();
    }
    if (a === "rooms") {
      S.custom = !S.custom;
      S.draftUnits = [...S.data.private.units];
      S.roomDirty = false;
      S.error = "";
      render();
    }
    if (a === "applyrooms") {
      if (mutationBusy || S.busy) return;
      const version = ++requestVersion;
      S.busy = true;
      S.error = "";
      render();
      await guarded(async () => {
        const q = await quoted("private", S.draftUnits);
        if (version !== requestVersion) return;
        S.data.private = q;
        S.selected = "private";
        S.roomDirty = false;
        journeyStep("rooms", "selected", "private");
        toast("Rooms and full price updated.");
      });
      if (version === requestVersion) {
        S.busy = false;
        render();
      }
    }
    if (a === "review") {
      if (!offer() || S.roomDirty) return;
      S.error = "";
      S.terms = false;
      journeyStep("review", "viewed", apiKind());
      view("review");
    }
    if (a === "bill") modal("<h2>Your price, explained.</h2>" + bill());
    if (a === "resolve") {
      await submit();
    }
    if (a === "submit") {
      await submit();
    }
    if (a === "visits") {
      await loadVisits();
    }
    if (a === "profile") {
      if (!S.account.actor && !(await signIn())) return;
      if ($("#sheet").open) $("#sheet").close();
      view("profile");
    }
    if (a === "account") {
      if (!S.account.actor) await signIn();
      else
        modal(
          "<h2>Your Aroha account.</h2><p>" +
            esc(S.account.actor.name) +
            "</p><p>" +
            esc(S.account.profile?.email) +
            '</p><div class="inline-actions"><button class="secondary" data-act="profile">Guest profile</button><button class="textbutton" data-act="logout">Sign out</button></div>',
        );
    }
    if (a === "logout") {
      await guarded(async () => {
        await api("logout");
        $("#sheet").close();
        clearPrivate();
        await refresh();
        view("find");
      });
    }
    if (a === "saveprofile") {
      await saveProfile();
    }
    if (a === "confirmation") view("confirmation");
    if (a === "morevisits") {
      await loadVisits(true);
    }
    if (a === "cancel") {
      modal(
        '<h2>Cancel this request?</h2><p>Your host will see the updated status. Cancellation is subject to the booking’s saved cutoff.</p><div class="inline-actions">' +
          primary("Cancel booking", "confirmcancel") +
          '<button class="secondary" data-act="keep">Keep booking</button></div>',
      );
    }
    if (a === "confirmcancel") {
      await manage("cancel");
    }
    if (a === "keep") $("#sheet").close();
    if (a === "acceptoffer") {
      await manage("accept_event");
    }
    if (a === "communications") {
      await communications();
    }
    if (a === "invoice") {
      await downloadInvoice();
    }
    if (a === "editnote") {
      modal(
        '<h2>A note to your hosts.</h2><label class="field">Private request<textarea id="booking-note" maxlength="1000">' +
          esc(S.record.note) +
          '</textarea></label><div class="inline-actions">' +
          primary("Save note", "savenote") +
          "</div>",
      );
    }
    if (a === "savenote") {
      await guarded(async () => {
        await api("note", {
          id: S.record.id,
          note: $("#booking-note").value,
          expectedVersion: S.record.version,
        });
        $("#sheet").close();
        S.record = await api("reservation-detail", { id: S.record.id });
        view("confirmation");
      });
    }
    if (a === "switchday") {
      S.kind = "day";
      await search();
    }
    if (a === "changedates") {
      await changeDates();
    }
    if (a === "reviewchange") {
      await reviewChange();
    }
    if (a === "sendchange") {
      await sendChange();
    }
    if (a === "applypromo") {
      await applyPromo();
    }
    if (a === "help")
      modal(
        `<span class="eyebrow">A LITTLE CLARITY</span><h2>Let’s make it easy.</h2><div class="reviewpanel"><h3>Do I get a private room?</h3><p>Private rooms are reserved for your party. Individual stays are ${cash(policy().individualRate)} per adult per night, allocated by hosts and potentially shared.</p></div><div class="reviewpanel"><h3>How are children charged?</h3><p>Under 10s are ${cash(policy().dayChildRate)} for a day outing. A private room starts at ${cash(policy().roomRate)} per night and includes two occupants; additional child places are ${cash(policy().extraChildRate)} per night, with at most 2 adults and 2 children per room.</p></div><div class="reviewpanel"><h3>When is my visit confirmed?</h3><p>After host approval. Exclusive enquiries need a host quote and your acceptance first. No online payment is taken.</p></div><p>All times are in India Standard Time. Return to the main website for host contact and retreat information.</p><div class="inline-actions"><a href="/">Explore Aroha ↗</a></div>`,
      );
  });

  const cutoff = (h) =>
    h === 0
      ? "before your scheduled arrival"
      : "up to " + h + " hours before arrival";
  const policy = () => S.account.settings.products;
  const apiKind = () => (S.kind === "stay" ? S.selected || "private" : S.kind);
  const statusLabel = (s) =>
    ({
      pending_approval: "Awaiting host approval",
      checked_in: "Checked in",
      no_show: "No show",
      cancelled: "Cancelled",
      confirmed: "Confirmed",
      completed: "Completed",
      declined: "Declined",
      expired: "Expired",
    })[s] || "Booking update";
  const productLabel = (k) =>
    ({
      day: "Day outing",
      individual: "Individual stay",
      private: "Private family stay",
      event: "Exclusive retreat",
    })[k] || "Overnight stay";
  const messages = {
    SESSION_CHANGED:
      "Your account changed. Sign in and review the current booking before continuing.",
    PREPROD_TESTER_REQUIRED:
      "This test site is available only to approved test accounts.",
    WRONG_ENVIRONMENT:
      "This portal is connected to a different booking service. Please reload or return to the retreat website.",
    BOOKINGS_PAUSED:
      "Your hosts have paused new requests. Existing bookings can still be managed.",
    AVAILABILITY_CHANGED:
      "Availability changed. Your plans are kept; refresh the options before sending.",
    ROOM_PARTY_LIMIT:
      "Those rooms do not fit your party. Each room needs an adult and fits up to 2 adults and 2 under 10s.",
    SELECT_ROOMS: "Select enough rooms for your party.",
    QUOTE_EXPIRED:
      "This quote expired. Refresh your options and review the latest price.",
    QUOTE_CHANGED:
      "The price or policy changed. Refresh options and review before sending.",
    INVALID_CONTACT:
      "Enter your full name and phone number with country code, for example +91 98765 43210.",
    CONTACT_REQUIRED: "Add your name and phone number before sending.",
    VERSION_CONFLICT:
      "This booking or profile changed in another window. Refresh and review it again.",
    HOST_CANCELLATION_REQUIRED:
      "This booking is inside its cancellation cutoff. Please contact your hosts.",
    REQUEST_LIMIT:
      "You already have three active requests. Review Your visits before requesting another.",
    PROMO_NOT_VALID: "That code is unavailable or outside its valid dates.",
    PROMO_EXHAUSTED: "That code has reached its use limit.",
    LOYALTY_IS_BETTER: "Your stay benefit already equals or exceeds this code.",
    INVALID_CHILD_AGE:
      "Children must be under 10 on arrival; older guests count as adults.",
    INVALID_STAY_DATES:
      "Choose future dates within the next year and up to 31 nights.",
    INVALID_TIME_WINDOW: "This visit window has ended. Choose another date.",
    IDEMPOTENCY_CONFLICT:
      "A previous request may already be saved. Check Your visits before trying again.",
    EVENT_QUOTE_REQUIRED:
      "Your host’s offer needs guest acceptance before approval.",
    FORBIDDEN: "This account cannot access that booking.",
    INVOICE_NOT_FOUND: "An invoice is not available yet.",
    INVOICE_NOT_PAYABLE:
      "This invoice was cancelled or replaced. Review the current booking.",
  };
  const message = (e) =>
    messages[e?.code] ||
    "The booking service could not complete this action. Your choices are kept. Please try again.";
  function updateAccount() {
    $("#account").disabled = !S.account;
    const a = S.account?.actor;
    $("#account").innerHTML = a
      ? 'Account<span class="account-name"> · ' +
        esc(a.name.split(" ")[0]) +
        "</span>"
      : "Sign in";
    updateAtmosphere();
  }
  function updateAtmosphere() {
    let dark = getAtmosphere() === "evening";
    $("#atmosphere").textContent = dark ? "Daylight" : "Sunset";
    $("#atmosphere").setAttribute("aria-pressed", dark);
    $("#logo").src = dark
      ? "/assets/brand/logo-white.svg"
      : "/assets/brand/logo-forest.svg";
  }
  let mutationBusy = false;
  async function guarded(fn) {
    if (mutationBusy) return;
    mutationBusy = true;
    $("#app").setAttribute("aria-busy", "true");
    try {
      await fn();
    } catch (e) {
      S.error = message(e);
      toast(S.error);
      journeyStep(
        S.view === "options"
          ? "rooms"
          : S.view === "profile"
            ? "profile"
            : S.view === "review"
              ? "submit"
              : "visits",
        "failed",
        apiKind(),
      );
    } finally {
      mutationBusy = false;
      $("#app").removeAttribute("aria-busy");
    }
  }
  async function submit() {
    if (S.submitting || mutationBusy) return;
    if (!S.submissionUnknown && offer()?.expiresAt <= Date.now()) {
      S.needsQuote = true;
    }
    if (S.needsQuote) {
      await search();
      return;
    }
    syncContact();
    const f = $("#contact");
    if (!S.submissionUnknown && !f?.checkValidity()) {
      f?.reportValidity();
      journeyStep("contact", "failed", apiKind());
      return;
    }
    if (!offer()) return;
    await guarded(async () => {
      S.submitting = true;
      try {
        if (!S.requestBody) {
          if ($("#save-profile")?.checked) {
            await api("profile", {
              name: S.name,
              phone: S.phone,
              expectedVersion: S.account.profile?.version || 0,
            });
            await refresh();
          }
          S.submitKey = offer().id;
          S.requestBody = {
            quoteId: offer().id,
            note: S.occasion
              ? "Occasion: " + S.occasion + "\n" + S.notes
              : S.notes,
            contact: { name: S.name, phone: S.phone },
          };
        }
        journeyStep("contact", "attempted", apiKind());
        journeyStep("submit", "attempted", apiKind());
        const b = await api("create", S.requestBody, S.submitKey);
        S.record = b;
        S.requestBody = null;
        S.submitKey = null;
        S.submissionUnknown = false;
        S.contactDirty = false;
        S.terms = false;
        S.saveProfile = false;
        journeyStep("contact", "succeeded", b.kind);
        journeyStep("submit", "succeeded", b.kind);
        try {
          await refresh();
          S.record = S.account.bookings.find((row) => row.id === b.id) || b;
        } catch {
          toast(
            "Your request was saved. Booking history could not refresh yet.",
          );
        }
        view("confirmation");
      } catch (e) {
        if (
          typeof e.code === "string" &&
          !(e.status >= 500) &&
          e.code !== "IDEMPOTENCY_CONFLICT"
        ) {
          S.requestBody = null;
          S.submitKey = null;
          S.submissionUnknown = false;
          if (
            ["QUOTE_EXPIRED", "QUOTE_CHANGED", "AVAILABILITY_CHANGED"].includes(
              e.code,
            )
          )
            S.needsQuote = true;
        } else S.submissionUnknown = !!S.requestBody;
        S.error = S.submissionUnknown
          ? "The response was interrupted. Your request may have been saved. Check Your visits, or retry this same request; its original reference is preserved."
          : message(e);
        render();
        toast(S.error);
        journeyStep("submit", "failed", apiKind());
      } finally {
        S.submitting = false;
      }
    });
  }
  async function saveProfile() {
    const f = $("#profile-form");
    if (!f?.reportValidity()) {
      journeyStep("profile", "failed", apiKind());
      return;
    }
    await guarded(async () => {
      journeyStep("profile", "attempted");
      await api("profile", {
        name: $("#profile-name").value,
        phone: $("#profile-phone").value,
        expectedVersion: S.account.profile?.version || 0,
      });
      S.contactDirty = false;
      await refresh();
      render();
      toast("Your profile is saved.");
    });
  }
  async function loadVisits(more = false) {
    if (!S.account.actor && !(await signIn())) return;
    await guarded(async () => {
      if (more && S.account.nextCursor) {
        const next = await api("state", undefined, undefined, {
          cursor: S.account.nextCursor,
        });
        S.account.bookings = [
          ...new Map(
            [...S.account.bookings, ...next.bookings].map((b) => [b.id, b]),
          ).values(),
        ];
        S.account.nextCursor = next.nextCursor;
      } else await refresh();
      view("visits");
    });
  }
  async function openBooking(id) {
    await guarded(async () => {
      S.record = await api("reservation-detail", { id });
      if ($("#sheet").open) $("#sheet").close();
      view("confirmation");
    });
  }
  async function manage(action) {
    await guarded(async () => {
      const b = S.record;
      journeyStep(
        action === "accept_event" ? "event_offer" : "visits",
        "attempted",
        b.kind,
      );
      await api("booking-action", {
        id: b.id,
        action,
        expectedVersion: b.version,
      });
      $("#sheet").close();
      S.record = await api("reservation-detail", { id: b.id });
      try {
        await refresh();
      } catch {}
      view("confirmation");
      toast(
        action === "cancel"
          ? "Your booking is cancelled."
          : "Your acceptance is recorded. Host approval is still required.",
      );
    });
  }
  async function communications() {
    await guarded(async () => {
      const b = S.record;
      const c = await api("communications", { id: b.id });
      S.communications = c;
      modal(
        `<span class="eyebrow">${esc(b.reference)}</span><h2>Email updates & invoice.</h2>${c.notifications.length ? c.notifications.map((n) => `<div class="reviewpanel"><h3>${esc(n.channel.replaceAll("_", " "))}</h3><p>${esc({ accepted: "Accepted by email service", delivered: "Delivered to recipient mail server", needs_reconciliation: "Host review needed", suppressed: "Not sent after booking changed" }[n.status] || n.status.replaceAll("_", " "))}</p></div>`).join("") : "<p>No email updates have been queued yet.</p>"}${c.invoice ? `<div class="reviewpanel"><h3>${esc(c.invoice.number)}</h3><p>${c.invoice.test ? "TEST DOCUMENT — DO NOT PAY · " : ""}${esc(c.invoice.status)}</p><p>Balance: ${cash(c.invoice.balanceDue)}</p>${["void", "superseded"].includes(c.invoice.status) ? "<p>This invoice is no longer payable.</p>" : '<div class="inline-actions">' + primary("Download invoice PDF", "invoice") + "</div>"}</div>` : "<p>An invoice is issued after host confirmation.</p>"}`,
      );
    });
  }
  const objectUrls = new Set();
  async function downloadInvoice() {
    await guarded(async () => {
      const f = await api("invoice-download", { id: S.record.id });
      const bytes = Uint8Array.from(atob(f.contentBase64), (c) =>
        c.charCodeAt(0),
      );
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/pdf" }),
      );
      objectUrls.add(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.filename;
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        objectUrls.delete(url);
      }, 5000);
    });
  }
  async function changeDates() {
    const b = S.record;
    if (b.changeRequest) {
      toast(
        "A date change is already awaiting host review. Your original booking remains valid.",
      );
      return;
    }
    if (b.kind === "event") {
      modal(
        '<h2>A new exclusive date range.</h2><p>Exclusive date changes require a fresh enquiry and accepted host quote. Keep or cancel the current enquiry, then plan the new range; no dates change automatically.</p><div class="inline-actions">' +
          primary("Plan a new enquiry", "find") +
          "</div>",
      );
      return;
    }
    modal(
      `<h2>A change of plans.</h2><p>Your original dates stay reserved while hosts review the change.</p><form id="change-form"><div class="columns"><label class="field">New arrival<input id="change-arrival" type="date" min="${today()}" value="${b.arrival}" required></label>${b.kind === "day" ? "" : `<label class="field">New departure<input id="change-departure" type="date" value="${b.departure}" required></label>`}</div><div class="inline-actions">${primary("Review date change", "reviewchange")}</div></form>`,
    );
  }
  async function reviewChange() {
    if (!$("#change-form").reportValidity()) return;
    await guarded(async () => {
      const b = S.record;
      const arrival = $("#change-arrival").value,
        departure =
          b.kind === "day" ? add(arrival, 1) : $("#change-departure").value;
      S.changeQuote = await api("change-quote", {
        id: b.id,
        arrival,
        departure,
        guests: b.guests,
      });
      const q = S.changeQuote;
      modal(
        `<h2>Review your date change.</h2><p>${dateLabel(q.arrival)} – ${dateLabel(q.departure)}</p><h3>${cash(q.total)}</h3><p>The same rooms are requested. Host approval rechecks availability; your original booking remains valid until then.</p><div class="inline-actions">${primary("Send change request", "sendchange")}</div>`,
      );
    });
  }
  async function sendChange() {
    await guarded(async () => {
      const q = S.changeQuote;
      await api(
        "change-request",
        { id: S.record.id, quoteId: q.id, expectedVersion: S.record.version },
        q.id,
      );
      $("#sheet").close();
      S.record = await api("reservation-detail", { id: S.record.id });
      view("confirmation");
      toast(
        "Your date change is awaiting host review. Original dates remain reserved.",
      );
    });
  }
  async function applyPromo() {
    const code = $("#promo-code")?.value.trim() || "";
    await guarded(async () => {
      const previous = S.promo;
      S.promo = code;
      try {
        const q = await quoted(apiKind(), offer().units);
        if (S.kind === "stay")
          S.data[S.selected === "private" ? "private" : "shared"] = q;
        else S.data.offer = q;
        render();
        toast("Your price is updated.");
      } catch (e) {
        S.promo = previous;
        throw e;
      }
    });
  }
  function initialView() {
    return location.hash === "#visits"
      ? "visits"
      : location.hash === "#profile" && S.account.actor
        ? "profile"
        : "find";
  }
  const stopTheme = watchAtmosphere(updateAtmosphere);
  window.addEventListener("hashchange", () => {
    syncContact();
    const v = initialView();
    if (v === "visits") void loadVisits();
    else view(v);
  });
  window.addEventListener("pagehide", () => {
    requestVersion++;
    clearTimeout(window.toastTimer);
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
  });
  $("#sheet").addEventListener("close", () => {
    if (
      !document.activeElement?.isConnected ||
      document.activeElement === document.body
    )
      $("#main").focus({ preventScroll: true });
  });
  document.addEventListener("input", (e) => {
    if (["name", "phone"].includes(e.target.id)) S.contactDirty = true;
  });
  updateAtmosphere();
  await refresh();
  S.view = initialView();
  render();
  journeyStep(S.view === "find" ? "plan" : S.view, "viewed", apiKind());
  return {
    async identity(user) {
      if ((S.account.actor?.id || null) === (user?.uid || null)) return;
      if (S.account.actor) clearPrivate();
      else { identityGeneration++; requestVersion++; }
      render();
      try {
        await refresh();
        render();
      } catch (e) {
        toast(message(e));
      }
    },
    destroy() {
      stopTheme();
      requestVersion++;
      clearTimeout(window.toastTimer);
    },
  };
}
