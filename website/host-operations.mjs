import { openStudioDialog, studioStatus } from "./studio-feedback.mjs";
import {chooseStudioDates} from './studio-date-range.mjs';
import {visitDateLabel} from './booking-visit-label.mjs';
import {calendarIcon,confirmMaterial} from './material-controls.mjs';
import {studioTable} from "./studio-table.mjs";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const cash = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format((n || 0) / 100);
const label = (s) =>
  ({
    pending_approval: "Awaiting review",
    checked_in: "Checked in",
    no_show: "No show",
    earn: "Credits earned",
    hold: "Credits reserved",
    redeem: "Credits used",
    release: "Reservation released",
    restore: "Credits restored",
    expired_release: "Expired reservation released",
    adjustment: "Host adjustment",
    payment: "Payment",
    reversal: "Reversal",
    cash: "Cash",
    upi: "UPI",
    bank: "Bank transfer",
  })[s] || String(s).replaceAll("_", " ");
const statuses = [
  "pending_approval",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "declined",
  "expired",
  "no_show",
];
const heading = (title, copy) =>
  `<div class="ops-heading"><p class="eyebrow">HOST DESK</p><h1>${title}</h1><p>${copy}</p></div>`;
const empty = (t) => `<div class="ops-empty">${t}</div>`;
const referenceForm = () =>
  '<form data-search class="ops-filters"><label>Booking reference<input name="reference" placeholder="AR-…" maxlength="32"></label><button class="outline-button">Search</button><button type="button" class="text-button" data-clear>Show all</button></form>';
const ledgerDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
});
const ledgerTable = (items) => studioTable("Payment ledger", [
  ["Booking"], ["Recorded (IST)"], ["Entry"], ["Method"], ["Amount", "table-number"],
], items.map((item) => `<tr>
  <th scope="row"><button type="button" class="text-button table-key" data-open="${esc(item.bookingId)}" aria-label="Open booking ${esc(item.bookingReference || "")}">${esc(item.bookingReference || "Historical booking")}</button></th>
  <td>${Number.isFinite(item.createdAt) ? esc(ledgerDate.format(item.createdAt)) : "—"}</td>
  <td><span class="table-status">${esc(label(item.kind))}</span></td>
  <td>${esc(item.method ? label(item.method) : "—")}</td>
  <td class="table-number">${cash(item.amountPaise)}</td>
</tr>`).join(""));
const visitKind = kind => ({individual:'Individual stay',private:'Private room',day:'Day visit',event:'Exclusive retreat'})[kind] || 'Stay';
const shortDate = date => new Date(date+'T12:00:00Z').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'});
const bookingRows = items => items.length ? `<div class="ops-booking-table" role="table" aria-label="Bookings"><div class="ops-table-head" role="row"><span role="columnheader">Booking</span><span role="columnheader">Dates & guests</span><span role="columnheader">Status</span><span role="columnheader">Visit total</span><span role="columnheader">Action</span></div>${items.map(b=>`<div class="ops-booking-row" role="row"><div role="cell"><strong>${esc(b.reference)}</strong><small>${visitKind(b.kind)}</small></div><div role="cell"><span>${esc(shortDate(b.arrival))} → ${esc(shortDate(b.departure))}</span><small>${b.adults ? `${esc(b.adults)} adult${b.adults===1?'':'s'}${b.childrenCount ? ` · ${esc(b.childrenCount)} ${b.childrenCount===1?'child':'children'}`:''}` : 'Guest count to be arranged'}</small></div><div role="cell"><span class="badge ${esc(b.status)}">${esc(label(b.status))}</span></div><div role="cell" class="ops-amount">${b.totalPaise===null?'To be agreed':cash(b.totalPaise)}</div><div role="cell"><button class="${b.status==='pending_approval'?'button':'outline-button'}" data-open="${esc(b.id)}">${b.status==='pending_approval'?'Review request':'Open booking'} <span aria-hidden="true">→</span></button></div></div>`).join('')}</div>` : '';
const creditSummary = (w) =>
  `<div class="ops-stats"><article><span>Available credits</span><strong>${w.creditsAvailable.toLocaleString("en-IN")}</strong><small>Worth ${cash(w.availableValuePaise)}</small></article><article><span>Reserved for requests</span><strong>${w.creditsReserved.toLocaleString("en-IN")}</strong><small>Released when a request ends</small></article><article><span>Level ${w.level} · ${esc(w.name)}</span><strong>${w.earnCreditsPerNight}<small> credits / night</small></strong><small>${w.completedStays} completed stays${w.nextLevelAt ? ` · next level at ${w.nextLevelAt}` : ""}</small></article></div>`;
const entryRows = (items) =>
  items
    .map(
      (e) =>
        `<article class="ops-row"><div><h3>${esc(label(e.kind))}${e.bookingReference ? " · " + esc(e.bookingReference) : ""}</h3><p>${new Date(e.createdAt).toLocaleString("en-IN")}${e.date ? " · night " + esc(e.date) : ""}</p>${e.reason ? `<p>${esc(e.reason)}</p>` : ""}</div><div><strong>${e.creditsDelta > 0 ? "+" : ""}${e.creditsDelta} credits</strong>${e.reservedDelta ? `<small>${e.reservedDelta > 0 ? "+" : ""}${e.reservedDelta} reserved</small>` : ""}</div></article>`,
    )
    .join("");
export async function mountCreditWallet(
  target,
  { call, customerId, manager = false },
) {
  target.classList.add("ops-wallet");
  const own = !customerId,
    base = own ? "My" : "Customer",
    args = own ? {} : { id: customerId };
  let wallet,
    items = [],
    cursor = null;
  const load = async () => {
    [wallet, { items, nextCursor: cursor }] = await Promise.all([
      call("get" + base + "Loyalty", args),
      call("list" + base + "LoyaltyEntries", { ...args, limit: 20 }),
    ]);
  };
  const draw = () => {
    if (!target.isConnected) return;
    target.innerHTML = `${creditSummary(wallet)}<p class="ops-note">1 credit = ₹1. Earn 100, 200 or 300 credits per eligible night at checkout. Credits have no expiry and can cover the full eligible stay price after the best offer. Day outings and events do not earn or redeem credits.</p>${manager ? '<details class="ops-card"><summary>Adjust this customer’s credits</summary><p>Use an adjustment only to correct a verified balance. Every change stays in the activity history.</p><form data-adjust class="ops-form"><label>Credits to add or remove<input name="credits" type="number" step="1" min="-1000000" max="1000000" required placeholder="e.g. 100 or -100"></label><label>Reason<textarea name="reason" minlength="5" maxlength="200" required></textarea></label><button class="outline-button">Review adjustment</button></form></details>' : ""}<h2>Credit activity</h2><div data-entries>${entryRows(items) || empty("No credit activity yet. Credits are earned after an eligible completed stay.")}</div>${cursor ? '<button class="outline-button" data-more>Load more activity</button>' : ""}<p role="status" data-message></p>`;
    target
      .querySelector("[data-more]")
      ?.addEventListener("click", async (e) => {
        e.target.disabled = true;
        try {
          const p = await call("list" + base + "LoyaltyEntries", {
            ...args,
            limit: 20,
            cursor,
          });
          items.push(...p.items);
          cursor = p.nextCursor;
          draw();
        } catch {
          e.target.disabled = false;
          target.querySelector("[data-message]").textContent =
            "Could not load more activity. Try again.";
        }
      });
    const f = target.querySelector("[data-adjust]");
    if (f)
      f.onsubmit = async (e) => {
        e.preventDefault();
        if (f.dataset.pending) return;
        const d = new FormData(f),
          credits = Number(d.get("credits")),
          reason = String(d.get("reason")).trim();
        if (
          !credits ||
          !await confirmMaterial(
            `${credits > 0 ? "Add" : "Remove"} ${Math.abs(credits)} credits?\nReason: ${reason}`,
          )
        )
          return;
        const input = {
            id: customerId,
            credits,
            reason,
            expectedVersion: wallet.version,
          },
          key = crypto.randomUUID();
        f.dataset.pending = "1";
        f.querySelectorAll("input,textarea,button").forEach(
          (x) => (x.disabled = true),
        );
        const send = async () => {
          try {
            await call("adjustCustomerCredits", input, key);
            await load();
            draw();
          } catch (err) {
            if (!target.isConnected) return;
            if (
              [
                "VERSION_CONFLICT",
                "INSUFFICIENT_LOYALTY_CREDITS",
                "INVALID_LOYALTY_ADJUSTMENT",
              ].includes(err.code)
            ) {
              try {
                await load();
                draw();
                target.querySelector("[data-message]").textContent =
                  "The balance changed or the adjustment was invalid. Review the current credits before submitting another adjustment.";
              } catch {
                target.querySelector("[data-message]").textContent =
                  "The balance could not refresh. Reopen this customer before another adjustment.";
              }
              return;
            }
            const m = target.querySelector("[data-message]");
            m.textContent =
              "The adjustment response could not be confirmed. Retry the same adjustment safely.";
            const retry = document.createElement("button");
            retry.textContent = "Retry same adjustment";
            retry.onclick = () => {
              retry.disabled = true;
              void send();
            };
            m.append(retry);
          }
        };
        await send();
      };
  };
  try {
    await load();
    draw();
  } catch {
    if (target.isConnected)
      target.innerHTML = empty(
        "Credits could not load. Reopen this section to try again.",
      );
  }
}
export async function mountHostOperations(
  target,
  { tab, call, manager, openBooking },
) {
  let page = { items: [], nextCursor: null },
    filter = {},
    listGeneration = 0, pageIndex=0, cursors=[undefined];
  const alive = () => target.isConnected;
  const openRows = () =>
    target
      .querySelectorAll("[data-open]")
      .forEach((b) => (b.onclick = () => openBooking(b.dataset.open)));
  const message = (text, pending = false) => {
    if (alive()) studioStatus(target.querySelector("[data-message]"), text, pending);
  };
  if (["guests", "loyalty"].includes(tab)) {
    target.innerHTML =
      heading(
        tab === "guests" ? "Customers" : "Loyalty credits",
        "Find one customer to see their visits and credits. No account is required for a host-recorded booking.",
      ) +
      `<form data-search class="ops-filters"><label>Find by<select name="mode"><option value="name">Name starts with</option><option value="email">Exact email</option><option value="phone">Exact phone</option><option value="reference">Booking reference</option></select></label><label>Search<input name="search" minlength="2" maxlength="254" required placeholder="Enter a name, email, phone or reference"></label><button class="button">Find customer</button></form><p role="status" data-message></p><div data-results>${empty("Search to open a customer. Contact details are visible to authorised booking staff.")}</div><div data-customer></div>`;
    target.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const form = e.currentTarget,
        d = new FormData(form);
      form.querySelector("button").disabled = true;
      message("Searching…");
      target.querySelector("[data-customer]").replaceChildren();
      try {
        const p = await call("lookupCustomers", {
          mode: String(d.get("mode")),
          search: String(d.get("search")),
          limit: 10,
        });
        if (!alive()) return;
        const out = target.querySelector("[data-results]");
        out.innerHTML =
          p.items
            .map(
              (c) =>
                `<article class="ops-row"><div><h3>${esc(c.name)}</h3><p>${esc(c.email)}<br>${esc(c.phone)}</p><small>${c.accountConnected ? "Account connected" : "Host-recorded guest"}</small></div><button class="outline-button" data-customer-id="${esc(c.id)}">View customer →</button></article>`,
            )
            .join("") ||
          empty(
            "No customer matched. Try the exact booking email or reference.",
          );
        message(
          p.hasMore
            ? "More matches exist. Refine your search."
            : `${p.items.length} result(s)`,
        );
        out.querySelectorAll("[data-customer-id]").forEach(
          (b) =>
            (b.onclick = async () => {
              const customer = p.items.find(
                (c) => c.id === b.dataset.customerId,
              );
              const area = document.createElement("div");
              target.querySelector("[data-customer]").replaceChildren(area);
              area.innerHTML = `<section class="ops-card"><h2>${esc(customer.name)}</h2><p>${esc(customer.email)} · ${esc(customer.phone)}</p><div data-wallet></div></section><section class="ops-card"><h2>Customer bookings</h2><div data-bookings>Loading…</div></section>`;
              await mountCreditWallet(area.querySelector("[data-wallet]"), {
                call,
                customerId: customer.id,
                manager,
              });
              try {
                let history = await call("listCustomerReservations", {
                  id: customer.id,
                  limit: 20,
                });
                const draw = () => {
                  if (!area.isConnected) return;
                  const el = area.querySelector("[data-bookings]");
                  if (!el?.isConnected) return;
                  el.innerHTML =
                    bookingRows(history.items) || empty("No bookings yet.");
                  if (history.nextCursor) {
                    const more = document.createElement("button");
                    more.className = "outline-button";
                    more.textContent = "Load more bookings";
                    more.onclick = async () => {
                      more.disabled = true;
                      try {
                        const next = await call("listCustomerReservations", {
                          id: customer.id,
                          limit: 20,
                          cursor: history.nextCursor,
                        });
                        history = {
                          items: [...history.items, ...next.items],
                          nextCursor: next.nextCursor,
                        };
                        draw();
                      } catch {
                        more.textContent = "Could not load. Retry";
                        more.disabled = false;
                      }
                    };
                    el.append(more);
                  }
                  openRows();
                };
                draw();
              } catch {
                area.querySelector("[data-bookings]").textContent =
                  "Booking history could not load. Select this customer again to retry.";
              }
            }),
        );
      } catch {
        message("Search could not complete. Check your search and try again.");
      } finally {
        if (alive()) form.querySelector("button").disabled = false;
      }
    };
    return;
  }
  const review = tab === "overview";
  if(review)filter={status:"pending_approval"};
  const operation =
    (review || tab === "reservations")
      ? "listHostReservations"
      : tab === "payments"
        ? "listPaymentLedger"
        : "reviewPrivateFeedback";
  const titles = {
    overview:["New requests", "Review the dates and price, then accept or decline."],
    reservations: [
      "Reservations",
      "Review a request, welcome an arrival, or follow a completed stay. Search uses the exact booking reference.",
    ],
    payments: [
      "Payment ledger",
      "Verified payments and corrections. Open a booking to record a payment or download its documents.",
    ],
    feedback: [
      "Private feedback",
      "Only booking managers can read guest feedback. Feedback is private and is never published as a review.",
    ],
  };
  target.innerHTML =
    (review ? heading(...titles[tab]).replaceAll("h1>","h2>") : heading(...titles[tab])) +
    (review ? '<form data-search class="ops-review-refresh"><button class="outline-button">Refresh requests</button></form>' : tab === "reservations"
      ? `<form data-search class="ops-filters"><label>Booking reference<input name="reference" maxlength="32" placeholder="AR-…"></label><label>Status<select name="status"><option value="">All statuses</option>${statuses.map((s) => `<option value="${s}">${esc(label(s))}</option>`).join("")}</select></label><button class="button">Apply filters</button></form><div class="ops-status-shortcuts" role="group" aria-label="Quick booking filters"><button type="button" data-status="">All bookings</button><button type="button" data-status="pending_approval">Needs review</button><button type="button" data-status="confirmed">Confirmed</button><button type="button" data-status="checked_in">Checked in</button></div>`
      : tab === "payments" ? `<div class="ledger-filters">${referenceForm()}</div>` : referenceForm()) +
    '<p role="status" data-message></p><div data-results></div><div data-pagination></div>';
  const render = () => {
    if (!alive()) return;
    target.querySelector("[data-results]").innerHTML =
      (review || tab === "reservations")
        ? bookingRows(page.items) ||
          empty(review ? "You’re up to date. No requests are awaiting review. Open Reservations to find an existing booking, or use Add booking for a walk-in guest." : "No bookings match. Check the reference or choose another status.")
        : tab === "payments"
          ? page.items.length ? ledgerTable(page.items) : empty(filter.reference ? "No payments match that booking reference." : "No verified payments recorded.")
          : page.items
            .map(
              (i) =>
                `<article class="ops-row"><div><h3>${esc(i.bookingReference || "Booking")} · ${esc(i.rating)} / 5</h3><p>${i.withdrawn ? "Feedback withdrawn" : esc(i.comment)}</p><small>${new Date(i.createdAt).toLocaleString("en-IN")}</small></div><button class="outline-button" data-open="${esc(i.bookingId)}">Open booking →</button></article>`,
            )
            .join("") || empty("No entries match these filters.");
    openRows();
    target.querySelector('[data-pagination]').innerHTML = `<div class="ops-pagination"><button class="outline-button" data-previous ${pageIndex===0?'disabled':''}>← Previous</button><span>Page ${pageIndex+1} · ${page.items.length} ${review?'requests':'records'}</span><button class="outline-button" data-more ${page.nextCursor?'':'disabled'}>Next →</button></div>`;
    target.querySelector('[data-more]').onclick=()=>load(true);
    target.querySelector('[data-previous]').onclick=()=>load('previous');
    target.querySelectorAll('[data-status]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.status===(filter.status||''))));
    message(tab === "payments" && filter.reference ? `Filtered to ${filter.reference.toUpperCase()}` : "");
  };
  const load = async (direction = false, nextFilter = filter) => {
    const generation=++listGeneration;
    const nextIndex=direction===true?pageIndex+1:direction==='previous'?pageIndex-1:0;
    if(nextIndex<0)return;
    const cursor=direction===true?page.nextCursor:direction==='previous'?cursors[nextIndex]:undefined;
    if(direction===true&&!cursor)return;
    message('Loading results…', true);
    const results=target.querySelector('[data-results]');results.setAttribute('aria-busy','true');
    target.querySelectorAll('form button,[data-more],[data-previous],[data-open]').forEach(b=>b.disabled=true);
    try {
      const p=await call(operation,{...nextFilter,limit:25,...(cursor?{cursor}:{})});
      if(generation!==listGeneration||!alive())return;
      if(direction===false)cursors=[undefined];else cursors[nextIndex]=cursor;
      filter=nextFilter;
      pageIndex=nextIndex;page={items:p.items,nextCursor:p.nextCursor};render();
    } catch {
      if(generation===listGeneration&&alive())message('Could not load this page. Your previous results are still shown. Retry with Refresh or Apply filters.');
    } finally {
      if(alive()&&generation===listGeneration){
        results.removeAttribute('aria-busy');
        target.querySelectorAll('form button,[data-open]').forEach(b=>b.disabled=false);
        const prev=target.querySelector('[data-previous]'),next=target.querySelector('[data-more]');if(prev)prev.disabled=pageIndex===0;if(next)next.disabled=!page.nextCursor;
      }
    }
  };
  target.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const nextFilter = review ? {status:"pending_approval"} : Object.fromEntries(
      [...new FormData(e.currentTarget)].map(([key,value]) => [key,String(value).trim()]).filter(([,value]) => value),
    );
    if (nextFilter.reference) nextFilter.reference = nextFilter.reference.toUpperCase();
    void load(false,nextFilter);
  };
  target.querySelector("[data-clear]")?.addEventListener("click", () => {
    target.querySelector("form").reset();
    void load(false,{});
  });
  target.querySelectorAll('[data-status]').forEach(button=>button.onclick=()=>{
    const form=target.querySelector('form');form.elements.status.value=button.dataset.status;form.requestSubmit();
  });
  await load();
}
const manualDrafts = new Map();
const bookingErrors = {
  QUOTE_EXPIRED:
    "This price expired. Check availability and review a fresh price.",
  QUOTE_STALE: "The price changed. Please review a fresh quote.",
  QUOTE_CHANGED:
    "The price or availability changed. Please review again.",
  INSUFFICIENT_LOYALTY_CREDITS:
    "The customer has fewer available credits. Reduce the credits and check the price again.",
  CREDITS_EXCEED_PAYABLE:
    "Credits cannot exceed the stay price. Enter a lower whole number.",
  INVALID_REDEEM_CREDITS: "Enter a whole number of credits.",
  AVAILABILITY_CHANGED:
    "These places are no longer available. Choose other dates or rooms.",
  ROOM_UNAVAILABLE:
    "The selected room is unavailable. Choose another room or date.",
  CAPACITY_EXCEEDED:
    "The party exceeds available capacity. Change the dates or number of guests.",
  VERSION_CONFLICT:
    "This booking information changed. Review the latest availability.",
  INVALID_CHILD_AGE:
    "Choose an age under 10 for each child. Guests aged 10 or above are adults.",
  INVALID_CONTACT:
    "Enter the guest’s full name and a valid phone with country code.",
  INVALID_EMAIL: "Enter the guest’s valid email address.",
  SELECT_ROOMS: "Choose rooms for this private stay.",
  ROOM_PARTY_LIMIT:
    "The selected rooms cannot accommodate this party. Choose more rooms or adjust the guests.",
  CHILDREN_REQUIRE_PRIVATE_ROOM:
    "Choose private rooms for a stay with children.",
  INVALID_DATE: "Enter valid calendar dates.",
  INVALID_STAY_DATES:
    "Choose dates within the next year, departure after arrival and up to 31 nights.",
  CUSTOMER_LINK_REVIEW_REQUIRED:
    "This email has conflicting customer records. Ask an Aroha administrator to review the identity before booking.",
  PROFILE_RECREATE_REQUIRED:
    "This customer erased their profile. They must explicitly recreate it before a new booking.",
  BOOKINGS_PAUSED:
    "New bookings are paused. Review the booking policies before continuing.",
  PROMO_NOT_VALID:
    "This invitation code is not valid for the selected visit.",
  PROMO_EXHAUSTED: "This invitation code has been fully used.",
};
export function openManualBooking({ call, units, onBooked, identity, chooseGuest, customer }) {
  const trigger = document.activeElement;
  const today = new Date(Date.now()+19800000).toISOString().slice(0,10);
  const tomorrow = new Date(Date.parse(today)+86400000).toISOString().slice(0,10);
  let state = manualDrafts.get(identity);
  if (!state || customer && !state.pending) {
    state = {
      customer: customer ? { name:customer.name, email:customer.email, phone:customer.phone } : { name:"", email:"", phone:"" },
      selectedGuest:customer?.name || "",
      kind:"individual", arrival:today, departure:tomorrow, adults:1, ages:[], unitIds:[], promo:"", credits:0,
    };
    manualDrafts.set(identity,state);
  }
  const dialog = document.createElement("dialog");
  dialog.className = "ops-dialog manual-composer";
  dialog.setAttribute("data-dt-mask","");
  dialog.setAttribute("aria-labelledby","manual-composer-title");
  dialog.innerHTML = `<header class="manual-head"><div><p class="eyebrow">WALK-IN &amp; OFFLINE RESERVATIONS</p><h2 id="manual-composer-title">New booking</h2></div><button type="button" data-close class="text-button" aria-label="Close new booking">×</button></header>
    <form class="manual-layout">
      <div class="manual-body">
        <fieldset class="manual-card" data-guest-fields><legend><span>1</span> Guest details</legend>
          <div class="manual-guest-pick"><div><strong data-selected-guest></strong><small>Use the guest’s email to link this booking and their credits.</small></div>
          ${chooseGuest ? '<div class="manual-guest-actions"><button type="button" class="tonal" data-find>Find guest</button><button type="button" class="text-button" data-new-guest hidden>Use new guest</button></div>' : ""}
          </div>
          <div class="guest-contact-fields"><label>Full name<input name="name" autocomplete="name" minlength="2" maxlength="120" required></label>
            <label>Email<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
            <label>Phone with country code<input name="phone" type="tel" autocomplete="tel" maxlength="32" placeholder="+91 98765 43210" required></label></div>
        </fieldset>
        <fieldset class="manual-card" data-visit-fields><legend><span>2</span> Stay details</legend>
          <label class="manual-kind">Visit type<select name="kind">${[["individual","Individual stay"],["private","Private rooms"],["day","Day outing"],["event","Exclusive retreat"]].map(([value,label])=>`<option value="${value}" ${value===state.kind?"selected":""}>${label}</option>`).join("")}</select></label>
          <button type="button" class="manual-date-field" data-dates aria-haspopup="dialog"></button><p class="ops-note" data-date-help></p>
          <div class="ops-columns"><label>Adults · age 10+<input name="adults" type="number" min="1" max="35" required value="${state.adults}"></label>
            <label>Children under 10<input name="childrenCount" type="number" min="0" max="100" value="${state.ages.length}"></label></div>
          <div data-child-ages class="ops-columns"></div>
          <fieldset data-room-fields hidden><legend>Choose private rooms</legend><div class="manual-room-grid">${units.filter((unit)=>unit.active).map((unit)=>`<label class="ops-check"><input type="checkbox" name="units" value="${esc(unit.id)}" ${state.unitIds.includes(unit.id)?"checked":""}><span>${esc(unit.name)}<small>Up to ${unit.capacity} adults</small></span></label>`).join("")}</div></fieldset>
          <details><summary>Offer code or credits</summary><div class="ops-columns">
            <label>Invitation code<input name="promo" maxlength="32" value="${esc(state.promo)}"></label>
            <label data-credit-field>Credits to redeem<input name="credits" type="number" min="0" max="1000000000" step="1" value="${state.credits}"></label>
          </div></details>
        </fieldset>
      <section class="manual-quote" aria-labelledby="manual-quote-title"><h3 id="manual-quote-title" tabindex="-1"><span>3</span> Review booking</h3>
        <div data-quote></div><div data-confirm-area></div>
        <button type="submit" class="text-button" data-refresh-quote hidden>Refresh quote</button>
      </section>
      </div>
      <footer class="manual-footer"><p role="status" data-message></p>
        <div class="manual-actions"><button type="button" class="text-button" data-cancel-booking>Close</button>
        <button type="submit" class="primary" data-get-quote>Check availability &amp; price</button>
        <button type="button" class="primary" data-confirm hidden></button></div>
      </footer>
    </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector("form");
  const quoteSlot = form.querySelector("[data-quote]");
  const confirmArea = form.querySelector("[data-confirm-area]");
  const notice = form.querySelector("[data-message]");
  const getQuote = form.querySelector("[data-get-quote]");
  const refreshQuote = form.querySelector("[data-refresh-quote]");
  const confirmButton = form.querySelector("[data-confirm]");
  const close = dialog.querySelector("[data-close]");
  const cancel = form.querySelector("[data-cancel-booking]");
  let working = false;
  const showContact = () => {
    for (const name of ["name","email","phone"]) form.elements[name].value = state.customer[name];
    form.elements.email.readOnly = Boolean(state.selectedGuest);
    form.querySelector("[data-selected-guest]").textContent = state.selectedGuest || "New guest";
    if (chooseGuest) {
      form.querySelector("[data-find]").textContent = state.selectedGuest ? "Change guest" : "Find guest";
      form.querySelector("[data-new-guest]").hidden = !state.selectedGuest;
    }
  };
  const capture = () => {
    state.customer = Object.fromEntries(["name","email","phone"].map((field)=>[field,form.elements[field].value.trim()]));
    state.kind = form.elements.kind.value;
    state.adults = Number(form.elements.adults.value);
    state.ages = [...form.querySelectorAll("[name=childAge]")].map((field)=>field.value);
    state.unitIds = [...form.querySelectorAll("[name=units]:checked")].map((field)=>field.value);
    state.promo = form.elements.promo.value;
    state.credits = Number(form.elements.credits.value);
  };
  const drawAges = () => {
    const count = Number(form.elements.childrenCount.value);
    if (!Number.isInteger(count) || count < 0 || count > 100) return;
    const ages = [...form.querySelectorAll("[name=childAge]")].map((field)=>field.value);
    form.querySelector("[data-child-ages]").innerHTML = Array.from({length:count},(_,i)=>`<label>Child ${i+1} age at arrival<select name="childAge" required>
      <option value="">Choose age</option>${Array.from({length:10},(_,age)=>`<option value="${age}" ${String(ages[i]??state.ages[i])===String(age)?"selected":""}>${age===0?"Under 1":age+" years"}</option>`).join("")}</select></label>`).join("");
  };
  const drawVisit = () => {
    const day = state.kind === "day", event = state.kind === "event";
    const end = event ? new Date(Date.parse(state.departure)-86400000).toISOString().slice(0,10) : state.departure;
    form.querySelector("[data-dates]").innerHTML = `<span><small>${day?"Visit date":event?"First event day":"Check-in"}</small><strong>${esc(shortDate(state.arrival))}</strong></span>
      ${day?"":`<span aria-hidden="true">→</span><span><small>${event?"Last event day":"Checkout"}</small><strong>${esc(shortDate(end))}</strong></span>`}<span class="manual-date-icon" aria-hidden="true">${calendarIcon}</span>`;
    const rooms = form.querySelector("[data-room-fields]");
    rooms.hidden = state.kind !== "private";
    rooms.disabled = rooms.hidden;
    form.querySelector("[data-credit-field]").hidden = day || event;
    if (day || event) form.elements.credits.value = "0";
    form.querySelector("[data-date-help]").textContent = day ? "Choose one day for the visit." : event ? "The first and last event days are included." : "Choose an arrival and checkout date.";
  };
  function lock(value) {
    form.querySelector("[data-guest-fields]").disabled = value;
    form.querySelector("[data-visit-fields]").disabled = value;
    getQuote.disabled = value;
    refreshQuote.disabled = value;
    close.disabled = working;
    cancel.disabled = working;
  }
  function drawQuote() {
    const quote = state.quote;
    quoteSlot.innerHTML = quote ? `<div class="manual-quote-summary"><strong>${esc(quote.contact.name)}</strong><small>${esc(quote.contact.email)}</small><p>${esc(visitKind(quote.kind))} · ${esc(visitDateLabel(quote,shortDate))}</p>
      ${quote.unitNames.length?`<p>${esc(quote.unitNames.join(" · "))}</p>`:""}
      <dl class="ops-price"><div><dt>Subtotal</dt><dd>${cash(quote.subtotalPaise)}</dd></div>
      <div><dt>Best offer benefit</dt><dd>−${cash(quote.priceBenefitDiscountPaise)}</dd></div>
      <div><dt>Credits applied</dt><dd>−${cash(quote.loyaltyDiscountPaise)}</dd></div>
      <div><dt>Total payable</dt><dd><strong>${cash(quote.totalPaise)}</strong></dd></div></dl></div>` :
      '<p>Availability and the total price will appear here after you check the stay.</p>';
    getQuote.hidden = Boolean(quote);
    refreshQuote.hidden = !quote || Boolean(state.pending);
    confirmButton.hidden = !quote;
    confirmButton.disabled = working;
    confirmButton.textContent = state.pending ? "Retry same confirmation" : "Confirm booking & email";
    confirmArea.innerHTML = quote && !state.pending ? '<label class="ops-check"><input name="consent" type="checkbox">I checked the contact, dates and price, and the guest agrees to the booking and email.</label>' : "";
    lock(working || Boolean(state.pending));
  }
  function changed() {
    if (working || state.pending) return;
    if (state.quote) {
      state.quote = null;
      notice.textContent = "Details changed. Check availability and price again.";
      drawQuote();
    }
  }
  function selectGuest(person) {
    state.selectedGuest = person?.name || "";
    state.customer = person ? { name:person.name,email:person.email,phone:person.phone } : { name:"",email:"",phone:"" };
    showContact();
    changed();
  }
  form.querySelector("[data-find]")?.addEventListener("click",()=>chooseGuest(selectGuest));
  form.querySelector("[data-new-guest]")?.addEventListener("click",()=>{selectGuest(null);form.elements.name.focus();});
  form.querySelector("[data-dates]").onclick=()=>chooseStudioDates({
    kind:state.kind, arrival:state.arrival, departure:state.departure, today,
    onApply:(arrival,departure)=>{Object.assign(state,{arrival,departure});drawVisit();changed();},
  });
  form.addEventListener("input",(event)=>{
    if (event.target.name === "consent" || working || state.pending) return;
    if (event.target.name === "childrenCount") drawAges();
    capture();
    if (event.target.name === "kind") drawVisit();
    changed();
  });
  confirmButton.onclick = confirm;
  close.onclick=()=>{if(!working)dialog.close();};
  cancel.onclick=close.onclick;
  dialog.addEventListener("cancel",(event)=>{if(working)event.preventDefault();});
  dialog.addEventListener("close",()=>{dialog.remove();if(trigger?.isConnected)trigger.focus();},{once:true});
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (working || state.pending) return;
    capture();
    const ages = state.ages.map((age)=>age === "" ? NaN : Number(age));
    if (ages.some((age)=>!Number.isInteger(age)||age<0||age>9)) { notice.textContent=bookingErrors.INVALID_CHILD_AGE;return; }
    if (state.kind === "day") state.departure = new Date(Date.parse(state.arrival)+86400000).toISOString().slice(0,10);
    working=true;
    lock(true);
    studioStatus(notice, "Checking availability and price…", true);
    state.quote=null;
    drawQuote();
    try {
      state.quote=await call("quoteManualBooking",{
        customer:state.customer,kind:state.kind,arrival:state.arrival,departure:state.departure,
        adults:state.adults,childrenAges:ages,units:state.kind==="private"?state.unitIds:[],
        promo:state.promo,redeemCredits:["day","event"].includes(state.kind)?0:state.credits,
      },crypto.randomUUID());
      studioStatus(notice, "Quote ready. Review the guest, dates and price.");
    } catch (error) {
      studioStatus(notice, bookingErrors[error.code] || "Could not check this visit. Check the dates, guest contact and your access.");
    } finally {
      working=false;
      drawQuote();
      (state.quote ? form.querySelector("#manual-quote-title") : getQuote).focus();
    }
  };
  async function confirm() {
    if (working || !state.quote) return;
    if (!state.pending && !form.elements.consent.checked) {
      notice.textContent="Confirm that the guest agreed to the booking and email.";
      form.elements.consent.focus();
      return;
    }
    state.pending ??= {input:{quoteId:state.quote.id},key:crypto.randomUUID()};
    working=true;
    lock(true);
    confirmButton.disabled=true;
    studioStatus(notice, "Confirming booking…", true);
    try {
      const booking=await call("createManualBooking",state.pending.input,state.pending.key);
      manualDrafts.delete(identity);
      dialog.close();
      await onBooked(booking);
    } catch (error) {
      if (!dialog.isConnected) return;
      if (bookingErrors[error.code] || error.status >= 400 && error.status < 500 && error.status !== 429) {
        state.pending=null;
        state.quote=null;
        studioStatus(notice, bookingErrors[error.code] || "The booking could not be confirmed. Review the details and try again.");
      } else {
        studioStatus(notice, "The response is uncertain. Retry the same confirmation.");
      }
    } finally {
      working=false;
      if(dialog.isConnected)drawQuote();
    }
  }
  showContact();
  drawAges();
  drawVisit();
  drawQuote();
  openStudioDialog(dialog);
}

export async function mountHostSummary(target, { call }) {
  try {
    const s = await call("getHostBookingSummary", {});
    if (!target.isConnected) return;
    target.innerHTML = `<div class="ops-stats"><article><span>Awaiting review</span><strong>${s.pendingReview}</strong><small>Current unexpired requests</small></article><article><span>Confirmed</span><strong>${s.confirmed}</strong><small>Reservations to welcome</small></article><article><span>Checked in</span><strong>${s.checkedIn}</strong><small>Currently staying</small></article></div><small>All bookings · updated ${new Date(s.asOf).toLocaleTimeString("en-IN")}</small>`;
  } catch {
    if (target.isConnected)
      target.textContent =
        "Booking totals could not load. Refresh the workspace to retry.";
  }
}
