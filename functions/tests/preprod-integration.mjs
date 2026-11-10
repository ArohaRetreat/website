import test from "node:test";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getBytes, ref } from "firebase/storage";
import sharp from "sharp";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID, createHmac } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { addDays, todayIST } from "../booking/domain.mjs";
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
    // New lifecycle messages use actual host actions and only the local provider collector.
    const lifeId="synthetic-lifecycle-"+randomUUID(),lifeNow=Date.now(),beforeLife=messages.length;
    await db.collection('aroha_preprod_bookings').doc(lifeId).set({id:lifeId,reference:'SYNTHETIC-LIFECYCLE',owner:guest.localId,status:'confirmed',kind:'day',arrival:'2026-01-01',departure:'2026-01-02',startsAt:lifeNow-7200000,endsAt:lifeNow-3600000,adults:1,children:0,guests:1,units:[],allocations:[],subtotal:100000,discount:0,total:100000,history:[],version:1,createdAt:lifeNow});
    const checkedIn=await call(owner,'/booking/booking-action',{id:lifeId,action:'checkin',expectedVersion:1},{admin:true});assert.equal(checkedIn.httpStatus,200,JSON.stringify(checkedIn));
    assert.equal(checkedIn.guestNumber, 1);
    await until(()=>messages.length===beforeLife+1);
    const checkedOut=await call(owner,'/booking/booking-action',{id:lifeId,action:'complete',expectedVersion:checkedIn.version},{admin:true});assert.equal(checkedOut.httpStatus,200,JSON.stringify(checkedOut));
    await until(()=>messages.length===beforeLife+2);
    const lifeJobs=(await db.collection('aroha_preprod_notifications').where('bookingId','==',lifeId).get()).docs;assert.equal(lifeJobs.length,3);
    const feedbackJob=lifeJobs.find(d=>d.data().channel==='guest_feedback'),feedbackData=feedbackJob.data();assert.ok(feedbackData.nextAttemptAt>=checkedOut.checkedOutAt+86400000);assert.equal(feedbackData.status,'queued');
    const checkoutMail=messages.find(m=>m.body.subject.includes('Thank you for your time at Aroha'));assert.equal(checkoutMail.body.attachments.filter(a=>a.filename.endsWith('.pdf')).length,1);assert.match(checkoutMail.body.text,/Outstanding balance: INR 1,000.00/);
    const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');
    const runWorker=()=>promisify(execFile)(process.execPath,['--input-type=module','-e',`import {initializeApp} from 'firebase-admin/app';import {getFirestore} from 'firebase-admin/firestore';import {drainEmails} from './email/delivery.mjs';initializeApp({projectId:'demo-aroha'});await drainEmails(getFirestore(),async(body,options)=>(await fetch('http://127.0.0.1:17881/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body,options})})).json());`],{cwd:new URL('../',import.meta.url),env:{...process.env,AROHA_ENVIRONMENT:'pre-prod',FUNCTIONS_EMULATOR:'true',MAIL_ENABLED:'true',MAIL_FROM:'test@example.test',MAIL_REPLY_TO:'owner@example.test',MAIL_HOST_TO:'owner@example.test',MAIL_RECIPIENT_MODE:'booking',DT_EXPORT_ENABLED:'false'},timeout:20000});
    await runWorker();assert.equal(messages.length,beforeLife+2);
    // Advance only this synthetic fixture's clock; the production handler still checks >=24h.
    const pastCheckout=Date.now()-25*3600000;await db.collection('aroha_preprod_bookings').doc(lifeId).update({checkedOutAt:pastCheckout});await feedbackJob.ref.update({'snapshot.checkedOutAt':pastCheckout,nextAttemptAt:Date.now()-1});
    await runWorker();await until(()=>messages.length===beforeLife+3);const feedbackMail=messages.find(m=>m.body.subject.includes('A private note about your Aroha stay'));assert.ok(feedbackMail);assert.match(feedbackMail.body.text,/private/);assert.equal((await feedbackJob.ref.get()).data().status,'accepted');
    await runWorker();assert.equal(messages.length,beforeLife+3);
    const cancelId='synthetic-cancel-'+randomUUID(),cancelKey=randomUUID(),cancelNow=Date.now();
    await db.collection('aroha_preprod_bookings').doc(cancelId).set({id:cancelId,reference:'SYNTHETIC-CANCEL',owner:guest.localId,status:'confirmed',kind:'day',arrival:'2026-01-01',departure:'2026-01-02',startsAt:cancelNow+86400000,endsAt:cancelNow+90000000,adults:1,children:0,guests:1,units:[],allocations:[],subtotal:100000,discount:0,total:100000,history:[],version:1,createdAt:cancelNow});
    const cancelled=await call(owner,'/booking/booking-action',{id:cancelId,action:'cancel',expectedVersion:1},{admin:true,key:cancelKey});assert.equal(cancelled.httpStatus,200,JSON.stringify(cancelled));
    await until(()=>messages.some(m=>m.body.subject.includes('Booking cancelled')&&m.body.text.includes('SYNTHETIC-CANCEL')));
    const cancellation=(await db.collection('aroha_preprod_notifications').where('bookingId','==',cancelId).get()).docs;assert.equal(cancellation.length,1);await until(async()=>(await cancellation[0].ref.get()).data().status==='accepted');assert.equal((await cancellation[0].ref.get()).data().status,'accepted');
    assert.equal((await call(owner,'/booking/booking-action',{id:cancelId,action:'cancel',expectedVersion:1},{admin:true,key:cancelKey})).httpStatus,200);
    await runWorker();assert.equal((await db.collection('aroha_preprod_notifications').where('bookingId','==',cancelId).get()).size,1);
    const bookings = db.collection("aroha_preprod_bookings");
    const profiles = db.collection("aroha_preprod_booking_profiles");
    const walkId = randomUUID(), repeatId = randomUUID(), parallelId = randomUUID();
    const manualCustomerId = "customer-" + randomUUID();
    await profiles.doc(manualCustomerId).set({
      id: manualCustomerId, name: "Synthetic Walk-in", email: "other@example.test",
      identitySource: "host_manual", completedStays: 0, activeIds: [],
    });
    const fixture = (id, who, source = "host_manual") => ({
      id, reference: "SYNTHETIC-IDENTITY", owner: who, status: "confirmed", kind: "day",
      arrival: "2026-01-01", departure: "2026-01-02",
      startsAt: lifeNow - 7200000, endsAt: lifeNow - 3600000,
      adults: 1, children: 0, guests: 1, units: [], allocations: [],
      subtotal: 100000, discount: 0, total: 100000, history: [], version: 1, createdAt: lifeNow, source,
    });
    await Promise.all([
      bookings.doc(walkId).set(fixture(walkId, manualCustomerId)),
      bookings.doc(repeatId).set(fixture(repeatId, guest.localId, "guest")),
      bookings.doc(parallelId).set(fixture(parallelId, owner.localId)),
      profiles.doc(owner.localId).set({
        id: owner.localId, name: "Synthetic manager", email: "owner@example.test", completedStays: 0, activeIds: [],
      }, { merge: true }),
    ]);
    const identity = (user, action, body = {}) => call(user, "/guest-identity/" + action, body);
    const image = await sharp({ create: {
      width: 16, height: 16, channels: 3, background: "#325642",
    }}).png().toBuffer();
    const upload = { version: null, consent: true, contentType: "image/png", contentBase64: image.toString("base64") };
    assert.equal((await identity(null, "status")).httpStatus, 401);
    assert.equal((await identity(outsider, "status")).httpStatus, 403);
    assert.equal((await identity(guest, "status", { bookingId: walkId })).httpStatus, 403);
    assert.equal((await identity(guest, "upload", { ...upload, consent: false })).error.code, "IDENTITY_CONSENT_REQUIRED");
    assert.equal((await identity(guest, "upload", { ...upload, contentBase64: "QUJD" })).error.code, "INVALID_ID_IMAGE");
    assert.equal((await identity(owner, "upload", { ...upload, bookingId: repeatId })).httpStatus, 403);
    const manual = await identity(owner, "upload", { ...upload, bookingId: walkId });
    assert.equal(manual.httpStatus, 200, JSON.stringify(manual));
    const manualVersion = manual.document.version;
    assert.equal(manual.document.status, "pending_review");
    assert.equal((await identity(owner, "preview", { bookingId: walkId, version: manualVersion })).contentType, "image/jpeg");
    assert.equal((await identity(guest, "preview", { version: manualVersion })).httpStatus, 409);
    const verified = await identity(owner, "verify", { bookingId: walkId, version: manualVersion });
    assert.equal(verified.document.status, "verified");
    const claimed = await call(other, "/platform", { operation: "claimMyCustomer", input: {} });
    assert.equal(claimed.customerId, manualCustomerId, JSON.stringify(claimed));
    assert.equal((await identity(other, "status")).document.version, manualVersion);
    await db.collection("aroha_members").doc(other.localId).set({ role: "viewer", active: true, bookingAccess: "viewer" });
    assert.equal((await identity(other, "status", { bookingId: walkId })).httpStatus, 403);
    const replaced = await identity(other, "upload", { ...upload, version: manualVersion });
    assert.equal(replaced.document.status, "pending_review");
    assert.equal((await identity(owner, "verify", { bookingId: walkId, version: manualVersion })).httpStatus, 409);
    const ruleEnv = await initializeTestEnvironment({
      projectId: project,
      storage: { host: "127.0.0.1", port: Number(process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(":").at(-1)),
        rules: await readFile("storage.rules", "utf8") },
    });
    try {
      for (const client of [ruleEnv.unauthenticatedContext(), ruleEnv.authenticatedContext(other.localId)]) {
        await assertFails(getBytes(ref(client.storage("gs://demo-aroha.appspot.com"),
          "identity/pre-prod/" + replaced.document.version)));
      }
    } finally { await ruleEnv.cleanup(); }
    const checkin = (id, key) => call(owner, "/booking/booking-action",
      { id, action: "checkin", expectedVersion: 1 }, { admin: true, key });
    const firstWalkKey = randomUUID();
    const [returnVisit, walkCheckin, otherCheckin] = await Promise.all([
      checkin(repeatId), checkin(walkId, firstWalkKey), checkin(parallelId),
    ]);
    assert.equal(returnVisit.guestNumber, 1, JSON.stringify(returnVisit));
    assert.equal(walkCheckin.httpStatus, 200, JSON.stringify(walkCheckin));
    assert.equal(otherCheckin.httpStatus, 200, JSON.stringify(otherCheckin));
    assert.deepEqual([walkCheckin.guestNumber, otherCheckin.guestNumber].sort(), [2, 3]);
    assert.equal((await checkin(walkId, firstWalkKey)).guestNumber, walkCheckin.guestNumber);
    assert.equal((await identity(other, "status")).guestNumber, walkCheckin.guestNumber);
    assert.equal((await identity(other, "remove", { version: replaced.document.version })).document, null);
    assert.equal((await identity(owner, "preview", { bookingId: walkId, version: replaced.document.version })).httpStatus, 409);
    await promisify(execFile)(process.execPath, ["--input-type=module", "-e",
      `import { initializeApp } from 'firebase-admin/app'; import { getFirestore } from 'firebase-admin/firestore';
       import { drainGuestIdentity } from './booking/guest-identity.mjs'; initializeApp({ projectId: 'demo-aroha' });
       await drainGuestIdentity(getFirestore());`], {
      cwd: new URL("../", import.meta.url), env: { ...process.env, AROHA_ENVIRONMENT: "pre-prod", FUNCTIONS_EMULATOR: "true" }, timeout: 15000,
    });
    assert.equal((await db.collection("aroha_preprod_booking_guest_id_files").get()).size, 0);
    assert.equal((await db.collection("aroha_booking_guest_numbers").get()).size, 0);
    // Retire only this test's synthetic check-ins before the shared scenario runner.
    const cleanup = db.batch();
    for (const id of [walkId, repeatId, parallelId]) cleanup.delete(bookings.doc(id));
    cleanup.update(profiles.doc(owner.localId), { activeIds: [] });
    await cleanup.commit();
    const {mkdir,writeFile}=await import('node:fs/promises');await mkdir('qa/local/platform-emails',{recursive:true});
    for(const m of messages.slice(beforeLife).filter(m=>!m.body.subject.includes('Booking cancelled'))){let html=m.body.html;for(const a of m.body.attachments.filter(a=>a.contentId)){const mime=a.filename.endsWith('.png')?'image/png':'image/jpeg';const data=typeof a.content==='string'?a.content:Buffer.from(a.content.data).toString('base64');html=html.replaceAll('cid:'+a.contentId,'data:'+mime+';base64,'+data);}const name=m.body.subject.includes('Welcome')?'checkin':m===checkoutMail?'checkout':'feedback';await writeFile('qa/local/platform-emails/'+name+'.html',html);}
    {
      const earlyNow = Date.now(), earlyDay = todayIST(earlyNow);
      const earlyId = "synthetic-early-" + randomUUID(), earlyReference = "SYNTHETIC-EARLY";
      const arrival = addDays(earlyDay, -1), departure = addDays(earlyDay, 2);
      const startsAt = Date.parse(arrival + "T11:00:00+05:30");
      const endsAt = Date.parse(departure + "T11:00:00+05:30");
      const config = db.collection("aroha_preprod_booking_config").doc("site");
      const originalUnits = (await config.get()).data().units;
      const unit = originalUnits.find(row => row.active && row.ready !== false);
      assert.ok(unit);
      const earlyBooking = {
        id: earlyId, reference: earlyReference, owner: guest.localId, kind: "private", status: "checked_in",
        arrival, departure, startsAt, endsAt, checkedInAt: startsAt, units: [unit.id], allocations: [],
        adults: 1, children: 0, guests: 1, subtotal: 100000, discount: 0, total: 100000,
        history: [], version: 1, createdAt: startsAt, loyaltyEarnRate: 100,
      };
      const future = db.collection("aroha_preprod_booking_days").doc(addDays(earlyDay, 1));
      await Promise.all([
        bookings.doc(earlyId).set(earlyBooking),
        future.set({ entries: { [earlyId]: earlyBooking } }, { merge: true }),
      ]);
      const earlyInput = { id: earlyId, action: "complete", expectedVersion: 1 };
      const tooSoon = await call(owner, "/booking/booking-action", earlyInput, { admin: true });
      assert.equal(tooSoon.httpStatus, 409);
      assert.equal(tooSoon.error.code, "STAY_NOT_STARTED_OR_FINISHED");
      const confirmedEarly = { ...earlyInput, earlyCheckout: true };
      assert.equal((await call(guest, "/booking/booking-action", confirmedEarly)).httpStatus, 403);
      assert.equal((await bookings.doc(earlyId).get()).data().status, "checked_in");

      const key = randomUUID();
      const early = await call(owner, "/booking/booking-action", confirmedEarly, { admin: true, key });
      assert.equal(early.httpStatus, 200, JSON.stringify(early));
      assert.equal(early.status, "completed");
      assert.equal(early.departure, departure);
      assert.ok(early.checkedOutAt >= earlyNow && early.checkedOutAt < endsAt);
      assert.deepEqual(early.history.at(-1), { status: "completed", at: early.checkedOutAt, earlyCheckout: true });
      const actualDay = todayIST(early.checkedOutAt);
      const nights = (Date.parse(actualDay) - Date.parse(arrival)) / 86400000;
      assert.equal(early.loyaltyEarnedNights, nights);
      assert.equal(early.loyaltyEarnedCredits, nights * 100);
      assert.equal((await future.get()).data().entries[earlyId], undefined);
      assert.equal((await config.get()).data().units.find(row => row.id === unit.id).ready, false);
      const statement = (await db.collection("aroha_preprod_booking_documents").doc(early.checkoutStatementId).get()).data();
      assert.equal(statement.total, earlyBooking.total);
      assert.equal(statement.balanceDue, earlyBooking.total);
      assert.equal(statement.endsAt, early.checkedOutAt);
      assert.equal(statement.departure, actualDay);
      assert.deepEqual(await call(owner, "/booking/booking-action", confirmedEarly, { admin: true, key }), early);
      await until(() => messages.some(message => message.body.text.includes(earlyReference)));
      assert.equal(messages.filter(message => message.body.text.includes(earlyReference)).length, 1);
      const earlyJobs = (await db.collection("aroha_preprod_notifications").where("bookingId", "==", earlyId).get()).docs.map(doc => doc.data());
      assert.equal(earlyJobs.length, 2);
      assert.ok(earlyJobs.every(job => job.snapshot.endsAt === early.checkedOutAt));
      assert.equal(earlyJobs.find(job => job.channel === "guest_feedback").nextAttemptAt, early.checkedOutAt + 86400000);
      await config.update({ units: originalUnits });
    }
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

test("Studio dashboard, guest summaries, issued documents and manual email use shared pre-prod authorization", async () => {
  const messages = [];
  const collector = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const payload = JSON.parse(raw);
    const id = randomUUID();
    messages.push({ id, payload });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: { id }, error: null }));
  });
  await new Promise((resolve) => collector.listen(17881, "127.0.0.1", resolve));
  try {
    const owner = await google("owner@example.test");
    const guest = await google("other@example.test");
    const stranger = await google("guest@example.test");
    await db.collection("aroha_members").doc(owner.localId).set({ role: "superadmin", active: true });
    const studio = (actor, operation, input = {}, key) => call(actor, "/platform", { operation, input }, { key });
    const now = Date.now();
    const id = "studio-" + randomUUID();
    const today = new Date(now + 19800000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10);
    const invoiceId = id + "-v1";
    const b = {
      id, owner: guest.localId, reference: "AR-STUDIO-TEST", version: 1, status: "confirmed",
      kind: "private", deskKind: "private", arrival: today, departure: tomorrow,
      guests: 1, adults: 1, units: [], allocations: [], createdAt: now, contact: { name: "Studio Sample", phone: "+910000000001" },
      startsAt: now, endsAt: now + 86400000, subtotal: 120000, total: 120000, discount: 0, invoiceId,
    };
    await db.collection("aroha_preprod_booking_profiles").doc(guest.localId).set({
      id: guest.localId, name: "Studio Sample", email: "other@example.test", contact: b.contact, searchName: "studio sample",
    }, { merge: true });
    await db.collection("aroha_preprod_bookings").doc(id).set(b);
    await db.collection("aroha_preprod_invoices").doc(invoiceId).set({
      id: invoiceId, number: "TEST-AR-STUDIO-0001", bookingId: id, owner: b.owner, environment: "pre-prod",
      currency: "INR", documentTemplateVersion: "pdf-v4", createdAt: now, version: 1, reference: b.reference,
      kind: b.kind, arrival: b.arrival, departure: b.departure, startsAt: b.startsAt, endsAt: b.endsAt,
      guestName: b.contact.name, guestEmail: "other@example.test", issuer: { name: "Aroha Retreat", address: "Synthetic address", paymentInstructions: "Synthetic instructions" },
      test: true, status: "unpaid", lineItems: [{ label: "Private room", amount: b.total }],
      subtotal: b.total, total: b.total, discount: 0, amountPaid: 0, balanceDue: b.total,
    });
    const dashboard = await studio(owner, "getStudioDashboard");
    assert.equal(dashboard.httpStatus, 200, JSON.stringify(dashboard));
    assert.ok(dashboard.arrivals >= 1);
    const viewerDashboard = await studio(guest, "getStudioDashboard");
    assert.equal(viewerDashboard.httpStatus, 200);
    assert.equal(viewerDashboard.balanceDuePaise, null);
    assert.equal((await studio(stranger, "getStudioDashboard")).httpStatus, 403);
    assert.equal((await studio(guest, "getStudioGuest", { id: guest.localId })).httpStatus, 403);
    const before = await studio(owner, "getStudioGuest", { id: guest.localId });
    assert.equal(before.httpStatus, 200, JSON.stringify(before));
    const unpaid = await studio(guest, "listMyDocuments");
    assert.equal(unpaid.httpStatus, 200, JSON.stringify(unpaid));
    assert.ok(!unpaid.items.some((d) => d.id === invoiceId));
    const payment = await studio(owner, "recordPayment", { id, expectedVersion: 0, amountPaise: 40000, method: "cash", receivedAt: now, verified: true });
    assert.equal(payment.httpStatus, 200, JSON.stringify(payment));
    const after = await studio(owner, "getStudioGuest", { id: guest.localId });
    assert.equal(after.netVerifiedPaidPaise, before.netVerifiedPaidPaise + 40000);
    const history = await studio(owner, "listStudioGuestPayments", { id: guest.localId });
    assert.ok(history.items.some((p) => p.id === payment.payment.id));
    const list = await studio(guest, "listMyDocuments");
    assert.equal(list.items.find((d) => d.id === invoiceId).currentBalanceDuePaise, 80000);
    const receipt = list.items.find((d) => d.id === payment.document.id);
    assert.equal(receipt.paymentPaise, 40000);
    assert.equal(receipt.balanceDuePaise, 80000);
    const own = await studio(guest, "downloadDocument", { id, documentId: invoiceId });
    assert.equal(own.httpStatus, 200);
    assert.match(Buffer.from(own.contentBase64, "base64").toString("ascii", 0, 8), /^%PDF-/);
    assert.equal((await studio(stranger, "downloadDocument", { id, documentId: invoiceId })).httpStatus, 404);
    assert.equal((await studio(owner, "listStudioDocuments", { id: guest.localId, limit: 1 })).items.length, 1);
    assert.equal((await db.collection("aroha_preprod_invoices").doc(invoiceId).get()).data().object, undefined);

    const input = { id: guest.localId, bookingId: id, subject: "Studio confirmation", message: "Welcome <guest>." };
    assert.equal((await studio(stranger, "sendStudioEmail", input)).httpStatus, 403);
    assert.equal((await studio(owner, "sendStudioEmail", { ...input, id: stranger.localId })).httpStatus, 404);
    const key = randomUUID();
    const queued = await studio(owner, "sendStudioEmail", input, key);
    assert.equal(queued.httpStatus, 200, JSON.stringify(queued));
    assert.equal(queued.status, "queued");
    assert.equal((await studio(owner, "sendStudioEmail", input, key)).id, queued.id);
    assert.equal((await studio(owner, "sendStudioEmail", { ...input, message: "Different" }, key)).httpStatus, 409);
    await until(() => messages.some((m) => m.payload.body.tags?.some((tag) => tag.name === "job_id" && tag.value === queued.id)));
    const accepted = messages.find((m) => m.payload.body.tags.some((tag) => tag.name === "job_id" && tag.value === queued.id));
    assert.deepEqual(accepted.payload.body.to, ["other@example.test"]);
    assert.equal(accepted.payload.body.replyTo, "owner@example.test");
    assert.equal(accepted.payload.body.subject, "[TEST] Studio confirmation");
    assert.match(accepted.payload.body.html, /Welcome &lt;guest&gt;/);
    const event = JSON.stringify({ type: "email.delivered", data: { email_id: accepted.id, to: ["other@example.test"], tags: { environment: "pre-prod", job_id: queued.id } } });
    const eventId = "msg_" + randomUUID(), timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", Buffer.from("c3ludGhldGljLXdlYmhvb2stc2VjcmV0", "base64")).update(eventId + "." + timestamp + "." + event).digest("base64");
    const webhook = await fetch(base + "/email/webhook", { method: "POST", body: event, headers: {
      "Content-Type": "application/json", "svix-id": eventId, "svix-timestamp": timestamp, "svix-signature": "v1," + signature,
    } });
    assert.equal(webhook.status, 200);
    const detail = await studio(owner, "getStudioEmail", { jobId: queued.id });
    assert.equal(detail.status, "delivered");
    assert.equal(detail.message, input.message);
    assert.ok((await studio(owner, "listStudioEmail", { id: guest.localId })).items.some((j) => j.id === queued.id));
    assert.equal((await studio(guest, "getStudioEmail", { jobId: queued.id })).httpStatus, 403);
  } finally {
    await new Promise((resolve) => collector.close(resolve));
  }
});
