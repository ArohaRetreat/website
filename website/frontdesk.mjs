import { mountGuestIdentity } from "./guest-identity.mjs";
import {mountStayPanel} from './stay-panel.mjs';
export const escape = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=escape, money=v=>v==null?'Quote needed':new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(v/100);
const kinds={individual:'Individual stay',private:'Private room',day:'Day visit',event:'Exclusive retreat'};
const statuses={pending_approval:'Needs review',confirmed:'Confirmed',checked_in:'Checked in',completed:'Completed',cancelled:'Cancelled',declined:'Declined',expired:'Expired',no_show:'No show'};
const attention={new:'New request',change:'Date change',offer:'Offer requested'};
const activityLabels = {
  ...statuses, pending_approval:"Request received", dates_changed:"Dates changed", change_declined:"Date change declined",
  rooms_assigned:"Rooms assigned", request_change:"Date change requested", withdraw_change:"Date change withdrawn",
  quote_sent:"Quote sent", offer_sent:"Offer sent",
};
const activityDate = new Intl.DateTimeFormat("en-IN", { day:"numeric", month:"short", year:"numeric", timeZone:"Asia/Kolkata" });
const activityTime = new Intl.DateTimeFormat("en-IN", { hour:"numeric", minute:"2-digit", timeZone:"Asia/Kolkata" });
const checkoutOpensAt = booking => booking.kind && Number.isFinite(booking.endsAt)
  ? booking.endsAt
  : Date.parse(booking.departure + "T00:00:00+05:30");
const checkoutSchedule = at => Number.isFinite(at)
  ? `Scheduled checkout is on ${activityDate.format(at)} at ${activityTime.format(at)} IST.`
  : "Review the scheduled checkout time before confirming.";
function bookingTimeline(history) {
  const entries = Array.isArray(history)
    ? history.filter((event) => event?.status && Number.isFinite(event.at)).reverse().sort((a,b) => b.at - a.at)
    : [];
  return `<section class="booking-activity"><h3>Booking activity</h3>
    ${entries.length ? `<p class="activity-caption">Latest first · India Standard Time</p>
      <ol class="booking-timeline">${entries.map((event,index) => `<li>
        <span class="timeline-marker" aria-hidden="true"></span>
        <div><strong>${e(event.earlyCheckout === true ? "Checked out early" : activityLabels[event.status] || event.status.replaceAll("_"," "))}</strong>${index === 0 ? '<span class="table-status current">Latest</span>' : ""}
          <time datetime="${new Date(event.at).toISOString()}">${activityDate.format(event.at)} · ${activityTime.format(event.at)}</time>
        </div></li>`).join("")}</ol>` : '<p class="workspace-empty">No activity has been recorded for this booking.</p>'}
  </section>`;
}
const format=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
const eventLastDay = (day) => new Date(Date.parse(day + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
const dateField = (label, day) => `<div><small>${label}</small><time datetime="${e(day)}">${format(day)}</time></div>`;
const visitDates = (b) => `<div class="date-pair ${b.kind === "day" ? "single-date" : ""}">${b.kind === "day"
  ? dateField("Visit date", b.arrival)
  : dateField(b.kind === "event" ? "First event day" : "Check-in", b.arrival) +
    '<span class="date-direction" aria-hidden="true">→</span>' +
    dateField(b.kind === "event" ? "Last event day" : "Checkout", b.kind === "event" ? eventLastDay(b.departure) : b.departure)}</div>`;
const icons = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="11" width="7" height="10" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  overview: '<path d="M4 4h16l2 10v6H2v-6Zm-2 10h6l2 3h4l2-3h6"/>',
  calendar: '<path d="M3 5h18v16H3zM7 3v4m10-4v4M3 10h18"/>',
  guests: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m0 4a5 5 0 0 1 4 5"/>',
  inventory: '<path d="m3 11 9-8 9 8M5 10v11h14V10m-10 11v-7h6v7"/>',
  payments: '<path d="M3 5h18v14H3zM3 10h18M7 15h4m3 0h2"/>',
  mail: '<path d="M3 5h18v14H3zM3 5l9 8 9-8"/>',
  website: '<path d="M3 4h18v16H3zM3 9h18M7 7h.01M10 7h.01"/>',
  access: '<path d="M12 3 3 7v5c0 6 9 10 9 10s9-4 9-10V7zM8 12l3 3 5-6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  appearance: '<path d="M5 6h14M5 12h14M5 18h14"/><circle cx="9" cy="6" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/>',
};
export const studioIcon = (id) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[id] || ""}</svg>`;
export const hostDestinations = (manager) => [
  ["dashboard","Dashboard"],["today","Today on the Farm"],["overview","Requests & Quotes"],
  ["calendar","Bookings & Calendar"], ...(manager ? [["guests","Guests"]] : []),
  ["inventory","Cottages & Spaces"],["payments","Payments & Credits"], ...(manager ? [["mail","Guest email"]] : []),
  ["appearance","Settings"],
];
const groups = {
  reservations:"calendar", "calendar-month":"calendar", feedback:"calendar",
  settings:"inventory", facilities:"inventory", blocks:"inventory", offers:"overview",
  documents:"payments", loyalty:"payments",
};
const activeGroup = (tab) => groups[tab] || tab;
export const hostTabAllowed = (tab, manager) =>
  hostDestinations(manager).some(([id]) => id === activeGroup(tab)) &&
  (manager || !["documents","loyalty","feedback"].includes(tab));
export function hostShell({ tab, manager, content, modules = {}, initials = "AR" }) {
  const link = ([id,label], smallLabel = label) => `<button type="button" data-host-tab="${id}" aria-label="${e(label)}" title="${e(label)}" ${activeGroup(tab)===id?'aria-current="page"':''}>${studioIcon(id)}<span>${e(smallLabel)}</span></button>`;
  const moduleLinks = [["website","Site Studio"],["access","Staff & Access"]].filter(([id])=>modules[id]);
  const title = hostDestinations(manager).find(([id])=>id===activeGroup(tab))?.[1] || "Dashboard";
  const section = {
    today:["Today on the Farm","Welcome arrivals, see guests in house and review checkouts."],
    overview:["Requests & Quotes","Review new requests, date changes and exclusive retreat offers."],
    reservations:["Bookings & Calendar","Search reservations and filter the archive."],
  }[tab];
  const shortcuts = [["dashboard","Dashboard"],["today","Today on the Farm"],["calendar","Bookings & Calendar"],manager?["guests","Guests"]:["overview","Requests & Quotes"]];
  const mobileLabels = ["Dashboard","Today","Calendar",manager?"Guests":"Requests"];
  return `<div class="workspace">
    <header class="topbar">
      <a class="workspace-brand" href="/" aria-label="Aroha Retreat website"><img src="/assets/brand/logo-white.svg" width="1000" height="340" alt=""><strong>Host Studio</strong></a>
      <form class="global-search" data-desk-search><label class="sr-only" for="desk-reference">${manager?"Find a booking or guest":"Find a booking reference"}</label><input id="desk-reference" name="reference" maxlength="254" minlength="2" autocomplete="off" placeholder="${manager?"Find a booking or guest":"Find booking reference"}" required><button aria-label="Search Studio" type="submit">${studioIcon("search")}</button></form>
      <div class="workspace-top-actions"><button type="button" class="workspace-mobile-search" data-mobile-search aria-label="Search Studio">${studioIcon("search")}</button><button type="button" class="workspace-account" data-studio-account aria-label="Studio account">${e(initials)}</button></div>
    </header>
    <aside class="rail">
      ${manager ? '<button type="button" class="primary workspace-new" data-new-booking>＋ <span>New booking</span></button>' : ""}
      <nav aria-label="Studio navigation"><span class="nav-caption">Workspace</span>${hostDestinations(manager).filter(([id]) => id !== "appearance").map((item)=>link(item)).join("")}
      ${moduleLinks.map(([id,label])=>`<button type="button" data-studio-module="${id}" aria-label="${e(label)}" title="${e(label)}">${studioIcon(id)}<span>${e(label)}</span></button>`).join("")}
      <div class="rail-bottom">${link(["appearance","Settings"])}</div></nav>
    </aside>
    <div class="page"><main id="main" tabindex="-1">${section ? `<div class="page-heading"><div><p class="eyebrow">${e(title)}</p><h1>${e(section[0])}</h1><p>${e(section[1])}</p></div>${manager?'<button class="primary mobile-new" data-new-booking>＋ New booking</button>':""}</div>${content}<div data-frontdesk></div>` : content}</main>
      <footer class="studio-footer"><span>© ${new Date().getFullYear()} Aroha Retreat</span><nav aria-label="Legal">
        <button type="button" class="text-button" data-studio-privacy>Privacy policy</button>
        <button type="button" class="text-button" data-studio-terms>Terms &amp; conditions</button>
      </nav></footer></div>
    <nav class="bottom-nav" aria-label="Studio mobile navigation">${shortcuts.map((item,i)=>link(item,mobileLabels[i])).join("")}<button type="button" data-desk-more>${studioIcon("more")}<span>More</span></button></nav>
  </div>`;
}
const memories=new Map();
export async function mountFrontDesk(target, { tab, call, identity, openBooking, initialView }) {
  const key=identity+':'+tab;
  const s=memories.get(key)||{view:tab==='overview'?'review':tab==='today'?'arrivals':'all',filter:{},cursor:undefined,stack:[],page:null}; memories.set(key,s);
  if (initialView && initialView !== s.view) {
    s.view = initialView;
    s.filter = {};
    s.cursor = undefined;
    s.stack = [];
    s.page = null;
  }
  let generation=0,busy=false;
  const alive=()=>target.isConnected;
  const notify=t=>{if(alive())target.querySelector('[data-desk-status]').textContent=t;};
  const labels={review:'Review requests',arrivals:'Check-ins today',in_house:'In house',departures:'Check-outs',all:'All bookings'};
  const clearPage=()=>{s.cursor=undefined;s.stack=[];};
  const draw=()=>{
    if(!alive())return;
    const f=s.filter, rows=s.page?.items||[];
    const viewTabs = tab === "today" ? `<div class="task-tabs" role="group" aria-label="Today’s visits">${["arrivals","in_house","departures"].map((view)=>`<button type="button" data-desk-view="${view}" aria-pressed="${s.view === view}">${labels[view]}</button>`).join("")}</div>` : "";
    const requestTabs = s.view === "review" ? `<div class="task-tabs" role="group" aria-label="Request types">${[["","All requests"],["new","New requests"],["change","Date changes"],["offer","Offers"]].map(([value,label])=>`<button type="button" data-request-filter="${value}" aria-pressed="${(f.attention || "") === value}">${label}</button>`).join("")}<button type="button" data-host-tab="offers">Promotions</button></div>` : "";
    target.innerHTML=`${viewTabs}${requestTabs}<section class="list-surface"><div class="list-top"><div><h2>${labels[s.view]}</h2><p>${s.view==='review'?'Review the visit and price, then decide what happens next.':'Open a guest’s booking to continue their visit.'}</p></div><button class="ghost" data-refresh>Refresh</button></div><div class="toolbar"><button class="filter-trigger ${f.kind?'filtered':''}" data-filter="kind">Visit type ${f.kind?'· '+kinds[f.kind]:''}⌄</button><button class="filter-trigger ${f.arrivalFrom||f.arrivalThrough?'filtered':''}" data-filter="date">Arrival date ⌄</button>${s.view==='review'?`<button class="filter-trigger ${f.attention?'filtered':''}" data-filter="attention">Request type ⌄</button>`:s.view==='all'?`<button class="filter-trigger ${f.status?'filtered':''}" data-filter="status">Status ⌄</button>`:''}<span class="sort-trigger">${s.view==='review'?'Response deadline':'Arrival date'} ↑</span></div><div class="chip-line">${Object.entries(f).map(([k,v])=>`<button class="filter-chip" data-remove="${e(k)}">${e(kinds[v]||statuses[v]||attention[v]||(k==='reference'?'Reference: ':k==='arrivalFrom'?'From: ':'Through: ')+v)} ×</button>`).join('')}${Object.keys(f).length?'<button class="clear-filters" data-clear>Clear all</button>':''}</div><p role="status" data-desk-status>${s.page?'':'Loading bookings…'}</p><div data-desk-results ${busy?'aria-busy="true"':''}>${rows.length?`<table class="booking-table"><thead><tr>${['Guest','Visit','Dates',s.view==='review'?'To review':'Status','Total','Action'].map(t=>`<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${rows.map(b=>`<tr><td><div class="guest-cell"><span class="avatar" aria-hidden="true">${e(b.guestName.slice(0,1))}</span><div><button class="name-button" data-desk-open="${e(b.id)}">${e(b.guestName)}</button><small>${e(b.reference)}</small></div></div></td><td><span class="cell-main">${kinds[b.kind]}</span><span class="cell-sub">${b.adults} adult(s)${b.childrenCount?' · '+b.childrenCount+' under 10':''}</span></td><td><span class="cell-main">${format(b.arrival)}</span><span class="cell-sub">${b.kind==='day'?'Day visit':'Through '+format(b.kind==='event'?new Date(Date.parse(b.departure+'T00:00:00Z')-86400000).toISOString().slice(0,10):b.departure)}</span></td><td><span class="badge ${b.attention==='change'?'purple':b.status==='confirmed'?'green':''}">${e(attention[b.attention]||statuses[b.status])}</span></td><td class="money">${money(b.totalPaise)}</td><td><button class="row-action" data-desk-open="${e(b.id)}">${s.view==='review'?'Review':s.view==='arrivals'?'Check in':'Open'} →</button></td></tr>`).join('')}</tbody></table>`:`<div class="empty-state"><h3>${s.page?'No bookings in this view.':'Loading your workspace…'}</h3><p>${s.page?'Try another view or adjust your filters.':''}</p></div>`}</div><div class="table-footer"><span>Page ${s.stack.length+1}${s.page?' · '+rows.length+' bookings':''}</span><div class="pagination"><button data-previous ${!s.stack.length||busy?'disabled':''}>← Previous</button><button data-next ${!s.page?.nextCursor||busy?'disabled':''}>Next →</button></div></div></section>`;
    target.querySelectorAll('[data-desk-view]').forEach(b=>b.onclick=()=>{s.view=b.dataset.deskView;s.filter={};clearPage();s.page=null;void load();});
    target.querySelectorAll("[data-request-filter]").forEach((control) => {
      control.onclick = () => {
        if (control.dataset.requestFilter) s.filter.attention = control.dataset.requestFilter;
        else delete s.filter.attention;
        clearPage();
        void load();
      };
    });
    target.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>filterDialog(b.dataset.filter,b));
    target.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{delete s.filter[b.dataset.remove];clearPage();void load();});
    target.querySelector('[data-clear]')?.addEventListener('click',()=>{s.filter={};clearPage();void load();});
    target.querySelector('[data-refresh]').onclick=()=>void load();
    target.querySelector('[data-next]').onclick=()=>{s.stack.push(s.cursor);s.cursor=s.page.nextCursor;void load(true);};
    target.querySelector('[data-previous]').onclick=()=>{s.cursor=s.stack.pop();void load(true);};
    target.querySelectorAll('[data-desk-open]').forEach(b=>b.onclick=()=>void openBooking(b.dataset.deskOpen,b,s.view==='departures'?'payments':'overview',()=>load()));
  };
  async function load(paging=false){
    const g=++generation;busy=true;draw();notify('Loading bookings…');
    target.querySelectorAll('button').forEach(b=>b.disabled=true);
    try {const result=await call('searchHostReservations',{view:s.view,...s.filter,limit:25,...(s.cursor?{cursor:s.cursor}:{})});if(g!==generation||!alive())return;s.page=result;s.lastCursor=s.cursor;s.lastStack=[...s.stack];busy=false;draw();notify('Updated '+new Date(result.asOf).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'})+' IST');}
    catch(err){if(g!==generation||!alive())return;busy=false;if(paging){s.cursor=s.lastCursor;s.stack=[...(s.lastStack||[])];}if([401,403].includes(err.status)||err.code==='SESSION_CHANGED')s.page=null;draw();notify(err.code==='CURSOR_EXPIRED'?'This page expired. Refresh to start again.':'Bookings could not load. Your last results remain shown. Check your access and refresh.');}
  }
  function filterDialog(type,trigger){
    const d=document.createElement('dialog');d.className='filter-dialog';d.setAttribute('aria-label',type==='date'?'Arrival dates':'Filter bookings');
    const opts=type==='kind'?kinds:type==='attention'?attention:statuses;
    d.innerHTML=`<form><div class="dialog-head"><h2>${type==='date'?'Arrival dates':type==='kind'?'Visit type':type==='attention'?'Request type':'Status'}</h2><button type="button" class="icon-button ghost" data-close aria-label="Close filters">×</button></div>${type==='date'?`<div class="filter-options"><label>From<input name="arrivalFrom" type="date" value="${e(s.filter.arrivalFrom||'')}"></label><label>Through<input name="arrivalThrough" type="date" value="${e(s.filter.arrivalThrough||'')}"></label><p>Filter by the date the visit begins.</p></div>`:`<div class="filter-options"><label class="filter-option"><input type="radio" name="value" value="" ${!s.filter[type]?'checked':''}>All ${type==='kind'?'visit types':type==='attention'?'requests':'statuses'}</label>${Object.entries(opts).map(([v,l])=>`<label class="filter-option"><input type="radio" name="value" value="${v}" ${s.filter[type]===v?'checked':''}>${l}</label>`).join('')}</div>`}<p role="status"></p><div class="filter-foot"><button type="button" class="ghost" data-reset>Reset</button><button class="primary">Apply filters</button></div></form>`;
    document.body.append(d);d.showModal();
    const close=()=>d.close();d.querySelector('[data-close]').onclick=close;
    d.addEventListener('close',()=>{d.remove();if(trigger?.isConnected)trigger.focus();},{once:true});
    d.querySelector('[data-reset]').onclick=()=>{if(type==='date'){d.querySelectorAll('input').forEach(i=>i.value='');}else d.querySelector('input[value=""]').checked=true;};
    d.querySelector('form').onsubmit=ev=>{ev.preventDefault();const data=new FormData(ev.currentTarget);if(type==='date'){const a=String(data.get('arrivalFrom')),b=String(data.get('arrivalThrough'));if(a&&b&&a>b){d.querySelector('[role=status]').textContent='Choose an end date on or after the start.';return;}for(const k of ['arrivalFrom','arrivalThrough']){const v=data.get(k);if(v)s.filter[k]=v;else delete s.filter[k];}}else{const value=data.get('value');if(value)s.filter[type]=value;else delete s.filter[type];}clearPage();close();void load();};
  }
  if(s.page)draw();
  await load();
}

export async function openStudioBooking({
  id, trigger, api, call, manager, openLegacy, guestIdentityEnabled = false,
  initialSection = "overview", onChanged = () => {}, composeEmail,
}) {
    const d=document.createElement('dialog');d.className='booking-panel';d.setAttribute('data-dt-mask','');d.setAttribute('aria-label','Booking details');d.innerHTML='<div class="dialog-head"><h2>Opening booking…</h2><button data-close aria-label="Close booking details">×</button></div><p role="status">Loading…</p>';document.body.append(d);d.showModal();
    let b,section=initialSection,pending,working=false,uncertain=false,checkoutTimer;
    let checkoutTimingRejected = false;
    const needsEarlyCheckout = () => checkoutTimingRejected || Date.now() < checkoutOpensAt(b);
    const close=()=>{if(!working&&!uncertain)d.close();};
    d.addEventListener('cancel',ev=>{if(working||uncertain)ev.preventDefault();});
    d.addEventListener('close',()=>{clearTimeout(checkoutTimer);d.remove();if(trigger?.isConnected)trigger.focus();},{once:true});d.querySelector('[data-close]').onclick=close;
    async function fetchBooking(){const name=b?.guestName;b=await api('reservation-detail',{id});if(!b.guestName&&name)b.guestName=name;}
    function render(){
      clearTimeout(checkoutTimer);
      if(!d.isConnected)return;
      const review=b.status==='pending_approval',change=b.status==='confirmed'&&b.changeRequest;
      const starts=b.startsAt||Date.parse(b.arrival+'T00:00:00+05:30'), checkinOpen=Date.now()>=starts;
      const checkoutTime = checkoutOpensAt(b);
      const earlyCheckout = b.status === "checked_in" && needsEarlyCheckout();
      const hint = uncertain ? "The response is uncertain. Resolve this same action before continuing."
        : manager && earlyCheckout ? checkoutSchedule(checkoutTime)
        : b.status === "confirmed" && !checkinOpen ? "Check-in opens " + new Date(starts).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}) + " IST."
        : "Booking changes and email delivery are tracked separately.";
      d.innerHTML=`<div class="dialog-head booking-heading"><div class="booking-heading-copy"><div class="eyebrow">${review||change?'Review request':'Booking details'}</div><h2>${e(b.contact?.name||b.guestName||'Guest')}</h2><div class="dialog-reference">${e(b.reference)} <span class="badge">${e(statuses[b.status])}</span>${b.guestNumber ? `<span class="identity-number">Guest #${Number(b.guestNumber)}</span>` : ""}</div></div><button class="icon-button ghost" data-close aria-label="Close booking details" ${working||uncertain?'disabled':''}>×</button></div><div class="panel-tabs" role="group" aria-label="Booking sections">${['overview',...(manager&&guestIdentityEnabled?['identity']:[]),'payments','messages','activity'].map(x=>`<button data-section="${x}" aria-pressed="${section===x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div><div class="panel-body" data-body></div><footer class="panel-footer"><p role="status" data-action-status></p><div class="action-row">${manager?(uncertain?'<button class="primary" data-retry>Retry same action</button>':change?'<button class="danger" data-action="decline_change">Keep original dates</button><button class="primary" data-action="approve_change">Approve new dates</button>':review?`<button class="danger" data-action="decline">Decline</button>${b.kind==='event'&&!b.pricingVersion&&!b.quoteAccepted?'':'<button class="primary" data-action="approve">Accept request</button>'}`:b.status==='confirmed'?`<button class="primary" data-action="checkin" ${checkinOpen?'':'disabled'}>Check in guest</button>`:b.status==='checked_in'?`<button class="primary" data-action="complete">${earlyCheckout ? 'Review early checkout' : 'Review checkout'}</button>`:''):''}<button class="${review&&b.kind==='event'&&!b.pricingVersion&&!b.quoteAccepted?'primary':'ghost'}" data-legacy ${uncertain||working?'disabled':''}>${review&&b.kind==='event'&&!b.pricingVersion&&!b.quoteAccepted?'Prepare offer':'More booking options'}</button></div><small data-action-hint aria-live="polite">${e(hint)}</small></footer>`;
      d.querySelector('[data-close]').onclick=close;
      d.querySelectorAll('[data-section]').forEach(x=>{x.disabled=working||uncertain;x.onclick=()=>{section=x.dataset.section;render();d.querySelector('[aria-pressed=true][data-section]')?.focus();};});
      d.querySelector('[data-legacy]').onclick=()=>{d.close();void openLegacy(id);};
      d.querySelectorAll('[data-action]').forEach(x=>x.onclick=()=>confirmAction(x.dataset.action));d.querySelector('[data-retry]')?.addEventListener('click',()=>void submit());
      const checkoutButton = d.querySelector('[data-action="complete"]');
      if (checkoutButton && earlyCheckout && !checkoutTimingRejected) {
        const updateCheckoutLabel = () => {
          const remaining = checkoutTime - Date.now();
          if (remaining > 0) {
            checkoutTimer = setTimeout(updateCheckoutLabel, Math.min(remaining, 2_147_483_647));
            return;
          }
          checkoutButton.textContent = "Review checkout";
          d.querySelector("[data-action-hint]").textContent = "Checkout is now available.";
        };
        updateCheckoutLabel();
      }
      const body=d.querySelector('[data-body]');
      if(section==='overview')body.innerHTML=`${change?`<div class="review-warning"><strong>Requested date change</strong><p>Original: ${format(b.arrival)} → ${format(b.departure)} · ${money(b.total)}</p><p>Requested: ${format(b.changeRequest.arrival)} → ${format(b.changeRequest.departure)} · ${money(b.changeRequest.total)}</p></div>`:''}<div class="section-label">Their visit</div>${visitDates(b)}<dl class="booking-facts"><div><dt>Visit</dt><dd>${kinds[b.kind]||'Private room'}</dd></div><div><dt>Guests</dt><dd>${b.adults??b.guests} ${(b.adults??b.guests)===1?"adult":"adults"} · ${b.children||0} under 10</dd></div><div class="accommodation-fact"><dt>Accommodation</dt><dd>${e((b.unitNames||[]).join(', ')||'Host allocation')}</dd></div></dl>${b.note?`<section class="panel-section"><h3>Guest request</h3><div class="note-card">${e(b.note)}</div></section>`:''}<section class="panel-section"><h3>Booking total</h3><div class="price-line total"><span>Total</span><span>${money(b.total)}</span></div>${review?`<p>Respond by ${new Date(b.expiresAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST.</p>`:''}</section>`;
      if (section === "identity" && guestIdentityEnabled && manager) {
        const target = document.createElement("div");
        body.append(target);
        void mountGuestIdentity(target, { call: api, bookingId: id });
      }
      if(section==='payments')void mountStayPanel(body,{booking:b,manager,staff:true,call,onMutation:async()=>{await fetchBooking();await onChanged();}});
      if(section==='activity')body.innerHTML=bookingTimeline(b.history);
      if(section==='messages'){body.textContent='Loading email updates…';void api('communications',{id}).then(p=>{if(!body.isConnected)return;const rows = (p.notifications || []).map((item) => `<article class="note-card"><strong>${e(item.channel.replace(/^guest_/,"").replaceAll("_"," "))}</strong><p>${e(item.status.replaceAll("_"," "))}</p></article>`).join("");
        body.innerHTML = '<h3>Email updates</h3>' + (rows || '<p>No email updates yet.</p>') + (manager && composeEmail && b.owner ? '<button type="button" class="outline-button" data-compose-booking>Compose email</button>' : '');
        body.querySelector('[data-compose-booking]')?.addEventListener('click', () => { d.close(); composeEmail(b.owner, b.id); });}).catch(()=>{if(body.isConnected)body.textContent='Email updates could not load. Reopen Messages to retry.';});}
    }
    function confirmAction(action){
      const status=d.querySelector('[data-action-status]');
      const earlyCheckout = action === "complete" && needsEarlyCheckout();
      if(action==='complete'&&section!=='payments'){section='payments';render();d.querySelector('[data-action-status]').textContent='Review recorded payments and balance before confirming checkout.';return;}
      if(action==='approve'){pending={input:{id,action,expectedVersion:b.version},key:crypto.randomUUID()};void submit();return;}
      clearTimeout(checkoutTimer);
      d.querySelector('.action-row').hidden=true;
      const checkoutCopy = earlyCheckout
        ? ["Check out this guest early?", "Confirm the guest is leaving now. The checkout statement uses the booking total and recorded payments.", "Confirm early checkout"]
        : ["Check out this guest?", "Checkout records eligible night credits and a checkout statement.", "Confirm checkout"];
      const update = "The guest will receive the corresponding booking update.";
      const [title, description, label] = {
        decline: ["Decline this request?", update, "Confirm decline"],
        approve_change: ["Approve the requested dates?", update, "Confirm new dates"],
        decline_change: ["Keep the original dates?", update, "Confirm original dates"],
        checkin: ["Has the guest arrived?", "Verify their identity and actual arrival. This does not record a payment.", "Confirm check-in"],
        complete: checkoutCopy,
      }[action];
      status.innerHTML=`<strong>${title}</strong><p>${description}</p><button class="ghost" data-keep>Keep reviewing</button><button class="${action === "decline" ? "danger" : "primary"}" data-confirm>${label}</button>`;
      d.querySelector('[data-confirm]').onclick=()=> {
        const input = { id, action, expectedVersion: b.version, ...(earlyCheckout ? { earlyCheckout: true } : {}) };
        pending = { input, key: crypto.randomUUID() };
        void submit();
      };
      d.querySelector('[data-keep]').onclick=render;
    }
    async function submit(){
      working=true;d.querySelectorAll('button').forEach(x=>x.disabled=true);d.querySelector('[data-action-status]').textContent='Saving…';
      try{await api('booking-action',pending.input,pending.key);await fetchBooking();pending=null;uncertain=false;working=false;render();void onChanged();d.querySelector('[data-action-status]').textContent='Booking updated. Check Messages for delivery status.';}
      catch (err) {
        working = false;
        if ([401,403].includes(err.status) || err.code === "SESSION_CHANGED") {
          d.innerHTML = '<div class="dialog-head"><h2>Booking access changed</h2><button data-denied-close>Close</button></div><p>You no longer have access to these details. Sign in again or contact the retreat owner.</p>';
          uncertain = false;
          d.querySelector("[data-denied-close]").onclick = close;
          return;
        }
        const definitive = err.status >= 400 && err.status < 500 || [
          "VERSION_CONFLICT", "INVALID_TRANSITION", "CAPACITY_EXCEEDED", "ROOM_UNAVAILABLE",
          "AVAILABILITY_CHANGED", "STAY_NOT_STARTED_OR_FINISHED", "QUOTE_NOT_ACCEPTED",
        ].includes(err.code);
        if (definitive) {
          const checkoutTimingConflict = pending?.input.action === "complete" && err.code === "STAY_NOT_STARTED_OR_FINISHED";
          checkoutTimingRejected ||= checkoutTimingConflict;
          pending = null;
          uncertain = false;
          try { await fetchBooking(); } catch {}
          render();
          d.querySelector("[data-action-status]").textContent = checkoutTimingConflict
            ? checkoutSchedule(checkoutOpensAt(b))
            : "This action could not complete. Review the latest booking, dates and availability before trying again.";
        } else {
          uncertain = true;
          render();
        }
      }
    }
    try{await fetchBooking();if(d.isConnected)render();}catch{if(d.isConnected)d.querySelector('[role=status]').textContent='Booking could not load. Close and reopen to retry.';}
  }
