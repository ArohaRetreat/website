import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {emailTemplate} from '../functions/email/templates.mjs';
import {compatibleBookingApi} from '../scripts/delivery/environment-policy.mjs';
const job={templateVersion:'email-v3',channel:'guest_acknowledgement',test:true,subjectPrefix:'[PRE-PROD TEST] ',snapshot:{reference:'AR-SYNTHETIC',guestName:'Meera <script>alert(1)</script> & ಕುಟುಂಬ',kind:'private',arrival:'2026-12-12',departure:'2026-12-13',guests:4,pricingVersion:2}};
test('approved actual email renderer includes logo, photo and the stage-correct raster trail with readable fallbacks',()=>{
 for (const channel of ['guest_acknowledgement','host_notification','guest_confirmation']) {
  const m=emailTemplate({...job,channel}),d=new JSDOM(m.html).window.document;
  assert.equal(m.attachments.length,3);
  for(const img of d.querySelectorAll('img')) {
   const cid=img.getAttribute('src').replace('cid:',''),a=m.attachments.find(a=>a.contentId===cid);
   assert.ok(a,cid);assert.ok(a.content.length>1000);assert.ok(img.alt);
   if(a.filename.endsWith('.png')) assert.equal(a.content.subarray(1,4).toString(),'PNG');
  }
  const graph=d.querySelector('[src="cid:aroha-journey"]');
  assert.match(graph.alt,channel==='guest_confirmation'?/Request sent: complete. Review: complete. Confirmed: you are here/:/Request sent: you are here. Review: coming up/);
  for(const label of ['Check in','Check out','Feedback']) assert.ok(graph.alt.includes(label));
  assert.match(m.text,/YOUR AROHA JOURNEY/);
  assert.match(m.text,/not a confirmed reservation|does not mean payment has been received/);
  assert.equal(d.querySelectorAll('script,form,iframe,svg').length,0);
  assert.ok(d.body.textContent.includes(job.snapshot.guestName));
  assert.ok(Buffer.byteLength(m.html)<100000);
  assert.ok(m.attachments.reduce((n,a)=>n+a.content.length,0)<400000);
  assert.match(m.html,/Lora,Georgia,serif/);assert.match(m.html,/Source\.woff2/);
  const url=d.querySelector('a').getAttribute('href');assert.ok(url.endsWith(channel==='host_notification'?'/admin/#bookings':'/book/#visits'));
  assert.match(m.subject,/^\[PRE-PROD TEST\]/);assert.match(m.text,/Isolated test booking/);
 }
});
test('immutable queued legacy jobs retain their original provider body; unknown template versions fail closed',()=>{
 const old=emailTemplate({...job,templateVersion:undefined});
 assert.equal(old.attachments,undefined);assert.match(old.html,/We have received your booking request/);
 assert.throws(()=>emailTemplate({...job,templateVersion:'unreviewed'}),/UNKNOWN_EMAIL_TEMPLATE/);
 assert.throws(()=>emailTemplate({...job,channel:'unreviewed'}),/UNKNOWN_EMAIL_CHANNEL/);
});
test('approved confirmation distinguishes amendment, payment invoice, actual timestamps and exclusive end dates',()=>{
 const m=emailTemplate({...job,channel:'guest_confirmation',snapshot:{...job.snapshot,amended:true,kind:'event',startsAt:Date.parse('2026-11-15T06:00:00+05:30'),endsAt:Date.parse('2026-11-16T18:00:00+05:30')}});
 assert.match(m.text,/replaces the earlier invoice/);assert.match(m.text,/16 Nov 2026, 18:00 IST/);
 assert.ok(!m.html.includes('12 Dec'));assert.ok(!m.text.includes('paid in full'));
 const prod=emailTemplate({...job,test:false,subjectPrefix:''});assert.ok(!prod.text.includes('PRE-PRODUCTION'));assert.ok(!prod.subject.startsWith('[PRE-PROD'));
});
test('approved-email frontend release requires matching template-capable API',()=>{
 assert.equal(compatibleBookingApi('0.23.2','0.8.2'),false);
 assert.equal(compatibleBookingApi('0.23.2','0.8.3'),true);
 assert.equal(compatibleBookingApi('0.23.1','0.8.1'),false);
 assert.equal(compatibleBookingApi('0.23.1','0.8.2'),true);
 assert.equal(compatibleBookingApi('0.23.0','0.8.1'),true);
});
test('already deployed email-v3 payloads retain their exact pre-private-booking bytes for retries',async()=>{
 const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');
 const expected=JSON.parse(await readFile(new URL('./fixtures/email-v3-payload-hashes.json',import.meta.url),'utf8'));
 const {environment}=await import('../functions/environment.mjs');
 for(const {channel,amended,sha256}of expected.filter(x=>x.environment===environment.name)){
  const job={channel,templateVersion:'email-v3',test:true,subjectPrefix:'[PRE-PROD TEST] ',snapshot:{kind:'event',pricingVersion:1,guestName:'Synthetic Customer',reference:'AR-IMMUTABLE',arrival:'2026-12-12',departure:'2026-12-14',guests:2,amended}};
  assert.equal(createHash('sha256').update(JSON.stringify(emailTemplate(job))).digest('hex'),sha256,channel+' '+amended);
 }
});
