import { environment } from "../environment.mjs";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function emailTemplate(job) {
  const b = job.snapshot,
    kind = b.kind === "event" ? "exclusive retreat enquiry" : "booking request";
  const end =
    b.kind === "event"
      ? new Date(Date.parse(b.departure + "T00:00:00Z") - 86400000)
          .toISOString()
          .slice(0, 10)
      : b.departure;
  const subject =
    job.channel === "guest_acknowledgement"
      ? `We have received your ${kind}`
      : job.channel === "host_notification"
        ? "A booking request needs your review"
        : b.amended
          ? "Your Aroha booking has been updated"
          : "Your Aroha booking is confirmed";
  const lines =
    job.channel === "guest_acknowledgement"
      ? [
          `Hello ${b.guestName},`,
          `Your ${kind} has been received and is under consideration by your hosts.`,
          "Host approval is still required. This message does not confirm a reservation.",
          b.kind === "event"
            ? "An exclusive retreat enquiry does not hold the retreat. Your host will send an offer for your acceptance."
            : "You can follow the host response in Your visits.",
        ]
      : job.channel === "host_notification"
        ? [
            `${b.guestName} has submitted a ${kind}.`,
            "Open Host Studio to review the request and availability before approving.",
          ]
        : [
            `Hello ${b.guestName},`,
            b.amended
              ? "Your host has approved your date change at Aroha Retreat. The attached invoice replaces the earlier invoice."
              : "Your host has confirmed your booking at Aroha Retreat.",
            "Your invoice is attached. It shows the amount payable; it does not confirm that payment has been received.",
            "Review your booking for the agreed arrival arrangements.",
          ];
  const test = job.test
    ? "PRE-PRODUCTION TEST: This message concerns an isolated test booking. No real reservation or payment is requested."
    : "";
  const url =
    environment.origin +
    (job.channel === "host_notification"
      ? "/admin/#bookings"
      : "/book/#visits");
  const summary = `Reference: ${b.reference}\nDates: ${b.arrival} to ${end}\nGuests: ${b.guests}`;
  const text = [
    test,
    ...lines,
    summary,
    "View booking: " + url,
    "Aroha Retreat",
  ]
    .filter(Boolean)
    .join("\n\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5ee;color:#163e2d;font:16px/1.6 Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:600px;background:#fffdf7;border-radius:16px"><tr><td style="padding:28px;background:#163e2d;color:#fffdf7;font:28px Georgia,serif">Aroha Retreat</td></tr><tr><td style="padding:28px">${test ? `<p style="padding:16px;background:#f6dfaa;color:#563d12"><strong>${esc(test)}</strong></p>` : ""}<h1 style="font:26px Georgia,serif">${esc(subject)}</h1>${lines.map((l) => `<p>${esc(l)}</p>`).join("")}<p style="padding:18px;background:#edf0e6">${esc(summary).replaceAll("\n", "<br>")}</p><a href="${esc(url)}" style="display:inline-block;padding:12px 20px;background:#163e2d;color:#fffdf7;border-radius:8px;text-decoration:none">${job.channel === "host_notification" ? "Review in Host Studio" : "View your booking"}</a><p style="font-size:13px;color:#52634e">Sent for your booking request. You can reply to reach your hosts.</p></td></tr></table></td></tr></table></body></html>`;
  return {
    subject: job.subjectPrefix + subject + " · " + b.reference,
    text,
    html,
  };
}
