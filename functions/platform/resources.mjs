import { randomUUID } from "node:crypto";
import { col, bounded, fail, version, page, queryPage } from "./core.mjs";
import { loadConfig } from "../booking/store.mjs";
import { mutate, occupies, todayIST } from "../booking/domain.mjs";
import { contactDetails } from "../booking/contact.mjs";
const changeId = (b) =>
  b.changeRequest?.id || "legacy-change-" + b.changeRequest?.requestedAt;
const noteView = (n) => ({
  id: n.id,
  text: n.redacted ? "" : n.text,
  redacted: n.redacted === true,
  version: n.version,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});
export async function resourcesHandler({ tx, db, ctx, input, booking }) {
  const op = ctx.operation;
  if (op === "updateReservationContact") {
    if (!["pending_approval", "confirmed"].includes(booking.status))
      fail("INVALID_TRANSITION", 409);
    version(booking.version, input.expectedVersion);
    const contact = contactDetails(input.contact);
    tx.set(col(db, "booking_contact_history").doc(), {
      bookingId: booking.id,
      before: booking.contact || null,
      after: contact,
      actor: ctx.uid,
      at: ctx.now,
    });
    tx.update(col(db, "bookings").doc(booking.id), {
      contact,
      version: booking.version + 1,
    });
    return { id: booking.id, version: booking.version + 1, contact };
  }
  if (op === "listReservationChanges")
    return {
      items: booking.changeRequest
        ? [
            {
              id: changeId(booking),
              arrival: booking.changeRequest.arrival,
              departure: booking.changeRequest.departure,
              totalPaise: booking.changeRequest.total,
              createdAt: booking.changeRequest.requestedAt,
              version: booking.version,
              status: "pending",
            },
          ]
        : [],
      nextCursor: null,
    };
  if (op === "listReservationOffers")
    return {
      items: [
        ...(booking.offerHistory || []),
        ...(booking.currentOffer ? [booking.currentOffer] : []),
      ].map((o) => ({
        id: o.id,
        amountPaise: o.amount,
        createdAt: o.createdAt,
        status: o.status,
        version: o.version,
      })),
      nextCursor: null,
    };
  if (op === "getGuestNote")
    return {
      id: booking.id,
      text: booking.note || "",
      version: booking.version,
    };
  if (op.startsWith("listHost") || op.includes("HostNote")) {
    const collection = col(db, "booking_host_notes");
    if (op === "listHostNotes")
      return queryPage(
        tx,
        db,
        ctx,
        op + ":" + booking.id,
        input,
        collection.where("bookingId", "==", booking.id),
        noteView,
      );
    if (op === "createHostNote") {
      const n = {
        id: randomUUID(),
        bookingId: booking.id,
        author: ctx.uid,
        text: input.text.trim(),
        version: 1,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        redacted: false,
      };
      tx.set(collection.doc(n.id), n);
      return noteView(n);
    }
    const ref = collection.doc(input.noteId),
      old = (await tx.get(ref)).data();
    if (!old || old.bookingId !== booking.id) fail("NOT_FOUND", 404);
    version(old.version, input.expectedVersion);
    if (old.redacted) fail("NOTE_REDACTED", 409);
    const next = {
      ...old,
      text: op === "redactHostNote" ? "" : input.text.trim(),
      redacted: op === "redactHostNote",
      version: old.version + 1,
      updatedAt: ctx.now,
    };
    tx.set(col(db, "booking_note_history").doc(), {
      bookingId: booking.id,
      noteId: old.id,
      previousVersion: old.version,
      operation: op,
      actor: ctx.uid,
      at: ctx.now,
    });
    tx.set(ref, next);
    return noteView(next);
  }
  const ref = col(db, "booking_config").doc("site"),
    snap = await tx.get(ref),
    state = loadConfig(snap);
  if (op === "getBlock") {
    const b = state.blocks.find((x) => x.id === input.id);
    if (!b) fail("NOT_FOUND", 404);
    return { ...b, version: b.version || 1 };
  }
  if (op === "getPromotion") {
    const p = state.promos.find(
      (x) => x.id === input.id || x.code === input.id.toUpperCase(),
    );
    if (!p) fail("NOT_FOUND", 404);
    return p;
  }
  let result;
  if (op === "createUnit") {
    if (state.units.length >= 20) fail("UNIT_LIMIT", 409);
    result = {
      id: randomUUID(),
      name: input.name.trim(),
      type: "Unconfigured",
      capacity: input.capacity,
      rate: input.rate,
      active: false,
      ready: false,
      retired: false,
      version: 1,
      createdAt: ctx.now,
    };
    state.units.push(result);
  } else if (op === "retireUnit") {
    const unit = state.units.find((x) => x.id === input.id);
    if (!unit) fail("NOT_FOUND", 404);
    version(unit.version, input.expectedVersion);
    const active = await bounded(
      tx,
      col(db, "bookings").where("status", "in", [
        "confirmed",
        "checked_in",
        "pending_approval",
      ]),
    );
    if (
      active.some((b) => occupies(b, ctx.now) && b.units?.includes(unit.id)) ||
      state.blocks.some(
        (b) => b.unitId === unit.id && b.departure > todayIST(ctx.now),
      )
    )
      fail("RESOURCE_IN_USE", 409);
    Object.assign(unit, {
      active: false,
      ready: false,
      retired: true,
      retiredAt: ctx.now,
      version: unit.version + 1,
    });
    result = unit;
  } else if (op === "updateBlock") {
    const old = state.blocks.find((x) => x.id === input.id);
    if (!old) fail("NOT_FOUND", 404);
    version(old.version || 1, input.expectedVersion);
    state.bookings = await bounded(
      tx,
      col(db, "bookings").where("status", "in", [
        "confirmed",
        "checked_in",
        "pending_approval",
      ]),
    );
    state.blocks = state.blocks.filter((x) => x.id !== old.id);
    const created = mutate(
      state,
      { id: ctx.uid, role: "host" },
      "block",
      input,
      ctx.now,
    );
    Object.assign(created, { id: old.id, version: (old.version || 1) + 1 });
    result = created;
  } else if (op === "updatePromotion" || op === "deactivatePromotion") {
    const p = state.promos.find(
      (x) => x.id === input.id || x.code === input.id.toUpperCase(),
    );
    if (!p) fail("NOT_FOUND", 404);
    version(p.version, input.expectedVersion);
    if (op === "updatePromotion") {
      const used = (
        await bounded(tx, col(db, "bookings").where("promo", "==", p.code))
      ).filter(
        (b) =>
          ["confirmed", "checked_in", "completed", "no_show"].includes(
            b.status,
          ) ||
          (b.status === "pending_approval" && b.expiresAt > ctx.now),
      ).length;
      if (input.code && input.code.toUpperCase() !== p.code)
        fail("PROMO_CODE_IMMUTABLE");
      const next = {
        ...p,
        ...Object.fromEntries(
          Object.entries(input).filter(
            ([k]) => !["id", "expectedVersion"].includes(k),
          ),
        ),
      };
      if (next.maxUses < used) fail("PROMOTION_REDEMPTIONS_EXIST", 409);
      if (next.from > next.until) fail("INVALID_PROMO_DATES");
      if (next.kind === "percent" && next.value > 50)
        fail("INVALID_PROMO_VALUE");
      Object.assign(p, next);
    } else p.active = false;
    p.version++;
    result = p;
  } else fail("NOT_FOUND", 404);
  tx.set(ref, {
    settings: state.settings,
    units: state.units,
    promos: state.promos,
    blocks: state.blocks,
    schemaVersion: 1,
    guardVersion: (snap.data()?.guardVersion || 0) + 1,
  });
  return result;
}
