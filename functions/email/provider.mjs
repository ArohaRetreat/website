import { Resend } from "resend";
export async function sendEmail(secret, body, options) {
  if (process.env.FUNCTIONS_EMULATOR) {
    const endpoint = process.env.MAIL_TEST_COLLECTOR_URL || "";
    if (!/^http:\/\/127\.0\.0\.1:[0-9]{1,5}\/email$/.test(endpoint))
      throw Object.assign(Error("EMULATOR_EMAIL_DISABLED"), { terminal: true });
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, options }),
      signal: AbortSignal.timeout(5000),
    });
    return r.json();
  }
  return new Resend(secret).emails.send(body, options);
}
