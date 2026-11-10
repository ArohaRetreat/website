import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {deskFields} from '../functions/booking/desk.mjs';
const feedback = (await readFile(new URL('../website/studio-feedback.mjs',import.meta.url),'utf8')).replaceAll('export ', '');
const code=feedback+'\nconst mountStayPanel=async()=>{};const mountGuestIdentity=async()=>{};\n'+(await readFile(new URL('../website/frontdesk.mjs',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replaceAll('export ','')+'\nwindow.desk={hostShell,mountFrontDesk,openStudioBooking};';
const pause=()=>new Promise(r=>setTimeout(r,0));
async function mount({manager=true,failAction=false,failRefresh=false,rejectAction,waitForAction,tab='overview'}={}){
 const dom=new JSDOM('<div id="app"></div>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.eval(code);
 const b={id:'synthetic',reference:'AR-TEST',guestName:'Synthetic guest',kind:'individual',status:'pending_approval',version:1,arrival:'2026-11-06',departure:'2026-11-08',adults:1,children:0,history:[],unitNames:[],total:700000,expiresAt:Date.now()+3600000};const calls=[],actions=[];
 w.document.querySelector('#app').innerHTML=w.desk.hostShell({tab,manager,content:''});
 const call=async(op,input)=>{calls.push({op,input});return{items:[{...b,...deskFields(b),attention:deskFields(b).deskAttention,totalPaise:b.total,childrenCount:0}],asOf:Date.now(),nextCursor:input.cursor?null:'12345678-1234-1234-1234-123456789012'};};
 let detailReads=0;const api=async(op,input,key)=>{if(op==='reservation-detail'){detailReads++;if(failRefresh&&detailReads===2)throw Error('read response lost');return structuredClone(b);}if(op==='booking-action'){actions.push({input,key});if(waitForAction)await waitForAction;if(failAction&&actions.length===1)throw Error('network');if(rejectAction&&actions.length===1)throw rejectAction;b.status=({approve:'confirmed',checkin:'checked_in',complete:'completed'})[input.action]||'declined';b.version++;return b;}if(op==='communications')return{notifications:[]};throw Error(op);};
 await w.desk.mountFrontDesk(w.document.querySelector('[data-frontdesk]'),{tab,call,identity:'staff',openBooking:(id,trigger,initialSection,onChanged)=>w.desk.openStudioBooking({id,trigger,manager,call,api,openLegacy:()=>{},initialSection,onChanged})});
 return{w,d:w.document,b,calls,actions,close:()=>dom.window.close()};
}
test('desk projection separates review work from booking status without identity duplication',()=>{assert.equal(deskFields({status:'confirmed',changeRequest:{}}).deskAttention,'change');assert.equal(deskFields({status:'cancelled',changeRequest:{}}).deskAttention,'none');assert.equal(deskFields({status:'pending_approval',kind:'event'}).deskAttention,'offer');assert.equal(deskFields({status:'pending_approval',kind:'event',pricingVersion:1}).deskAttention,'new');assert.deepEqual(Object.keys(deskFields({})).sort(),['deskAttention','deskDeadline','deskKind']);});
test('filters reach the server, reset cursors, and retain selected state',async()=>{const m=await mount({tab:'today'});try{m.d.querySelector('[data-next]').click();await pause();assert.ok(m.calls.at(-1).input.cursor);m.d.querySelector('[data-filter=kind]').click();const input=m.d.querySelector('input[value=individual]');input.checked=true;m.d.querySelector('dialog form').dispatchEvent(new m.w.Event('submit',{bubbles:true,cancelable:true}));await pause();assert.equal(m.calls.at(-1).input.kind,'individual');assert.equal(m.calls.at(-1).input.cursor,undefined);assert.match(m.d.querySelector('.chip-line').textContent,/Individual stay/);m.d.querySelector('[data-desk-view=departures]').click();await pause();assert.equal(m.calls.at(-1).input.view,'departures');assert.equal(m.calls.at(-1).input.kind,undefined);}finally{m.close();}});
test('acceptance and check-in are distinct, confirmed operations',async()=>{const m=await mount();try{m.d.querySelector('[data-desk-open]').click();await pause();m.d.querySelector('[data-action=approve]').click();await pause();assert.equal(m.b.status,'confirmed');assert.equal(m.actions.length,1);m.d.querySelector('[data-action=checkin]').click();assert.equal(m.actions.length,1);m.d.querySelector('[data-confirm]').click();await pause();assert.equal(m.b.status,'checked_in');assert.equal(m.actions[1].input.expectedVersion,2);}finally{m.close();}});
test('uncertain action retries the frozen payload and key and blocks alternatives',async()=>{const m=await mount({failAction:true});try{m.d.querySelector('[data-desk-open]').click();await pause();m.d.querySelector('[data-action=approve]').click();await pause();assert.ok(m.d.querySelector('[data-retry]'));assert.equal(m.d.querySelector('[data-action=decline]'),null);assert.equal(m.d.querySelector('[data-close]').disabled,true);m.d.querySelector('[data-retry]').click();await pause();assert.deepEqual(m.actions[0],m.actions[1]);assert.equal(m.b.status,'confirmed');}finally{m.close();}});
test('view-only staff see detail but no mutation or manual booking action',async()=>{const m=await mount({manager:false});try{assert.equal(m.d.querySelector('#manual-reservation'),null);assert.equal(m.d.querySelector('[data-host-tab=guests]'),null);m.d.querySelector('[data-desk-open]').click();await pause();assert.equal(m.d.querySelector('[data-action]'),null);}finally{m.close();}});
test('request tabs clear cursors and apply the selected server filter',async()=>{const m=await mount();try{m.d.querySelector('[data-next]').click();await pause();m.d.querySelector('[data-request-filter=change]').click();await pause();assert.equal(m.calls.at(-1).input.view,'review');assert.equal(m.calls.at(-1).input.attention,'change');assert.equal(m.calls.at(-1).input.cursor,undefined);}finally{m.close();}});
test('a decline confirmation replaces competing footer actions until the reviewer returns',async()=>{const m=await mount();try{m.d.querySelector('[data-desk-open]').click();await pause();m.d.querySelector('[data-action=decline]').click();assert.equal(m.d.querySelector('.action-row').hidden,true);assert.match(m.d.querySelector('[data-confirm]').textContent,/decline/);m.d.querySelector('[data-keep]').click();assert.equal(m.d.querySelector('.action-row').hidden,false);}finally{m.close();}});
test('an unpriced exclusive request leads to offer preparation rather than a disabled acceptance',async()=>{const m=await mount();try{m.b.kind='event';m.d.querySelector('[data-desk-open]').click();await pause();assert.equal(m.d.querySelector('[data-action=approve]'),null);assert.equal(m.d.querySelector('[data-legacy]').textContent,'Prepare offer');}finally{m.close();}});
test('a committed action followed by a failed detail refresh retains its retry key',async()=>{const m=await mount({failRefresh:true});try{m.d.querySelector('[data-desk-open]').click();await pause();m.d.querySelector('[data-action=approve]').click();await pause();assert.equal(m.b.status,'confirmed');assert.ok(m.d.querySelector('[data-retry]'));m.d.querySelector('[data-retry]').click();await pause();assert.deepEqual(m.actions[0],m.actions[1]);assert.equal(m.d.querySelector('[data-retry]'),null);}finally{m.close();}});

test("booking activity shows recorded events newest first", async () => {
  const m = await mount();
  try {
    m.b.history = [
      { status: "pending_approval", at: Date.parse("2026-11-08T04:00:00Z") },
      { status: "dates_changed", at: Date.parse("2026-11-09T07:00:00Z") },
      { status: "confirmed", at: Date.parse("2026-11-08T07:00:00Z") },
    ];
    m.d.querySelector("[data-desk-open]").click();
    await pause();
    m.d.querySelector("[data-section=activity]").click();
    const events = [...m.d.querySelectorAll(".booking-timeline li")];
    assert.deepEqual(events.map((item) => item.querySelector("strong").textContent), [
      "Dates changed", "Confirmed", "Request received",
    ]);
    assert.equal(events[0].querySelector("time").dateTime,"2026-11-09T07:00:00.000Z");
    assert.equal(m.d.querySelectorAll(".booking-timeline .current").length,1);
  } finally {
    m.close();
  }
});

test("checkout switches from early to scheduled in the open drawer at the cutoff", async () => {
  const m = await mount({ tab: "today" });
  try {
    const opens = Date.parse("2026-11-10T11:00:00+05:30");
    let now = opens - 60_000;
    let wake;
    m.w.Date.now = () => now;
    m.w.setTimeout = callback => { wake = callback; return 1; };
    Object.assign(m.b, { status: "checked_in", version: 5, departure: "2026-11-10", endsAt: opens });
    m.d.querySelector("[data-desk-open]").click();
    await pause();
    const button = () => m.d.querySelector('[data-action="complete"]');
    assert.equal(button().textContent, "Review early checkout");
    assert.match(m.d.querySelector("[data-action-hint]").textContent, /Scheduled checkout is on 10 Nov 2026 at 11:00 am IST/i);

    now = opens;
    wake();
    assert.equal(button().textContent, "Review checkout");
    button().click();
    assert.equal(m.d.querySelector('[data-section="payments"]').getAttribute("aria-pressed"), "true");
    button().click();
    m.d.querySelector("[data-confirm]").click();
    await pause();
    assert.deepEqual(JSON.parse(JSON.stringify(m.actions.map(call => call.input))), [
      { id: "synthetic", action: "complete", expectedVersion: 5 },
    ]);
    assert.equal(m.b.status, "completed");
    assert.equal(button(), null);
  } finally {
    m.close();
  }
});

test("a server timing conflict keeps the booking checked in and offers early checkout", async () => {
  const m = await mount({
    tab: "today",
    rejectAction: { code: "STAY_NOT_STARTED_OR_FINISHED", status: 409 },
  });
  try {
    const opens = Date.parse("2026-11-10T11:00:00+05:30");
    m.w.Date.now = () => opens;
    Object.assign(m.b, { status: "checked_in", departure: "2026-11-10", endsAt: opens });
    m.d.querySelector("[data-desk-open]").click();
    await pause();
    m.d.querySelector('[data-section="payments"]').click();
    m.d.querySelector('[data-action="complete"]').click();
    m.d.querySelector("[data-confirm]").click();
    await pause();
    assert.equal(m.b.status, "checked_in");
    assert.match(m.d.querySelector("[data-action-status]").textContent, /Scheduled checkout is on 10 Nov 2026 at 11:00 am IST/i);
    assert.equal(m.d.querySelector('[data-action="complete"]').textContent, "Review early checkout");
    assert.equal(m.d.querySelector("[data-retry]"), null);
  } finally {
    m.close();
  }
});

test("early checkout requires payment review and confirmation and retains its retry key", async () => {
  const m = await mount({ tab: "today", failAction: true });
  try {
    const opens = Date.parse("2026-11-10T11:00:00+05:30");
    m.w.Date.now = () => opens - 60_000;
    Object.assign(m.b, { status: "checked_in", version: 5, departure: "2026-11-10", endsAt: opens });
    m.d.querySelector("[data-desk-open]").click();
    await pause();
    const button = () => m.d.querySelector('[data-action="complete"]');
    button().click();
    assert.equal(m.d.querySelector('[data-section="payments"]').getAttribute("aria-pressed"), "true");
    button().click();
    assert.equal(m.d.querySelector("[data-confirm]").textContent, "Confirm early checkout");
    assert.equal(m.actions.length, 0);

    m.d.querySelector("[data-confirm]").click();
    await pause();
    m.d.querySelector("[data-retry]").click();
    await pause();
    assert.deepEqual(m.actions[0], m.actions[1]);
    assert.deepEqual(JSON.parse(JSON.stringify(m.actions[0].input)), {
      id: "synthetic", action: "complete", expectedVersion: 5, earlyCheckout: true,
    });
    assert.equal(m.b.status, "completed");
  } finally {
    m.close();
  }
});

test("a pending booking action shows progress until its result is known", async () => {
  const request = Promise.withResolvers();
  const m = await mount({ waitForAction: request.promise, failAction: true });
  try {
    m.d.querySelector("[data-desk-open]").click();
    await pause();
    m.d.querySelector("[data-action=approve]").click();
    const status = m.d.querySelector("[data-action-status]");
    assert.equal(status.hasAttribute("data-studio-progress"), true);
    assert.equal(status.textContent, "Saving booking…");
    assert.equal(m.d.querySelector("[data-close]").disabled, true);
    request.resolve();
    await pause();
    assert.equal(m.d.querySelector("[data-action-status]").hasAttribute("data-studio-progress"), false);
    assert.ok(m.d.querySelector("[data-retry]"));
  } finally {
    request.resolve();
    m.close();
  }
});
