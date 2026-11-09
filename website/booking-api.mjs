import { finishGuestSignIn } from "./guest-signin-return.mjs";
import {
  bookingJourneyId,
  bookingJourneyKind,
  journeyStep,
} from "./booking-journey.mjs";
import { auth, login, logout } from "./firebase-auth.mjs";
let ready = auth.authStateReady();
const customerClaims = new Map();
export async function bookingApi(
  operation,
  body,
  key,
  { admin = false, start, cursor, workspace = false } = {},
) {
  await ready;
  if (operation === "session") {
    journeyStep("auth", "attempted");
    await login().catch((e) => {
      journeyStep(
        "auth",
        e.code === "auth/popup-closed-by-user" ? "cancelled" : "failed",
      );
      throw e;
    });
    journeyStep("auth", "succeeded");
    try {
      sessionStorage.setItem("aroha-guest-session", "1");
    } catch {}
    if (admin) {
      const token = await auth.currentUser.getIdToken();
      const session = await fetch("/api/v1/session", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      if (!session.ok)
        throw Error("This Google account does not have Host Studio access.");
    }
    if (!admin) return finishGuestSignIn();
    return request("state", undefined, undefined, { admin, start });
  }
  if (operation === "logout") {
    customerClaims.clear();
    await logout();
    try {
      sessionStorage.removeItem("aroha-guest-session");
    } catch {}
    return { signedOut: true };
  }
  if (operation === "state" && !auth.currentUser) return request("public");
  if (operation === "calendar") return request(operation, body);
  if (!auth.currentUser) throw Error("Sign in with Google to continue.");
  try {
    return await request(operation, body, key, { admin, start, cursor, workspace });
  } catch (e) {
    if (operation === "state" && admin && e.code === "FORBIDDEN")
      return request("public");
    throw e;
  }
}
async function request(
  operation,
  body,
  key,
  { admin = false, start, cursor, workspace = false } = {},
) {
  let customerLinkNotice;
  if (operation === "state" && !admin && auth.currentUser) {
    const uid = auth.currentUser.uid;
    if (!customerClaims.has(uid))
      customerClaims.set(
        uid,
        request(
          "platform",
          { operation: "claimMyCustomer", input: {} },
          crypto.randomUUID(),
        ).catch((e) => {
          customerClaims.delete(uid);
          throw e;
        }),
      );
    try {
      await customerClaims.get(uid);
    } catch (e) {
      if (
        ["CUSTOMER_LINK_REVIEW_REQUIRED", "PROFILE_RECREATE_REQUIRED"].includes(
          e.code,
        )
      )
        customerLinkNotice =
          e.code === "PROFILE_RECREATE_REQUIRED"
            ? "Your profile was erased. Save your contact details explicitly to recreate it. Retained booking and financial history remains available."
            : "Some host-recorded history needs an identity review. Contact Aroha; no accounts have been merged.";
      else throw e;
    }
    if (auth.currentUser?.uid !== uid)
      throw Object.assign(
        Error("Account changed. Please reopen your portal."),
        { code: "SESSION_CHANGED" },
      );
  }
  const query = new URLSearchParams();
  if (admin) query.set("admin", "1");
  if (start) query.set("start", start);
  if (cursor) query.set("cursor", cursor);
  if (admin && workspace) query.set("workspace", "1");
  const token = await auth.currentUser?.getIdToken();
  const stage = {
    availability: "availability",
    quote: "review",
    create: "submit",
    profile: "profile",
    "booking-action": "admin",
  }[operation];
  const response = await fetch(
    operation === "platform"
      ? "/api/v1/platform"
      : operation.startsWith("guest-identity/")
        ? "/api/v1/" + operation
        : "/api/v1/booking/" + operation + (query.size ? "?" + query : ""),
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "X-Aroha-Journey": bookingJourneyId(),
        ...(bookingJourneyKind()
          ? { "X-Aroha-Booking-Kind": bookingJourneyKind() }
          : {}),
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body !== undefined
          ? {
              "Content-Type": "application/json",
              "Idempotency-Key": key || crypto.randomUUID(),
            }
          : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    },
  ).catch((e) => {
    if (stage) journeyStep(stage, "failed");
    throw e;
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error("Booking service is temporarily unavailable.");
  }
  if (stage)
    journeyStep(
      stage,
      response.ok ? "succeeded" : "failed",
      result.kind,
      response.headers.get("X-Request-Id") || undefined,
    );
  if (
    !response.ok &&
    ["CONTACT_REQUIRED", "INVALID_CONTACT"].includes(result.error?.code)
  )
    journeyStep("contact", "failed");
  if (!response.ok) {
    const e = Error(result.error?.code || "REQUEST_FAILED");
    e.code = result.error?.code;
    e.status = response.status;
    throw e;
  }
  if (operation === "state" && result.activeBookings)
    result.bookings = [
      ...new Map(
        [...result.bookings, ...result.activeBookings].map((b) => [b.id, b]),
      ).values(),
    ];
  if (customerLinkNotice) result.customerLinkNotice = customerLinkNotice;
  if (operation === "profile") customerClaims.clear();
  return result;
}
