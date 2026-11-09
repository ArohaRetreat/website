import { AggregateField } from "firebase-admin/firestore";
import { addDays, todayIST } from "../booking/domain.mjs";
import { customerOwnerContext, customerProfiles } from "../booking/customers.mjs";
import { readGuestNumber } from "../booking/guest-number.mjs";
import { eligibleNightDates, loyaltySummary, readWallets } from "../booking/loyalty.mjs";
import { loadConfig } from "../booking/store.mjs";
import { invoiceCollection } from "../email/jobs.mjs";
import { customerView } from "./customers.mjs";
import { col, fail, queryPage } from "./core.mjs";
import { documentView, financialSummary, ledgerRead, paymentView } from "./finance.mjs";

export async function studioCustomer(tx, db, id) {
  const profile = (await tx.get(customerProfiles(db).doc(id))).data();
  if (!profile) fail("NOT_FOUND", 404);
  const context = await customerOwnerContext(tx, db, id, profile);
  return { profile, context, owners: context.ownerIds.slice().sort() };
}

async function currentFinancials(tx, db, booking) {
  if (!Number.isSafeInteger(booking.total)) return null;
  if (Number.isSafeInteger(booking.verifiedPaidPaise))
    return { paidPaise: booking.verifiedPaidPaise, balanceDuePaise: ["cancelled", "declined", "expired"].includes(booking.status) ? 0 : booking.total - booking.verifiedPaidPaise };
  const ledger = booking.financialVersion ? await ledgerRead(tx, db, booking.id) : [];
  return financialSummary(booking, ledger);
}

export async function studioGuest({ tx, db, ctx, input }) {
  const { profile, context, owners } = await studioCustomer(tx, db, input.id);
  const completed = col(db, "bookings").where("owner", "in", owners).where("status", "==", "completed");
  const payments = col(db, "booking_payments").where("owner", "in", owners);
  const total = (kind) => tx.get(payments.where("kind", "==", kind).aggregate({ amount: AggregateField.sum("amountPaise") }));
  const [visits, projected, paid, reversed, number, config, wallets] = await Promise.all([
    tx.get(completed.count()),
    tx.get(completed.select("kind", "arrival", "departure", "checkedInAt", "checkedOutAt").limit(201)),
    total("payment"),
    total("reversal"),
    readGuestNumber(tx, db, owners),
    tx.get(col(db, "booking_config").doc("site")),
    readWallets(tx, db, owners, ctx.now),
  ]);
  let nights = 0, missingNights = 0;
  for (const snapshot of projected.docs) {
    const booking = snapshot.data();
    if (!["private", "individual"].includes(booking.kind || "private")) continue;
    if (!booking.checkedInAt || !booking.checkedOutAt) {
      missingNights++;
      continue;
    }
    nights += eligibleNightDates({ ...booking, kind: booking.kind || "private" }, booking.checkedOutAt).length;
  }
  const loyalty = loyaltySummary(wallets, context, loadConfig(config).settings, ctx.now);
  return {
    ...customerView({ ...profile, id: input.id }),
    guestNumber: number,
    completedVisits: visits.data().count,
    recordedNights: projected.size <= 200 ? nights : null,
    nightsComplete: projected.size <= 200 && missingNights === 0,
    netVerifiedPaidPaise: paid.data().amount - reversed.data().amount,
    creditsAvailable: loyalty.creditsAvailable,
    asOf: ctx.now,
  };
}

export async function studioDocuments({ tx, db, ctx, input }) {
  const own = ctx.operation === "listMyDocuments";
  const owners = own ? ctx.ownerIds.slice().sort() : input.id ? (await studioCustomer(tx, db, input.id)).owners : null;
  const bookingCache = new Map();
  function getBooking(id) {
    if (!bookingCache.has(id))
      bookingCache.set(id, tx.get(col(db, "bookings").doc(id)).then((doc) => doc.data()));
    return bookingCache.get(id);
  }
  const financeCache = new Map();
  function getFinancials(booking) {
    if (!financeCache.has(booking.id))
      financeCache.set(booking.id, currentFinancials(tx, db, booking));
    return financeCache.get(booking.id);
  }
  const result = await queryPage(
    tx, db, ctx, ctx.operation + ":" + (owners?.join(",") || "all"), { limit: 12, ...input },
    [col(db, "booking_documents"), invoiceCollection(db)].map((collection) => owners ? collection.where("owner", "in", owners) : collection),
    async (document) => {
      const view = documentView(document);
      if (view.kind === "receipt" || view.kind === "checkout_statement")
        return { ...view, reference: document.reference, paymentPaise: document.paymentAmount ?? null };
      const booking = await getBooking(view.bookingId);
      if (!booking || booking.owner !== document.owner) return null;
      const active = booking.invoiceId === document.id;
      const current = active ? await getFinancials(booking) : null;
      const settled = active && document.status === "settled" && document.total === 0;
      if (own && !settled && !(current?.paidPaise > 0)) return null;
      return {
        ...view,
        reference: document.reference,
        paymentPaise: null,
        currentBalanceDuePaise: current?.balanceDuePaise ?? null,
      };
    },
    { orderField: "createdAt", descending: true },
  );
  return { items: result.items.filter(Boolean), nextCursor: result.nextCursor };
}

export async function studioGuestPayments({ tx, db, ctx, input }) {
  const { owners } = await studioCustomer(tx, db, input.id);
  return queryPage(
    tx, db, ctx, "studioGuestPayments:" + owners.join(","), { limit: 15, ...input },
    col(db, "booking_payments").where("owner", "in", owners),
    paymentView,
    { orderField: "createdAt", descending: true },
  );
}

export async function studioDashboard({ tx, db, ctx }) {
  const today = todayIST(ctx.now);
  const bookings = col(db, "bookings");
  const arrivals = bookings.where("status", "==", "confirmed").where("arrival", "==", today);
  const checkedIn = bookings.where("status", "==", "checked_in");
  const departures = [
    checkedIn.where("deskKind", "in", ["individual", "private"]).where("departure", "==", today),
    checkedIn.where("deskKind", "==", "day").where("arrival", "==", today),
    checkedIn.where("deskKind", "==", "event").where("departure", "==", addDays(today, 1)),
  ];
  const review = bookings.where("deskAttention", "in", ["new", "change", "offer"]).where("deskDeadline", ">", ctx.now);
  const from = addDays(today, -6);
  const start = Date.parse(from + "T00:00:00+05:30");
  const [counts, arrivalRows, departureRows, inHouseRows, paymentRows] = await Promise.all([
    Promise.all([review, arrivals, checkedIn, ...departures].map(async (query) => (await tx.get(query.count())).data().count)),
    tx.get(arrivals.limit(21)),
    Promise.all(departures.map((query) => tx.get(query.limit(6)))),
    ctx.modules.bookings === "manager" ? tx.get(checkedIn.limit(21)) : null,
    ctx.modules.bookings === "manager" ? tx.get(col(db, "booking_payments").where("createdAt", ">=", start).select("kind", "createdAt", "amountPaise").limit(101)) : null,
  ]);
  const agenda = [
    ...arrivalRows.docs.map((d) => ({ action: "arrival", booking: d.data() })),
    ...departureRows.flatMap((rows) => rows.docs.map((d) => ({ action: "departure", booking: d.data() }))),
  ].map(({ action, booking }) => ({
    id: booking.id,
    action,
    reference: booking.reference,
    kind: booking.kind || "private",
    guestName: String(booking.contact?.name || booking.guestName || "Guest").slice(0, 120),
    at: action === "arrival" ? booking.startsAt || null : booking.endsAt || null,
  })).sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity)).slice(0, 12);
  let balanceDuePaise = null;
  const balanceRows = inHouseRows ? [...arrivalRows.docs, ...inHouseRows.docs] : [];
  if (inHouseRows && balanceRows.length <= 20) {
    const summaries = await Promise.all(balanceRows.map((snapshot) => currentFinancials(tx, db, snapshot.data())));
    if (summaries.every(Boolean)) balanceDuePaise = summaries.reduce((sum, row) => sum + row.balanceDuePaise, 0);
  }
  let paymentTrend = null;
  if (paymentRows && paymentRows.size <= 100) {
    const days = new Map(Array.from({ length: 7 }, (_, i) => [addDays(from, i), 0]));
    for (const snapshot of paymentRows.docs) {
      const entry = snapshot.data();
      const day = todayIST(entry.createdAt);
      if (days.has(day)) days.set(day, days.get(day) + (entry.kind === "reversal" ? -entry.amountPaise : entry.amountPaise));
    }
    paymentTrend = [...days].map(([date, netPaise]) => ({ date, netPaise }));
  }
  return {
    today, asOf: ctx.now,
    requests: counts[0], arrivals: counts[1], inHouse: counts[2],
    departures: counts.slice(3).reduce((sum, value) => sum + value, 0),
    agenda, balanceDuePaise, paymentTrend,
  };
}
