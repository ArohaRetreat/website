import { environment } from "../environment.mjs";
const email = (s) =>
  typeof s === "string" &&
  /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(s) &&
  s.length <= 254;
export function mailSettings(env = process.env, profile = environment) {
  const enabled = env.MAIL_ENABLED === "true";
  const c = {
    enabled,
    environment: profile.name,
    test: profile.preprod,
    from: env.MAIL_FROM || "",
    replyTo: env.MAIL_REPLY_TO || "",
    hostTo: env.MAIL_HOST_TO || "",
    testRecipient: env.MAIL_TEST_RECIPIENT || "",
    issuer: {
      name: env.BILLING_DISPLAY_NAME || "Aroha Retreat",
      address: env.BILLING_ADDRESS || "",
      paymentInstructions: env.BILLING_PAYMENT_INSTRUCTIONS || "",
      configVersion: Number(env.BILLING_CONFIG_VERSION || 1),
    },
  };
  if (!enabled) return c;
  if (
    !email(c.from) ||
    !email(c.replyTo) ||
    !email(c.hostTo) ||
    (c.test && !email(c.testRecipient))
  )
    throw Error("MAIL_CONFIG_INCOMPLETE");
  if (
    !c.test &&
    (!c.issuer.name ||
      !c.issuer.address ||
      !c.issuer.paymentInstructions ||
      [c.issuer.name, c.issuer.address, c.issuer.paymentInstructions].some(
        (x) => /TEST|DO NOT PAY/i.test(x),
      ))
  )
    throw Error("LIVE_BILLING_CONFIG_INCOMPLETE");
  if (
    !c.issuer.name ||
    c.issuer.name.length > 120 ||
    c.issuer.address.length > 500 ||
    c.issuer.paymentInstructions.length > 800 ||
    !Number.isSafeInteger(c.issuer.configVersion) ||
    c.issuer.configVersion < 1
  )
    throw Error("INVALID_BILLING_CONFIG");
  return c;
}
export const validEmail = email;
