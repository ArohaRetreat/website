import { randomUUID } from "node:crypto";
import { col, bounded, fail, version, page, queryPage } from "./core.mjs";
export async function profileHandler({ tx, db, ctx, input }) {
  const op = ctx.operation;
  if (op === "getOperation" || op === "getMyErasureRequest") {
    const d = (
      await tx.get(col(db, "platform_operations").doc(input.id))
    ).data();
    if (
      !d ||
      d.owner !== ctx.uid ||
      (ctx.token._integration && d.grantId !== ctx.token._integration.id)
    )
      fail("NOT_FOUND", 404);
    return {
      id: d.id,
      type: d.type,
      status: d.status,
      createdAt: d.createdAt,
      completedAt: d.completedAt,
      retained: d.retained,
    };
  }
  const ref = col(db, "booking_profiles").doc(ctx.uid),
    profile = (await tx.get(ref)).data() || {};
  version(profile.contactVersion || 0, input.expectedVersion);
  const active = await bounded(
    tx,
    col(db, "bookings")
      .where("owner", "in", ctx.ownerIds || [ctx.uid])
      .where("status", "in", ["pending_approval", "confirmed", "checked_in"]),
  );
  if (
    active.some(
      (b) =>
        ["confirmed", "checked_in"].includes(b.status) ||
        (b.status === "pending_approval" && b.expiresAt > ctx.now),
    )
  )
    fail("ACTIVE_RESERVATIONS_RETAIN_PROFILE", 409);
  const related = [];
  for (const owner of (ctx.ownerIds || [ctx.uid]).filter(
    (id) => id !== ctx.uid,
  )) {
    const ref = col(db, "booking_profiles").doc(owner);
    related.push({ ref, profile: (await tx.get(ref)).data() || {}, id: owner });
  }
  const id = randomUUID(),
    operation = {
      id,
      owner: ctx.uid,
      grantId: ctx.token._integration?.id ?? null,
      type: "profile_erasure",
      status: "completed",
      createdAt: ctx.now,
      completedAt: ctx.now,
      retained: [
        "reservation_history",
        "financial_documents",
        "operational_communications",
        "minimal_audit_and_counters",
        "loyalty_ledger_and_account_binding",
      ],
    };
  // A tombstone prevents ordinary sign-in/state reads from silently recreating profile PII.
  const retain = (p) =>
    Object.fromEntries(
      [
        "createdAt",
        "schemaVersion",
        "completedStays",
        "linkedUid",
        "identitySource",
        "identityVersion",
      ]
        .filter((k) => p[k] !== undefined)
        .map((k) => [k, p[k]]),
    );
  for (const row of related)
    tx.set(row.ref, {
      ...retain(row.profile),
      id: row.id,
      contactVersion: (row.profile.contactVersion || 0) + 1,
      erasedAt: ctx.now,
      updatedAt: ctx.now,
    });
  const retained = Object.fromEntries(
    ["createdAt", "schemaVersion", "completedStays"]
      .filter((k) => profile[k] !== undefined)
      .map((k) => [k, profile[k]]),
  );
  tx.set(ref, {
    ...retained,
    id: ctx.uid,
    contactVersion: (profile.contactVersion || 0) + 1,
    erasedAt: ctx.now,
    updatedAt: ctx.now,
  });
  tx.set(col(db, "platform_operations").doc(id), operation);
  return {
    id,
    type: operation.type,
    status: operation.status,
    createdAt: ctx.now,
    completedAt: ctx.now,
    retained: operation.retained,
    version: (profile.contactVersion || 0) + 1,
  };
}
export async function auditHandler({ tx, db, ctx, input }) {
  return queryPage(
    tx,
    db,
    ctx,
    "audit",
    input,
    [col(db, "audit"), col(db, "booking_audit")],
    (r) => ({
      id: r.id,
      operation: r.operation || r.type || "unknown",
      entity: r.entity || null,
      actor: r.actor || null,
      createdAt: r.at || r.occurredAt?.toMillis?.() || 0,
    }),
  );
}
