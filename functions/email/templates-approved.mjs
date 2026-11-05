import { readFileSync } from "node:fs";
import { visitWindow } from "./visit-window.mjs";
import { environment } from "../environment.mjs";
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const stages = ["Request sent", "Review", "Confirmed", "Check in", "Check out", "Feedback"];
const files = new Map();
function asset(filename, contentId) {
  if (!files.has(filename)) files.set(filename, readFileSync(new URL("./assets/" + filename, import.meta.url)));
  return { filename, contentId, content: files.get(filename) };
}
const bodyFont = "'Source Sans 3',Arial,sans-serif";
const headingFont = "Lora,Georgia,serif";
export function approvedEmailTemplate(job) {
  const b = job.snapshot, privateReservation = job.templateVersion === "email-v3-private" && b.privateReservation === true, host = job.channel === "host_notification", confirmed = job.channel === "guest_confirmation";
  if (!["guest_acknowledgement", "host_notification", "guest_confirmation"].includes(job.channel)) throw Error("UNKNOWN_EMAIL_CHANNEL");
  const legacyEvent = b.kind === "event" && !b.pricingVersion;
  const stage = confirmed ? 2 : 0;
  const subject = host ? "A booking request needs your review" : confirmed ? b.amended ? "Your Aroha booking has been updated" : "Your time at Aroha is confirmed" : "Your Aroha request is with your hosts";
  const kicker = host ? "A PERSONAL WELCOME STARTS WITH YOU" : confirmed ? "REVIEWED WITH CARE. READY TO WELCOME YOU." : "A LITTLE TIME AWAY IS TAKING SHAPE";
  const title = host ? "A little time away.<br>A request to review." : confirmed ? b.amended ? "A fresh plan.<br>The same warm welcome." : "Something lovely<br>to look forward to." : "Every good stay<br>starts with a hello.";
  const opening = host ? "Dear hosts," : `Dear ${b.guestName},`;
  const body = privateReservation ? "Your hosts have confirmed your private booking of the whole retreat for the dates below. Reply to this email to arrange attendance and arrival details with us." : host ? `${b.guestName} has sent a ${legacyEvent ? "retreat enquiry" : "booking request"}. Take a look at their dates and arrangements, then review availability in Host Studio before approving.` : confirmed ? b.amended ? "Your hosts have approved your date change. Your updated invoice accompanies this note and replaces the earlier invoice." : "Your hosts have reviewed your request and confirmed your visit. A little breathing space, time together, and a slower morning are getting closer." : "Thank you for making room for Aroha. Your request has reached us, and we’re taking a thoughtful look at your dates and arrangements.";
  const caption = confirmed ? "Your hosts have approved your request. Next comes your welcome." : host ? "The guest’s request has arrived. Host review comes next." : "We have your request. Your hosts review it next.";
  const now = host ? "A request is waiting for your care." : confirmed ? "Reviewed. Confirmed. Yours to look forward to." : "Your request is safely with us.";
  const next = host ? "Review the request and current availability. This acknowledgement does not approve a reservation." : confirmed ? "Review your visit details for the agreed arrival arrangements. Your hosts will welcome you and record your check-in." : legacyEvent ? "An exclusive retreat enquiry does not hold the retreat. Your host will send an offer for your acceptance." : "Your requested capacity is held until the host review deadline. Your hosts will write again when your visit is confirmed.";
  const note = confirmed ? "Your invoice is attached. It shows the agreed amount payable; it does not mean payment has been received." : "This is an acknowledgement, not a confirmed reservation. No payment is requested.";
  const url = environment.origin + (privateReservation ? "/" : host ? "/admin/#bookings" : "/book/#visits");
  const action = privateReservation ? "Explore Aroha Retreat" : host ? "Review in Host Studio" : confirmed ? "See your visit & invoice" : "View your request";
  const alt = stages.map((s,i)=>`${s}: ${i<stage?"complete":i===stage?"you are here":"coming up"}`).join(". ") + ".";
  const test = job.test ? "PRE-PRODUCTION TEST · Isolated test booking. No real reservation or payment is requested." : "";
  const attendance = privateReservation && b.guestCountPending ? "Guest count to be arranged with your hosts" : `${b.guests} guests`;
  const summary = `${visitWindow(b)}\n${attendance} · Booking ${b.reference}`;
  const text = [test,subject,opening,body,"YOUR AROHA JOURNEY: " + alt,caption,now,next,summary,action + ": " + url,note,"With warmth,\nYour hosts at Aroha"].filter(Boolean).join("\n\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><style>
@font-face{font-family:Lora;src:url('${environment.origin}/assets/fonts/Lora.woff2')}@font-face{font-family:'Source Sans 3';src:url('${environment.origin}/assets/fonts/Source.woff2')}
@media only screen and (max-width:540px){.outer{padding:12px!important}.content{padding-left:22px!important;padding-right:22px!important}.email-title{font-size:33px!important}.logo{width:115px!important;height:auto!important}.image-band{height:auto!important}}
</style></head><body style="margin:0;background:#e7e3d9;color:#263e2d;font-family:${bodyFont};font-size:17px;line-height:1.65">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e7e3d9"><tr><td class="outer" align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="640"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fffcf5;border:1px solid #d8d6c7">
<tr><td class="content" style="padding:26px 38px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td><img class="logo" src="cid:aroha-logo" width="132" height="46" alt="Aroha Retreat" style="display:block;border:0;width:132px;height:auto"></td><td align="right" style="font-family:${bodyFont};font-size:10px;line-height:1.8;color:#74806c">YOUR TIME,<br>A LITTLE SLOWER.</td></tr></table></td></tr>
<tr><td><img class="image-band" src="cid:aroha-farm" width="640" height="150" alt="Aroha’s cottages beneath the palms" style="display:block;border:0;width:100%;height:auto"></td></tr>
<tr><td class="content" style="padding:9px 38px;background:#163e2d;color:#fffaf0;font-size:10px">A NOTE FROM YOUR HOSTS</td></tr>
${test ? `<tr><td class="content" style="padding:14px 38px;background:#f6e8bd;color:#62471f;font-size:12px;line-height:1.6">${esc(test)}</td></tr>` : ""}
<tr><td class="content" style="padding:35px 38px 0"><p style="margin:0;font-size:10px;color:#8d5c37;font-weight:600">${kicker}</p><h1 class="email-title" style="font-family:${headingFont};font-weight:400;font-size:42px;line-height:1.18;margin:15px 0 24px;color:#263e2d">${title}</h1><p style="margin:0 0 12px">${esc(opening)}</p><p style="margin:0 0 28px;color:#58644f;line-height:1.75">${esc(body)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f1e6;border:1px solid #d8dfc9"><tr><td style="padding:18px 18px 0;font-size:10px;color:#596b4c">YOUR AROHA JOURNEY <span style="color:#8d5c37"> · 0${stage+1} / 06</span></td></tr><tr><td style="padding:20px 0 0"><img src="cid:aroha-journey" width="562" height="281" alt="${esc(alt)}" style="display:block;border:0;width:100%;height:auto;color:#55664b;font-size:12px"></td></tr><tr><td style="padding:16px 18px;background:#e5ead9;border-top:1px solid #d8dfc9;font-size:13px;color:#4e6343;line-height:1.5"><strong>● ${stages[stage]}.</strong> ${esc(caption)}</td></tr></table>
<div style="padding:24px 0 25px;border-bottom:1px solid #dedccf"><p style="margin:0;font-size:10px;color:#8d5c37">RIGHT NOW</p><h2 style="font-family:${headingFont};font-weight:400;font-size:24px;line-height:1.35;margin:7px 0 9px">${now}</h2><p style="font-size:15px;line-height:1.7;color:#66725c;margin:0">${esc(next)}</p></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #dedccf"><tr><td style="padding:25px 0 23px"><p style="margin:0 0 8px;font-size:10px;color:#748067">YOUR VISIT · IST</p><p style="margin:0;font-family:${headingFont};font-size:21px;line-height:1.5;color:#29452e">${esc(visitWindow(b))}</p><p style="margin:12px 0 0;font-size:13px;color:#5f6f54">${esc(attendance)} · Booking ${esc(b.reference)}</p></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:25px;background:#163e2d"><tr><td style="padding:15px 20px"><a href="${esc(url)}" style="display:block;color:#fffdf3;text-decoration:none;font-weight:600;font-size:15px">${esc(action)} ↗</a></td></tr></table><p style="font-size:12px;line-height:1.7;color:#70775f;margin:16px 0 24px">${esc(note)}</p><p style="margin:0 0 27px;font-size:14px;color:#647354">With warmth,<br><strong style="font-weight:500;color:#314c33">Your hosts at Aroha</strong></p></td></tr>
<tr><td class="content" align="center" style="background:#edeede;padding:23px 38px 25px;color:#67765b;font-size:10px"><p style="margin:0">COME AS GUESTS. RETURN AS FAMILY.</p><p style="margin:7px 0 0;font-size:11px">Aroha Retreat · Kanakapura</p><p style="margin:7px 0 0;font-size:10px">Sent for your booking. Reply to reach your hosts.</p></td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  return {subject:job.subjectPrefix + subject + " · " + b.reference,text,html,attachments:[asset("logo-forest.png","aroha-logo"),asset("farm.jpg","aroha-farm"),asset(`journey-${confirmed?"confirmed":"request"}.png`,"aroha-journey")]};
}
