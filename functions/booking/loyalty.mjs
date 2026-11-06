import { createHash } from "node:crypto";
import { collectionName } from "../environment.mjs";
import { BookingError, todayIST, addDays } from "./domain.mjs";
const fail = (code, status = 409) => {
  throw new BookingError(code, status);
};
const hash = (v) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const col = (db, k) => db.collection(collectionName("loyalty_" + k));
export function creditLevel(stays, settings) {
  return stays >= settings.familyAt ? 3 : stays >= settings.friendAt ? 2 : 1;
}
export function walletSnapshot(wallet, now = Date.now()) {
  const balance = wallet.balance || 0,
    holds = wallet.holds || {};
  if (
    !Number.isSafeInteger(balance) ||
    balance < 0 ||
    balance > 1e9 ||
    !Number.isSafeInteger(wallet.version || 0) ||
    Object.keys(holds).length > 50
  )
    fail("LOYALTY_RECONCILIATION_REQUIRED");
  let reserved = 0;
  for (const h of Object.values(holds)) {
    if (
      !Number.isSafeInteger(h.credits) ||
      h.credits <= 0 ||
      !Number.isSafeInteger(h.expiresAt)
    )
      fail("LOYALTY_RECONCILIATION_REQUIRED");
    if (h.expiresAt > now) reserved += h.credits;
  }
  if (!Number.isSafeInteger(reserved) || reserved > balance)
    fail("LOYALTY_RECONCILIATION_REQUIRED");
  return {
    balance,
    reserved,
    available: balance - reserved,
    version: wallet.version || 0,
  };
}
export async function readWallets(tx, db, ownerIds, now) {
  const result = new Map();
  for (const owner of [...new Set(ownerIds)].sort()) {
    const ref = col(db, "wallets").doc(owner),
      row = (await tx.get(ref)).data() || {
        owner,
        balance: 0,
        version: 0,
        holds: {},
      };
    walletSnapshot(row, now);
    result.set(owner, {
      ref,
      row: { ...structuredClone(row), holds: structuredClone(row.holds || {}) },
    });
  }
  return result;
}
export function loyaltySummary(wallets, context, settings, now) {
  const totals = [...wallets.values()].reduce(
    (a, { row }) => {
      const w = walletSnapshot(row, now);
      for (const k of ["balance", "reserved", "available", "version"])
        a[k] += w[k];
      return a;
    },
    { balance: 0, reserved: 0, available: 0, version: 0 },
  );
  const level = creditLevel(context.completedStays, settings);
  return {
    id: context.ownerIds[0],
    currency: "INR",
    creditsBalance: totals.balance,
    creditsReserved: totals.reserved,
    creditsAvailable: totals.available,
    availableValuePaise: totals.available * 100,
    version: totals.version,
    level,
    name: ["Visitor", "Friend", "Family"][level - 1],
    earnCreditsPerNight: level * 100,
    completedStays: context.completedStays,
    nextLevelAt:
      level === 3 ? null : level === 2 ? settings.familyAt : settings.friendAt,
    creditValuePaise: 100,
  };
}
export function eligibleNightDates(booking, checkoutAt) {
  if (
    !["individual", "private"].includes(booking.kind) ||
    !Number.isSafeInteger(booking.checkedInAt) ||
    booking.checkedInAt >= checkoutAt
  )
    return [];
  const from = [booking.arrival, todayIST(booking.checkedInAt)].sort().at(-1),
    until = [booking.departure, todayIST(checkoutAt)].sort()[0],
    rows = [];
  for (let d = from; d < until; d = addDays(d, 1)) {
    if (rows.length >= 31) fail("LOYALTY_RECONCILIATION_REQUIRED");
    rows.push(d);
  }
  return rows;
}
export async function prepareLoyalty(
  tx,
  db,
  { context, owner, target, operation, input, settings, now },
) {
  const wallets = await readWallets(tx, db, context.ownerIds, now),
    summary = loyaltySummary(wallets, context, settings, now),
    nightRows = [];
  if (
    operation === "booking-action" &&
    input.action === "complete" &&
    target?.status === "checked_in"
  ) {
    for (const date of eligibleNightDates(target, now)) {
      const refs = context.ownerIds.map((id) =>
          col(db, "nights").doc(hash([id, date])),
        ),
        snaps = await tx.getAll(...refs);
      if (!snaps.some((d) => d.exists))
        nightRows.push({
          date,
          ref: col(db, "nights").doc(hash([owner, date])),
        });
    }
  }
  return { wallets, summary, nightRows, owner, context, now };
}
export function commitLoyalty(
  tx,
  db,
  prepared,
  { booking, previous, operation, input, manual = false },
) {
  const { wallets, owner, now } = prepared,
    dirty = new Set();
  for (const [id, w] of wallets)
    for (const [bookingId, h] of Object.entries(w.row.holds || {}))
      if (h.expiresAt <= now) {
        delete w.row.holds[bookingId];
        w.row.version++;
        w.row.updatedAt = now;
        dirty.add(id);
        const entryId = hash(["expiry", bookingId, id]);
        tx.create(col(db, "entries").doc(entryId), {
          id: entryId,
          owner: id,
          bookingId,
          kind: "expired_release",
          creditsDelta: 0,
          reservedDelta: -h.credits,
          balanceAfter: w.row.balance,
          createdAt: now,
          expiresAt: h.expiresAt,
          version: 1,
        });
      }
  const journal = (id, kind, creditsDelta, reservedDelta, extra = {}) => {
    const w = wallets.get(id);
    if (!w) fail("LOYALTY_RECONCILIATION_REQUIRED");
    dirty.add(id);
    w.row.version = (w.row.version || 0) + 1;
    w.row.updatedAt = now;
    walletSnapshot(w.row, now);
    const entryId = hash([booking.id, kind, id, extra.date || ""]);
    tx.create(col(db, "entries").doc(entryId), {
      id: entryId,
      owner: id,
      bookingId: booking.id,
      reference: booking.reference,
      kind,
      creditsDelta,
      reservedDelta,
      balanceAfter: w.row.balance,
      createdAt: now,
      version: 1,
      ...extra,
    });
  };
  const credits = booking.loyaltyCredits || 0;
  if (
    previous?.loyaltyRedemptionState &&
    credits &&
    ["reserved", "redeemed"].includes(previous.loyaltyRedemptionState)
  ) {
    const allocations = previous.loyaltyAllocations || [];
    if (
      !allocations.length ||
      allocations.some(
        (a) =>
          !Number.isSafeInteger(a.credits) ||
          a.credits <= 0 ||
          !wallets.has(a.owner),
      ) ||
      allocations.reduce((n, a) => n + a.credits, 0) !== credits
    )
      fail("LOYALTY_RECONCILIATION_REQUIRED");
  }
  if (operation === "create" && credits) {
    let remaining = credits;
    const allocations = [];
    for (const [id, w] of wallets) {
      const amount = Math.min(remaining, walletSnapshot(w.row, now).available);
      if (!amount) continue;
      if (manual) {
        w.row.balance -= amount;
        journal(id, "redeem", -amount, 0);
      } else {
        w.row.holds[booking.id] = {
          credits: amount,
          expiresAt: booking.expiresAt,
          createdAt: now,
        };
        journal(id, "hold", 0, amount, { expiresAt: booking.expiresAt });
      }
      allocations.push({ owner: id, credits: amount });
      remaining -= amount;
    }
    if (remaining) fail("INSUFFICIENT_LOYALTY_CREDITS");
    booking.loyaltyAllocations = allocations;
    booking.loyaltyRedemptionState = manual ? "redeemed" : "reserved";
  }
  if (
    operation === "booking-action" &&
    input.action === "approve" &&
    credits &&
    previous?.loyaltyRedemptionState === "reserved"
  ) {
    for (const a of previous.loyaltyAllocations || []) {
      const w = wallets.get(a.owner),
        hold = w?.row.holds?.[booking.id];
      if (
        !hold ||
        hold.credits !== a.credits ||
        hold.expiresAt <= now ||
        w.row.balance < a.credits
      )
        fail("LOYALTY_RECONCILIATION_REQUIRED");
      delete w.row.holds[booking.id];
      w.row.balance -= a.credits;
      journal(a.owner, "redeem", -a.credits, -a.credits);
    }
    booking.loyaltyRedemptionState = "redeemed";
  }
  if (
    operation === "booking-action" &&
    ["cancel", "decline"].includes(input.action) &&
    credits &&
    ["reserved", "redeemed"].includes(previous?.loyaltyRedemptionState)
  ) {
    for (const a of previous.loyaltyAllocations || []) {
      const w = wallets.get(a.owner);
      if (!w) fail("LOYALTY_RECONCILIATION_REQUIRED");
      if (previous.loyaltyRedemptionState === "redeemed") {
        w.row.balance += a.credits;
        journal(a.owner, "restore", a.credits, 0);
      } else {
        const held = w.row.holds?.[booking.id];
        delete w.row.holds[booking.id];
        journal(a.owner, "release", 0, held?.expiresAt > now ? -a.credits : 0);
      }
    }
    booking.loyaltyRedemptionState = "released";
  }
  if (operation === "booking-action" && input.action === "checkin")
    booking.loyaltyEarnRate = prepared.summary.earnCreditsPerNight;
  if (
    operation === "booking-action" &&
    input.action === "complete" &&
    prepared.nightRows.length
  ) {
    const rate =
      previous.loyaltyEarnRate || prepared.summary.earnCreditsPerNight;
    if (![100, 200, 300].includes(rate))
      fail("LOYALTY_RECONCILIATION_REQUIRED");
    const w = wallets.get(owner);
    if (!w) fail("LOYALTY_RECONCILIATION_REQUIRED");
    for (const n of prepared.nightRows) {
      w.row.balance += rate;
      journal(owner, "earn", rate, 0, { date: n.date, rate });
      tx.create(n.ref, {
        owner,
        bookingId: booking.id,
        date: n.date,
        credits: rate,
        createdAt: now,
      });
    }
    booking.loyaltyEarnedCredits = prepared.nightRows.length * rate;
    booking.loyaltyEarnedNights = prepared.nightRows.length;
  }
  for (const id of dirty) {
    const w = wallets.get(id);
    tx.set(w.ref, w.row);
  }
}
export async function adjustCredits({
  tx,
  db,
  context,
  owner,
  delta,
  reason,
  expectedVersion,
  settings,
  now,
  entryId,
}) {
  const wallets = await readWallets(tx, db, context.ownerIds, now),
    summary = loyaltySummary(wallets, context, settings, now);
  if (expectedVersion !== summary.version) fail("VERSION_CONFLICT");
  if (
    !Number.isSafeInteger(delta) ||
    !delta ||
    Math.abs(delta) > 1e6 ||
    typeof reason !== "string" ||
    reason.trim().length < 5 ||
    reason.length > 200
  )
    fail("INVALID_LOYALTY_ADJUSTMENT", 422);
  if (delta < 0 && -delta > summary.creditsAvailable)
    fail("INSUFFICIENT_LOYALTY_CREDITS");
  let remaining = Math.abs(delta);
  for (const [id, w] of wallets) {
    if (delta > 0 && id !== owner) continue;
    const amount =
      delta > 0
        ? remaining
        : Math.min(remaining, walletSnapshot(w.row, now).available);
    if (!amount) continue;
    const change = delta > 0 ? amount : -amount;
    w.row.balance += change;
    w.row.version++;
    w.row.updatedAt = now;
    walletSnapshot(w.row, now);
    tx.set(w.ref, w.row);
    tx.create(col(db, "entries").doc(hash([entryId, id])), {
      id: hash([entryId, id]),
      owner: id,
      kind: "adjustment",
      creditsDelta: change,
      reservedDelta: 0,
      balanceAfter: w.row.balance,
      reason: reason.trim(),
      createdAt: now,
      version: 1,
    });
    remaining -= amount;
    if (!remaining) break;
  }
  if (remaining) fail("LOYALTY_RECONCILIATION_REQUIRED");
  return loyaltySummary(wallets, context, settings, now);
}
