import { col, fail, queryPage } from "./core.mjs";
import {
  customerProfiles,
  customerOwnerContext,
} from "../booking/customers.mjs";
import { projectReservation } from "../external/read.mjs";
export async function hostHandler({ tx, db, ctx, input }) {
  const bookings = col(db, "bookings");
  if (ctx.operation === "getHostBookingSummary") {
    const statuses = [
      "pending_approval",
      "confirmed",
      "checked_in",
      "completed",
      "cancelled",
      "declined",
      "expired",
      "no_show",
    ];
    // A separate read-only snapshot avoids locking every matched reservation while
    // the outer transaction rechecks current staff membership and records the read.
    const { counts, elapsed } = await db.runTransaction(
      async (read) => ({
        counts: await Promise.all(
          statuses.map((s) =>
            read
              .get(bookings.where("status", "==", s).count())
              .then((s) => s.data().count),
          ),
        ),
        elapsed: (
          await read.get(
            bookings
              .where("status", "==", "pending_approval")
              .where("expiresAt", "<=", ctx.now)
              .count(),
          )
        ).data().count,
      }),
      { readOnly: true },
    );
    return {
      pendingReview: counts[0] - elapsed,
      confirmed: counts[1],
      checkedIn: counts[2],
      completed: counts[3],
      cancelled: counts[4],
      declined: counts[5],
      expired: counts[6] + elapsed,
      noShow: counts[7],
      asOf: ctx.now,
    };
  }
  if (input.reference) {
    if (input.cursor) fail("INVALID_CURSOR");
    const rows = await tx.get(
      bookings
        .where("reference", "==", input.reference.trim().toUpperCase())
        .limit(2),
    );
    if (rows.size > 1) fail("BOOKING_REFERENCE_CONFLICT", 409);
    return {
      items: rows.docs
        .filter((d) => !input.status || d.data().status === input.status)
        .map((d) => projectReservation({ id: d.id, ...d.data() })),
      nextCursor: null,
    };
  }
  let query = bookings,
    binding = "all";
  if (ctx.operation === "listCustomerReservations") {
    const profile = (await tx.get(customerProfiles(db).doc(input.id))).data();
    if (!profile) fail("NOT_FOUND", 404);
    const context = await customerOwnerContext(tx, db, input.id, profile);
    binding = context.ownerIds.sort().join(",");
    query = query.where("owner", "in", context.ownerIds);
  }
  if (input.reference)
    query = query.where(
      "reference",
      "==",
      input.reference.trim().toUpperCase(),
    );
  if (input.status) query = query.where("status", "==", input.status);
  return queryPage(
    tx,
    db,
    ctx,
    ctx.operation +
      ":" +
      binding +
      ":" +
      (input.reference || "").trim().toUpperCase() +
      ":" +
      (input.status || ""),
    input,
    query,
    projectReservation,
    { orderField: "createdAt", descending: true },
  );
}
