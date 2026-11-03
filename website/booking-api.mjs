import { auth, login, logout } from "./firebase-auth.mjs";
let ready = auth.authStateReady();
export async function bookingApi(
  operation,
  body,
  key,
  { admin = false, start, cursor } = {},
) {
  await ready;
  if (operation === "session") {
    await login();
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
    return request("state", undefined, undefined, { admin, start });
  }
  if (operation === "logout") {
    await logout();
    try {
      sessionStorage.removeItem("aroha-guest-session");
    } catch {}
    return { signedOut: true };
  }
  if (operation === "state" && !auth.currentUser) return request("public");
  if (!auth.currentUser) throw Error("Sign in with Google to continue.");
  try {
    return await request(operation, body, key, { admin, start, cursor });
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
  { admin = false, start, cursor } = {},
) {
  const query = new URLSearchParams();
  if (admin) query.set("admin", "1");
  if (start) query.set("start", start);
  if (cursor) query.set("cursor", cursor);
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(
    "/api/v1/booking/" + operation + (query.size ? "?" + query : ""),
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
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
  );
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error("Booking service is temporarily unavailable.");
  }
  if (!response.ok) {
    const e = Error(result.error?.code || "REQUEST_FAILED");
    e.code = result.error?.code;
    throw e;
  }
  if (operation === "state" && result.activeBookings)
    result.bookings = [
      ...new Map(
        [...result.bookings, ...result.activeBookings].map((b) => [b.id, b]),
      ).values(),
    ];
  return result;
}
