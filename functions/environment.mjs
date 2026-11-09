import { environmentProfile } from "./environment-profile.mjs";
if (!process.env.FUNCTIONS_EMULATOR && process.env.FUNCTION_TARGET) {
  const target = process.env.FUNCTION_TARGET;
  if (
    target.startsWith("aroha") &&
    target.endsWith("Preprod") !==
      (process.env.AROHA_ENVIRONMENT === "pre-prod")
  )
    throw Error("FUNCTION_ENVIRONMENT_MISMATCH");
}
export const environment = environmentProfile(
  process.env.AROHA_ENVIRONMENT || "production",
);
export const collectionName = (name) => environment.prefix + name;
export const sharedCollectionName = (name) => "aroha_" + name;
export const serviceName = (name) => name + environment.serviceSuffix;
export const environmentFields = () => ({
  "deployment.environment.name": environment.name,
});
export function isTester(token) {
  if (!environment.preprod) return true;
  if (
    token?.email_verified !== true ||
    token?.firebase?.sign_in_provider !== "google.com"
  )
    return false;
  return isTesterEmail(token.email);
}
export function isTesterEmail(email) {
  if (!environment.preprod) return true;
  const allow = new Set(
    (process.env.PREPROD_TESTER_EMAILS || process.env.SUPER_ADMIN_EMAILS || "")
      .toLowerCase()
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );
  return allow.has(String(email || "").toLowerCase());
}

export function runtimeServiceName(target = process.env.FUNCTION_TARGET || "") {
  return serviceName(
    target.includes("Email")
      ? "aroha-booking-emails"
      : target.includes("BookingEvents")
        ? "aroha-booking-events"
        : "aroha-api",
  );
}
