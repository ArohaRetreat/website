import { environment } from "./environment.mjs";
export const PUBLIC_ORIGIN = environment.origin;
const productionOrigins = new Set(
  environment.preprod
    ? [environment.origin, "https://aroha-retreat-preprod.firebaseapp.com"]
    : [
        PUBLIC_ORIGIN,
        "https://aroha-retreat.web.app",
        "https://aroha-retreat.firebaseapp.com",
      ],
);
const emulatorOrigins = new Set([
  "http://127.0.0.1:8770",
  "http://localhost:8770",
]);
export function isAllowedOrigin(origin, emulator = false) {
  return (
    !origin ||
    productionOrigins.has(origin) ||
    origin === 'https://developer.aroharetreat.com' ||
    origin === 'https://aroha-retreat-developer.web.app' ||
    (emulator && emulatorOrigins.has(origin))
  );
}
