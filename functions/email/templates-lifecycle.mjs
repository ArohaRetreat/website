import { readFileSync } from "node:fs";
import { environment } from "../environment.mjs";
import { visitWindow } from "./visit-window.mjs";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const stages = [
  "Request sent",
  "Review",
  "Confirmed",
  "Check in",
  "Check out",
  "Feedback",
];
const bodyFont = "'Source Sans 3',Arial,sans-serif",
  headingFont = "Lora,Georgia,serif";
const files = new Map();
const asset = (filename, contentId) => {
  if (!files.has(filename))
    files.set(
      filename,
      readFileSync(new URL("./assets/" + filename, import.meta.url)),
    );
  return { filename, contentId, content: files.get(filename) };
};
const cash = (n) =>
  "INR " +
  ((n || 0) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function lifecycleEmailTemplate(job) {
  const b = job.snapshot;
  let stage, subject, kicker, title, body, caption, next, note, action;
  if (job.channel === "guest_checkin") {
    stage = 3;
    subject = "Welcome to your Aroha stay";
    kicker = "YOU HAVE ARRIVED. TAKE YOUR TIME.";
    title = "Settle in.<br>Let the day unfold.";
    body =
      "Your hosts have recorded your check-in. " +
      (b.facilities.length
        ? "Available for your visit: " + b.facilities.join(", ") + "."
        : "Your hosts will guide you through the facilities available today.");
    caption = "Checked in with your hosts. Your stay is underway.";
    next =
      "Enjoy the retreat at your pace. Reply here if you need help or local guidance.";
    note =
      "Your hosts can help with the facilities and any arrangements for your visit.";
    action = "See your visit";
  } else if (job.channel === "guest_checkout") {
    stage = 4;
    subject = "Thank you for your time at Aroha";
    kicker = "A LITTLE AROHA, TO TAKE WITH YOU.";
    title = "Good days.<br>Warm memories.";
    body = b.pricingPending
      ? "Your hosts have recorded your checkout. Pricing is still to be arranged with your hosts; no settled balance is implied."
      : "Your hosts have recorded your checkout. Payment recorded: " +
        cash(b.amountPaid) +
        ". Outstanding balance: " +
        cash(b.balanceDue) +
        ".";
    caption =
      "Checkout completed. Paid and outstanding amounts are shown as actually recorded.";
    next = b.pricingPending
      ? "Please contact your hosts to agree the final visit price. No financial statement has been issued."
      : b.balanceDue
        ? "Please arrange the remaining balance with your hosts using the agreed instructions. Checkout does not mark that balance as paid."
        : "Your recorded balance is settled. Thank you for spending this time with us.";
    note = b.pricingPending
      ? "No financial statement is issued until a final price is recorded. Your private feedback invitation follows 24 hours after checkout."
      : "The attached statement snapshots the actual payment ledger at checkout. Your private feedback invitation follows 24 hours after checkout.";
    action = "See visit and documents";
  } else if (job.channel === "guest_feedback") {
    stage = 5;
    subject = "A private note about your Aroha stay";
    kicker = "YOUR EXPERIENCE MATTERS TO YOUR HOSTS.";
    title = "A moment to reflect.<br>A note, just for us.";
    body =
      "Thank you for spending time at Aroha. If you would like, share a private rating and note about your visit.";
    caption = "Your visit is complete. Feedback is optional and private.";
    next =
      "Sign in with the same Google account used for this booking. Only you and authorized booking managers can read your feedback.";
    note =
      "Your feedback is never published as a public review. You can edit or withdraw it within seven days of submission.";
    action = "Share private feedback";
  } else throw Error("INVALID_LIFECYCLE_CHANNEL");
  const now = stages[stage] + ". Recorded by your hosts.";
  const opening = "Dear " + b.guestName + ",";
  const attendance = Number.isInteger(b.guests)
    ? b.guests + " guests"
    : "Arrangements with your hosts";
  const url = environment.origin + "/book/#visits";
  const alt =
    stages
      .map(
        (s, i) =>
          s +
          ": " +
          (i < stage ? "complete" : i === stage ? "you are here" : "coming up"),
      )
      .join(". ") + ".";
  const test = job.test
    ? "PRE-PRODUCTION TEST · Isolated test booking. No real payment is requested."
    : "";
  const summary = visitWindow(b) + " · Booking " + b.reference;
  const text = [
    test,
    subject,
    opening,
    body,
    "YOUR AROHA JOURNEY: " + alt,
    caption,
    now,
    next,
    summary,
    action + ": " + url,
    note,
    "With warmth, your hosts at Aroha",
  ]
    .filter(Boolean)
    .join("\n\n");
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
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f1e6;border:1px solid #d8dfc9"><tr><td style="padding:18px 18px 0;font-size:10px;color:#596b4c">YOUR AROHA JOURNEY <span style="color:#8d5c37"> · 0${stage + 1} / 06</span></td></tr><tr><td style="padding:20px 0 0"><img src="cid:aroha-journey" width="562" height="281" alt="${esc(alt)}" style="display:block;border:0;width:100%;height:auto;color:#55664b;font-size:12px"></td></tr><tr><td style="padding:16px 18px;background:#e5ead9;border-top:1px solid #d8dfc9;font-size:13px;color:#4e6343;line-height:1.5"><strong>● ${stages[stage]}.</strong> ${esc(caption)}</td></tr></table>
<div style="padding:24px 0 25px;border-bottom:1px solid #dedccf"><p style="margin:0;font-size:10px;color:#8d5c37">RIGHT NOW</p><h2 style="font-family:${headingFont};font-weight:400;font-size:24px;line-height:1.35;margin:7px 0 9px">${now}</h2><p style="font-size:15px;line-height:1.7;color:#66725c;margin:0">${esc(next)}</p></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #dedccf"><tr><td style="padding:25px 0 23px"><p style="margin:0 0 8px;font-size:10px;color:#748067">YOUR VISIT · IST</p><p style="margin:0;font-family:${headingFont};font-size:21px;line-height:1.5;color:#29452e">${esc(visitWindow(b))}</p><p style="margin:12px 0 0;font-size:13px;color:#5f6f54">${esc(attendance)} · Booking ${esc(b.reference)}</p></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:25px;background:#163e2d"><tr><td style="padding:15px 20px"><a href="${esc(url)}" style="display:block;color:#fffdf3;text-decoration:none;font-weight:600;font-size:15px">${esc(action)} ↗</a></td></tr></table><p style="font-size:12px;line-height:1.7;color:#70775f;margin:16px 0 24px">${esc(note)}</p><p style="margin:0 0 27px;font-size:14px;color:#647354">With warmth,<br><strong style="font-weight:500;color:#314c33">Your hosts at Aroha</strong></p></td></tr>
<tr><td class="content" align="center" style="background:#edeede;padding:23px 38px 25px;color:#67765b;font-size:10px"><p style="margin:0">COME AS GUESTS. RETURN AS FAMILY.</p><p style="margin:7px 0 0;font-size:11px">Aroha Retreat · Kanakapura</p><p style="margin:7px 0 0;font-size:10px">Sent for your booking. Reply to reach your hosts.</p></td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  return {
    subject: job.subjectPrefix + subject + " · " + b.reference,
    text,
    html,
    attachments: [
      asset("logo-forest.png", "aroha-logo"),
      asset("farm.jpg", "aroha-farm"),
      asset(
        "journey-" +
          ["", "", "", "checkin", "checkout", "feedback"][stage] +
          ".png",
        "aroha-journey",
      ),
    ],
  };
}
