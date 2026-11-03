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
  new Intl.NumberFormat("en-IN", {
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
  new Date(d + "T12:00:00Z").toLocaleDateString("en-IN", options);
const pretty = (s) =>
  ({
    pending_approval: "Awaiting host approval",
    checked_in: "Checked in",
    no_show: "No show",
  })[s] || s?.replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase());
const badge = (status) =>
  `<span class="badge ${esc(status)}"><span></span>${esc(pretty(status))}</span>`;
let state,
  search = { arrival: day(3), departure: day(5), guests: 2 },
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
  AVAILABILITY_CHANGED:
    "That room has just become unavailable. Choose another room or date.",
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
  VERSION_CONFLICT: "This item changed in another view. Refresh and try again.",
  EXISTING_BOOKINGS_CONFLICT:
    "Existing reservations conflict with this change. Resolve them first.",
  ROOM_NOT_READY:
    "This room is not ready to open. Its details need host verification.",
  HOST_CANCELLATION_REQUIRED:
    "This stay is inside the cancellation window. Please contact the host.",
  STAY_NOT_STARTED_OR_FINISHED:
    "Check-in starts on arrival day; completion and no-show require the departure date.",
  INVALID_TIER_THRESHOLDS: "Family must begin after the Friend threshold.",
  SIGN_IN_REQUIRED: "Choose a sample guest to continue.",
  INVALID_TRANSITION: "This reservation has changed. Refresh its details.",
  BOOKINGS_PAUSED: "The host has paused new booking requests.",
  REQUEST_LIMIT: "This sample account already has three active requests.",
};
async function api(path, body, key = crypto.randomUUID()) {
  let response;
  try {
    response = await fetch(
      "/prototype-api/v1/" + path,
      body === undefined
        ? { cache: "no-store" }
        : {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Prototype-Client": "aroha-review",
              "Idempotency-Key": key,
            },
            body: JSON.stringify(body),
          },
    );
  } catch {
    throw Error("Cannot reach the local review server. Please retry.");
  }
  const data = await response.json();
  if (!response.ok)
    throw Error(
      errors[data.error?.code] ||
        `Could not save: ${pretty(data.error?.code)}.`,
    );
  return data;
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
  state = await api("state");
}
const hostRoute = () => location.pathname.includes("/studio/");
function open(markup) {
  lastFocus = document.activeElement;
  dialog.innerHTML = `<button class="close" aria-label="Close dialog" data-close>×</button>${markup}`;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector("[data-close]").onclick = () => dialog.close();
  dialog.querySelector("h2")?.setAttribute("tabindex", "-1");
  dialog.querySelector("h2")?.setAttribute("id", "review-dialog-title");
  dialog.setAttribute("aria-labelledby", "review-dialog-title");
  dialog.querySelector("h2")?.focus();
  bindDialog();
  extendDetail();
}
dialog.addEventListener("close", () => {
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
      dialog.close();
  }
});
function login() {
  open(
    `<p class="eyebrow">EXPLORE THE PROTOTYPE</p><h2>A familiar welcome.</h2><p>Choose a sample account. This is a local demo sign-in; no Google account or real reservation is involved.</p><div class="persona-list"><button class="persona" data-persona="guest-1"><span class="avatar">A</span><span><strong>Ananya</strong><small>Visitor · 5 completed sample stays</small></span><b>↗</b></button><button class="persona" data-persona="guest-2"><span class="avatar gold">A</span><span><strong>Arjun</strong><small>Visitor · 2 upcoming sample stays</small></span><b>↗</b></button>${hostRoute() ? '<button class="persona" data-persona="host"><span class="avatar">H</span><span><strong>Sample host</strong><small>Calendar, reservations and settings</small></span><b>↗</b></button>' : ""}</div>`,
  );
}
function header() {
  return `<header class="guest-header"><a href="/prototype/booking/" aria-label="Aroha booking home"><img src="/assets/brand/logo-forest.svg" width="160" height="55" alt="Aroha Retreat"></a><nav aria-label="Booking navigation"><a href="#plan" ${location.hash !== "#visits" ? 'aria-current="page"' : ""}>Plan a stay</a><a href="#visits" ${location.hash === "#visits" ? 'aria-current="page"' : ""}>Your visits</a></nav><div class="header-actions"><a class="host-link" href="/prototype/studio/">Host Studio ↗</a><button class="account-button" id="account">${state.actor ? `<span class="avatar small">${esc(state.actor.name[0])}</span><span>${esc(state.actor.name.split(" ·")[0])}</span>` : "Demo sign-in ↗"}</button></div></header>`;
}
const foot = () =>
  `<footer class="guest-footer"><img src="/assets/brand/logo-forest.svg" alt="Aroha Retreat" width="140" height="48"><span>A little time. A little closer to nature.</span><span>Local review · No emails or payments</span></footer>`;
function dateInputs() {
  return `<div class="date-fields"><label>Arrival<input type="date" name="arrival" value="${search.arrival}" min="${day(1)}" required></label><label>Departure<input type="date" name="departure" value="${search.departure}" min="${add(search.arrival, 1)}" required></label><label>Guests<select name="guests">${Array.from({ length: Math.min(state.settings.capacity, 30) }, (_, i) => `<option value="${i + 1}" ${search.guests === i + 1 ? "selected" : ""}>${i + 1} ${i ? "guests" : "guest"}</option>`).join("")}</select></label></div>`;
}
function calendar() {
  const first = month + "-01",
    start = add(first, -((new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7));
  return `<div class="date-calendar"><div class="calendar-heading"><button type="button" class="icon-button" data-month="-1" aria-label="Previous month">←</button><strong>${format(first, { month: "long", year: "numeric" })}</strong><button type="button" class="icon-button" data-month="1" aria-label="Next month">→</button></div><p class="calendar-hint">Choose your ${picking === "arrival" ? "arrival" : "departure"} date</p><div class="month-grid">${["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span class="weekday">${d}</span>`).join("")}${Array.from(
    { length: 42 },
    (_, i) => {
      const d = add(start, i),
        inMonth = d.startsWith(month),
        disabled = d < day(1) || d > day(365);
      return `<button type="button" data-date="${d}" class="date-cell ${inMonth ? "" : "outside"} ${d === search.arrival || d === search.departure ? "endpoint" : ""} ${d > search.arrival && d < search.departure ? "in-range" : ""}" ${disabled ? "disabled" : ""} aria-label="${format(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${d === search.arrival ? ", arrival" : d === search.departure ? ", departure" : ""}" aria-pressed="${d === search.arrival || d === search.departure}">${Number(d.slice(-2))}</button>`;
    },
  ).join("")}</div></div>`;
}
function planPage() {
  if (step === 1)
    return `<section class="hero"><div class="hero-copy"><p class="eyebrow">MAKE A LITTLE ROOM FOR YOURSELF</p><h1>A little closer<br>to <em>the quiet.</em></h1><p>Wake up among the trees. Take the longer path.<br>Let the day belong to you.</p><div class="hero-facts"><span>Whole-room stays</span><span>Thoughtfully hosted</span><span>${state.settings.capacity}-guest retreat limit</span></div></div><figure class="hero-photo"><img src="/assets/retreat/hero-desktop.webp" alt="A-frame cottages surrounded by coconut palms at the retreat"><figcaption>Aroha, at your own pace.</figcaption></figure></section><section class="planning"><div class="section-heading"><div><p class="eyebrow">YOUR NEXT CHAPTER</p><h2>When shall we welcome you?</h2></div><span class="subtle">All times in India Standard Time</span></div><div class="planning-grid"><form id="search-form" class="date-panel">${dateInputs()}${calendar()}<button class="button full" type="submit">Find your little corner <span>→</span></button><p class="form-note">A request comes first. Your hosts confirm every stay personally.</p></form><aside class="stay-note"><span class="handwriting">Less rush. More room.</span><h3>A stay shaped<br>around you.</h3><p>Choose a tree house or a cottage, tell us who’s coming, and leave a note for your hosts.</p><div class="note-item"><span>01</span><div><strong>Find your dates</strong><p>See rooms available for your whole stay.</p></div></div><div class="note-item"><span>02</span><div><strong>Make it yours</strong><p>Choose your rooms and add a personal request.</p></div></div><div class="note-item"><span>03</span><div><strong>We’ll take it from here</strong><p>Your hosts review and confirm in Your visits.</p></div></div><div class="sample-note">Review note: room prices, offers and cancellation terms are illustrative. Day visits and new rooms are not open.</div></aside></div></section>`;
  const nights = Math.round(
    (Date.parse(search.departure) - Date.parse(search.arrival)) / 86400000,
  );
  const summary = `<aside class="summary"><p class="eyebrow">YOUR TIME AT AROHA</p><h3>${format(search.arrival)} — ${format(search.departure)}</h3><p>${nights} ${nights === 1 ? "night" : "nights"} · ${search.guests} ${search.guests === 1 ? "guest" : "guests"}</p><hr><dl>${selected
    .map((id) => {
      const u = state.units.find((u) => u.id === id);
      return `<div><dt>${esc(u.name)}</dt><dd>${money(u.rate * nights)}</dd></div>`;
    })
    .join(
      "",
    )}${quote ? `<div><dt>${esc(quote.offer)}</dt><dd>−${money(quote.discount)}</dd></div><div class="total"><dt>Stay total</dt><dd>${money(quote.total)}</dd></div>` : `<div class="total"><dt>Room subtotal</dt><dd>${money(selected.reduce((n, id) => n + state.units.find((u) => u.id === id).rate * nights, 0))}</dd></div>`}</dl><p class="form-note">Sample INR prices · no payment collected.<br>Final property tariffs and taxes need host approval.</p><div class="approval-note"><strong>A personal welcome</strong><p>Pending requests reserve these rooms for up to ${state.settings.approvalHours} hours. Your host must approve before the deadline.</p></div></aside>`;
  return `<section class="wizard-heading"><button class="text-button" id="back-step">← ${step === 2 ? "Change dates" : "Back to rooms"}</button><div class="steps"><span class="done">1 Dates</span><span class="${step === 2 ? "current" : "done"}">2 Your room</span><span class="${step === 3 ? "current" : ""}">3 Make it yours</span></div><h1>${step === 2 ? "Find your little corner." : "A few details. Then, exhale."}</h1><p>${step === 2 ? "A whole room, just for your group. Select one or more." : "Review your stay and leave a note for your hosts."}</p></section><div class="booking-layout"><div>${
    step === 2
      ? `<div class="room-list">${(available?.units || [])
          .filter((u) => u.active)
          .map(
            (u) =>
              `<article class="room-card ${selected.includes(u.id) ? "selected" : ""} ${u.available ? "" : "unavailable"}"><img src="/assets/retreat/${esc(u.image)}" alt="${u.type === "Tree house" ? "Farm tree-house photography; individual room identity to be verified" : "Aroha cottage photography; individual room identity to be verified"}"><div class="room-info"><p class="eyebrow">${esc(u.type)}</p><h2>${esc(u.name)}</h2><p>Up to ${u.capacity} guests · Private whole room</p><p class="room-description">${u.type === "Tree house" ? "A little higher. A little quieter. A place among the farm’s trees." : "Slow mornings beneath the palms, with space to settle into your own rhythm."}</p><div class="room-price"><span><strong>${money(u.rate)}</strong> / night <small>Sample rate</small></span><button class="${selected.includes(u.id) ? "button" : "outline-button"}" type="button" data-room="${u.id}" aria-pressed="${selected.includes(u.id)}" ${u.available ? "" : "disabled"}>${u.available ? (selected.includes(u.id) ? "Selected ✓" : "Choose room +") : "Unavailable"}</button></div></div></article>`,
          )
          .join(
            "",
          )}</div><p class="form-note">Photos show the retreat’s existing accommodation. Room-by-room identification will be verified before launch.</p><button class="button continue-button" id="review" ${!selected.length ? "disabled" : ""}>Make this stay yours <span>→</span></button>`
      : `<form id="request-form" class="review-form"><div class="paper"><p class="eyebrow">A NOTE TO YOUR HOSTS</p><h2>What would make you feel at home?</h2><label for="note">Special requests <span class="subtle">(optional)</span></label><textarea id="note" maxlength="1000" rows="5" placeholder="Arrival plans, a special occasion, or something you’d like us to know…">${esc(note)}</textarea><p class="form-note">Private to you and your hosts. Requests are subject to confirmation. Please leave out sensitive personal information.</p></div><div class="paper"><h3>A little something for your stay</h3>${state.loyalty ? `<p>${esc(state.loyalty.name)} · ${state.loyalty.stays} completed stays${state.loyalty.discount ? ` · ${state.loyalty.discount}% sample benefit` : ""}</p>` : ""}<label for="promo">Have an invitation code?</label><div class="promo-field"><input id="promo" maxlength="24" value="${esc(promo)}" placeholder="Try SLOWDAYS"><button class="outline-button" type="button" id="apply-promo">Apply</button></div><p class="form-note">The better of your tier benefit or one promo applies. Offers do not stack.</p></div><div class="paper terms"><h3>Before you send your request</h3><p>Check-in ${state.settings.checkIn} · Check-out ${state.settings.checkOut} IST</p><p>Cancel a pending request at any time. Confirmed stays can be cancelled here until ${state.settings.cancelHours} hours before arrival. Later cancellations need your host.</p><label class="check"><input type="checkbox" id="terms" required><span>I understand this is a sample request that needs host approval, with no payment or email confirmation.</span></label></div><button class="button full" type="submit">Send stay request <span>→</span></button></form>`
  }</div>${summary}</div>`;
}
function visitsPage() {
  if (!state.actor)
    return `<section class="empty"><span class="handwriting">Your next chapter</span><h1>A little space of your own.</h1><p>Sign in with a sample guest to see reservations and your journey with Aroha.</p><button class="button" data-login>Choose sample guest ↗</button></section>`;
  if (state.actor.role === "host")
    return `<section class="empty"><h1>You’re in the host account.</h1><p>Open Host Studio to manage all reservations, or choose a guest account to review their experience.</p><a class="button" href="/prototype/studio/">Open Host Studio ↗</a><button class="text-button" id="switch-guest">Choose sample guest</button></section>`;
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
  return `<section class="account-heading"><div><p class="eyebrow">YOUR AROHA</p><h1>Some places stay with you.</h1><p>Welcome back, ${esc(state.actor.name.split(" ·")[0])}. Your visits, all in one quiet corner.</p></div><a class="button" href="#plan">Plan another stay ↗</a></section><section class="loyalty-card"><div><p class="eyebrow">A LITTLE CLOSER EACH TIME</p><h2>${esc(t.name)} <span>· ${t.stays} completed stays</span></h2><p>${next ? `${next} more ${next === 1 ? "stay" : "stays"} until ${t.name === "Visitor" ? "Friend" : "Family"}.` : "You’re part of the Aroha Family."} ${t.discount ? `${t.discount}% sample stay benefit.` : "Every completed overnight visit brings you closer."}</p></div><div class="tier-path">${[
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
  return `<article class="visit-card"><div class="visit-date"><strong>${format(b.arrival, { day: "numeric" })}</strong><span>${format(b.arrival, { month: "short" })}</span></div><div class="visit-info"><div class="visit-top">${badge(b.status)}<span class="reference">${esc(b.reference)}</span></div><h3>${esc(b.unitNames?.join(" + ") || b.units.join(", "))}</h3><p>${format(b.arrival)} — ${format(b.departure)} · ${b.guests} guests${host ? " · " + esc(state.users.find((u) => u.id === b.owner)?.name.split(" ·")[0] || "Sample host") : ""}</p>${b.status === "pending_approval" ? `<p class="deadline">Host review by ${new Date(b.expiresAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} IST</p>` : ""}</div><div class="visit-action"><strong>${money(b.total)}</strong><button class="text-button" data-booking="${b.id}">View ${host ? "request" : "details"} ↗</button></div></article>`;
}
function hostPage() {
  const nav = [
    ["overview", "Overview", "◈"],
    ["calendar", "Retreat calendar", "▦"],
    ["reservations", "Reservations", "☷"],
    ["inventory", "Rooms & inventory", "⌂"],
    ["offers", "Rates & offers", "◇"],
    ["guests", "Guests & loyalty", "♡"],
    ["settings", "Booking policies", "⚙"],
    ["website", "Website changes", "↗"],
  ];
  if (state.actor?.role !== "host")
    return `<div class="host-welcome"><img src="/assets/brand/logo-forest.svg" width="200" alt="Aroha Retreat"><p class="eyebrow">HOST STUDIO · LOCAL REVIEW</p><h1>A thoughtful stay<br>starts with you.</h1><p>Explore your reservation desk with a sample host account.<br>Guest sessions do not have access to host booking controls.</p><button class="button" id="host-login">Enter sample Host Studio ↗</button><a class="text-button" href="/prototype/booking/">← Back to guest experience</a></div>`;
  return `<div class="studio"><aside class="studio-nav"><a href="/prototype/booking/"><img src="/assets/brand/logo-white.svg" alt="Aroha Retreat" width="180" height="62"></a><p class="eyebrow">HOST STUDIO</p><nav aria-label="Studio modules">${nav.map(([id, label, icon]) => `<button data-host-tab="${id}" ${hostTab === id ? 'aria-current="page"' : ""}><span aria-hidden="true">${icon}</span>${label}</button>`).join("")}</nav><div class="studio-bottom"><p>Sample host workspace</p><a href="/prototype/booking/">View guest portal ↗</a><button class="text-button" id="logout">Leave demo account</button></div></aside><div class="studio-content"><header class="studio-header"><span>HOST STUDIO <b>/</b> ${nav.find((x) => x[0] === hostTab)[1]}</span><span class="host-avatar">H</span></header><main id="main" class="studio-main" tabindex="-1">${hostContent()}</main></div></div>`;
}
function hostContent() {
  const pending = state.bookings.filter((b) => b.status === "pending_approval"),
    active = state.bookings.filter((b) =>
      ["confirmed", "checked_in"].includes(b.status),
    ),
    rooms = state.units.filter((u) => u.active),
    title = (eye, h, p, action = "") =>
      `<div class="section-heading studio-title"><div><p class="eyebrow">${eye}</p><h1>${h}</h1><p>${p}</p></div>${action}</div>`;
  if (hostTab === "overview")
    return `${title("YOUR HOSTING DESK", "Make room for good days.", "A clear view of the people and places you’re caring for.")}<div class="stat-grid"><article><span>Awaiting your welcome</span><strong>${pending.length}</strong><small>Requests to review</small></article><article><span>Confirmed & checked in</span><strong>${active.length}</strong><small>Reservations on the calendar</small></article><article><span>Ready to host</span><strong>${rooms.length}<em>rooms</em></strong><small>${rooms.reduce((n, u) => n + u.capacity, 0)} configured beds · site cap ${state.settings.capacity}</small></article><article><span>Future rooms</span><strong>4</strong><small>Under construction · not available</small></article></div><section class="host-section"><div class="section-heading"><div><p class="eyebrow">A PERSONAL WELCOME</p><h2>Waiting for your reply</h2></div><button class="text-button" data-host-tab="calendar">Open calendar ↗</button></div>${pending.length ? pending.map((b) => bookingCard(b, true)).join("") : '<div class="paper"><h3>You’re all caught up.</h3><p>New requests will appear here.</p></div>'}</section><div class="host-bottom-grid"><article class="paper"><p class="eyebrow">BEFORE YOU OPEN THE DOORS</p><h3>Five rooms. Four identified.</h3><p>The current site limit is 10 overnight guests. Four verified room placeholders account for eight beds. Map the fifth room before making it available.</p><button class="text-button" data-host-tab="inventory">Review inventory →</button></article><article class="paper"><p class="eyebrow">DELIVERY STATUS</p><h3>Everything stays here, for now.</h3><p>Requests and status changes appear in the portal. Email, payments and external calendar sync are not connected.</p><small>${state.audit.length} committed prototype events · local audit only</small></article></div>`;
  if (hostTab === "calendar")
    return `${title("THE RETREAT, AT A GLANCE", "A little room in the calendar.", "Pending requests hold their rooms until the review deadline.")}<div class="calendar-tools"><button class="outline-button" id="calendar-prev">← Previous week</button><strong>${format(calendarStart)} — ${format(add(calendarStart, 13))}</strong><button class="outline-button" id="calendar-next">Next week →</button><button class="text-button" id="calendar-today">Today</button></div><div class="legend"><span>○ Available</span><span class="legend-pending">◐ Pending</span><span class="legend-confirmed">● Confirmed</span><span>▨ Maintenance</span></div><div class="timeline-scroll" tabindex="0" aria-label="Room availability timeline. Scroll horizontally for more dates."><table class="timeline"><caption class="sr-only">Fourteen-day room availability</caption><thead><tr><th scope="col">Accommodation</th>${Array.from({ length: 14 }, (_, i) => `<th scope="col">${format(add(calendarStart, i), { weekday: "short" })}<strong>${format(add(calendarStart, i), { day: "numeric", month: "short" })}</strong></th>`).join("")}</tr></thead><tbody>${rooms
      .map(
        (u) =>
          `<tr><th scope="row">${esc(u.name)}<small>Up to ${u.capacity} guests</small></th>${Array.from(
            { length: 14 },
            (_, i) => {
              const d = add(calendarStart, i),
                b = state.bookings.find(
                  (b) =>
                    ["pending_approval", "confirmed", "checked_in"].includes(
                      b.status,
                    ) &&
                    b.units.includes(u.id) &&
                    b.arrival <= d &&
                    b.departure > d,
                ),
                block = state.blocks.find(
                  (b) => b.unitId === u.id && b.arrival <= d && b.departure > d,
                );
              return `<td><button class="timeline-cell ${b ? b.status : block ? "blocked" : ""}" ${b ? `data-booking="${b.id}"` : block ? `data-unblock="${block.id}"` : `data-block-unit="${u.id}" data-block-date="${d}"`} aria-label="${esc(u.name)}, ${format(d)}: ${b ? esc(pretty(b.status) + " " + b.reference) : block ? "maintenance block; select to release" : "available; select to block"}">${b ? `<span>${esc(b.reference)}</span><small>${b.guests} guests</small>` : block ? "▨" : "·"}</button></td>`;
            },
          ).join("")}</tr>`,
      )
      .join(
        "",
      )}<tr class="occupancy-row"><th scope="row">Overnight guests<small>Limit ${state.settings.capacity}</small></th>${Array.from(
      { length: 14 },
      (_, i) => {
        const d = add(calendarStart, i),
          n = state.bookings
            .filter(
              (b) =>
                ["pending_approval", "confirmed", "checked_in"].includes(
                  b.status,
                ) &&
                b.arrival <= d &&
                b.departure > d,
            )
            .reduce((n, b) => n + b.guests, 0);
        return `<td>${n} / ${state.settings.capacity}</td>`;
      },
    ).join(
      "",
    )}</tr></tbody></table></div><p class="form-note">Select a reservation to review it. Select an empty future cell to block a room for maintenance. All dates are IST. Checkout dates are available for the next stay.</p>`;
  if (hostTab === "reservations")
    return `${title("EVERY STAY, IN ONE PLACE", "Your reservations.", "Review requests and follow each visit through to completion.")}<div class="filter-row"><label class="search-label">Search reservations<input id="reservation-search" placeholder="Reference, guest or room…"></label><label>Status<select id="reservation-status"><option value="all">All statuses</option>${["pending_approval", "confirmed", "checked_in", "completed", "cancelled", "declined", "expired", "no_show"].map((s) => `<option value="${s}">${pretty(s)}</option>`).join("")}</select></label></div><div id="reservation-results">${[
      ...state.bookings,
    ]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((b) => bookingCard(b, true))
      .join("")}</div>`;
  if (hostTab === "inventory")
    return `${title("CARE FOR YOUR SPACES", "Rooms that are ready.", "Individual room capacities and the overall retreat limit are both enforced.")}<div class="notice-strip">${state.settings.capacity}-person overnight limit · ${rooms.reduce((n, u) => n + u.capacity, 0)} configured beds · Fifth room awaiting identification · Future rooms closed</div><div class="inventory-grid">${state.units.map((u) => `<article class="inventory-card"><div class="inventory-art ${u.image ? "" : "future"}">${u.image ? `<img src="/assets/retreat/${esc(u.image)}" alt="Retreat accommodation photograph">` : "<span>⌂</span>"}<span class="inventory-state">${u.active ? "Open for requests" : u.type === "Under construction" ? "Under construction" : "Needs configuration"}</span></div><form data-unit-form="${u.id}"><p class="eyebrow">${esc(u.type)}</p><h3>${esc(u.name)}</h3><div class="two-fields"><label>Guests per room<input name="capacity" type="number" min="1" max="10" value="${u.capacity}" required></label><label>Sample ₹ / night<input name="rate" type="number" min="100" max="1000000" value="${u.rate / 100 || 4200}" required></label></div><label class="check"><input type="checkbox" name="active" ${u.active ? "checked" : ""} ${["Under construction", "Unconfigured"].includes(u.type) ? "disabled" : ""}>Open for requests</label><button class="outline-button full" type="submit">Save room settings</button></form></article>`).join("")}</div>${state.blocks.length ? `<section class="host-section"><h2>Maintenance blocks</h2>${state.blocks.map((b) => `<div class="block-row"><span>${esc(state.units.find((u) => u.id === b.unitId)?.name)} · ${format(b.arrival)} — ${format(b.departure)} · ${esc(b.reason)}</span><button class="text-button" data-unblock="${b.id}">Release block</button></div>`).join("")}</section>` : ""}`;
  if (hostTab === "offers")
    return `${title("A THOUGHTFUL LITTLE EXTRA", "Invitations to return.", "Sample room rates live under Rooms & inventory. Offers apply before host approval.", '<button class="button" id="new-promo">Create invitation code +</button>')}<div class="notice-strip">One best offer per stay · Pending requests reserve a redemption · Cancellation restores sample offer usage</div><div class="offers-grid">${state.promos.map((p) => `<article class="offer-card"><p class="eyebrow">${p.active ? "ACTIVE INVITATION" : "PAUSED INVITATION"}</p><h2>${esc(p.code)}</h2><strong class="offer-amount">${p.kind === "percent" ? p.value + "%" : money(p.value)} <span>off a stay</span></strong><p>${format(p.from)} — ${format(p.until, { day: "numeric", month: "short", year: "numeric" })}</p><div class="offer-bottom"><span>${p.uses} / ${p.maxUses} reserved or redeemed</span><button class="text-button" data-toggle-promo="${p.id}">${p.active ? "Pause" : "Activate"} →</button></div></article>`).join("")}</div><div class="paper"><h3>Offer rules in this prototype</h3><p>Fixed or percentage discounts; date validity; total redemption limits; one offer per reservation. Loyalty applies automatically unless a promo is better. Prices and benefits remain sample values for review.</p></div>`;
  if (hostTab === "guests")
    return `${title("FAMILIAR FACES", "Closer with every stay.", "Completed overnight visits earn a stay credit. Cancelled requests and nights do not.")}<div class="tier-definition">${[
      ["Visitor", "0–" + (state.settings.friendAt - 1) + " stays", 0],
      [
        "Friend",
        state.settings.friendAt +
          "–" +
          (state.settings.familyAt - 1) +
          " stays",
        state.settings.friendDiscount,
      ],
      [
        "Family",
        state.settings.familyAt + "+ stays",
        state.settings.familyDiscount,
      ],
    ]
      .map(
        ([name, range, benefit]) =>
          `<article><span class="handwriting">${name}</span><h3>${range}</h3><p>${benefit ? benefit + "% sample stay benefit" : "A warm first welcome"}</p></article>`,
      )
      .join(
        "",
      )}</div><div class="paper"><table class="guest-table"><thead><tr><th>Sample guest</th><th>Completed stays</th><th>Tier</th><th>Next milestone</th></tr></thead><tbody>${state.users
      .filter((u) => u.role === "guest")
      .map((u) => {
        const stays = state.bookings.filter(
            (b) => b.owner === u.id && b.status === "completed",
          ).length,
          name =
            stays >= state.settings.familyAt
              ? "Family"
              : stays >= state.settings.friendAt
                ? "Friend"
                : "Visitor",
          next =
            stays >= state.settings.familyAt
              ? null
              : stays >= state.settings.friendAt
                ? state.settings.familyAt
                : state.settings.friendAt;
        return `<tr><td>${esc(u.name.split(" ·")[0])}</td><td>${stays}</td><td>${name}</td><td>${next ? next - stays + " stays to go" : "Family member"}</td></tr>`;
      })
      .join(
        "",
      )}</tbody></table></div><p class="form-note">Tier thresholds and sample benefits are configurable in Booking policies. Historical imports and manual credits need an audited production workflow.</p>`;
  if (hostTab === "settings")
    return `${title("CLEAR TERMS, CALMER STAYS", "Your hosting rhythm.", "These sample policies affect new requests. Existing cancellation terms stay attached to their booking.")}<form id="settings-form" class="settings-form"><section class="paper"><h2>Capacity & approvals</h2><div class="two-fields"><label>Overall overnight guest limit<input name="capacity" type="number" min="1" max="100" value="${state.settings.capacity}" required></label><label>Host approval window (hours)<input name="approvalHours" type="number" min="1" max="72" value="${state.settings.approvalHours}" required></label><label>Free self-service cancellation before arrival (hours)<input name="cancelHours" type="number" min="0" max="336" value="${state.settings.cancelHours}" required></label></div><label class="check"><input type="checkbox" name="paused" ${state.settings.paused ? "checked" : ""}><span>Pause new requests. Existing bookings remain visible.</span></label><p class="form-note">Check-in 14:00 · Check-out 11:00 IST. Day visits remain disabled pending their capacity and slot policy.</p></section><section class="paper"><h2>Closer with each completed stay</h2><div class="two-fields"><label>Friend begins at (stays)<input type="number" name="friendAt" min="1" max="100" value="${state.settings.friendAt}" required></label><label>Family begins at (stays)<input type="number" name="familyAt" min="2" max="200" value="${state.settings.familyAt}" required></label><label>Friend sample discount (%)<input type="number" name="friendDiscount" min="0" max="50" value="${state.settings.friendDiscount}" required></label><label>Family sample discount (%)<input type="number" name="familyDiscount" min="0" max="50" value="${state.settings.familyDiscount}" required></label></div></section><button class="button" type="submit">Save booking policies →</button></form><section class="host-section"><h2>Recent operational history</h2><div class="audit-list">${
      state.audit.length
        ? state.audit
            .slice(0, 10)
            .map(
              (e) =>
                `<p><strong>${esc(pretty(e.type.replaceAll(".", " ")))}</strong><span>${new Date(e.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</span></p>`,
            )
            .join("")
        : "<p>No local changes yet.</p>"
    }</div></section>`;
  return `${title("YOUR PUBLIC RETREAT", "Website changes.", "Website content stays separate from reservation operations.")}<div class="paper"><h2>Your existing editor is preserved.</h2><p>All current content categories belong here in the integrated Studio. This review prototype does not read or overwrite the live host draft.</p><div class="website-categories">${["Brand & welcome", "Page layout", "Farm tour & films", "Living Map stories", "Cottages", "Experiences", "Visit packages", "Contact & FAQs", "Design & motion", "Published history"].map((s) => `<div><span>${s}</span><small>Existing CMS editor</small></div>`).join("")}</div><a class="outline-button" href="https://aroharetreat.com/admin/" target="_blank" rel="noopener noreferrer">Open existing Host Studio ↗</a><p class="form-note">Opens the real Studio in a new tab and requires your existing host account. Publishing there affects the live site.</p></div>`;
}
function render() {
  document.title = hostRoute()
    ? "Host Studio · Aroha booking review"
    : "Your time at Aroha · Booking review";
  app.innerHTML = hostRoute()
    ? hostPage()
    : `${header()}<main id="main" class="guest-main" tabindex="-1">${location.hash === "#visits" ? visitsPage() : planPage()}</main>${foot()}`;
  bind();
  extendPage();
}
function detail(id) {
  dialog.dataset.detailId = id;
  const b = state.bookings.find((b) => b.id === id);
  if (!b) return;
  const isHost = state.actor?.role === "host",
    owner = state.users?.find((u) => u.id === b.owner);
  open(
    `<p class="eyebrow">${esc(b.reference)} ${isHost && owner ? "· " + esc(owner.name.split(" ·")[0]) : ""}</p><h2>Your little corner of Aroha.</h2>${badge(b.status)}<div class="detail-dates"><strong>${format(b.arrival, { day: "numeric", month: "long" })} — ${format(b.departure, { day: "numeric", month: "long", year: "numeric" })}</strong><p>${esc(b.unitNames.join(" + "))} · ${b.guests} guests</p></div><dl class="detail-price"><div><dt>Room subtotal</dt><dd>${money(b.subtotal)}</dd></div><div><dt>Offer</dt><dd>−${money(b.discount)}</dd></div><div class="total"><dt>Sample stay total</dt><dd>${money(b.total)}</dd></div></dl>${b.note ? `<div class="private-note"><p class="eyebrow">PRIVATE GUEST REQUEST</p><p>${esc(b.note)}</p></div>` : ""}${b.status === "pending_approval" ? `<div class="approval-note"><strong>Awaiting your host’s approval</strong><p>Review deadline: ${new Date(b.expiresAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST. Your rooms are held until then.</p></div>` : ""}<div class="status-history">${b.history.map((h) => `<div><span></span><p><strong>${esc(pretty(h.status))}</strong><small>${new Date(h.at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}</small></p></div>`).join("")}</div><div class="detail-actions">${isHost && b.status === "pending_approval" ? `<button class="button" data-action="approve" data-id="${b.id}">Approve request ✓</button><button class="outline-button" data-action="decline" data-id="${b.id}">Decline request</button>` : ""}${isHost && b.status === "confirmed" ? `<button class="button" data-action="checkin" data-id="${b.id}">Check in</button><button class="text-button" data-action="no_show" data-id="${b.id}">Mark no-show</button>` : ""}${isHost && b.status === "checked_in" ? `<button class="button" data-action="complete" data-id="${b.id}">Complete stay</button>` : ""}${["pending_approval", "confirmed"].includes(b.status) ? `<button class="text-button danger" data-cancel="${b.id}">Cancel ${b.status === "pending_approval" ? "request" : "booking"}</button>` : ""}</div><p class="form-note">No email sent. No payment collected. Confirmed-stay cancellation cutoff: ${b.cancelHours ?? state.settings.cancelHours} hours before arrival. For later cancellation, contact the host.</p>`,
  );
}
function bindDialog() {
  dialog.querySelectorAll("[data-persona]").forEach(
    (b) =>
      (b.onclick = () =>
        run(async () => {
          await api("session", { persona: b.dataset.persona });
          await refresh();
          dialog.close();
          render();
          toast("Sample account ready. Welcome in.");
        })),
  );
  dialog.querySelectorAll("[data-action]").forEach(
    (b) =>
      (b.onclick = () =>
        run(async () => {
          const booking = state.bookings.find((x) => x.id === b.dataset.id);
          await api("booking-action", {
            id: booking.id,
            action: b.dataset.action,
            expectedVersion: booking.version,
          });
          await refresh();
          render();
          detail(booking.id);
          toast("Reservation updated.");
        })),
  );
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
  if (["overview", "reservations", "calendar"].includes(hostTab)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "button";
    b.textContent = "Add host reservation +";
    b.id = "manual-reservation";
    b.onclick = manualReservation;
    document.querySelector(".studio-title")?.append(b);
  }
}
function extendDetail() {
  if (!dialog.querySelector(".detail-dates")) return;
  const b = state.bookings.find((b) => b.id === dialog.dataset.detailId);
  if (!b) return;
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
    if (b.status === "confirmed") {
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
    `<p class="eyebrow">A LITTLE CHANGE OF PLANS</p><h2>Find a new time.</h2><p>Your current rooms stay reserved while the host reviews your request. New dates are checked again at approval.</p><form id="change-form"><div class="two-fields"><label>New arrival<input name="arrival" type="date" min="${day(1)}" value="${b.arrival}" required></label><label>New departure<input name="departure" type="date" value="${b.departure}" required></label></div><label>Guests<input name="guests" type="number" min="1" max="10" value="${b.guests}" required></label><button class="button full" type="submit">Review new dates →</button></form>`,
  );
  dialog.querySelector("#change-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(async () => {
      const q = await api("change-quote", {
        id: b.id,
        expectedVersion: b.version,
        arrival: f.get("arrival"),
        departure: f.get("departure"),
        guests: Number(f.get("guests")),
        promo: b.promo,
      });
      open(
        `<p class="eyebrow">REVIEW YOUR CHANGE</p><h2>A new little chapter.</h2><p>${format(q.arrival)} — ${format(q.departure)} · ${q.guests} guests</p><h3>${money(q.total)} sample stay total</h3><p>Same rooms. The host must approve the new dates and price. Your original booking stays valid until then.</p><button class="button full" id="send-change">Send change request →</button>`,
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
function manualReservation() {
  open(
    `<p class="eyebrow">A PERSONAL RESERVATION</p><h2>Add a host booking.</h2><p>For sample phone or WhatsApp reservations. The same capacity rules apply.</p><form id="manual-form"><label>Sample guest<select name="guestId">${state.users
      .filter((u) => u.role === "guest")
      .map(
        (u) => `<option value="${u.id}">${esc(u.name.split(" ·")[0])}</option>`,
      )
      .join(
        "",
      )}</select></label><div class="two-fields"><label>Arrival<input name="arrival" type="date" min="${day(1)}" value="${day(3)}" required></label><label>Departure<input name="departure" type="date" value="${day(5)}" required></label></div><label>Room<select name="unit">${state.units
      .filter((u) => u.active)
      .map((u) => `<option value="${u.id}">${esc(u.name)}</option>`)
      .join(
        "",
      )}</select></label><label>Guests<input type="number" name="guests" min="1" max="2" value="2" required></label><label>Private guest request<textarea name="note" maxlength="1000" rows="3"></textarea></label><button class="button full" type="submit">Review reservation →</button></form>`,
  );
  dialog.querySelector("#manual-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      note = f.get("note");
    run(async () => {
      const q = await api("quote", {
        arrival: f.get("arrival"),
        departure: f.get("departure"),
        guests: Number(f.get("guests")),
        units: [f.get("unit")],
        guestId: f.get("guestId"),
        promo: "",
      });
      open(
        `<p class="eyebrow">REVIEW HOST RESERVATION</p><h2>One more welcome.</h2><p>${esc(q.unitNames.join(" + "))} · ${format(q.arrival)} — ${format(q.departure)} · ${q.guests} guests</p><h3>${money(q.total)} sample total</h3><p>Create a pending request, then approve it from the reservation details.</p><button class="button full" id="create-manual">Create reservation request →</button>`,
      );
      dialog.querySelector("#create-manual").onclick = () =>
        run(async () => {
          const b = await api("create", { quoteId: q.id, note }, q.id);
          await refresh();
          render();
          detail(b.id);
          toast("Host reservation request created.");
        });
    });
  };
}
function readDates(form) {
  const f = new FormData(form);
  search = {
    arrival: f.get("arrival"),
    departure: f.get("departure"),
    guests: Number(f.get("guests")),
  };
  selected = [];
  quote = null;
}
function bind() {
  document.querySelector("#account")?.addEventListener("click", () => {
    if (!state.actor) {
      login();
      return;
    }
    open(
      `<p class="eyebrow">YOUR SAMPLE ACCOUNT</p><h2>${esc(state.actor.name.split(" ·")[0])}</h2><p>This session is local to the booking review. Your real Google account is not connected.</p><button class="button" id="account-logout">Sign out of sample account</button>`,
    );
    dialog.querySelector("#account-logout").onclick = () =>
      run(async () => {
        await api("logout", {});
        await refresh();
        dialog.close();
        render();
      });
  });
  document.querySelectorAll("[data-login]").forEach((b) => (b.onclick = login));
  document.querySelector("#switch-guest")?.addEventListener("click", login);
  document.querySelector("#host-login")?.addEventListener("click", () =>
    run(async () => {
      await api("session", { persona: "host" });
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
        render();
      }),
  );
  document.querySelectorAll("[data-date]").forEach(
    (b) =>
      (b.onclick = () => {
        const d = b.dataset.date;
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
    const departure = e.currentTarget.querySelector('[name="departure"]');
    departure.min = add(search.arrival, 1);
    document.querySelectorAll("[data-date]").forEach((cell) => {
      const d = cell.dataset.date,
        endpoint = d === search.arrival || d === search.departure;
      cell.classList.toggle("endpoint", endpoint);
      cell.classList.toggle(
        "in-range",
        d > search.arrival && d < search.departure,
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
            ? ", arrival"
            : d === search.departure
              ? ", departure"
              : ""),
      );
    });
  });
  document.querySelector("#search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    readDates(e.currentTarget);
    if (!state.actor) {
      login();
      return;
    }
    if (state.actor.role === "host") {
      toast("Choose a sample guest account to review guest bookings.", true);
      login();
      return;
    }
    run(async () => {
      available = await api("availability", search);
      step = 2;
      render();
      document.querySelector("#main").focus();
      window.scrollTo(0, 0);
    });
  });
  document.querySelector("#back-step")?.addEventListener("click", () => {
    if (step === 3) note = document.querySelector("#note")?.value || note;
    step--;
    quote = null;
    render();
    window.scrollTo(0, 0);
  });
  document.querySelectorAll("[data-room]").forEach(
    (b) =>
      (b.onclick = () => {
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
    };
    run(async () => {
      const b = await api("create", body, quote.id);
      await refresh();
      step = 1;
      selected = [];
      quote = null;
      note = "";
      promo = "";
      location.hash = "visits";
      render();
      open(
        `<div class="success-mark">✓</div><p class="eyebrow">A LITTLE SOMETHING TO LOOK FORWARD TO</p><h2>Your request is with your hosts.</h2><p>${esc(b.reference)} · ${format(b.arrival)} — ${format(b.departure)}</p>${badge("pending_approval")}<p>Your sample rooms are held until the host review deadline. Follow the response in Your visits.</p><p class="form-note">This is a local prototype reservation. No real stay or email has been created.</p><button class="button full" id="see-request">See my request →</button>`,
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
  document
    .querySelectorAll("[data-booking]")
    .forEach((b) => (b.onclick = () => detail(b.dataset.booking)));
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
    render();
  });
  document.querySelector("#calendar-next")?.addEventListener("click", () => {
    calendarStart = add(calendarStart, 7);
    render();
  });
  document.querySelector("#calendar-today")?.addEventListener("click", () => {
    calendarStart = day();
    render();
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
            expectedVersion: u.version,
            capacity: Number(f.get("capacity")),
            rate: Math.round(Number(f.get("rate")) * 100),
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
      `<p class="eyebrow">AN INVITATION TO SLOW DOWN</p><h2>Create an offer.</h2><form id="promo-form"><label>Invitation code<div class="promo-field"><input name="code" id="generated-code" value="AROHA${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}" pattern="[A-Za-z0-9]{4,24}" maxlength="24" required><button class="outline-button" type="button" id="generate-code">Generate</button></div></label><div class="two-fields"><label>Offer type<select name="kind"><option value="percent">Percentage off</option><option value="fixed">Fixed amount (₹)</option></select></label><label>Discount value<input type="number" name="value" min="1" max="100000" value="10" required></label><label>Valid from<input type="date" name="from" value="${day()}" required></label><label>Valid until<input type="date" name="until" value="${day(90)}" required></label><label>Total redemption limit<input type="number" name="maxUses" value="20" min="1" max="10000" required></label></div><button class="button full" type="submit">Create invitation code →</button></form>`,
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
        dialog.close();
        render();
        toast("Invitation code created.");
      });
    };
  });
  document.querySelectorAll("[data-block-unit]").forEach(
    (b) =>
      (b.onclick = () => {
        open(
          `<p class="eyebrow">CARE FOR YOUR SPACES</p><h2>Block a room.</h2><p>${esc(state.units.find((u) => u.id === b.dataset.blockUnit).name)}</p><form id="block-form"><div class="two-fields"><label>From<input name="arrival" type="date" min="${day(1)}" value="${b.dataset.blockDate}" required></label><label>Until (exclusive)<input name="departure" type="date" value="${add(b.dataset.blockDate, 1)}" required></label></div><label>Reason<input name="reason" maxlength="120" placeholder="Maintenance, host use…" required></label><button class="button full" type="submit">Block room →</button></form>`,
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
            dialog.close();
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
            dialog.close();
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
            `${b.reference} ${b.unitNames.join(" ")} ${state.users.find((u) => u.id === b.owner)?.name || ""}`
              .toLowerCase()
              .includes(q),
        )
        .map((b) => bookingCard(b, true))
        .join("") || '<div class="paper">No matching reservations.</div>';
    document
      .querySelectorAll("[data-booking]")
      .forEach((b) => (b.onclick = () => detail(b.dataset.booking)));
  };
  document
    .querySelector("#reservation-search")
    ?.addEventListener("input", filter);
  document
    .querySelector("#reservation-status")
    ?.addEventListener("change", filter);
}
window.addEventListener("hashchange", () => {
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
  app.innerHTML = `<main class="empty"><h1>The review server is taking a moment.</h1><p>${esc(e.message)}</p><a class="button" href="/prototype/booking/">Reload review</a></main>`;
}
