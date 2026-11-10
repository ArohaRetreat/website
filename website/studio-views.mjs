import { openStudioDialog, studioStatus } from "./studio-feedback.mjs";
import { escape as e } from "./frontdesk.mjs";
import { mountCreditWallet } from "./host-operations.mjs";
import { mountBookingDocuments } from "./booking-documents.mjs";
import { visitDateLabel } from "./booking-visit-label.mjs";
import { studioTable } from "./studio-table.mjs";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value / 100);
const date = (day, options = {}) => new Date(day + "T12:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", ...options, timeZone: "Asia/Kolkata" });
const dateTime = (at) => Number.isFinite(at) ? new Date(at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—";
export const studioInitials = (name) => String(name || "Aroha Retreat").trim().split(/\s+/).slice(0,2).map((word) => [...word][0] || "").join("").toUpperCase();
const kinds = { private: "Private room", individual: "Individual stay", day: "Day visit", event: "Exclusive retreat" };
const words = (value) => String(value || "").replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase());
const heading = (title, copy, eyebrow = "") => `<header class="workspace-heading">${eyebrow ? `<p class="eyebrow">${e(eyebrow)}</p>` : ""}<h1>${e(title)}</h1><p>${e(copy)}</p></header>`;
const icon = (path) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
const paths = {
  requests: "M4 4h16l2 10v6H2v-6Zm-2 10h6l2 3h4l2-3h6",
  calendar: "M3 5h18v16H3zM7 3v4m10-4v4M3 10h18",
  rooms: "M3 18V9m18 9v-5a3 3 0 0 0-3-3H8v5M3 15h18M5 11h3V8H5z",
  payments: "M3 5h18v14H3zM3 10h18M7 15h4m3 0h2",
  guests: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-3.9M16 3a4 4 0 0 1 0 8",
  add: "M12 5v14M5 12h14",
  arrow: "M4 12h16m-6-6 6 6-6 6",
};
const symbol = (name, tone = "") => `<span class="workspace-icon ${tone}">${icon(paths[name])}</span>`;
const button = (label, action, { className = "outline-button", extra = "" } = {}) =>
  `<button type="button" class="${className}" ${action} ${extra}>${e(label)}</button>`;
const surface = (title, copy, body) => `<section class="workspace-card"><h2>${e(title)}</h2>${copy ? `<p class="workspace-muted">${e(copy)}</p>` : ""}${body}</section>`;
const quick = (label, copy, name, action) => `<button type="button" class="workspace-quick" ${action}>${symbol(name)}<span><strong>${e(label)}</strong><small>${e(copy)}</small></span>${icon(paths.arrow)}</button>`;
const metric = (label, value, copy, name, tone = "") => `<article class="workspace-metric"><span class="metric-label">${symbol(name,tone)}${e(label)}</span><strong>${e(value)}</strong><small>${e(copy)}</small></article>`;

export async function mountStudioDashboard(target, { call, manager, openBooking }) {
  async function load() {
    const refresh = target.querySelector("[data-dashboard-refresh]");
    if (refresh?.disabled) return;
    const hasResults = Boolean(target.querySelector(".workspace-metrics"));
    const restoreFocus = refresh && target.ownerDocument.activeElement === refresh;
    if (refresh) refresh.disabled = true;
    if (!target.querySelector("[data-dashboard-status]")) {
      target.innerHTML = heading("Dashboard", "Booking activity, arrivals and payments at a glance.") +
        '<p data-dashboard-status role="status"></p>';
    }
    const status = target.querySelector("[data-dashboard-status]");
    studioStatus(status, hasResults ? "Refreshing dashboard…" : "Loading your dashboard…", true);
    try {
      const data = await call("getStudioDashboard", {});
      if (!target.isConnected) return;
      const agenda = data.agenda.map((item) => `<article class="workspace-row agenda-row">
        <time>${item.at ? new Date(item.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Kolkata" }) : "—"}</time>
        <div><strong>${e(item.guestName)}</strong><small>${item.action === "arrival" ? "Arrival" : "Checkout"} · ${e(kinds[item.kind] || "Visit")}</small></div>
        ${button(item.action === "arrival" ? "Open visit" : "Review checkout", `data-agenda-id="${e(item.id)}" data-agenda-action="${e(item.action)}"`)}
      </article>`).join("");
      const trend = data.paymentTrend;
      const max = Math.max(1, ...(trend || []).map((d) => Math.abs(d.netPaise)));
      const chart = trend ? `<figure class="studio-trend"><figcaption>Verified payments recorded over the last 7 days, after reversals.</figcaption><div class="trend-grid">${trend.map((day) => `<div title="${e(date(day.date) + " · " + money(day.netPaise))}"><span class="sr-only">${e(date(day.date) + " · " + money(day.netPaise))}</span><i aria-hidden="true" class="${day.netPaise < 0 ? "negative" : ""}" style="--bar:${Math.max(3,Math.abs(day.netPaise) / max * 100)}%"></i><small aria-hidden="true">${e(date(day.date,{month:undefined}))}</small></div>`).join("")}</div></figure>` : '<p>Open the ledger to review the current payment activity.</p>';
      target.innerHTML = `<div class="workspace-page-head">${heading("Dashboard", "Booking activity, arrivals and payments at a glance.", date(data.today, { weekday: "long", month: "long", year: "numeric" }) + " · IST")}
        <div class="workspace-actions">${manager ? button("+ New booking", "data-new-booking", { className:"primary mobile-new" }) : ""}${button("Refresh", "data-dashboard-refresh", { className:"text-button" })}</div></div>
        <p data-dashboard-status role="status">${refresh ? "Dashboard updated." : ""}</p>
        <div class="workspace-metrics">
          ${metric("Requests to review",data.requests,"New requests, offers and date changes","requests","amber")}
          ${metric("Arrivals today",data.arrivals,"Confirmed visits starting today","calendar")}
          ${metric("In house",data.inHouse,`${data.departures} due to check out today`,"rooms","blue")}
          ${manager ? metric("On-site balance due",data.balanceDuePaise === null ? "See ledger" : money(data.balanceDuePaise),"Today’s arrivals and checked-in visits","payments") : metric("Due to check out",data.departures,"Checked-in visits ending today","calendar")}
        </div>
        <div class="workspace-columns">
          <div class="workspace-stack">
            ${surface("Today’s agenda","Scheduled arrivals and departures · IST", (agenda || '<p class="workspace-empty">No arrivals or checkouts in this view.</p>') + button("Open Today", 'data-host-tab="today"', {className:"text-button"}))}
            ${manager ? surface("Verified payments","",chart + button("Open ledger", 'data-host-tab="payments"', {className:"text-button"})) : ""}
          </div>
          ${surface("Quick actions","Start with the job you need to do.",`<div class="workspace-quick-list">
            ${quick("Review requests","Decide on a visit or date change","requests",'data-host-tab="overview"')}
            ${manager ? quick("Add a walk-in","Create a booking for a guest","add","data-new-booking") : ""}
            ${quick("Check in a guest","Open today’s arrivals","calendar",'data-host-tab="today"')}
            ${manager ? quick("Find a guest","Open their profile and visit history","guests",'data-host-tab="guests"') : ""}
          </div>`)}
        </div>`;
      const nextRefresh = target.querySelector("[data-dashboard-refresh]");
      nextRefresh.onclick = () => void load();
      if (restoreFocus && target.ownerDocument.activeElement === target.ownerDocument.body)
        nextRefresh.focus({ preventScroll:true });
      target.querySelectorAll("[data-agenda-id]").forEach((control) => {
        control.onclick = () => openBooking(control.dataset.agendaId, control, control.dataset.agendaAction === "departure" ? "payments" : "overview");
      });
    } catch {
      if (!target.isConnected) return;
      if (refresh) {
        refresh.disabled = false;
        studioStatus(status, hasResults ? "The dashboard could not refresh. Showing the last loaded results." : "The dashboard could not load.");
        if (restoreFocus && target.ownerDocument.activeElement === target.ownerDocument.body)
          refresh.focus({ preventScroll:true });
      } else {
        studioStatus(status, "The dashboard could not load.");
        target.insertAdjacentHTML("beforeend", button("Try again", "data-dashboard-refresh"));
        target.querySelector("[data-dashboard-refresh]").onclick = () => void load();
      }
    }
  }
  await load();
}

const searchMode = (value) => value.includes("@") ? "email" : value.startsWith("+") ? "phone" : /^ar-/i.test(value) ? "reference" : "name";
export function mountStudioGuestLookup(target, { call, onSelect, action = "Open profile", initial = "", onSearch = () => {} }) {
  target.innerHTML = `<form class="studio-lookup" data-search>
    <label>Find by<select name="mode"><option value="name">Name</option><option value="email">Email</option><option value="phone">Phone</option><option value="reference">Booking ref.</option></select></label>
    <label>Search term<input name="search" type="search" minlength="2" maxlength="254" required autocomplete="off" aria-describedby="guest-lookup-hint"></label>
    <button class="primary" type="submit">Search guests</button><p id="guest-lookup-hint" class="lookup-hint"></p>
    </form><p data-lookup-status role="status"></p><div class="guest-matches" data-matches></div>`;
  const form = target.querySelector("form");
  const status = target.querySelector("[data-lookup-status]");
  const matches = target.querySelector("[data-matches]");
  const submit = form.querySelector("button");
  const field = form.elements.search;
  const hints = {
    name:["Start of a guest’s name", "Enter at least two letters from the start of the guest’s name."],
    email:["guest@example.com", "Enter the guest’s exact booking email."],
    phone:["+91 98765 43210", "Enter the guest’s phone number with country code."],
    reference:["AR-…", "Enter the exact booking reference."],
  };
  function hint() {
    const [placeholder, copy] = hints[form.elements.mode.value] || hints.name;
    field.placeholder = placeholder;
    form.querySelector(".lookup-hint").textContent = copy;
  }
  form.elements.mode.value = searchMode(initial);
  field.value = initial;
  form.elements.mode.addEventListener("change",hint);
  hint();
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    const mode = form.elements.mode.value;
    const search = field.value.trim();
    if (search.length < 2) {
      status.textContent = "Enter at least two characters.";
      return;
    }
    submit.disabled = true;
    matches.replaceChildren();
    studioStatus(status, "Searching for guests…", true);
    try {
      const result = await call("lookupCustomers", { mode, search, limit: 10 });
      if (!target.isConnected) return;
      onSearch(search);
      studioStatus(status, result.hasMore ? "More matches exist. Refine your search." : `${result.items.length} ${result.items.length === 1 ? "match" : "matches"}`);
      matches.innerHTML = result.items.map((person, index) => `<article class="workspace-row">
        <span class="workspace-icon" aria-hidden="true">${e(studioInitials(person.name))}</span><div><strong>${e(person.name)}</strong><small>${e(person.email || "Email unavailable")}${person.guestNumber ? ` · Guest #${Number(person.guestNumber)}` : ""}</small></div>
        ${button(action, `data-guest-match="${index}"`, { extra: `aria-label="${e(action + " for " + person.name)}"` })}
      </article>`).join("") || '<p class="workspace-empty">No guests matched. Try an exact email, phone or reference.</p>';
      matches.querySelectorAll("[data-guest-match]").forEach((control) => {
        control.onclick = () => onSelect(result.items[Number(control.dataset.guestMatch)]);
      });
    } catch {
      if (target.isConnected) studioStatus(status, "Guest search could not complete. Check the search and try again.");
    } finally {
      submit.disabled = false;
    }
  };
  if (initial.length >= 2) form.requestSubmit();
}

export function chooseStudioGuest(call, onSelect) {
  const trigger = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = "filter-dialog guest-picker";
  dialog.setAttribute("data-dt-mask", "");
  dialog.setAttribute("aria-labelledby", "guest-picker-title");
  dialog.innerHTML = '<header class="dialog-head"><div><h2 id="guest-picker-title">Find an existing guest</h2><p>Choose the profile that matches the guest’s booking details.</p></div><button type="button" class="text-button" data-close aria-label="Close guest search">×</button></header><div class="guest-picker-body" data-picker></div>';
  document.body.append(dialog);
  dialog.querySelector("[data-close]").onclick = () => dialog.close();
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (trigger?.isConnected) trigger.focus();
  }, {once:true});
  mountStudioGuestLookup(dialog.querySelector("[data-picker]"), { call, action:"Use guest", onSelect:(person) => {
    dialog.close();
    onSelect(person);
  }});
  openStudioDialog(dialog);
  dialog.querySelector("[type=search]").focus();
}

function mountStudioList(target, { fetchPage, renderRow, table, empty, onRows = () => {} }) {
  target.innerHTML = '<div data-studio-list></div><p data-studio-list-status role="status"></p><div data-studio-pagination class="workspace-actions"></div>';
  const list = target.querySelector("[data-studio-list]");
  const status = target.querySelector("[data-studio-list-status]");
  const pagination = target.querySelector("[data-studio-pagination]");
  const cursors = [undefined];
  async function load(position, cursor = cursors[position]) {
    studioStatus(status, "Loading records…", true);
    pagination.querySelectorAll("button").forEach((control) => control.disabled = true);
    try {
      const page = await fetchPage({ limit:15, ...(cursor ? { cursor } : {}) });
      if (!target.isConnected) return;
      cursors[position] = cursor;
      const rows = page.items.map(renderRow).join("");
      list.innerHTML = rows ? (table ? studioTable(...table, rows) : rows) : `<p class="workspace-empty">${e(empty)}</p>`;
      onRows(list, page.items);
      pagination.innerHTML = position || page.nextCursor ? `<button type="button" data-prev ${position ? "" : "disabled"}>Previous</button><span>Page ${position + 1} · ${page.items.length} records</span><button type="button" data-next ${page.nextCursor ? "" : "disabled"}>Next</button>` : "";
      pagination.querySelector("[data-prev]")?.addEventListener("click", () => void load(position - 1));
      pagination.querySelector("[data-next]")?.addEventListener("click", () => void load(position + 1, page.nextCursor));
      studioStatus(status, "");
    } catch (error) {
      if (!target.isConnected) return;
      studioStatus(status, error.code === "CURSOR_EXPIRED" ? "This page expired. Refresh to start again." : "This list could not load.");
      pagination.innerHTML = button("Reload","data-reload");
      pagination.querySelector("[data-reload]").onclick = () => void load(0);
    }
  }
  void load(0);
}

const visitRow = (visit) => `<tr>
  <th scope="row">${e(visit.reference)}<small>${e(kinds[visit.kind] || "Visit")}</small></th><td>${e(visitDateLabel(visit,date))}</td>
  <td><span class="table-status">${e(words(visit.status))}</span></td>
  <td class="table-number">${Number.isSafeInteger(visit.totalPaise) ? money(visit.totalPaise) : "—"}</td>
  <td class="table-actions">${button("Open booking",`data-profile-booking="${e(visit.id)}"`,{className:"text-button",extra:`aria-label="Open booking ${e(visit.reference)}"`})}</td>
</tr>`;

export function mountStudioGuests(target, { call, openBooking, openManual, initial = "", initialCustomerId, tab = "Overview" }) {
  let query = initial;
  function directory() {
    target.innerHTML = heading("Guests","Search for a guest to see their visits, payments and credits.") +
      surface("Find a guest","Search by name or use an exact email, phone or booking reference.",'<div data-guest-lookup></div>');
    mountStudioGuestLookup(target.querySelector("[data-guest-lookup]"), {
      call, initial:query, onSearch:(value) => query = value, onSelect:(person) => void profile(person.id),
    });
  }
  async function profile(id) {
    target.innerHTML = button("← Back to guest search","data-back-guests",{className:"text-button"}) + '<p role="status">Opening guest profile…</p>';
    target.querySelector("[data-back-guests]").onclick = directory;
    const status = target.querySelector("[role=status]");
    let guest;
    try {
      guest = await call("getStudioGuest",{id});
    } catch {
      if (status.isConnected) status.textContent = "This guest profile could not load. Return to search and try again.";
      return;
    }
    if (!status.isConnected) return;
    const tabs = ["Overview","Visits","Payments","Invoices & receipts","Credits","Messages"];
    function draw(selected, startCompose = false) {
      target.innerHTML = button("← Back to guest search","data-back-guests",{className:"text-button"}) + `<header class="workspace-profile">
        <div class="profile-identity"><span class="workspace-icon profile-avatar" aria-hidden="true">${e(studioInitials(guest.name))}</span>
          <div><p class="eyebrow">GUEST PROFILE</p><h1>${e(guest.name)}</h1><div class="profile-badges"><span class="table-status">${guest.accountConnected ? "Linked guest account" : "Host-recorded guest"}</span>${guest.guestNumber ? `<span class="table-status current">Guest #${Number(guest.guestNumber)}</span>` : ""}</div></div>
        </div>
        <div class="workspace-actions">${button("Email guest","data-profile-email",{extra:guest.email ? "" : "disabled"})}${button("+ New booking","data-profile-book",{className:"primary"})}</div>
        <dl class="studio-profile-contact"><div><dt>Email</dt><dd>${e(guest.email || "Unavailable")}</dd></div><div><dt>Phone</dt><dd>${e(guest.phone || "Unavailable")}</dd></div>${guest.guestNumber ? "" : "<div><dt>Guest number</dt><dd>Assigned at first check-in</dd></div>"}</dl>
      </header><nav class="workspace-tabs" aria-label="Guest profile sections">${tabs.map((name) => button(name,`data-profile-section="${e(name)}" aria-current="${selected === name ? "page" : "false"}"`,{className:"text-button"})).join("")}</nav><div data-profile-body></div>`;
      target.querySelector("[data-back-guests]").onclick = directory;
      target.querySelectorAll("[data-profile-section]").forEach((control) => control.onclick = () => draw(control.dataset.profileSection));
      target.querySelector("[data-profile-email]").onclick = () => draw("Messages",true);
      target.querySelector("[data-profile-book]").onclick = () => openManual(guest);
      const body = target.querySelector("[data-profile-body]");
      const visits = (slot) => mountStudioList(slot,{
        fetchPage:(page) => call("listCustomerReservations",{id,...page}),
        renderRow:visitRow,empty:"No visits recorded for this guest.",
        table:["Booking history",[["Booking"],["Visit dates"],["Status"],["Total","table-number"],["Actions","table-actions"]]],
        onRows:(list) => list.querySelectorAll("[data-profile-booking]").forEach((control) => {
          control.onclick = () => openBooking(control.dataset.profileBooking,control);
        }),
      });
      if (selected === "Overview") {
        body.innerHTML = `<div class="workspace-metrics">
          ${metric("Completed visits",guest.completedVisits,"Bookings marked complete","calendar")}
          ${metric("Nights stayed",guest.recordedNights ?? "—",guest.nightsComplete ? "Recorded completed stays" : "Historical nights may be incomplete","rooms","blue")}
          ${metric("Net verified payments",money(guest.netVerifiedPaidPaise),"Across all visits, after reversals","payments")}
          ${metric("Available credits",guest.creditsAvailable,"Current loyalty balance","guests","amber")}
        </div>${surface("Booking history","Upcoming and previous visits.",'<div data-guest-visits></div>')}`;
        visits(body.querySelector("[data-guest-visits]"));
      } else if (selected === "Visits") {
        body.innerHTML = surface("Booking history","Upcoming and previous visits.",'<div data-guest-visits></div>');
        visits(body.querySelector("[data-guest-visits]"));
      } else if (selected === "Payments") {
        body.innerHTML = surface("Payment history","Verified payments and reversals.",'<div data-guest-payments></div>');
        mountStudioList(body.querySelector("[data-guest-payments]"),{
          fetchPage:(page) => call("listStudioGuestPayments",{id,...page}),
          empty:"No verified payments have been recorded.",
          table:["Guest payments",[["Entry"],["Recorded (IST)"],["Method"],["Amount","table-number"],["Actions","table-actions"]]],
          renderRow:(payment) => `<tr><th scope="row">${e(words(payment.kind))}</th><td>${e(dateTime(payment.createdAt))}</td><td>${payment.method === "upi" ? "UPI" : e(payment.method ? words(payment.method) : "—")}</td>
            <td class="table-number">${money(payment.amountPaise)}</td><td class="table-actions">${button("Open booking",`data-profile-payment="${e(payment.bookingId)}"`,{className:"text-button"})}</td></tr>`,
          onRows:(list) => list.querySelectorAll("[data-profile-payment]").forEach((control) => control.onclick = () => openBooking(control.dataset.profilePayment,control,"payments")),
        });
      } else if (selected === "Invoices & receipts") {
        body.innerHTML = surface("Invoices & receipts","Open the issued details or download a PDF.",'<div data-guest-documents></div>');
        void mountBookingDocuments(body.querySelector("[data-guest-documents]"),{call,staff:true,customerId:id});
      } else if (selected === "Credits") {
        body.innerHTML = surface("Loyalty credits","Earned, redeemed and available credits.",'<div data-guest-credits></div>');
        void mountCreditWallet(body.querySelector("[data-guest-credits]"),{call,customerId:id,manager:true});
      } else {
        mountStudioMail(body,{call,customer:guest,startCompose});
      }
    }
    draw(tabs.includes(tab) ? tab : "Overview");
  }
  if (initialCustomerId) void profile(initialCustomerId);
  else directory();
}

const mailStatuses = {
  queued: "Queued", sending: "Sending", retry: "Waiting to retry", accepted: "Accepted for sending",
  delivered: "Delivered", delayed: "Delayed", bounced: "Bounced", complained: "Complaint received",
  failed: "Failed", needs_reconciliation: "Needs review", suppressed: "Suppressed",
};
const mailStatus = (job) => `<span class="badge ${job.status === "delivered" ? "green" : ["bounced","failed","complained"].includes(job.status) ? "danger" : ""}">${e(mailStatuses[job.status] || words(job.status))}</span>`;
const mailError = (code) => ({
  PREPROD_MAIL_RECIPIENT_REQUIRED:"This address is outside the pre-prod recipient allowlist.",
  MAIL_RECIPIENT_UNAVAILABLE:"This guest does not have an available email address.",
  MAIL_DISABLED:"Email sending is paused for this environment.",
  INVALID_EMAIL_TEXT:"Check the subject and message for invalid characters.",
  FORBIDDEN:"You no longer have access to send guest email.",
  NOT_FOUND:"The guest or related booking is unavailable.",
})[code] || "Check the recipient and message, then try again.";

export function mountStudioMail(target, { call, customer = null, bookingId, startCompose = false }) {
  let guestFilter = customer;

  function history() {
    target.innerHTML = `<div data-mail-history><div class="workspace-page-head">${heading("Guest email","Send an email or check its delivery status.")}
      <div class="workspace-actions">${button("Compose email","data-compose",{className:"primary"})}${button("Refresh","data-refresh-mail",{className:"text-button"})}</div></div>
      <section class="workspace-card sent-mail"><h2>Sent history</h2><p class="workspace-muted">Staff messages and automatic booking updates.</p>
      ${customer ? "" : `<div class="table-filter">${button("Filter by guest","data-filter-mail-guest")}<span>${e(guestFilter?.name || "All guests")}</span>${guestFilter ? button("Clear filter","data-clear-mail-guest",{className:"text-button"}) : ""}</div>`}
      <div data-mail-list></div></section></div>`;
    target.querySelector("[data-compose]").onclick = compose;
    target.querySelector("[data-refresh-mail]").onclick = history;
    function setGuest(person) {
      guestFilter = person;
      history();
      target.querySelector("[data-filter-mail-guest]")?.focus();
    }
    target.querySelector("[data-filter-mail-guest]")?.addEventListener("click", () => chooseStudioGuest(call,setGuest));
    target.querySelector("[data-clear-mail-guest]")?.addEventListener("click", () => setGuest(null));
    mountStudioList(target.querySelector("[data-mail-list]"),{
      fetchPage:(page) => call("listStudioEmail",{...(guestFilter ? {id:guestFilter.id} : {}),...page}),
      table:["Guest email history",[["Subject"],["Recipient"],["Queued (IST)"],["Delivery"]]],
      renderRow:(job) => `<tr><th scope="row">${button(job.subject,`data-open-mail="${e(job.id)}"`,{className:"text-button mail-subject"})}</th>
        <td>${e(job.recipient)}</td><td>${e(dateTime(job.createdAt))}</td><td>${mailStatus(job)}</td></tr>`,
      empty:"No guest emails to show.",
      onRows:(list) => list.querySelectorAll("[data-open-mail]").forEach((control) => {
        control.onclick = () => void open(control.dataset.openMail,control);
      }),
    });
  }

  async function open(id, trigger) {
    const historyPane = target.querySelector("[data-mail-history]");
    if (historyPane) historyPane.hidden = true;
    else target.replaceChildren();
    const reader = document.createElement("section");
    reader.className = "mail-reader";
    reader.innerHTML = `${button("← Back to email history","data-mail-back",{className:"text-button"})}
      <div data-mail-detail><p role="status" data-studio-progress>Loading email…</p></div>`;
    target.append(reader);
    const slot = reader.querySelector("[data-mail-detail]");
    const back = reader.querySelector("[data-mail-back]");
    back.onclick = () => {
      if (historyPane) {
        reader.remove();
        historyPane.hidden = false;
        trigger?.focus();
      } else {
        history();
        target.querySelector("[data-compose]").focus();
      }
    };
    back.focus();
    async function load() {
      slot.innerHTML = '<p role="status" data-studio-progress>Loading email…</p>';
      try {
        const job = await call("getStudioEmail",{jobId:id});
        if (!slot.isConnected) return;
        const events = [["Queued",job.createdAt],["Accepted for sending",job.acceptedAt],["Delivered to mail server",job.deliveredAt]];
        if (!["queued","accepted","delivered"].includes(job.status) && job.statusAt)
          events.push([mailStatuses[job.status] || words(job.status),job.statusAt]);
        slot.innerHTML = `<article class="workspace-card"><p class="eyebrow">SENT EMAIL</p><h1>${e(job.subject)}</h1>
          <dl class="workspace-facts"><div><dt>To</dt><dd>${e(job.recipient)}</dd></div>
            <div><dt>Reply-to</dt><dd>${e(job.replyTo)}</dd></div>
            ${job.reference ? `<div><dt>Booking</dt><dd>${e(job.reference)}</dd></div>` : ""}
          </dl>${job.message ? `<p class="studio-mail-body">${e(job.message)}</p>` : ""}</article>
          <section class="workspace-card"><div class="mail-receipt-heading"><h2>Delivery receipt</h2>${mailStatus(job)}</div>
          <ol class="delivery-events">${events.filter(([,at])=>Number.isFinite(at)).map(([label,at])=>`<li><strong>${e(label)}</strong><small>${e(dateTime(at))} IST</small></li>`).join("")}</ol>
          <p class="workspace-muted">Delivered means the recipient’s mail server accepted the message.</p></section>`;
      } catch {
        if (!slot.isConnected) return;
        slot.innerHTML = '<p role="status">This email could not load.</p><button type="button" data-retry-mail>Retry</button>';
        slot.querySelector("[data-retry-mail]").onclick = load;
      }
    }
    await load();
  }

  function compose() {
    let recipient = guestFilter, pending, working = false;
    target.innerHTML = `<div class="mail-reader">
      ${button("← Back to email history","data-mail-back",{className:"text-button",extra:'form="studio-compose-form"'})}
      ${heading("Compose email","Send a message from Aroha Retreat.")}
      <form id="studio-compose-form" class="studio-composer" data-search>
        <div class="mail-envelope">
          <div><span>From</span><strong>Aroha Retreat</strong></div>
          <div><span>To</span><div class="mail-recipient" data-recipient></div>
            ${customer ? "" : button("Find guest","data-find-recipient",{className:"tonal"})}</div>
          <label><span>Subject</span><input name="subject" maxlength="120" placeholder="Add a subject" required></label>
        </div>
        <div class="mail-writing"><label for="studio-message">Message</label>
          <div class="workspace-actions" aria-label="Message templates" role="group">${button("Arrival directions",'data-template="arrival"',{className:"tonal"})}${button("Stay follow-up",'data-template="followup"',{className:"tonal"})}</div>
          <textarea id="studio-message" name="message" maxlength="2500" rows="8" placeholder="Write your message" required></textarea></div>
        <footer class="mail-send-bar"><div><p class="workspace-muted">Replies go to the retreat’s reply inbox.</p><p data-send-status role="status"></p></div>
          <button class="primary" type="submit" disabled>Send email</button></footer>
      </form></div>`;
    const form = target.querySelector("form");
    const status = form.querySelector("[data-send-status]");
    const submit = form.querySelector("[type=submit]");
    const back = target.querySelector("[data-mail-back]");
    function updateSend() {
      submit.disabled = !recipient?.email || !form.elements.subject.value.trim() || !form.elements.message.value.trim();
    }
    function recipientView() {
      form.querySelector("[data-recipient]").innerHTML = `<strong>${e(recipient?.name || "Choose a guest")}</strong><small>${e(recipient?.email || "Search by name, email or phone")}</small>`;
      if (form.querySelector("[data-find-recipient]"))
        form.querySelector("[data-find-recipient]").textContent = recipient ? "Change guest" : "Find guest";
      updateSend();
    }
    recipientView();
    form.querySelector("[data-find-recipient]")?.addEventListener("click", () => chooseStudioGuest(call,(person) => {
      recipient = person;
      recipientView();
    }));
    back.onclick = () => {
      if (!pending) history();
    };
    form.addEventListener("input", () => {
      if (!pending) updateSend();
    });
    form.querySelectorAll("[data-template]").forEach((control) => {
      control.onclick = () => {
        if (pending) return;
        const first = recipient?.name.split(/\s+/)[0] || "there";
        const arrival = control.dataset.template === "arrival";
        form.elements.subject.value = arrival ? "Directions to Aroha" : "Thank you for visiting Aroha";
        form.elements.message.value = `Hi ${first},\n\n${arrival ? "We look forward to welcoming you. Follow the directions on our website and please check in at reception when you arrive." : "Thank you for spending time with us. We hope to see you again."}\n\nYour hosts at Aroha Retreat`;
        updateSend();
        form.elements.subject.focus();
      };
    });
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (working) return;
      if (!recipient || !recipient.email) {
        status.textContent = "Choose a guest with an email address.";
        return;
      }
      const subject = form.elements.subject.value.trim();
      const message = form.elements.message.value.trim();
      if (!pending && (!subject || !message)) {
        status.textContent = "Enter a subject and message.";
        return;
      }
      pending ??= { input:{ id:recipient.id, ...(bookingId ? {bookingId} : {}), subject, message }, key:crypto.randomUUID() };
      working = true;
      form.dataset.emailPending = "";
      for (const control of form.elements) control.disabled = true;
      studioStatus(status, "Queuing email…", true);
      try {
        const job = await call("sendStudioEmail",pending.input,pending.key);
        if (form.isConnected) void open(job.id);
      } catch (error) {
        if (!form.isConnected) return;
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          pending = null;
          delete form.dataset.emailPending;
          for (const control of form.elements) control.disabled = false;
          submit.textContent = "Send email";
          studioStatus(status, mailError(error.code));
          updateSend();
        } else {
          submit.disabled = false;
          submit.textContent = "Retry same email";
          studioStatus(status, "The queue response could not be confirmed. Retry the same email.");
        }
      } finally {
        working = false;
      }
    };
  }
  if (startCompose) compose();
  else history();
}

const appearanceChoices = {
  theme: { light:"Light", dark:"Dark", system:"Match device" },
  heading: { google:"Google Sans", source:"Source Sans 3", system:"System sans", serif:"Georgia" },
  body: { source:"Source Sans 3", google:"Google Sans", system:"System sans" },
  palette: { forest:"Forest", clay:"Clay", slate:"River slate" },
};
const defaultAppearance = { theme:"light", heading:"google", body:"source", palette:"forest" };
const appearanceKey = (identity) => "aroha-studio-appearance:" + identity;
const validAppearance = (raw) => Object.fromEntries(
  Object.entries(defaultAppearance).map(([key, value]) => [key, Object.hasOwn(appearanceChoices[key], raw?.[key]) ? raw[key] : value]),
);
function readAppearance(identity) {
  try {
    return validAppearance(JSON.parse(localStorage.getItem(appearanceKey(identity))));
  } catch {
    return defaultAppearance;
  }
}
export function applyStudioAppearance(identity, settings = readAppearance(identity)) {
  const data = document.documentElement.dataset;
  if (!identity) {
    for (const key of ["studioTheme", "studioHeading", "studioBody", "studioPalette"]) delete data[key];
    return;
  }
  data.studioTheme = settings.theme;
  data.studioHeading = settings.heading;
  data.studioBody = settings.body;
  data.studioPalette = settings.palette;
}
export function mountStudioAppearance(target, identity) {
  const settings = readAppearance(identity);
  const options = (key) => Object.entries(appearanceChoices[key]).map(([value, label]) =>
    `<option value="${value}" ${settings[key] === value ? "selected" : ""}>${label}</option>`).join("");
  target.innerHTML = `${heading("Settings","Personalise the way Host Studio looks on this browser.")}
    <form class="workspace-card appearance-settings">
      <h2>Appearance</h2>
      <fieldset><legend>Colour mode</legend><div class="appearance-modes">
        ${Object.entries(appearanceChoices.theme).map(([value,label]) => `<label><input type="radio" name="theme" value="${value}" ${settings.theme === value ? "checked" : ""}><span>${label}</span></label>`).join("")}
      </div></fieldset>
      <fieldset><legend>Colour palette</legend><div class="appearance-palettes">
        ${Object.entries(appearanceChoices.palette).map(([value,label]) => `<label class="palette-choice ${value}"><input type="radio" name="palette" value="${value}" ${settings.palette === value ? "checked" : ""}><span class="palette-sample" aria-hidden="true"></span><span>${label}</span></label>`).join("")}
      </div></fieldset>
      <fieldset><legend>Typography</legend><div class="appearance-fonts">
        <label>Heading font<select name="heading">${options("heading")}</select></label>
        <label>Body font<select name="body">${options("body")}</select></label></div>
      </fieldset>
      <aside class="appearance-preview"><p class="eyebrow">PREVIEW</p><h3>Welcome to Aroha</h3><p>Review requests, welcome arrivals and plan the next visit.</p><span class="table-status current">Confirmed</span></aside>
      <div class="appearance-actions">${button("Restore defaults","data-restore",{className:"text-button"})}<p role="status" data-appearance-status></p></div>
    </form>`;
  const form = target.querySelector("form");
  const status = form.querySelector("[data-appearance-status]");
  form.onsubmit = (event) => event.preventDefault();
  function update() {
    const preferences = validAppearance(Object.fromEntries(new FormData(form)));
    applyStudioAppearance(identity, preferences);
    try {
      localStorage.setItem(appearanceKey(identity),JSON.stringify(preferences));
      status.textContent = "Saved for this browser.";
    } catch {
      status.textContent = "Applied here. Browser storage is unavailable.";
    }
  }
  form.onchange = update;
  form.querySelector("[data-restore]").onclick = () => {
    for (const [key, value] of Object.entries(defaultAppearance)) {
      const control = form.elements[key];
      control.value = value;
      control.dispatchEvent?.(new Event("change",{bubbles:true}));
    }
    update();
  };
}
