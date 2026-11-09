import { randomUUID } from "node:crypto";
import { col, fail, queryPage } from "./core.mjs";
import {
  customerProfiles,
  customerOwnerContext,
  claimCustomer,
  normalizedEmail,
} from "../booking/customers.mjs";
import {
  readWallets,
  loyaltySummary,
  adjustCredits,
} from "../booking/loyalty.mjs";
import { loadConfig } from "../booking/store.mjs";
import { validEmail } from "../email/config.mjs";
export const customerView = (p) => ({
  id: p.id,
  name: p.erasedAt ? "Profile erased" : p.contact?.name || p.name || "Guest",
  email: p.erasedAt ? "" : p.email || "",
  phone: p.erasedAt ? "" : p.contact?.phone || "",
  accountConnected:
    !!p.linkedUid ||
    !["host_manual", "host_recorded"].includes(p.identitySource),
  version: p.identityVersion || p.contactVersion || 0,
});
export async function customersHandler({ tx, db, ctx, input }) {
  const op = ctx.operation;
  if (op === "claimMyCustomer") return claimCustomer({ tx, db, ctx });
  if (op === "lookupCustomers") {
    const search = input.search.trim();
    if (/[\u0000-\u001f\u007f]/.test(search)) fail("INVALID_SEARCH");
    const limit = input.limit || 10;
    let rows = [];
    if (input.mode === "reference") {
      const bookings = await tx.get(
        col(db, "bookings")
          .where("reference", "==", search.toUpperCase())
          .limit(2),
      );
      if (bookings.size > 1) fail("BOOKING_REFERENCE_CONFLICT", 409);
      if (bookings.size) {
        const p = await tx.get(
          customerProfiles(db).doc(bookings.docs[0].data().owner),
        );
        if (p.exists) rows = [p];
      }
    } else {
      let query = customerProfiles(db);
      if (input.mode === "email") {
        const email = normalizedEmail(search);
        if (!validEmail(email)) fail("INVALID_EMAIL");
        query = query.where("searchEmail", "==", email);
      } else if (input.mode === "phone") {
        const phone = search.replace(/[ ()-]/g, "");
        if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) fail("INVALID_PHONE");
        query = query.where("searchPhone", "==", phone);
      } else {
        const prefix = search.normalize("NFKC").toLowerCase();
        query = query
          .where("searchName", ">=", prefix)
          .where("searchName", "<=", prefix + "\u{10ffff}")
          .orderBy("searchName");
      }
      rows = (await tx.get(query.limit(limit + 1))).docs;
    }
    const items = new Map();
    for (const d of rows) {
      const p = { ...d.data(), id: d.id };
      if (p.erasedAt) continue;
      const key = p.linkedUid || p.id;
      if (!items.has(key) || p.linkedUid) items.set(key, customerView(p));
    }
    return {
      items: [...items.values()].slice(0, limit),
      hasMore: rows.length > limit,
    };
  }
  if (op === "getCustomer") {
    const p = (await tx.get(customerProfiles(db).doc(input.id))).data();
    if (!p) fail("NOT_FOUND", 404);
    return customerView({ ...p, id: input.id });
  }
  const owner =
    op.startsWith("getMy") || op.startsWith("listMy") ? ctx.uid : input.id;
  const profile = (await tx.get(customerProfiles(db).doc(owner))).data();
  if (!profile) fail("NOT_FOUND", 404);
  const context = await customerOwnerContext(tx, db, owner, profile),
    settings = loadConfig(
      await tx.get(col(db, "booking_config").doc("site")),
    ).settings;
  if (op === "adjustCustomerCredits")
    return adjustCredits({
      tx,
      db,
      context,
      owner,
      delta: input.credits,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
      settings,
      now: ctx.now,
      entryId: randomUUID(),
    });
  if (op.endsWith("Entries"))
    return queryPage(
      tx,
      db,
      ctx,
      op + ":" + context.ownerIds.sort().join(","),
      input,
      col(db, "loyalty_entries").where("owner", "in", context.ownerIds),
      (r) => ({
        id: r.id,
        kind: r.kind,
        bookingId: r.bookingId || null,
        bookingReference: r.reference || null,
        creditsDelta: r.creditsDelta,
        reservedDelta: r.reservedDelta,
        balanceAfter: r.balanceAfter,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt || null,
        reason: r.kind === "adjustment" ? r.reason : null,
        date: r.date || null,
      }),
      { orderField: "createdAt", descending: true },
    );
  const wallets = await readWallets(tx, db, context.ownerIds, ctx.now);
  return loyaltySummary(wallets, context, settings, ctx.now);
}
