export const PUBLIC_ORIGIN = "https://aroharetreat.com";
const productionOrigins = new Set([
  PUBLIC_ORIGIN,
  "https://aroha-retreat.web.app",
  "https://aroha-retreat.firebaseapp.com",
]);
const emulatorOrigins = new Set(["http://127.0.0.1:8770", "http://localhost:8770"]);
export function isAllowedOrigin(origin, emulator = false) {
  return !origin || productionOrigins.has(origin) || (emulator && emulatorOrigins.has(origin));
}
