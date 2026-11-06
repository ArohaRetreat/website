import {lifecycleEmailTemplate} from './templates-lifecycle.mjs';
import { emailTemplate as legacyTemplate } from "./templates-legacy.mjs";
import { approvedEmailTemplate } from "./templates-approved.mjs";

// Jobs retain their original payload on retry, including provider idempotency.
export function emailTemplate(job) {
  if(job.templateVersion==='email-v4-lifecycle')return lifecycleEmailTemplate(job);
  if (!job.templateVersion) return legacyTemplate(job);
  if (!["email-v3","email-v3-private","email-v3-correction","email-v3-private-correction"].includes(job.templateVersion)) throw Error("UNKNOWN_EMAIL_TEMPLATE");
  return approvedEmailTemplate(job);
}
