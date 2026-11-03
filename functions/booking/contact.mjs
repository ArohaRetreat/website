import { BookingError } from "./domain.mjs";
export function contactDetails(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !["name", "phone"].includes(k))
  )
    throw new BookingError("INVALID_CONTACT", 422);
  const name = typeof value.name === "string" ? value.name.trim() : "",
    raw = typeof value.phone === "string" ? value.phone : "";
  const phone = raw.replace(/[ ()-]/g, "");
  if (
    name.length < 2 ||
    name.length > 120 ||
    /[\u0000-\u001f\u007f]/.test(name) ||
    !/^[+][1-9][0-9]{7,14}$/.test(phone)
  )
    throw new BookingError("INVALID_CONTACT", 422);
  return { name, phone };
}
export function ownContact(profile = {}, token = {}) {
  return {
    name:
      profile.contact?.name ||
      String(token.name || profile.name || "").slice(0, 120),
    phone: profile.contact?.phone || "",
    email: String(token.email || profile.email || "").slice(0, 254),
    version: profile.contactVersion || 0,
  };
}
export function withoutContact(b) {
  const { contact, ...rest } = b;
  return rest;
}
