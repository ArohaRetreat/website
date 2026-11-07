import {confirmMaterial} from './material-controls.mjs';
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
  const message = (t) => {
    if (alive()) target.querySelector("[data-message]").textContent = t;
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
      : referenceForm()) +
    '<p role="status" data-message></p><div data-results>Loading…</div><div data-pagination></div>';
  const render = () => {
    if (!alive()) return;
    target.querySelector("[data-results]").innerHTML =
      (review || tab === "reservations")
        ? bookingRows(page.items) ||
          empty(review ? "You’re up to date. No requests are awaiting review. Open Reservations to find an existing booking, or use Add booking for a walk-in guest." : "No bookings match. Check the reference or choose another status.")
        : page.items
            .map(
              (i) =>
                `<article class="ops-row"><div><h3>${esc(i.bookingReference || "Booking")} · ${tab === "payments" ? cash(i.amountPaise) : esc(i.rating) + " / 5"}</h3><p>${tab === "payments" ? esc(label(i.kind)) + " · " + esc(i.method || "Correction") : i.withdrawn ? "Feedback withdrawn" : esc(i.comment)}</p><small>${new Date(i.createdAt).toLocaleString("en-IN")}</small></div><button class="outline-button" data-open="${esc(i.bookingId)}">Open booking →</button></article>`,
            )
            .join("") || empty("No entries match these filters.");
    openRows();
    target.querySelector('[data-pagination]').innerHTML = `<div class="ops-pagination"><button class="outline-button" data-previous ${pageIndex===0?'disabled':''}>← Previous</button><span>Page ${pageIndex+1} · ${page.items.length} ${review?'requests':'records'}</span><button class="outline-button" data-more ${page.nextCursor?'':'disabled'}>Next →</button></div>`;
    target.querySelector('[data-more]').onclick=()=>load(true);
    target.querySelector('[data-previous]').onclick=()=>load('previous');
    target.querySelectorAll('[data-status]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.status===(filter.status||''))));
    message(review?'':'Showing one page. Search or filter to find another booking.');
  };
  const load = async (direction = false) => {
    const generation=++listGeneration;
    const nextIndex=direction===true?pageIndex+1:direction==='previous'?pageIndex-1:0;
    if(nextIndex<0)return;
    const cursor=direction===true?page.nextCursor:direction==='previous'?cursors[nextIndex]:undefined;
    if(direction===true&&!cursor)return;
    message('Loading…');
    const results=target.querySelector('[data-results]');results.setAttribute('aria-busy','true');
    target.querySelectorAll('form button,[data-more],[data-previous],[data-open]').forEach(b=>b.disabled=true);
    try {
      const p=await call(operation,{...filter,limit:25,...(cursor?{cursor}:{})});
      if(generation!==listGeneration||!alive())return;
      if(direction===false)cursors=[undefined];else cursors[nextIndex]=cursor;
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
    filter = review ? {status:"pending_approval"} : Object.fromEntries(
      [...new FormData(e.currentTarget)].filter(([, v]) => v),
    );
    void load();
  };
  target.querySelector("[data-clear]")?.addEventListener("click", () => {
    filter = {};
    target.querySelector("form").reset();
    void load();
  });
  target.querySelectorAll('[data-status]').forEach(button=>button.onclick=()=>{
    const form=target.querySelector('form');form.elements.status.value=button.dataset.status;form.requestSubmit();
  });
  await load();
}
const manualDrafts = new Map();
export function openManualBooking({ call, units, onBooked, identity }) {
  const dialog = document.createElement("dialog");
  dialog.className = "ops-dialog";
  dialog.setAttribute("data-dt-mask", "");
  dialog.setAttribute("aria-label", "Add a manual booking");
  document.body.append(dialog);
  const state = manualDrafts.get(identity) || {
    step: 1,
    customer: { name: "", email: "", phone: "" },
    kind: "individual",
    arrival: new Date(Date.now() + 19800000).toISOString().slice(0, 10),
    departure: "",
    adults: 1,
    ages: "",
    unitIds: [],
    promo: "",
    credits: 0,
  };
  manualDrafts.set(identity, state);
  const close = () => {
    dialog.close();
    dialog.remove();
  };
  const draw = () => {
    dialog.innerHTML = `<button type="button" class="ops-close" aria-label="Close manual booking">×</button><p class="eyebrow">MANUAL BOOKING · ${state.step} OF 3</p><ol class="ops-progress" aria-label="Booking progress">${['Guest','Visit','Review'].map((t,i)=>`<li ${state.step===i+1?'aria-current="step"':''}><span>${state.step>i+1?'✓':i+1}</span>${t}</li>`).join('')}</ol><h2>${["", "Who is staying?", "Plan their visit", "Review & confirm"][state.step]}</h2><p>${["", "Use the guest’s own email. Their booking and credits will appear when they sign in with that verified email.", "Choose dates, guests and accommodation. We’ll check availability and show the full price before you confirm.", "Confirming reserves capacity and emails the guest. Record any payment separately."][state.step]}</p><form class="ops-form">${
      state.step === 1
        ? `<label>Guest’s full name<input name="name" autocomplete="name" minlength="2" maxlength="120" required value="${esc(state.customer.name)}"></label><label>Guest’s email<input name="email" type="email" autocomplete="email" maxlength="254" required value="${esc(state.customer.email)}"></label><label>Phone with country code<input name="phone" type="tel" autocomplete="tel" maxlength="32" placeholder="+91 98765 43210" required value="${esc(state.customer.phone)}"></label>`
        : state.step === 2
          ? `<fieldset class="visit-choices"><legend>Visit type</legend><input type="hidden" name="kind" value="${state.kind}">${[
 ['individual','Individual stay','A shared sleeping place'],['private','Private rooms','Rooms just for this party'],['day','Day outing','Visit without staying over'],['event','Exclusive retreat','Reserve the whole property']
].map(([v,t,h])=>`<label class="visit-choice"><input type="radio" name="visitKind" value="${v}" ${state.kind===v?'checked':''}><strong>${t}</strong><small>${h}</small></label>`).join('')}</fieldset><div class="ops-columns"><label>Arrival<input name="arrival" type="date" required value="${state.arrival}"></label><label data-end-label><span data-end-text>Departure</span><input name="departure" type="date" required value="${state.kind === "event" && state.departure ? new Date(Date.parse(state.departure + "T00:00:00Z") - 86400000).toISOString().slice(0, 10) : state.departure}"></label></div><p class="ops-note" data-date-help>Departure is the checkout date, not a night stayed.</p><div class="ops-columns"><label>Adults · age 10+<input name="adults" type="number" min="1" max="35" required value="${state.adults}"></label><label>Children under 10<input name="childrenCount" type="number" min="0" max="100" step="1" value="${state.ageValues?.length || 0}"></label></div><div data-child-ages class="ops-columns"></div><fieldset data-room-fields><legend>Choose private rooms</legend>${units
              .filter((u) => u.active)
              .map(
                (u) =>
                  `<label class="ops-check"><input name="units" type="checkbox" value="${esc(u.id)}" ${state.unitIds.includes(u.id) ? "checked" : ""}>${esc(u.name)}</label>`,
              )
              .join(
                "",
              )}</fieldset><div class="ops-columns"><label>Invitation code (optional)<input name="promo" maxlength="32" value="${esc(state.promo)}"></label><label data-credit-field>Credits to redeem<input name="credits" type="number" min="0" max="1000000000" step="1" value="${state.credits}"></label></div>`
          : `<section class="ops-card"><h3>${esc(state.quote.contact.name)}</h3><p>${esc(state.quote.contact.email)}<br>${esc(state.quote.contact.phone)}</p><p>${esc(visitKind(state.quote.kind))} · ${state.quote.adults} adult(s) · ${state.quote.childrenCount} children<br>${esc(shortDate(state.quote.arrival))} → ${esc(shortDate(state.quote.departure))}</p><p>${esc(state.quote.unitNames.join(" · "))}</p><dl class="ops-price"><div><dt>Subtotal</dt><dd>${cash(state.quote.subtotalPaise)}</dd></div><div><dt>Best offer benefit</dt><dd>−${cash(state.quote.priceBenefitDiscountPaise)}</dd></div><div><dt>Credits (${state.quote.loyaltyCredits})</dt><dd>−${cash(state.quote.loyaltyDiscountPaise)}</dd></div><div><dt>Total payable</dt><dd><strong>${cash(state.quote.totalPaise)}</strong></dd></div></dl></section><label class="ops-check"><input name="consent" type="checkbox" required>I checked the guest contact, dates and price, and have their agreement to confirm and email this booking.</label>`
    }<p role="status" data-message></p><div class="ops-actions">${state.step > 1 && !state.pending ? '<button type="button" class="text-button" data-back>← Back</button>' : ""}<button class="button" type="submit">${state.step === 1 ? "Continue to visit →" : state.step === 2 ? "Check availability & price" : state.pending ? "Retry same confirmation" : "Confirm booking & email guest"}</button></div></form>`;
    dialog.querySelector(".ops-close").onclick = close;
    dialog.querySelector("[data-back]")?.addEventListener("click", () => {
      captureDraft();
      state.step--;
      draw();
    });
    const form = dialog.querySelector("form");
    function captureDraft(){
      if(state.pending)return;
      if(state.step===1)state.customer=Object.fromEntries(['name','email','phone'].map(k=>[k,form.elements[k].value]));
      if(state.step===2){
        state.kind=form.elements.kind.value;state.arrival=form.elements.arrival.value;
        const end=form.elements.departure.value;
        state.departure=state.kind==='event'&&end?new Date(Date.parse(end+'T12:00:00Z')+86400000).toISOString().slice(0,10):end;
        state.adults=Number(form.elements.adults.value);state.ageValues=[...form.querySelectorAll('[name=childAge]')].map(x=>x.value);
        state.unitIds=[...form.querySelectorAll('[name=units]:checked')].map(x=>x.value);state.promo=form.elements.promo.value;state.credits=Number(form.elements.credits.value);
      }
    }
    form.addEventListener('input',captureDraft);form.addEventListener('change',captureDraft);
    if (state.step === 2) {
      const kind = form.elements.kind,
        arrival = form.elements.arrival,
        end = form.elements.departure,
        count = form.elements.childrenCount;
      const drawAges = () => {
        const old = [...form.querySelectorAll("[name=childAge]")].map(
          (x) => x.value,
        );
        const n = Number(count.value);
        if (!Number.isInteger(n) || n < 0 || n > 100) return;
        form.querySelector("[data-child-ages]").innerHTML = Array.from(
          { length: n },
          (_, i) =>
            `<label>Child ${i + 1} · age at arrival<select name="childAge" required><option value="">Choose age</option>${Array.from({ length: 10 }, (_, age) => `<option value="${age}" ${String(old[i] ?? state.ageValues?.[i]) === String(age) ? "selected" : ""}>${age === 0 ? "Under 1" : age + " years"}</option>`).join("")}</select></label>`,
        ).join("");
      };
      const updateKind = () => {
        const day = kind.value === "day",
          event = kind.value === "event";
        form.querySelector("[data-end-label]").hidden = day;
        end.required = !day;
        form.querySelector("[data-end-text]").textContent = event
          ? "Last event day (included)"
          : "Departure";
        form.querySelector("[data-date-help]").textContent = day
          ? "A day outing includes no overnight stay."
          : event
            ? "Select the first and last day of exclusive use. Every selected day is included."
            : "Departure is the checkout date, not a night stayed.";
        form.querySelector("[data-room-fields]").hidden =
          kind.value !== "private";
        form.querySelector("[data-credit-field]").hidden = day || event;
        if (day || event) form.elements.credits.value = "0";
      };
      form.querySelector('.visit-choices').onchange = () => {
        kind.value=form.elements.visitKind.value;updateKind();
      };
      const today=new Date(Date.now()+19800000).toISOString().slice(0,10);
      arrival.min=today;arrival.max=new Date(Date.now()+366*86400000).toISOString().slice(0,10);
      const bounds=()=>{if(!arrival.value){end.removeAttribute('min');end.removeAttribute('max');return;}end.min=kind.value==='event'?arrival.value:new Date(Date.parse(arrival.value+'T12:00:00Z')+86400000).toISOString().slice(0,10);end.max=new Date(Date.parse(arrival.value+'T12:00:00Z')+(kind.value==='event'?30:31)*86400000).toISOString().slice(0,10);};
      arrival.addEventListener('change',()=>{if(arrival.value)bounds();});
      form.querySelector('.visit-choices').addEventListener('change',bounds);bounds();
      count.oninput = drawAges;
      drawAges();
      updateKind();
    }
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(form);
      if (state.step === 1) {
        state.customer = {
          name: String(d.get("name")).trim(),
          email: String(d.get("email")).trim(),
          phone: String(d.get("phone")).trim(),
        };
        state.step = 2;
        draw();
        return;
      }
      const msg = form.querySelector("[data-message]");
      const controls = [
        ...form.querySelectorAll("input,select,textarea,button"),
      ];
      controls.forEach((b) => (b.disabled = true));
      try {
        if (state.step === 2) {
          state.kind = String(d.get("kind"));
          state.arrival = String(d.get("arrival"));
          state.departure = String(d.get("departure"));
          const addDate = (v, n) =>
            new Date(Date.parse(v + "T00:00:00Z") + n * 86400000)
              .toISOString()
              .slice(0, 10);
          if (state.kind === "day") state.departure = addDate(state.arrival, 1);
          if (state.kind === "event")
            state.departure = addDate(state.departure, 1);
          state.adults = Number(d.get("adults"));
          const ages = d.getAll("childAge").map(Number);
          state.ageValues = ages;
          if (ages.some((a) => !Number.isInteger(a) || a < 0 || a > 9))
            throw { code: "INVALID_CHILD_AGE" };
          state.unitIds = d.getAll("units").map(String);
          state.promo = String(d.get("promo"));
          state.credits = Number(d.get("credits"));
          state.quote = await call(
            "quoteManualBooking",
            {
              customer: state.customer,
              kind: state.kind,
              arrival: state.arrival,
              departure: state.departure,
              adults: state.adults,
              childrenAges: ages,
              units: state.kind === "private" ? state.unitIds : [],
              promo: state.promo,
              redeemCredits: state.credits,
            },
            crypto.randomUUID(),
          );
          state.step = 3;
          draw();
        } else {
          state.pending ??= {
            input: { quoteId: state.quote.id },
            key: crypto.randomUUID(),
          };
          const booked = await call(
            "createManualBooking",
            state.pending.input,
            state.pending.key,
          );
          manualDrafts.delete(identity);
          close();
          await onBooked(booked);
        }
      } catch (err) {
        if (!dialog.isConnected) return;
        const messages = {
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
        if (messages[err.code]) {
          state.pending = null;
          if (state.step === 3) state.step = 2;
          draw();
          dialog.querySelector("[data-message]").textContent =
            messages[err.code];
          return;
        }
        msg.textContent = state.pending
          ? "The confirmation response is uncertain. Retry this same confirmation safely before starting another."
          : "Could not check this visit. Check the dates, guest contact and your current access, then try again.";
        controls.forEach((b) => (b.disabled = false));
        if (state.pending) {
          dialog.querySelector("[data-back]")?.remove();
          form.querySelector('button[type="submit"]').textContent =
            "Retry same confirmation";
        }
      }
    };
  };
  draw();
  dialog.showModal();
  dialog.addEventListener("close", () => dialog.remove());
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
