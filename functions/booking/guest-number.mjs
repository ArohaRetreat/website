import { collectionName, environment } from "../environment.mjs";
import { BookingError } from "./domain.mjs";

const numbers = (db) => db.collection(collectionName("booking_guest_numbers"));
export async function readGuestNumber(tx, db, ownerIds) {
  const snapshots = await tx.getAll(...ownerIds.map((id) => numbers(db).doc(id)));
  const found = [...new Set(snapshots.map((s) => s.data()?.number).filter(Number.isSafeInteger))];
  if (found.length > 1) throw new BookingError("GUEST_NUMBER_REVIEW_REQUIRED", 409);
  return found[0] ?? null;
}

// Must run after all reads except these and before any transaction writes.
export async function assignGuestNumber(tx, db, ownerIds, canonicalId, now) {
  const existing = await readGuestNumber(tx, db, ownerIds);
  if (existing !== null) return existing;
  const ref = db.collection(collectionName("booking_guest_counters")).doc("sequence");
  const sequence = (await tx.get(ref)).data();
  if (!environment.preprod && !sequence?.firstGuestSeeded) return null;
  const last = sequence?.last ?? 0;
  const minimum = environment.preprod ? 0 : 1;
  if (!Number.isSafeInteger(last) || last < minimum || last >= Number.MAX_SAFE_INTEGER)
    throw new BookingError("GUEST_NUMBER_REVIEW_REQUIRED", 409);
  const number = last + 1;
  tx.create(numbers(db).doc(canonicalId), { number, firstCheckInAt: now });
  tx.set(ref, { last: number }, { merge: true });
  return number;
}
