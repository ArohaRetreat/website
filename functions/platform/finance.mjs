import { randomUUID } from "node:crypto";
import {
  col,
  bounded,
  fail,
  version,
  digest,
  page,
  queryPage,
} from "./core.mjs";
import { mailSettings } from "../email/config.mjs";
import { environment } from "../environment.mjs";
import { invoiceCollection, invoiceYear } from "../email/jobs.mjs";
export const paymentView = (p) => ({
  id: p.id,
  bookingId: p.bookingId,
  kind: p.kind,
  amountPaise: p.amountPaise,
  method: p.method || null,
  receivedAt: p.receivedAt || p.createdAt,
  createdAt: p.createdAt,
  version: 1,
  ...(p.reverses ? { reverses: p.reverses } : {}),
});
export function financialSummary(booking, ledger) {
  let paid = 0;
  const originals = new Map();
  const reversed = new Set();
  for (const p of ledger.filter((p) => p.kind === "payment")) {
    if (!Number.isSafeInteger(p.amountPaise) || p.amountPaise <= 0)
      fail("FINANCIAL_RECONCILIATION_REQUIRED", 409);
    originals.set(p.id, p);
    paid += p.amountPaise;
  }
  for (const r of ledger.filter((p) => p.kind === "reversal")) {
    const p = originals.get(r.reverses);
    if (!p || reversed.has(p.id) || r.amountPaise !== p.amountPaise)
      fail("FINANCIAL_RECONCILIATION_REQUIRED", 409);
    reversed.add(p.id);
    paid -= r.amountPaise;
  }
  if (
    !Number.isSafeInteger(booking.total) ||
    booking.total < 0 ||
    !Number.isSafeInteger(paid) ||
    paid < 0 ||
    paid > booking.total
  )
    fail("FINANCIAL_RECONCILIATION_REQUIRED", 409);
  return {
    id: booking.id,
    currency: "INR",
    totalPaise: booking.total,
    paidPaise: paid,
    balanceDuePaise: booking.total - paid,
    version: booking.financialVersion || 0,
    hasOutstandingBalance: paid < booking.total,
  };
}
export const ledgerRead = (tx, db, id) =>
  bounded(tx, col(db, "booking_payments").where("bookingId", "==", id), 200);
export const documentView = (d) => ({
  id: d.id,
  bookingId: d.bookingId,
  kind: d.documentKind || "invoice",
  number: d.number,
  status: d.status,
  version: d.version || 1,
  createdAt: d.createdAt,
  currency: "INR",
  totalPaise: d.total,
  paidPaise: d.amountPaid || 0,
  balanceDuePaise: d.balanceDue,
  test: d.test === true,
});
export async function prepareDocument(
  tx,
  db,
  booking,
  summary,
  kind,
  now,
  { paymentId, paymentMethod, paymentAmount } = {},
) {
  const config = mailSettings();
  if (
    !environment.preprod &&
    (!config.issuer.address || !config.issuer.paymentInstructions)
  )
    fail("BILLING_CONFIGURATION_REQUIRED", 409);
  const profile =
    (await tx.get(col(db, "booking_profiles").doc(booking.owner))).data() || {};
  const counterRef = col(db, "financial_document_counters").doc(
      invoiceYear(now) + "-" + kind,
    ),
    counter = (await tx.get(counterRef)).data() || {};
  const id = randomUUID();
  const sequence = (counter.sequence || 0) + 1;
  const d = {
    schemaVersion: 1,
    documentTemplateVersion: "pdf-v4-financial",
    documentKind: kind,
    id,
    bookingId: booking.id,
    owner: booking.owner,
    environment: environment.name,
    number: `${config.test ? "TEST-" : ""}AR-${kind === "receipt" ? "R" : "S"}-${invoiceYear(now)}-${String(sequence).padStart(6, "0")}`,
    version: 1,
    createdAt: now,
    currency: "INR",
    reference: booking.reference || booking.id,
    kind: booking.kind || "legacy",
    arrival: booking.arrival,
    departure: booking.departure,
    startsAt: booking.startsAt || 0,
    endsAt: booking.endsAt || 0,
    guestName:
      booking.contact?.name || profile.contact?.name || profile.name || "Guest",
    guestEmail: profile.email || "",
    issuer: { ...config.issuer },
    test: config.test,
    lineItems: booking.lineItems || [
      { label: "Host-approved visit", amount: booking.total },
    ],
    subtotal: booking.subtotal ?? booking.total,
    discount: booking.discount || 0,
    total: booking.total,
    amountPaid: summary.paidPaise,
    balanceDue: summary.balanceDuePaise,
    status: "issued",
    financialVersion: summary.version,
    ...(paymentId
      ? {
          paymentId,
          paymentAmount,
          visitSummary: "Manual " + paymentMethod + " payment recorded",
        }
      : { visitSummary: "Actual checkout · outstanding balance permitted" }),
  };
  return { document: { ...d, snapshotHash: digest(d) }, counterRef, sequence };
}
export function commitDocument(tx, db, prepared, now) {
  tx.set(
    col(db, "booking_documents").doc(prepared.document.id),
    prepared.document,
  );
  tx.set(prepared.counterRef, { sequence: prepared.sequence, updatedAt: now });
}
export async function financeHandler({ tx, db, ctx, input, booking }) {
  const op = ctx.operation;
  if (op === "listDocuments") {
    return queryPage(
      tx,
      db,
      ctx,
      op + ":" + booking.id,
      input,
      [
        col(db, "booking_documents").where("bookingId", "==", booking.id),
        invoiceCollection(db).where("bookingId", "==", booking.id),
      ],
      documentView,
    );
  }
  if (op === "getDocument" || op === "downloadDocument") {
    const [current, legacy] = await Promise.all([
      tx.get(col(db, "booking_documents").doc(input.documentId)),
      tx.get(invoiceCollection(db).doc(input.documentId)),
    ]);
    const d = current.exists ? current.data() : legacy.data();
    if (!d || d.bookingId !== booking.id || d.owner !== booking.owner)
      fail("NOT_FOUND", 404);
    if (op === "downloadDocument" && ["void", "superseded"].includes(d.status))
      fail("DOCUMENT_NOT_AVAILABLE", 409);
    return op === "downloadDocument"
      ? { metadata: documentView(d), snapshot: d }
      : documentView(d);
  }
  const ledger = await ledgerRead(tx, db, booking.id),
    summary = financialSummary(booking, ledger);
  if (op === "getFinancialSummary") return summary;
  if (op === "listPayments")
    return page(
      tx,
      db,
      ctx,
      op + ":" + booking.id,
      input,
      ledger.map(paymentView),
    );
  version(summary.version, input.expectedVersion);
  if (ledger.length >= 200) fail("PAYMENT_ENTRY_LIMIT", 409);
  if (op === "recordPayment") {
    if (!["confirmed", "checked_in", "completed"].includes(booking.status))
      fail("CONFIRMED_STAY_REQUIRED", 409);
    if (input.verified !== true) fail("VERIFIED_PAYMENT_REQUIRED", 422);
    if (input.receivedAt > ctx.now || input.receivedAt < 946684800000)
      fail("INVALID_RECEIVED_AT");
    if (input.amountPaise > summary.balanceDuePaise)
      fail("PAYMENT_EXCEEDS_BALANCE", 409);
    const reference = (input.reference || "").trim();
    if (input.method !== "cash" && !reference)
      fail("PAYMENT_REFERENCE_REQUIRED");
    const proof = reference
      ? col(db, "booking_payment_proofs").doc(
          digest(input.method + ":" + reference.toUpperCase()),
        )
      : null;
    if (proof && (await tx.get(proof)).exists)
      fail("PAYMENT_ALREADY_RECORDED", 409);
    const payment = {
      id: randomUUID(),
      bookingId: booking.id,
      owner: booking.owner,
      kind: "payment",
      amountPaise: input.amountPaise,
      method: input.method,
      receivedAt: input.receivedAt,
      reference,
      verifiedBy: ctx.uid,
      createdAt: ctx.now,
      version: 1,
    };
    const next = financialSummary(
      { ...booking, financialVersion: summary.version + 1 },
      [...ledger, payment],
    );
    const prepared = await prepareDocument(
      tx,
      db,
      booking,
      next,
      "receipt",
      ctx.now,
      {
        paymentId: payment.id,
        paymentMethod: payment.method,
        paymentAmount: payment.amountPaise,
      },
    );
    payment.documentId = prepared.document.id;
    tx.set(col(db, "booking_payments").doc(payment.id), payment);
    if (proof)
      tx.set(proof, {
        bookingId: booking.id,
        paymentId: payment.id,
        createdAt: ctx.now,
      });
    tx.update(col(db, "bookings").doc(booking.id), {
      financialVersion: summary.version + 1,
      version: booking.version + 1,
    });
    commitDocument(tx, db, prepared, ctx.now);
    return {
      payment: paymentView(payment),
      summary: next,
      document: documentView(prepared.document),
    };
  }
  if (op === "reversePayment") {
    const original = ledger.find(
      (p) => p.id === input.paymentId && p.kind === "payment",
    );
    if (!original) fail("NOT_FOUND", 404);
    if (ledger.some((p) => p.reverses === original.id))
      fail("PAYMENT_ALREADY_REVERSED", 409);
    const receiptRef = original.documentId
      ? col(db, "booking_documents").doc(original.documentId)
      : null;
    const receipt = receiptRef ? await tx.get(receiptRef) : null;
    const reversal = {
      id: randomUUID(),
      bookingId: booking.id,
      owner: booking.owner,
      kind: "reversal",
      amountPaise: original.amountPaise,
      reverses: original.id,
      reason: input.reason.trim(),
      recordedBy: ctx.uid,
      createdAt: ctx.now,
      version: 1,
    };
    const next = financialSummary(
      { ...booking, financialVersion: summary.version + 1 },
      [...ledger, reversal],
    );
    tx.set(col(db, "booking_payments").doc(reversal.id), reversal);
    tx.update(col(db, "bookings").doc(booking.id), {
      financialVersion: summary.version + 1,
      version: booking.version + 1,
    });
    if (receipt?.exists)
      tx.update(receiptRef, {
        status: "void",
        voidedAt: ctx.now,
        reversalId: reversal.id,
      });
    return { payment: paymentView(reversal), summary: next };
  }
  fail("NOT_FOUND", 404);
}
