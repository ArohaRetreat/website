import { readCustomerBinding } from "../booking/customers.mjs";
import { studioAccess } from "../access.mjs";
import { randomUUID, createHash } from "node:crypto";
import { collectionName, sharedCollectionName } from "../environment.mjs";
import { loadConfig, publicBookingCalendar } from "../booking/store.mjs";
import { availability, todayIST, BookingError } from "../booking/domain.mjs";
import { ownContact } from "../booking/contact.mjs";
import { guardIntegrationTransaction } from "./access.mjs";
const fail = (c, s = 422) => {
  throw new BookingError(c, s);
};
const pick = (v, keys) =>
  Object.fromEntries(
    keys.filter((k) => v[k] !== undefined).map((k) => [k, v[k]]),
  );
export const projectReservation = (b) => ({
  id: b.id,
  reference: b.reference,
  version: b.version,
  kind: b.kind || "private",
  status:
    b.status === "pending_approval" && b.expiresAt <= Date.now()
      ? "expired"
      : b.status,
  arrival: b.arrival,
  departure: b.departure,
  adults: b.adults ?? b.guests,
  childrenCount: Number.isInteger(b.children)
    ? b.children
    : b.childrenAges?.length || 0,
  unitIds: b.units || [],
  totalPaise: b.total ?? null,
  currency: "INR",
});
export const projectUnit = (u) =>
  pick(u, [
    "id",
    "version",
    "name",
    "type",
    "capacity",
    "rate",
    "active",
    "ready",
  ]);
export const etag = (kind, id, version) =>
  '"' + kind + ":" + id + ":" + (version || 0) + '"';
export function expected(header, kind, id) {
  if (!header) fail("PRECONDITION_REQUIRED", 428);
  const prefix = '"' + kind + ":" + id + ":";
  if (
    !header.startsWith(prefix) ||
    !header.endsWith('"') ||
    !/^\d+$/.test(header.slice(prefix.length, -1))
  )
    fail("VERSION_CONFLICT", 412);
  return Number(header.slice(prefix.length, -1));
}
export async function configRead(db) {
  return loadConfig(
    await db.collection(collectionName("booking_config")).doc("site").get(),
  );
}
export async function reservationRead(db, token, id) {
  const d = await db.collection(collectionName("bookings")).doc(id).get(),
    b = d.data();
  const binding = await readCustomerBinding(db, token);
  const member =
    token._integration.rowAccess === "all"
      ? (
          await db
            .collection(sharedCollectionName("members"))
            .doc(token.uid)
            .get()
        ).data()
      : null;
  if (
    !d.exists ||
    (!binding.ownerIds.includes(b.owner) &&
      (token._integration.rowAccess !== "all" ||
        studioAccess(member).bookings === "none"))
  )
    fail("NOT_FOUND", 404);
  return b;
}
export async function pageRead(
  db,
  token,
  query,
  { limit = 25, cursor, view },
  project,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    fail("INVALID_LIMIT");
  const binding = createHash("sha256")
    .update(
      JSON.stringify([
        token.uid,
        token._integration.id,
        token._integration.version,
        view,
        limit,
      ]),
    )
    .digest("hex");
  const cursors = db.collection(collectionName("external_cursors"));
  let q = query
    .orderBy("createdAt", "desc")
    .orderBy("__name__", "desc")
    .limit(limit + 1);
  if (cursor) {
    if (!/^[a-f0-9-]{36}$/.test(cursor)) fail("INVALID_CURSOR", 400);
    const d = await cursors.doc(cursor).get(),
      c = d.data();
    if (!c || c.binding !== binding) fail("INVALID_CURSOR", 400);
    if (c.expiresAt <= Date.now()) fail("CURSOR_EXPIRED", 410);
    q = q.startAfter(c.at, c.id);
  }
  const result = await q.get(),
    page = result.docs.slice(0, limit);
  let nextCursor = null;
  if (result.size > limit) {
    const last = page.at(-1);
    nextCursor = randomUUID();
    await cursors.doc(nextCursor).set({
      binding,
      at: last.data().createdAt,
      id: last.id,
      expiresAt: Date.now() + 900000,
      expireAt: new Date(Date.now() + 900000),
    });
  }
  return {
    items: page.map((d) => project({ ...d.data(), id: d.id })),
    nextCursor,
  };
}
export async function availabilityRead(db, token, input) {
  const start = Date.parse(input.arrival),
    end = Date.parse(input.departure);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    end - start > 31 * 86400000
  )
    fail("INVALID_STAY_DATES");
  return db.runTransaction(async (tx) => {
    await guardIntegrationTransaction(tx, db, token);
    const [c, rows] = await Promise.all([
      tx.get(db.collection(collectionName("booking_config")).doc("site")),
      tx.get(
        db
          .collection(collectionName("bookings"))
          .where("status", "in", [
            "pending_approval",
            "confirmed",
            "checked_in",
          ])
          .limit(201),
      ),
    ]);
    if (rows.size > 200) fail("RECONCILIATION_REQUIRED", 409);
    const state = loadConfig(c);
    state.bookings = rows.docs.map((d) => d.data());
    const value = availability(state, input);
    return {
      available: value.available,
      configVersion: c.data()?.guardVersion || 0,
      availableUnitIds: (value.units || [])
        .filter((u) => u.available)
        .map((u) => u.id),
      reasons: value.available ? [] : ["UNAVAILABLE"],
    };
  });
}
export { publicBookingCalendar, ownContact };
