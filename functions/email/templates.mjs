import { emailTemplate as legacyTemplate } from "./templates-legacy.mjs";
import { approvedEmailTemplate } from "./templates-approved.mjs";

// Jobs retain their original payload on retry, including provider idempotency.
export function emailTemplate(job) {
  if (!job.templateVersion) return legacyTemplate(job);
  if (job.templateVersion !== "email-v3") throw Error("UNKNOWN_EMAIL_TEMPLATE");
  return approvedEmailTemplate(job);
}
