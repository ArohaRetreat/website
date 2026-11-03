import { auth, observeAuth } from "./firebase-auth.mjs";
import { preference } from "./preferences.mjs";
const allowed = () => preference("aroha-monitoring") === "allowed";
let journeyId, currentKind;
try {
  journeyId = sessionStorage.getItem("aroha-booking-journey");
  if (!/^[a-f0-9-]{36}$/.test(journeyId || "")) {
    journeyId = crypto.randomUUID();
    sessionStorage.setItem("aroha-booking-journey", journeyId);
  }
} catch {
  journeyId = crypto.randomUUID();
}
export const bookingJourneyId = () => journeyId;
export const bookingJourneyKind = () => currentKind;
const queue = [];
let sending = false;
export function journeyStep(step, outcome = "viewed", kind, relatedRequestId) {
  if (["day", "individual", "private", "event"].includes(kind))
    currentKind = kind;
  kind = kind || currentKind;
  if (!allowed()) return;
  if (queue.length >= 40) queue.shift();
  queue.push({
    eventId: crypto.randomUUID(),
    journeyId,
    step,
    outcome,
    ...(kind ? { kind } : {}),
    ...(relatedRequestId ? { relatedRequestId } : {}),
  });
  void flush();
}
async function flush() {
  if (sending || !allowed()) return;
  sending = true;
  try {
    while (queue.length && allowed()) {
      const body = queue[0];
      let accepted = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!allowed()) break;
        try {
          const token = await auth.currentUser?.getIdToken();
          const r = await fetch("/api/v1/booking/journey-event", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Aroha-Consent": "monitoring",
              ...(token ? { Authorization: "Bearer " + token } : {}),
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5000),
            keepalive: true,
          });
          if (r.ok) {
            accepted = true;
            break;
          }
          if (r.status >= 400 && r.status < 500 && r.status !== 429) break;
        } catch {}
        if (attempt < 2)
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
      queue.shift();
      if (!accepted) break;
    }
  } finally {
    sending = false;
  }
}
window.addEventListener("aroha-consent-change", () => {
  if (!allowed()) queue.length = 0;
  else void flush();
});
window.addEventListener("online", () => void flush());

let previousUser;
observeAuth((user) => {
  const id = user?.uid || null;
  if (previousUser && previousUser !== id) {
    journeyId = crypto.randomUUID();
    queue.length = 0;
    try {
      sessionStorage.setItem("aroha-booking-journey", journeyId);
    } catch {}
  }
  previousUser = id;
});
