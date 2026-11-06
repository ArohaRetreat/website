import { col, bounded, fail, version, page, queryPage } from "./core.mjs";
const publicView = (d) => ({
  id: d.id,
  bookingId: d.bookingId,
  rating: d.withdrawn ? null : d.rating,
  comment: d.withdrawn ? "" : d.comment,
  withdrawn: d.withdrawn === true,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
  version: d.version,
});
export async function feedbackHandler({ tx, db, ctx, input, booking }) {
  if (ctx.operation === "reviewPrivateFeedback") {
    if (input.reference) {
      const matches = await tx.get(
        col(db, "bookings")
          .where("reference", "==", input.reference.trim().toUpperCase())
          .limit(2),
      );
      if (matches.size > 1) fail("BOOKING_REFERENCE_CONFLICT", 409);
      if (!matches.size) return { items: [], nextCursor: null };
      const b = matches.docs[0].data(),
        d = (await tx.get(col(db, "booking_feedback").doc(b.id))).data();
      return {
        items: d ? [{ ...publicView(d), bookingReference: b.reference }] : [],
        nextCursor: null,
      };
    }
    return queryPage(
      tx,
      db,
      ctx,
      ctx.operation,
      input,
      col(db, "booking_feedback"),
      async (d) => {
        const b = (await tx.get(col(db, "bookings").doc(d.bookingId))).data();
        return {
          ...publicView(d),
          bookingReference: b?.reference || "Historical booking",
        };
      },
      { orderField: "createdAt", descending: true },
    );
  }
  if (ctx.operation === "listPrivateFeedback") {
    return queryPage(
      tx,
      db,
      ctx,
      ctx.operation,
      input,
      col(db, "booking_feedback"),
      publicView,
    );
  }
  if (
    !booking ||
    booking.status !== "completed" ||
    !Number.isSafeInteger(booking.checkedOutAt)
  )
    fail("ACTUAL_CHECKOUT_REQUIRED", 409);
  const ref = col(db, "booking_feedback").doc(booking.id),
    old = (await tx.get(ref)).data();
  if (ctx.operation === "getReservationFeedback") {
    if (!old) fail("NOT_FOUND", 404);
    return publicView(old);
  }
  if (!(ctx.ownerIds || [ctx.uid]).includes(booking.owner))
    fail("FORBIDDEN", 403);
  if (ctx.operation === "submitFeedback") {
    if (old) fail("FEEDBACK_ALREADY_SUBMITTED", 409);
    if (input.consent !== true) fail("FEEDBACK_CONSENT_REQUIRED");
    const d = {
      id: booking.id,
      bookingId: booking.id,
      owner: booking.owner,
      rating: input.rating,
      comment: input.comment.trim(),
      createdAt: ctx.now,
      updatedAt: ctx.now,
      version: 1,
      withdrawn: false,
    };
    tx.set(ref, d);
    return publicView(d);
  }
  if (!old) fail("NOT_FOUND", 404);
  version(old.version, input.expectedVersion);
  if (old.withdrawn) fail("FEEDBACK_WITHDRAWN", 409);
  if (ctx.now - old.createdAt > 7 * 86400000)
    fail("FEEDBACK_EDIT_WINDOW_CLOSED", 409);
  const next = { ...old, version: old.version + 1, updatedAt: ctx.now };
  if (ctx.operation === "withdrawMyFeedback") {
    next.withdrawn = true;
    next.rating = null;
    next.comment = "";
    next.withdrawnAt = ctx.now;
  } else {
    next.rating = input.rating;
    next.comment = input.comment.trim();
  }
  tx.set(ref, next);
  return publicView(next);
}
