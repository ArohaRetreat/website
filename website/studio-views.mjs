import { escape as e } from "./frontdesk.mjs";
import { mountCreditWallet } from "./host-operations.mjs";
import { mountBookingDocuments } from "./booking-documents.mjs";
import { visitDateLabel } from "./booking-visit-label.mjs";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value / 100);
const date = (day, options = {}) => new Date(day + "T12:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", ...options, timeZone: "Asia/Kolkata" });
const dateTime = (at) => new Date(at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
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
    target.innerHTML = heading("Dashboard", "Booking activity, arrivals and payments at a glance.") + '<p role="status">Loading your dashboard…</p>';
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
      target.querySelector("[data-dashboard-refresh]").onclick = () => void load();
      target.querySelectorAll("[data-agenda-id]").forEach((control) => {
        control.onclick = () => openBooking(control.dataset.agendaId, control, control.dataset.agendaAction === "departure" ? "payments" : "overview");
      });
    } catch {
      if (!target.isConnected) return;
      target.innerHTML = heading("Dashboard","Today’s booking workspace.") + '<p role="status">The dashboard could not load.</p>' + button("Try again","data-dashboard-refresh");
      target.querySelector("[data-dashboard-refresh]").onclick = () => void load();
    }
  }
  await load();
}

const searchMode = (value) => value.includes("@") ? "email" : value.startsWith("+") ? "phone" : /^ar-/i.test(value) ? "reference" : "name";
export function mountStudioGuestLookup(target, { call, onSelect, action = "Open profile", initial = "", onSearch = () => {} }) {
  target.innerHTML = `<form class="studio-lookup" data-search>
    <label>Search by<select name="mode"><option value="name">Guest name starts with</option><option value="email">Exact email</option><option value="phone">Exact phone</option><option value="reference">Booking reference</option></select></label>
    <label>Search term<input name="search" type="search" minlength="2" maxlength="254" required autocomplete="off" placeholder="e.g. guest name"></label>
    <button class="primary" type="submit">Search guests</button></form><p data-lookup-status role="status"></p><div data-matches><p class="workspace-empty">Search to find a guest.</p></div>`;
  const form = target.querySelector("form");
  const status = target.querySelector("[data-lookup-status]");
  const matches = target.querySelector("[data-matches]");
  const submit = form.querySelector("button");
  form.elements.mode.value = searchMode(initial);
  form.elements.search.value = initial;
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    const mode = form.elements.mode.value;
    const search = form.elements.search.value.trim();
    if (search.length < 2) {
      status.textContent = "Enter at least two characters.";
      return;
    }
    submit.disabled = true;
    matches.replaceChildren();
    status.textContent = "Searching…";
    try {
      const result = await call("lookupCustomers", { mode, search, limit: 10 });
      if (!target.isConnected) return;
      onSearch(search);
      status.textContent = result.hasMore ? "More matches exist. Refine your search." : `${result.items.length} ${result.items.length === 1 ? "match" : "matches"}`;
      matches.innerHTML = result.items.map((person, index) => `<article class="workspace-row">
        <span class="workspace-icon">${e(person.name.slice(0,1))}</span><div><strong>${e(person.name)}</strong><small>${e(person.email || "Email unavailable")}</small></div>
        ${button(action, `data-guest-match="${index}"`, { extra: `aria-label="${e(action + " for " + person.name)}"` })}
      </article>`).join("") || '<p class="workspace-empty">No guests matched. Try an exact email, phone or reference.</p>';
      matches.querySelectorAll("[data-guest-match]").forEach((control) => {
        control.onclick = () => onSelect(result.items[Number(control.dataset.guestMatch)]);
      });
    } catch {
      if (target.isConnected) status.textContent = "Guest search could not complete. Check the search and try again.";
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
  dialog.setAttribute("aria-label", "Find an existing guest");
  dialog.innerHTML = '<div class="dialog-head"><h2>Find an existing guest</h2><button type="button" data-close aria-label="Close guest search">×</button></div><div data-picker></div>';
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
  dialog.showModal();
  dialog.querySelector("[type=search]").focus();
}

function mountStudioList(target, { fetchPage, renderRow, empty, onRows = () => {} }) {
  target.innerHTML = '<div data-studio-list></div><p data-studio-list-status role="status"></p><div data-studio-pagination class="workspace-actions"></div>';
  const list = target.querySelector("[data-studio-list]");
  const status = target.querySelector("[data-studio-list-status]");
  const pagination = target.querySelector("[data-studio-pagination]");
  const cursors = [undefined];
  async function load(position, cursor = cursors[position]) {
    status.textContent = "Loading…";
    pagination.querySelectorAll("button").forEach((control) => control.disabled = true);
    try {
      const page = await fetchPage({ limit:15, ...(cursor ? { cursor } : {}) });
      if (!target.isConnected) return;
      cursors[position] = cursor;
      list.innerHTML = page.items.length ? page.items.map(renderRow).join("") : `<p class="workspace-empty">${e(empty)}</p>`;
      onRows(list, page.items);
      pagination.innerHTML = position || page.nextCursor ? `<button type="button" data-prev ${position ? "" : "disabled"}>Previous</button><span>Page ${position + 1}</span><button type="button" data-next ${page.nextCursor ? "" : "disabled"}>Next</button>` : "";
      pagination.querySelector("[data-prev]")?.addEventListener("click", () => void load(position - 1));
      pagination.querySelector("[data-next]")?.addEventListener("click", () => void load(position + 1, page.nextCursor));
      status.textContent = "";
    } catch (error) {
      if (!target.isConnected) return;
      status.textContent = error.code === "CURSOR_EXPIRED" ? "This page expired. Refresh to start again." : "This list could not load.";
      pagination.innerHTML = button("Reload","data-reload");
      pagination.querySelector("[data-reload]").onclick = () => void load(0);
    }
  }
  void load(0);
}

const visitRow = (visit) => `<article class="workspace-row">
  ${symbol("calendar")}<div><strong>${e(kinds[visit.kind] || "Visit")} · ${e(visit.reference)}</strong><small>${e(visitDateLabel(visit,date))} · ${e(words(visit.status))}${Number.isSafeInteger(visit.totalPaise) ? " · " + money(visit.totalPaise) : ""}</small></div>
  ${button("Open booking",`data-profile-booking="${e(visit.id)}"`)}
</article>`;

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
        <span class="workspace-icon profile-avatar">${e(guest.name.split(/\s+/).slice(0,2).map((part) => part[0] || "").join("").toUpperCase())}</span>
        <div>${heading(guest.name,guest.accountConnected ? "Linked guest account" : "Host-recorded guest","Guest profile")}${guest.guestNumber ? `<span class="badge green">Guest #${guest.guestNumber}</span>` : ""}</div>
        <div class="workspace-actions">${button("Email guest","data-profile-email")}${button("+ New booking","data-profile-book",{className:"primary"})}</div>
      </header><nav class="workspace-tabs" aria-label="Guest profile sections">${tabs.map((name) => button(name,`data-profile-section="${e(name)}" aria-current="${selected === name ? "page" : "false"}"`,{className:"text-button"})).join("")}</nav><div data-profile-body></div>`;
      target.querySelector("[data-back-guests]").onclick = directory;
      target.querySelectorAll("[data-profile-section]").forEach((control) => control.onclick = () => draw(control.dataset.profileSection));
      target.querySelector("[data-profile-email]").onclick = () => draw("Messages",true);
      target.querySelector("[data-profile-book]").onclick = () => openManual(guest);
      const body = target.querySelector("[data-profile-body]");
      const visits = (slot) => mountStudioList(slot,{
        fetchPage:(page) => call("listCustomerReservations",{id,...page}),
        renderRow:visitRow,empty:"No visits recorded for this guest.",
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
        </div><div class="workspace-columns">${surface("Booking history","Upcoming and previous visits.",'<div data-guest-visits></div>')}
        <div class="workspace-stack">${surface("Contact details","",`<dl class="workspace-facts"><div><dt>Email</dt><dd>${e(guest.email || "Unavailable")}</dd></div><div><dt>Phone</dt><dd>${e(guest.phone || "Unavailable")}</dd></div><div><dt>Guest number</dt><dd>${guest.guestNumber ? "#" + guest.guestNumber : "Assigned at first check-in"}</dd></div></dl>`)}
        ${surface("Documents","View issued invoices, receipts and checkout statements.",button("Invoices & receipts","data-open-documents"))}</div></div>`;
        visits(body.querySelector("[data-guest-visits]"));
        body.querySelector("[data-open-documents]").onclick = () => draw("Invoices & receipts");
      } else if (selected === "Visits") {
        body.innerHTML = surface("Booking history","Upcoming and previous visits.",'<div data-guest-visits></div>');
        visits(body.querySelector("[data-guest-visits]"));
      } else if (selected === "Payments") {
        body.innerHTML = surface("Payment history","Verified payments and reversals.",'<div data-guest-payments></div>');
        mountStudioList(body.querySelector("[data-guest-payments]"),{
          fetchPage:(page) => call("listStudioGuestPayments",{id,...page}),
          empty:"No verified payments have been recorded.",
          renderRow:(payment) => `<article class="workspace-row">${symbol("payments")}<div><strong>${e(words(payment.kind))} · ${money(payment.amountPaise)}</strong><small>${e(dateTime(payment.createdAt))} IST${payment.method ? " · " + e(words(payment.method)) : ""}</small></div>${button("Open booking",`data-profile-payment="${e(payment.bookingId)}"`)}</article>`,
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
  let activeJob;
  function history() {
    target.innerHTML = `<div class="workspace-page-head">${heading("Guest email","Send an email or check its delivery status.")}<div class="workspace-actions">${button("Compose email","data-compose",{className:"primary"})}${button("Refresh","data-refresh-mail",{className:"text-button"})}</div></div>
      <div class="workspace-columns mail-columns">${surface("Sent history","Staff messages and automatic guest updates.",'<div data-mail-list></div>')}
      <div data-mail-detail>${surface("Delivery receipt","",'<p class="workspace-empty">Choose an email to see its delivery details.</p>')}</div></div>`;
    target.querySelector("[data-compose]").onclick = compose;
    target.querySelector("[data-refresh-mail]").onclick = history;
    const slot = target.querySelector("[data-mail-detail]");
    async function open(id, focus = false) {
      activeJob = id;
      slot.innerHTML = surface("Delivery receipt","",'<p role="status">Loading email…</p>');
      try {
        const job = await call("getStudioEmail",{jobId:id});
        if (!slot.isConnected || activeJob !== id) return;
        const events = [["Queued",job.createdAt],["Accepted for sending",job.acceptedAt],["Delivered to mail server",job.deliveredAt]];
        if (!["queued","accepted","delivered"].includes(job.status) && job.statusAt)
          events.push([mailStatuses[job.status] || words(job.status),job.statusAt]);
        slot.innerHTML = surface(job.subject,"Delivery receipt",`${mailStatus(job)}<dl class="workspace-facts">
          <div><dt>To</dt><dd>${e(job.recipient)}</dd></div><div><dt>Reply-to</dt><dd>${e(job.replyTo)}</dd></div>
          ${job.reference ? `<div><dt>Booking</dt><dd>${e(job.reference)}</dd></div>` : ""}
        </dl>${job.message ? `<p class="studio-mail-body">${e(job.message)}</p>` : ""}
        <ol class="delivery-events">${events.filter(([,at])=>Number.isFinite(at)).map(([label,at])=>`<li><strong>${e(label)}</strong><small>${e(dateTime(at))} IST</small></li>`).join("")}</ol>
        <p class="workspace-muted">Delivered means the recipient’s mail server accepted the message.</p>`);
        if (focus && window.matchMedia("(max-width:760px)").matches) {
          slot.tabIndex = -1;
          slot.focus({preventScroll:true});
          slot.scrollIntoView({block:"start"});
        }
      } catch {
        if (slot.isConnected && activeJob === id) slot.innerHTML = surface("Delivery receipt","",'<p role="status">This email could not load. Select it to retry.</p>');
      }
    }
    mountStudioList(target.querySelector("[data-mail-list]"),{
      fetchPage:(page) => call("listStudioEmail",{...(customer ? {id:customer.id} : {}),...page}),
      renderRow:(job) => `<button type="button" class="mail-list-item" data-open-mail="${e(job.id)}">
        <span><strong>${e(job.subject)}</strong><small>${e(job.recipient)} · ${e(dateTime(job.createdAt))} IST</small></span>${mailStatus(job)}</button>`,
      empty:"No guest emails to show.",
      onRows:(list) => list.querySelectorAll("[data-open-mail]").forEach((control) => {
        control.onclick = () => {
          list.querySelectorAll("[data-open-mail]").forEach((row) => row.removeAttribute("aria-current"));
          control.setAttribute("aria-current","true");
          void open(control.dataset.openMail,true);
        };
      }),
    });
    if (activeJob) void open(activeJob);
  }

  function compose() {
    let recipient = customer, pending, working = false;
    target.innerHTML = heading("Compose email","Send an email to a guest using the retreat’s address.") +
      `<form class="studio-composer" data-search><div class="workspace-stack">
      ${surface("Recipient","Choose the guest who should receive this email.",`<div class="workspace-row"><span>${symbol("guests")}</span><div data-recipient></div>
        ${customer ? "" : button("Find guest","data-find-recipient")}</div>`)}
      ${surface("Message","Write a note or start with a template.",`<div class="workspace-actions">${button("Arrival directions",'data-template="arrival"')}${button("Stay follow-up",'data-template="followup"')}</div>
        <label>Subject<input name="subject" maxlength="120" required></label><label>Message<textarea name="message" maxlength="2500" rows="8" required></textarea></label>`)}
      </div>${surface("Review and send","Check the recipient and wording before sending.",`<dl class="workspace-facts"><div><dt>From</dt><dd>Aroha Retreat</dd></div><div><dt>To</dt><dd data-to></dd></div></dl>
      <p class="workspace-muted">Replies go to the retreat’s configured reply inbox.</p><p data-send-status role="status"></p><div class="workspace-actions">
      ${button("Back to email history","data-mail-back",{className:"text-button"})}<button class="primary" type="submit">Send email</button></div>`)}</form>`;
    const form = target.querySelector("form");
    const status = form.querySelector("[data-send-status]");
    const submit = form.querySelector("[type=submit]");
    const back = form.querySelector("[data-mail-back]");
    function recipientView() {
      form.querySelector("[data-recipient]").innerHTML = `<strong>${e(recipient?.name || "Choose a guest")}</strong><small>${e(recipient?.email || "Search by name, email or phone")}</small>`;
      form.querySelector("[data-to]").textContent = recipient?.email || "Choose a guest";
      if (form.querySelector("[data-find-recipient]"))
        form.querySelector("[data-find-recipient]").textContent = recipient ? "Change guest" : "Find guest";
    }
    recipientView();
    form.querySelector("[data-find-recipient]")?.addEventListener("click", () => chooseStudioGuest(call,(person) => {
      recipient = person;
      recipientView();
    }));
    back.onclick = () => {
      if (!pending) history();
    };
    form.querySelectorAll("[data-template]").forEach((control) => {
      control.onclick = () => {
        if (pending) return;
        const first = recipient?.name.split(/\s+/)[0] || "there";
        const arrival = control.dataset.template === "arrival";
        form.elements.subject.value = arrival ? "Directions to Aroha" : "Thank you for visiting Aroha";
        form.elements.message.value = `Hi ${first},\n\n${arrival ? "We look forward to welcoming you. Follow the directions on our website and please check in at reception when you arrive." : "Thank you for spending time with us. We hope to see you again."}\n\nYour hosts at Aroha Retreat`;
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
      status.textContent = "Queuing email…";
      try {
        const job = await call("sendStudioEmail",pending.input,pending.key);
        activeJob = job.id;
        if (target.isConnected) history();
      } catch (error) {
        if (!form.isConnected) return;
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          pending = null;
          delete form.dataset.emailPending;
          for (const control of form.elements) control.disabled = false;
          submit.textContent = "Send email";
          status.textContent = mailError(error.code);
        } else {
          submit.disabled = false;
          submit.textContent = "Retry same email";
          status.textContent = "The queue response could not be confirmed. Retry the same email.";
        }
      } finally {
        working = false;
      }
    };
  }
  if (startCompose) compose();
  else history();
}
