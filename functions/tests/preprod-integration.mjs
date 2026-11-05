import test from "node:test";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID, createHmac } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {runBookingScenarios} from '../../website/testing/booking-scenarios.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  !process.env.FIREBASE_STORAGE_EMULATOR_HOST
)
  throw Error("EMULATORS_REQUIRED");
const project = "demo-aroha",
  base = `http://127.0.0.1:5001/${project}/asia-south2/arohaApi/api/v1`,
  db = getFirestore(initializeApp({ projectId: project }, "preprod-test"));
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
        aud: project,
      }),
    ).toString("base64url"),
    "",
  ].join(".");
  const r = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: "id_token=" + jwt + "&providerId=google.com",
        requestUri: "http://localhost",
        returnSecureToken: true,
      }),
    },
  );
  assert.ok(r.ok);
  return r.json();
}
async function call(
  user,
  path,
  body,
  { admin = false, key = randomUUID() } = {},
) {
  const r = await fetch(base + path + (admin ? "?admin=1" : ""), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": key,
      ...(user ? { Authorization: "Bearer " + user.idToken } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  return { httpStatus: r.status, ...(await r.json()) };
}
async function until(check) {
  const end = Date.now() + 40000;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.fail("Timed out waiting for emulator email dispatch");
}
test("pre-prod HTTP booking, approval, private invoice and webhook stay inside test inventory and recipient boundaries", async () => {
  const messages = [];
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const v = JSON.parse(raw);
    messages.push(v);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: { id: randomUUID() }, error: null }));
  });
  await new Promise((r) => server.listen(17881, "127.0.0.1", r));
  try {
    const owner = await google("owner@example.test"),
      guest = await google("guest@example.test"),
      other = await google("other@example.test"),
      outsider = await google("outsider@example.test");
    await db
      .collection("aroha_members")
      .doc(owner.localId)
      .set({ role: "superadmin", active: true, email: "owner@example.test" });
    const canary = { marker: "DO_NOT_CHANGE", version: 99 };
    assert.equal((await call(null, "/draft")).httpStatus, 401);
    await db.collection("aroha_booking_config").doc("settings").set(canary);
    await db.collection("aroha_bookings").doc("canary").set(canary);
    assert.equal((await call(outsider, "/booking/state")).httpStatus, 403);
    const metadata = await call(null, "/runtime-config");
    assert.equal(metadata.environment, "pre-prod");
    assert.ok(!JSON.stringify(metadata).includes("tokenSecretVersion"));
    const session = await call(owner, "/session", {});
    assert.equal(session.httpStatus, 200, JSON.stringify(session));
    assert.equal(session.session.modules.website, true);
    assert.equal(session.session.modules.access, false);
    assert.equal((await call(owner, "/members")).httpStatus, 403);
    assert.equal((await call(owner, "/invitations", {email:"nobody@example.test",role:"viewer"})).httpStatus, 403);
    const content = JSON.parse(await readFile("website/content.json", "utf8"));
    for (const [collection, id] of [["aroha_content","draft"],["aroha_public","site"],["aroha_revisions","1"]])
      await db.collection(collection).doc(id).set(canary);
    assert.equal((await call(guest, "/draft")).httpStatus, 403);
    assert.equal((await call(owner, "/draft", {content,expectedVersion:0})).version, 1);
    assert.equal((await call(owner, "/draft", {content,expectedVersion:0})).httpStatus, 409);
    assert.equal((await call(owner, "/publish", {expectedVersion:1})).httpStatus, 200);
    assert.equal((await call(owner, "/revisions")).revisions[0].version, 1);
    const changed = structuredClone(content);changed.brand.welcome="Preprod-only synthetic welcome";
    assert.equal((await call(owner, "/draft", {content:changed,expectedVersion:1})).version, 2);
    assert.equal((await call(owner, "/restore", {revision:1,expectedVersion:2})).version, 3);
    assert.deepEqual((await call(owner, "/draft")).draft.content, content);
    assert.equal((await call(owner, "/publish", {expectedVersion:3})).httpStatus, 200);
    for (const [collection,id] of [["aroha_content","draft"],["aroha_public","site"],["aroha_revisions","1"]])
      assert.deepEqual((await db.collection(collection).doc(id).get()).data(), canary);
    const sharedMember=await db.collection("aroha_members").doc(owner.localId).get();
    assert.equal(sharedMember.data().role,"superadmin");
    const rules=await initializeTestEnvironment({projectId:project,firestore:{host:"127.0.0.1",port:8080,rules:await readFile("firestore.rules","utf8")}});
    try {const anon=rules.unauthenticatedContext().firestore();
      const published=await assertSucceeds(getDoc(doc(anon,"aroha_preprod_public/site")));
      assert.deepEqual(published.data().content,content);
      await assertFails(getDoc(doc(anon,"aroha_preprod_content/draft")));
      await assertFails(getDoc(doc(anon,"aroha_preprod_revisions/1")));
      await assertFails(setDoc(doc(anon,"aroha_preprod_public/site"),{content}));
    }finally{await rules.cleanup();}
    await db.collection("aroha_members").doc(owner.localId).update({websiteAccess:false,role:"admin"});
    assert.equal((await call(owner,"/session",{})).session.modules.website,false);
    assert.equal((await call(owner,"/draft",{content,expectedVersion:3})).httpStatus,403);
    assert.equal((await call(owner,"/publish",{expectedVersion:3})).httpStatus,403);
    await db.collection("aroha_members").doc(owner.localId).update({websiteAccess:true,role:"superadmin"});
    const arrival = new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .slice(0, 10),
      departure = new Date(Date.parse(arrival) + 86400000)
        .toISOString()
        .slice(0, 10);
    const quote = await call(guest, "/booking/quote", {
      kind: "day",
      arrival,
      departure,
      adults: 2,
      childrenAges: [],
      guests: 2,
      units: [],
    });
    assert.equal(quote.httpStatus, 200, JSON.stringify(quote));
    const request = {
        quoteId: quote.id,
        note: "PRIVATE_TEST_NOTE",
        contact: { name: "Synthetic Guest", phone: "+12025550123" },
      },
      key = randomUUID();
    assert.equal((await call(guest,"/booking/create",{...request,email:"other@example.test"})).httpStatus,422);
    const booking = await call(guest, "/booking/create", request, { key });
    assert.equal(booking.httpStatus, 200, JSON.stringify(booking));
    assert.equal(
      (await call(guest, "/booking/create", request, { key })).id,
      booking.id,
    );
    await until(() => messages.length === 2);
    const approved = await call(
      owner,
      "/booking/booking-action",
      { id: booking.id, action: "approve", expectedVersion: 1 },
      { admin: true },
    );
    assert.equal(approved.httpStatus, 200, JSON.stringify(approved));
    await until(() => messages.length === 3);
    assert.ok(
      messages.every(
        (m) =>
          m.body.to.length === 1 &&
          ["guest@example.test","owner@example.test"].includes(m.body.to[0]) &&
          m.body.subject.startsWith("[PRE-PROD TEST]"),
      ),
    );
    assert.equal(messages.filter(m=>m.body.to[0]==="owner@example.test").length,1);
    assert.equal(messages.filter(m=>m.body.to[0]==="guest@example.test").length,2);
    assert.equal(
      new Set(messages.map((m) => m.options.idempotencyKey)).size,
      3,
    );
    const confirmation = messages.find((m) => m.body.attachments?.some(a=>a.filename.endsWith(".pdf")));
    assert.equal(confirmation.body.attachments.length, 4);
    for (const m of messages) {
      assert.match(m.body.html, /YOUR AROHA JOURNEY/);
      assert.equal(m.body.attachments.filter(a=>a.contentId).length,3);
      assert.match(m.body.html, /cid:aroha-journey/);
    }
    // Opt-in local visual review of the actual synthetic provider payloads.
    // This file refuses non-emulator execution and only uses example.test users.
    if (process.env.AROHA_EMAIL_REVIEW === "1") {
      const {mkdir,writeFile}=await import("node:fs/promises");
      const root="local/release-evidence/aroha-approved-email-templates/rendered/";
      await mkdir(root,{recursive:true});
      for(const m of messages) {
        const channel=m.body.tags.find(t=>t.name==="channel").value;
        let html=m.body.html;
        for(const a of m.body.attachments.filter(a=>a.contentId)) {
          await writeFile(root+a.filename,Buffer.from(a.content.data));
          html=html.replaceAll("cid:"+a.contentId,a.filename);
        }
        await writeFile(root+channel+".html",html);
        await writeFile(root+channel+"-no-images.html",html.replace(/<img[^>]*alt="([^"]*)"[^>]*>/g,'<p style="font:13px/1.6 Arial;color:#263e2d">$1</p>'));
      }
      await writeFile(root+"provider-payloads.json",JSON.stringify(messages,null,2));
    }
    const communications = await call(guest, "/booking/communications", {
      id: booking.id,
    });
    assert.equal(
      communications.httpStatus,
      200,
      JSON.stringify(communications),
    );
    const stored = (
      await db.collection("aroha_preprod_bookings").doc(booking.id).get()
    ).data();
    assert.ok(stored.invoiceId);
    const pdf = await call(guest, "/booking/invoice-download", {
      id: booking.id,
    });
    assert.equal(pdf.httpStatus, 200, JSON.stringify(pdf));
    assert.ok(JSON.stringify(pdf).includes("JVBER"));
    assert.equal(
      (await call(other, "/booking/invoice-download", { id: booking.id }))
        .httpStatus,
      404,
    );
    const jobs = await db.collection("aroha_preprod_notifications").get(),
      job = jobs.docs
        .find((d) => d.data().channel === "guest_confirmation")
        .data();
    const event = {
        type: "email.delivered",
        data: {
          email_id: job.providerMessageId,
          to: [job.to],
          tags: { environment: "pre-prod", job_id: job.id },
        },
      },
      raw = JSON.stringify(event),
      id = "msg_" + randomUUID(),
      timestamp = String(Math.floor(Date.now() / 1000)),
      signature = createHmac("sha256", Buffer.from("synthetic-webhook-secret"))
        .update(id + "." + timestamp + "." + raw)
        .digest("base64");
    async function webhook(sig) {
      return fetch(base + "/email/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": id,
          "svix-timestamp": timestamp,
          "svix-signature": sig,
        },
        body: raw,
      });
    }
    const wrongRaw=JSON.stringify({...event,data:{...event.data,to:["owner@example.test"]}}),wrongId="msg_"+randomUUID();
    const wrongSignature=createHmac("sha256",Buffer.from("synthetic-webhook-secret")).update(wrongId+"."+timestamp+"."+wrongRaw).digest("base64");
    assert.equal((await fetch(base+"/email/webhook",{method:"POST",headers:{"Content-Type":"application/json","svix-id":wrongId,"svix-timestamp":timestamp,"svix-signature":"v1,"+wrongSignature},body:wrongRaw})).status,200);
    assert.notEqual((await db.collection("aroha_preprod_notifications").doc(job.id).get()).data().status,"delivered");
    assert.equal((await webhook("v1,invalid")).status, 400);
    assert.equal((await webhook("v1," + signature)).status, 200);
    assert.equal((await webhook("v1," + signature)).status, 200);
    assert.equal(
      (
        await db.collection("aroha_preprod_notifications").doc(job.id).get()
      ).data().status,
      "delivered",
    );
    assert.equal(
      (await db.collection("aroha_preprod_email_webhooks").get()).size,
      1,
    );
    const privateInvoice = (
      await db.collection("aroha_preprod_invoices").doc(stored.invoiceId).get()
    ).data();
    for (const token of [null, guest.idToken]) {
      const direct = await fetch(
        `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/demo-aroha.appspot.com/o/${encodeURIComponent(privateInvoice.object)}?alt=media`,
        { headers: token ? { Authorization: "Bearer " + token } : {} },
      );
      assert.equal(
        direct.status,
        403,
        "Invoice Storage objects must not be public or directly guest-readable",
      );
    }
    const newArrival = new Date(Date.parse(arrival) + 3 * 86400000)
        .toISOString()
        .slice(0, 10),
      newDeparture = new Date(Date.parse(departure) + 3 * 86400000)
        .toISOString()
        .slice(0, 10);
    const changedQuote = await call(guest, "/booking/change-quote", {
      id: booking.id,
      expectedVersion: 2,
      kind: "day",
      arrival: newArrival,
      departure: newDeparture,
      adults: 2,
      childrenAges: [],
      guests: 2,
    });
    assert.equal(changedQuote.httpStatus, 200, JSON.stringify(changedQuote));
    const change = await call(guest, "/booking/change-request", {
      id: booking.id,
      expectedVersion: 2,
      quoteId: changedQuote.id,
    });
    assert.equal(change.httpStatus, 200, JSON.stringify(change));
    const amended = await call(
      owner,
      "/booking/booking-action",
      { id: booking.id, expectedVersion: 3, action: "approve_change" },
      { admin: true },
    );
    assert.equal(amended.httpStatus, 200, JSON.stringify(amended));
    await until(() => messages.length === 4);
    const current = (
      await db.collection("aroha_preprod_bookings").doc(booking.id).get()
    ).data();
    assert.equal(current.invoiceId, booking.id + "-v2");
    assert.equal(
      (
        await db
          .collection("aroha_preprod_invoices")
          .doc(stored.invoiceId)
          .get()
      ).data().status,
      "superseded",
    );
    const revision = (
      await db.collection("aroha_preprod_invoices").doc(current.invoiceId).get()
    ).data();
    assert.equal(
      revision.number,
      "TEST-AR-" + new Date(Date.now() + 19800000).getUTCFullYear() + "-000002",
    );
    assert.ok(messages.at(-1).body.subject.includes("updated"));
    assert.equal(messages.at(-1).body.to[0],"guest@example.test");
    assert.equal(messages.filter(m=>m.body.to[0]==="owner@example.test").length,1);
    // Maintenance mode must preserve billing even when outgoing mail is paused.
    process.env.AROHA_ENVIRONMENT = "pre-prod";
    process.env.MAIL_ENABLED = "false";
    process.env.DT_EXPORT_ENABLED = "false";
    const { bookingCommand } = await import("../booking/store.mjs");
    const pausedGuest = { uid: guest.localId, email: "guest@example.test" };
    const pausedHost = { uid: owner.localId, email: "owner@example.test" };
    const pausedQuote = await bookingCommand(db, pausedGuest, "change-quote", {
      id: booking.id, expectedVersion: 4, kind: "day",
      arrival, departure, adults: 2, childrenAges: [], guests: 2,
    }, randomUUID());
    await bookingCommand(db, pausedGuest, "change-request", {
      id: booking.id, expectedVersion: 4, quoteId: pausedQuote.id,
    }, randomUUID());
    const pausedApproval = await bookingCommand(db, pausedHost, "booking-action", {
      id: booking.id, expectedVersion: 5, action: "approve_change",
    }, randomUUID(), { admin: true });
    const pausedInvoice = (await db.collection("aroha_preprod_invoices")
      .doc(pausedApproval.invoiceId).get()).data();
    assert.equal(pausedInvoice.version, 3);
    assert.equal(pausedInvoice.test, true);
    assert.deepEqual(pausedInvoice.issuer, revision.issuer);
    assert.equal((await db.collection("aroha_preprod_invoices")
      .doc(current.invoiceId).get()).data().status, "superseded");
    await bookingCommand(db, pausedGuest, "booking-action", {
      id: booking.id, expectedVersion: 6, action: "cancel",
    }, randomUUID());
    assert.equal((await db.collection("aroha_preprod_invoices")
      .doc(pausedApproval.invoiceId).get()).data().status, "void");
    assert.equal((await db.collection("aroha_preprod_notifications").get()).size, 4);
    assert.equal(
      (await call(guest, "/booking/invoice-download", { id: booking.id }))
        .httpStatus,
      409,
    );
    const events = await db
      .collection("aroha_preprod_observability_outbox")
      .get();
    assert.ok(
      events.docs.every(
        (d) => d.data().event["deployment.environment.name"] === "pre-prod",
      ),
    );
    assert.deepEqual(
      (
        await db.collection("aroha_booking_config").doc("settings").get()
      ).data(),
      canary,
    );
    assert.deepEqual(
      (await db.collection("aroha_bookings").doc("canary").get()).data(),
      canary,
    );
    assert.equal((await db.collection("aroha_bookings").get()).size, 1);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('reusable acceptance scenarios use real HTTP contracts and retire only their own emulator fixtures', async()=>{
  const server=createServer(async(req,res)=>{for await(const _ of req){}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:{id:randomUUID()},error:null}));});
  await new Promise(r=>server.listen(17881,'127.0.0.1',r));
  const user=await google('owner@example.test'), runId=randomUUID();
  assert.equal((await call(user,'/booking/profile',{name:'Internal emulator host',phone:'+12025550123',expectedVersion:0})).httpStatus,200);
  const existing=[];
  const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
  for(const n of [60,70]){
    const q=await call(user,'/booking/quote',{kind:'day',arrival:day(n),departure:day(n+1),guests:1,adults:1,childrenAges:[],units:[]});assert.equal(q.httpStatus,200);
    const b=await call(user,'/booking/create',{quoteId:q.id,note:'Pre-existing emulator canary',contact:{name:'Existing emulator reservation',phone:'+12025550123'}});assert.equal(b.httpStatus,200);existing.push(b);
  }
  let last=0;
  try {
    const report=await runBookingScenarios({runId,execution:'emulator',source:process.env.AROHA_TEST_SOURCE||'local-validation',call:async(op,body,{admin=false,anonymous=false,start,key=randomUUID()}={})=>{
      await new Promise(r=>setTimeout(r,Math.max(0,last+1500-Date.now())));last=Date.now();
      const q=new URLSearchParams();if(admin)q.set('admin','1');if(start)q.set('start',start);
      const r=await fetch(base+'/booking/'+op+(q.size?'?'+q:''),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key,'X-Aroha-Journey':runId,...(anonymous?{}:{Authorization:'Bearer '+user.idToken})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
      const b=await r.json();return{status:r.status,body:b,code:b.error?.code,requestId:r.headers.get('X-Request-Id')};
    }});
    report.project='demo-aroha';
    await mkdir('local/test-evidence',{recursive:true});await writeFile('local/test-evidence/emulator-scenarios.json',JSON.stringify(report,null,2),{mode:0o600});
    assert.deepEqual(report.cases.filter(c=>c.status==='failed').map(c=>({id:c.id,code:c.code})),[]);
    assert.equal(report.cleanup.status,'passed');
    assert.equal(report.existingActiveCount,2);
    assert.equal(report.cases.find(c=>c.id==='capacity-overlap').variant,'held-and-quoted');
    for(const b of existing){const current=await call(user,'/booking/reservation-detail',{id:b.id});assert.equal(current.version,b.version);assert.equal(current.status,b.status);}
    const retained=await db.collection('aroha_preprod_bookings').get();
    for(const d of retained.docs.filter(d=>report.createdIds.includes(d.id)))assert.ok(['cancelled','declined'].includes(d.data().status));
    assert.equal((await db.collection('aroha_bookings').get()).size,1);
  }finally{for(const b of existing)await call(user,'/booking/booking-action',{id:b.id,expectedVersion:b.version,action:'cancel'});await new Promise(r=>server.close(r));}
});
