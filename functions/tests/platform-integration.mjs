import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { initialState, addDays, todayIST } from "../booking/domain.mjs";
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.GCLOUD_PROJECT !== "demo-aroha"
)
  throw Error("ISOLATED_EMULATORS_REQUIRED");
const db = getFirestore(
  initializeApp({ projectId: "demo-aroha" }, "external-tests"),
);
const base = "http://127.0.0.1:5001/demo-aroha/asia-south2/arohaApi";
const json = async (url, options = {}) => {
  const r = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
  });
  return {
    status: r.status,
    data: await r.json(),
    etag: r.headers.get("etag"),
  };
};
async function google(email) {
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: email,
        email,
        email_verified: true,
        iss: "https://accounts.google.com",
        aud: "demo-aroha",
      }),
    ).toString("base64url"),
    "",
  ].join(".");
  const r = await json(
    "http://" +
      process.env.FIREBASE_AUTH_EMULATOR_HOST +
      "/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-api-key",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        postBody: "id_token=" + jwt + "&providerId=google.com",
        requestUri: "http://localhost",
        returnSecureToken: true,
      }),
    },
  );
  assert.equal(r.status, 200);
  return r.data;
}
async function call(
  bearer,
  path,
  { method = "GET", body, key, etag, external = true } = {},
) {
  return json(base + (external ? "/api/external/v1" : "/api/v1") + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + bearer,
      ...(key ? { "Idempotency-Key": key } : {}),
      ...(etag ? { "If-Match": etag } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
test("manual payments, reversals, documents and private feedback preserve shared policy", async () => {
 const owner=await google('platform-owner@example.test'), guest=await google('platform-guest@example.test'), other=await google('platform-other@example.test');
 await db.collection('aroha_members').doc(owner.localId).set({active:true,role:'superadmin'});
 const id='platform-'+Date.now(), now=Date.now();
 await db.collection('aroha_preprod_booking_profiles').doc(guest.localId).set({id:guest.localId,name:'Synthetic Guest',email:'platform-guest@example.test',contact:{name:'Synthetic Guest',phone:'+910000000001'},createdAt:now,activeIds:[]});
 await db.collection('aroha_preprod_bookings').doc(id).set({id,owner:guest.localId,reference:'SYNTHETIC-CRUD',status:'confirmed',kind:'day',arrival:'2026-01-01',departure:'2026-01-02',startsAt:now-7200000,endsAt:now-3600000,adults:2,children:0,guests:2,units:[],allocations:[],subtotal:100000,discount:0,total:100000,lineItems:[{label:'Synthetic approved visit',amount:100000}],history:[],version:1,createdAt:now-86400000});
 const mint=async(user,name,scopes,rowAccess='own')=>{const r=await call(user.idToken,'/integration-tokens',{external:false,method:'POST',key:name+'-mint-0001',body:{name,scopes,rowAccess,purpose:'mcp',expiresInHours:null}});assert.equal(r.status,200);return r.data.token};
 const host=await mint(owner,'platform-host',['runtime:read','reservations:read','stays:operate','payments:read','payments:record','payments:reverse','documents:read','documents:download','feedback:read'],'all');
 const own=await mint(guest,'platform-own',['payments:read','documents:read','documents:download','feedback:read','feedback:submit']);
 const stranger=await mint(other,'platform-other',['payments:read','feedback:read','feedback:submit']);
 assert.equal((await call(stranger,'/reservations/'+id+'/financial-summary')).status,404);
 let summary=await call(host,'/reservations/'+id+'/financial-summary');assert.equal(summary.data.paidPaise,0);assert.equal(summary.etag,'"financial:'+id+':0"');
 const body={amountPaise:25000,method:'upi',receivedAt:now,reference:'SYNTHETIC-UPI-'+id,verified:true};
 const payment=await call(host,'/reservations/'+id+'/payments',{method:'POST',key:'platform-payment-0001',etag:summary.etag,body});
 assert.equal(payment.status,201);assert.equal(payment.data.summary.paidPaise,25000);assert.equal(payment.data.summary.balanceDuePaise,75000);assert.equal(payment.etag,'"financial:'+id+':1"');
 const replay=await call(host,'/reservations/'+id+'/payments',{method:'POST',key:'platform-payment-0001',etag:summary.etag,body});assert.deepEqual(replay.data,payment.data);
 const duplicate=await call(host,'/reservations/'+id+'/payments',{method:'POST',key:'platform-payment-0002',etag:payment.etag,body});assert.equal(duplicate.status,409);
 assert.equal((await call(own,'/reservations/'+id+'/payments',{method:'POST',key:'guest-denied-pay-0001',etag:payment.etag,body})).status,403);
 const pdf=await fetch(base+'/api/external/v1/reservations/'+id+'/documents/'+payment.data.document.id+'/content',{headers:{Authorization:'Bearer '+own}});assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type'),/application\/pdf/);const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(bytes.subarray(0,4).toString(),'%PDF');
 const {mkdir,writeFile}=await import('node:fs/promises');await mkdir('qa/local/platform-documents',{recursive:true});await writeFile('qa/local/platform-documents/payment-receipt.pdf',bytes);
 const reversed=await call(host,'/reservations/'+id+'/payments/'+payment.data.payment.id+'/reversals',{method:'POST',key:'platform-reversal-0001',etag:payment.etag,body:{reason:'Synthetic correction'}});assert.equal(reversed.status,201);assert.equal(reversed.data.summary.paidPaise,0);
 const second=await call(host,'/reservations/'+id+'/payments/'+payment.data.payment.id+'/reversals',{method:'POST',key:'platform-reversal-0002',etag:reversed.etag,body:{reason:'Synthetic duplicate'}});assert.equal(second.status,409);
 const oldReceipt=await fetch(base+'/api/external/v1/reservations/'+id+'/documents/'+payment.data.document.id+'/content',{headers:{Authorization:'Bearer '+own}});assert.equal(oldReceipt.status,409);
 const over=await call(host,'/reservations/'+id+'/payments',{method:'POST',key:'platform-overpay-0001',etag:reversed.etag,body:{...body,amountPaise:100001,reference:'SYNTHETIC-OVER-'+id}});assert.equal(over.status,409);
 assert.equal((await call(own,'/reservations/'+id+'/feedback',{method:'POST',key:'early-feedback-0001',body:{rating:5,comment:'Synthetic private note',consent:true}})).status,409);
 const current=await call(host,'/reservations/'+id);
 const checkin=await call(host,'/reservations/'+id+'/actions/checkin',{method:'POST',key:'platform-checkin-0001',etag:current.etag,body:{}});assert.equal(checkin.status,200);
 const complete=await call(host,'/reservations/'+id+'/actions/complete',{method:'POST',key:'platform-checkout-0001',etag:checkin.etag,body:{}});assert.equal(complete.status,200);
 const checked=(await db.collection('aroha_preprod_bookings').doc(id).get()).data();assert.ok(checked.checkedOutAt>=now);assert.equal(checked.actualPaidAtCheckout,0);assert.equal(checked.outstandingAtCheckout,100000);assert.ok(checked.checkoutStatementId);
 const statement=await fetch(base+'/api/external/v1/reservations/'+id+'/documents/'+checked.checkoutStatementId+'/content',{headers:{Authorization:'Bearer '+own}});assert.equal(statement.status,200);await writeFile('qa/local/platform-documents/checkout-statement.pdf',Buffer.from(await statement.arrayBuffer()));

 const feedback=await call(own,'/reservations/'+id+'/feedback',{method:'POST',key:'platform-feedback-0001',body:{rating:5,comment:'Synthetic private note',consent:true}});assert.equal(feedback.status,201);
 assert.equal((await call(stranger,'/reservations/'+id+'/feedback')).status,404);
 const hostFeedback=await call(host,'/reservations/'+id+'/feedback');assert.equal(hostFeedback.data.comment,'Synthetic private note');
 assert.equal((await call(host,'/reservations/'+id+'/feedback',{method:'PATCH',key:'host-edit-feedback-0001',etag:hostFeedback.etag,body:{rating:1,comment:'Denied'}})).status,403);
 const edit=await call(own,'/reservations/'+id+'/feedback',{method:'PATCH',key:'owner-edit-feedback-0001',etag:hostFeedback.etag,body:{rating:4,comment:'Synthetic correction'}});assert.equal(edit.status,200);
 const withdraw=await call(own,'/reservations/'+id+'/feedback',{method:'DELETE',key:'owner-withdraw-feedback-0001',etag:edit.etag,body:{}});assert.equal(withdraw.status,200);assert.equal(withdraw.data.comment,'');assert.equal(withdraw.data.withdrawn,true);
 const stored=(await db.collection('aroha_preprod_booking_payments').where('bookingId','==',id).get()).docs.map(d=>d.data());assert.equal(stored.length,2);assert.ok(stored.some(p=>p.id===payment.data.payment.id&&p.kind==='payment'&&p.amountPaise===25000));
 assert.equal((await db.collection('aroha_bookings').get()).size,0);
});

test('CMS, integration client ceilings, media publication and profile erasure share scoped policy',async()=>{
 const owner=await google('platform-owner@example.test'),guest=await google('platform-guest@example.test');
 const mint=async(user,name,scopes,rowAccess='own',clientId)=>{const r=await call(user.idToken,'/integration-tokens',{external:false,method:'POST',key:name+'-mint-0001',body:{name,scopes,rowAccess,purpose:'mcp',expiresInHours:null,...(clientId?{clientId}:{})}});assert.equal(r.status,200,JSON.stringify(r.data));return r.data.token;};
 const host=await mint(owner,'platform-management',['runtime:read','content:read','content:write','content:publish','access:read','access:manage','integrations:manage','audit:read','media:read','media:write','communications:read','communications:retry'],'all');
 const guestDenied=await call(guest.idToken,'/integration-tokens',{external:false,method:'POST',key:'denied-admin-mint-0001',body:{name:'Denied manager token',scopes:['content:publish'],purpose:'mcp',rowAccess:'own'}});assert.equal(guestDenied.status,403);
 const {readFile}=await import('node:fs/promises');const content=JSON.parse(await readFile('website/content.json','utf8'));content.brand.tagline='Synthetic scoped CMS fixture';
 const draft=await call(host,'/content/draft',{method:'POST',key:'platform-content-create-0001',body:{content}});assert.equal(draft.status,201,JSON.stringify(draft.data));
 const get=await call(host,'/content/draft');assert.equal(get.data.content.brand.tagline,content.brand.tagline);assert.equal(get.etag,'"content:site:'+draft.data.version+'"');
 const published=await call(host,'/content/actions/publish',{method:'POST',key:'platform-content-publish-0001',etag:get.etag,body:{}});assert.equal(published.status,201);
 const revisions=await call(host,'/content/revisions');assert.equal(revisions.data.items[0].version,draft.data.version);
 const discard=await call(host,'/content/draft',{method:'DELETE',key:'platform-content-discard-0001',etag:get.etag,body:{}});assert.equal(discard.status,200);assert.equal((await db.collection('aroha_preprod_public').doc('site').get()).data().content.brand.tagline,content.brand.tagline);
 const restored=await call(host,'/content/actions/restore',{method:'POST',key:'platform-content-restore-0001',etag:'"content:site:0"',body:{revision:draft.data.version}});assert.equal(restored.status,201);assert.ok(restored.data.version>draft.data.version);
 const republished=await call(host,'/content/actions/publish',{method:'POST',key:'platform-content-publish-0002',etag:restored.etag,body:{}});assert.equal(republished.status,201);
 const firstRevision=await call(host,'/content/revisions?limit=1');assert.equal(firstRevision.data.items[0].version,restored.data.version);assert.ok(firstRevision.data.nextCursor);
 const nextRevision=await call(host,'/content/revisions?limit=1&cursor='+firstRevision.data.nextCursor);assert.equal(nextRevision.data.items[0].version,draft.data.version);assert.equal(nextRevision.data.nextCursor,null);
 assert.equal((await call(host,'/invitations',{method:'POST',key:'preprod-invite-denied-0001',body:{email:'no-write@example.test',role:'viewer'}})).status,403);
 const client=await call(host,'/integration-clients',{method:'POST',key:'platform-client-create-0001',body:{name:'Synthetic MCP client',sponsorUid:owner.localId,scopeCeiling:['runtime:read'],expiresAt:null}});assert.equal(client.status,201,JSON.stringify(client.data));
 const child=await mint(owner,'platform-client-child',['runtime:read'],'own',client.data.id);assert.equal((await call(child,'/runtime')).status,200);
 const clientRead=await call(host,'/integration-clients/'+client.data.id);assert.ok(!JSON.stringify(clientRead.data).includes('secretHash'));
 const revoked=await call(host,'/integration-clients/'+client.data.id,{method:'DELETE',key:'platform-client-revoke-0001',etag:clientRead.etag,body:{}});assert.equal(revoked.status,200);assert.equal((await call(child,'/runtime')).data.error.code,'CLIENT_REVOKED');
 const communicationId='c'.repeat(64),commBooking='platform-comm-fixture';await db.collection('aroha_preprod_bookings').doc(commBooking).set({id:commBooking,owner:guest.localId,status:'confirmed',version:1,total:1000});
 await db.collection('aroha_preprod_notifications').doc(communicationId).set({id:communicationId,bookingId:commBooking,owner:guest.localId,channel:'guest_confirmation',status:'failed',version:1,createdAt:Date.now(),uncertain:false});
 const delivery=await call(host,'/reservations/'+commBooking+'/communications/'+communicationId);assert.equal(delivery.status,200);assert.equal(delivery.data.retryAllowed,true);
 const retryArgs={method:'POST',key:'platform-comm-retry-0001',etag:delivery.etag,body:{}};const retry=await call(host,'/reservations/'+commBooking+'/communications/'+communicationId+'/actions/retry',retryArgs);assert.equal(retry.status,201,JSON.stringify(retry.data));assert.equal(retry.data.queued,true);assert.equal(retry.data.version,2);assert.deepEqual((await call(host,'/reservations/'+commBooking+'/communications/'+communicationId+'/actions/retry',retryArgs)).data,retry.data);
 await db.collection('aroha_preprod_notifications').doc(communicationId).update({status:'failed',uncertain:true,version:3});assert.equal((await call(host,'/reservations/'+commBooking+'/communications/'+communicationId+'/actions/retry',{...retryArgs,key:'platform-comm-uncertain-0001',etag:'"communication:'+communicationId+':3"'})).status,409);
 await db.collection('aroha_preprod_notifications').doc(communicationId).update({status:'accepted',uncertain:false,providerMessageId:'synthetic-provider-id',version:4});assert.equal((await call(host,'/reservations/'+commBooking+'/communications/'+communicationId+'/actions/retry',{...retryArgs,key:'platform-comm-accepted-0001',etag:'"communication:'+communicationId+':4"'})).status,409);
 // This isolated fixture cannot block profile erasure below.
 await db.collection('aroha_preprod_bookings').doc(commBooking).update({status:'cancelled'});
 const own=await mint(guest,'platform-privacy',['profiles:read','profiles:erase','operations:read']);
 const ref=db.collection('aroha_preprod_booking_profiles').doc(guest.localId);await ref.update({arbitraryPrivateField:'must be removed'});const p=await call(own,'/me/profile');
 const erase=await call(own,'/me/profile',{method:'DELETE',key:'platform-profile-erase-0001',etag:p.etag,body:{}});assert.equal(erase.status,200,JSON.stringify(erase.data));assert.equal(erase.data.status,'completed');const tombstone=(await ref.get()).data();assert.equal(tombstone.email,undefined);assert.equal(tombstone.arbitraryPrivateField,undefined);assert.ok(tombstone.erasedAt);
 const receipt=await call(own,'/operations/'+erase.data.id);assert.equal(receipt.status,200);assert.equal(receipt.data.status,'completed');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');const {createHash}=await import('node:crypto');
 const upload=await call(host,'/media/uploads',{method:'POST',key:'platform-media-upload-0001',body:{type:'image/png',size:png.length,sha256:createHash('sha256').update(png).digest('hex')}});assert.equal(upload.status,201,JSON.stringify(upload.data));
 const uploaded=await fetch(upload.data.uploadUrl,{method:'PUT',headers:{'content-type':'image/png','content-range':`bytes 0-${png.length-1}/${png.length}`},body:png});assert.ok(uploaded.ok,'Synthetic resumable upload failed: '+uploaded.status);
 const mediaRead=await call(host,'/media/uploads/'+upload.data.id);const finalized=await call(host,'/media/uploads/'+upload.data.id+'/actions/finalize',{method:'POST',key:'platform-media-finalize-0001',etag:mediaRead.etag,body:{}});assert.equal(finalized.status,201,JSON.stringify(finalized.data));assert.equal(finalized.data.status,'completed');
 const replay=await call(host,'/media/uploads/'+upload.data.id+'/actions/finalize',{method:'POST',key:'platform-media-finalize-0001',etag:mediaRead.etag,body:{}});assert.deepEqual(replay.data,finalized.data);
 const archived=await call(host,'/media/'+upload.data.id,{method:'DELETE',key:'platform-media-archive-0001',etag:finalized.etag,body:{}});assert.equal(archived.status,200,JSON.stringify(archived.data));assert.equal(archived.data.status,'archived');
 assert.equal((await db.collection('aroha_public').get()).size,0);
});

test('payment and checkout races serialize against actual ledger snapshots',async()=>{
 const owner=await google('platform-owner@example.test'),guest=await google('platform-guest@example.test');
 const mint=await call(owner.idToken,'/integration-tokens',{external:false,method:'POST',key:'platform-race-mint-0001',body:{name:'Synthetic race manager',scopes:['runtime:read','payments:read','payments:record','documents:read','reservations:read','stays:operate'],rowAccess:'all',purpose:'mcp'}});assert.equal(mint.status,200);const host=mint.data.token;
 const id='platform-race-'+Date.now(),now=Date.now();await db.collection('aroha_preprod_bookings').doc(id).set({id,owner:guest.localId,reference:'SYNTHETIC-RACE',status:'confirmed',kind:'day',arrival:'2026-01-01',departure:'2026-01-02',startsAt:now-7200000,endsAt:now-3600000,adults:1,guests:1,children:0,units:[],allocations:[],total:100000,subtotal:100000,discount:0,history:[],version:1,createdAt:now-86400000});
 const record=(key,etag)=>call(host,'/reservations/'+id+'/payments',{method:'POST',key,etag,body:{amountPaise:25000,method:'cash',receivedAt:now,verified:true}});
 const first=await Promise.all([record('race-payment-a-0001','"financial:'+id+':0"'),record('race-payment-b-0001','"financial:'+id+':0"')]);assert.deepEqual(first.map(r=>r.status).sort(),[201,412]);assert.equal((await db.collection('aroha_preprod_booking_payments').where('bookingId','==',id).get()).size,1);
 const current=await call(host,'/reservations/'+id);const checkin=await call(host,'/reservations/'+id+'/actions/checkin',{method:'POST',key:'race-checkin-0001',etag:current.etag,body:{}});assert.equal(checkin.status,200);
 const [payment,checkout]=await Promise.all([record('race-final-payment-0001','"financial:'+id+':1"'),call(host,'/reservations/'+id+'/actions/complete',{method:'POST',key:'race-checkout-0001',etag:checkin.etag,body:{}})]);assert.equal(payment.status,201);
 if(checkout.status===412){const latest=await call(host,'/reservations/'+id);assert.equal((await call(host,'/reservations/'+id+'/actions/complete',{method:'POST',key:'race-checkout-refreshed-0001',etag:latest.etag,body:{}})).status,200);}else assert.equal(checkout.status,200);
 const booking=(await db.collection('aroha_preprod_bookings').doc(id).get()).data();assert.equal(booking.status,'completed');const statement=(await db.collection('aroha_preprod_booking_documents').doc(booking.checkoutStatementId).get()).data();assert.ok([25000,50000].includes(statement.amountPaid));assert.equal(statement.balanceDue,100000-statement.amountPaid);assert.equal(booking.actualPaidAtCheckout,statement.amountPaid);
 const final=await call(host,'/reservations/'+id+'/financial-summary');assert.equal(final.data.paidPaise,50000);assert.equal(final.data.balanceDuePaise,50000);assert.equal((await db.collection('aroha_preprod_booking_documents').where('bookingId','==',id).where('documentKind','==','checkout_statement').get()).size,1);
});
