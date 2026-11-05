import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,mutate,addDays} from '../functions/booking/domain.mjs';
import {availabilityCalendar,calendarWindow,productAvailability} from '../functions/booking/products.mjs';
import {validateBookingOperation} from '../functions/booking/store.mjs';
import {createEnquiryAccess} from '../website/enquiry-access.mjs';
import {JSDOM} from 'jsdom';
const now=Date.parse('2026-11-05T03:00:00Z'), date='2026-11-15', guest={id:'g',role:'guest'},host={id:'h',role:'host'};
const selection=(kind,arrival=date,departure=addDays(date,1),adults=2,childrenAges=[])=>({kind,arrival,departure,adults,childrenAges,guests:adults+childrenAges.length,units:kind==='private'?['cottage-1']:[]});
function reserve(s,i){const q=mutate(s,guest,'quote',i,now);return mutate(s,guest,'create',{quoteId:q.id},now);}
const calendar=(s,more={})=>availabilityCalendar(s,{start:date,days:5,kind:'stay',adults:2,childrenAges:[],...more},now);
const approve=(s,b)=>mutate(s,host,'booking-action',{id:b.id,expectedVersion:b.version,action:'approve'},now);
test('published exclusive tariff needs one approval, holds continuously, expires/cancels and snapshots configurable price',()=>{
 const s=initialState(), b=reserve(s,selection('event',date,addDays(date,3),20));
 assert.equal(b.total,9000000);assert.equal(b.quoteAccepted,true);assert.equal(b.pricingVersion,1);
 assert.equal(calendar(s,{kind:'day'}).days[1].available,false);
 assert.throws(()=>mutate(s,host,'booking-action',{id:b.id,expectedVersion:1,action:'offer_event',amount:1},now),e=>e.code==='PUBLISHED_EVENT_RATE');
 s.settings.products.eventDayRate=4000000; approve(s,b); assert.equal(b.total,9000000);
 mutate(s,guest,'booking-action',{id:b.id,expectedVersion:b.version,action:'cancel'},now);
 assert.equal(calendar(s,{kind:'day'}).days[0].available,true);
 assert.equal(reserve(s,selection('event')).total,4000000);
 assert.equal(productAvailability(s,selection('day'),now+25*3600000).available,true);
});
test('calendar covers full range, room/site blocks, room turnover and no private data projection',()=>{
 const s=initialState();s.blocks.push({unitId:'site',arrival:addDays(date,2),departure:addDays(date,3),reason:'private host note'});
 assert.deepEqual(calendar(s,{kind:'event',arrival:date}).days.map(d=>d.available),[true,true,false,false,false]);
 const r=calendar(s); assert.equal(r.days[2].available,false);assert.equal(r.days[1].available,false);
 assert.deepEqual(Object.keys(r).sort(),['asOf','days','settingsVersion']);assert.deepEqual(Object.keys(r.days[0]).sort(),['available','date']);
 // Arrival blocked on17th; checkout at11AM on16th remains valid before the next block.
 assert.equal(calendar(s,{arrival:date}).days[1].available,true);
 s.blocks=[{unitId:'site',arrival:addDays(date,1),departure:addDays(date,2),startsAt:Date.parse(addDays(date,1)+'T11:00:00+05:30'),endsAt:Date.parse(addDays(date,2)+'T11:00:00+05:30')}];
 assert.equal(calendar(s,{arrival:date}).days[1].available,true); // exact checkout boundary
 assert.equal(calendar(s).days[1].available,false);
});
test('calendar combines shared/private availability and child limits, overdue guests, paused and expired holds',()=>{
 const s=initialState();const b=reserve(s,selection('individual',date,addDays(date,2),1));
 s.units.filter(u=>u.id!==b.units[0]).forEach(u=>u.active=false);
 assert.equal(calendar(s,{adults:1}).days[0].available,true);
 assert.equal(calendar(s,{adults:1,childrenAges:[5]}).days[0].available,false);
 s.settings.paused=true;assert(calendar(s).days.every(d=>!d.available));s.settings.paused=false;
 b.expiresAt=now-1;assert.equal(calendar(s,{adults:1,childrenAges:[5]}).days[0].available,true);
 b.status='checked_in';b.endsAt=now-1;b.departure='2026-11-04';assert.equal(calendar(s,{adults:2}).days[0].available,false);
});
test('calendar validates bounded windows, impossible dates, party and unknown fields',()=>{
 const i={start:date,days:62,kind:'day',adults:35,childrenAges:[9]};validateBookingOperation('calendar',i);calendarWindow(i,now);
 for(const bad of [{days:63},{start:'2026-02-30'},{childrenAges:[10]},{arrival:'2020-01-01'},{adults:0}])assert.throws(()=>calendarWindow({...i,...bad},now));
 assert.throws(()=>validateBookingOperation('calendar',{...i,phone:'private'}));
 const s=initialState();reserve(s,selection('day',date,addDays(date,1),35));assert.equal(calendar(s,{kind:'day',adults:1}).days[0].available,false);
});
test('enquiry sign-in wall preserves hints, rejects cancelled login, clears identity and ignores late loads',async()=>{
 const dom=new JSDOM('<dialog open><div id="content"></div></dialog>');
 const old={document:globalThis.document,MutationObserver:globalThis.MutationObserver};globalThis.document=dom.window.document;globalThis.MutationObserver=dom.window.MutationObserver;
 try{
  let auth={currentUser:null,authStateReady:async()=>{}},listener,failLogin=true,rendered=0;
  const m={auth,observeAuth:fn=>(listener=fn,()=>{listener=null}),login:async()=>{if(failLogin)throw Error();auth.currentUser={uid:'g',displayName:'Guest'};}};
  const open=createEnquiryAccess(async()=>m),show=html=>document.querySelector('#content').innerHTML=html;
  const render=(content,show,pkg,room,{canContinue})=>{rendered++;assert.equal(pkg,'stay');assert.equal(room,'tree');show('<div class="dialog-copy"><form class="enquiry-form"><input value="private"></form></div>');assert(canContinue());};
  await open({},show,'stay','tree',render);assert.equal(rendered,0);assert(document.querySelector('#enquiry-signin'));
  document.querySelector('#enquiry-signin').click();await new Promise(r=>setTimeout(r,0));assert.equal(rendered,0);assert.match(document.body.textContent,/did not finish/);
  failLogin=false;document.querySelector('#enquiry-signin').click();await new Promise(r=>setTimeout(r,0));assert.equal(rendered,1);
  auth.currentUser=null;listener();assert.equal(document.querySelector('.enquiry-form'),null);assert(document.querySelector('#enquiry-signin'));
  let release;const delayed=createEnquiryAccess(()=>new Promise(r=>release=r));const pending=delayed({},show,'stay','tree',render);show('<h2>A newer dialog</h2>');release(m);await pending;assert.match(document.body.textContent,/newer dialog/);
 }finally{Object.assign(globalThis,old);dom.window.close();}
});
