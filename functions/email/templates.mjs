import { lifecycleEmailTemplate } from "./templates-lifecycle.mjs";
import { statusEmailTemplate } from "./templates-status.mjs";
import { emailTemplate as legacyTemplate } from "./templates-legacy.mjs";
import { approvedEmailTemplate } from "./templates-approved.mjs";

// Jobs retain their original payload on retry, including provider idempotency.
export function emailTemplate(job) {
  if (job.templateVersion === "email-v4-manual") {
    const result = approvedEmailTemplate(job),
      note =
        "Your hosts recorded this booking for you. Sign in to Aroha with the email receiving this message to see your visit and loyalty.";
    return {
      ...result,
      text: result.text + "\n\n" + note,
      html: result.html.replace(
        "</body>",
        `<div style="max-width:600px;margin:0 auto;padding:24px;color:#263e2d;font-family:Arial,sans-serif">${note}</div></body>`,
      ),
    };
  }
  if (job.templateVersion === "email-v4-status")
    return statusEmailTemplate(job);
  if (job.templateVersion === "email-v4-lifecycle")
    return lifecycleEmailTemplate(job);
  if (!job.templateVersion) return legacyTemplate(job);
  if (
    ![
      "email-v3",
      "email-v3-private",
      "email-v3-correction",
      "email-v3-private-correction",
    ].includes(job.templateVersion)
  )
    throw Error("UNKNOWN_EMAIL_TEMPLATE");
  return approvedEmailTemplate(job);
}
