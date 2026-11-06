import { createHash, randomUUID } from "node:crypto";
import { BookingError } from "../booking/domain.mjs";
import {
  environment,
  collectionName,
  sharedCollectionName,
} from "../environment.mjs";
import { studioAccess } from "../access.mjs";
import { can } from "../domain.mjs";
import { guardIntegrationTransaction } from "../external/access.mjs";
import { bookingEvent, queueCommitted } from "../booking/observability.mjs";
export const fail = (code, status = 422) => {
  throw new BookingError(code, status);
};
export const stable = (v) =>
  v && typeof v === "object"
    ? Array.isArray(v)
      ? v.map(stable)
      : Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, stable(v[k])]),
        )
    : v;
export const digest = (v) =>
  createHash("sha256")
    .update(typeof v === "string" ? v : JSON.stringify(stable(v)))
    .digest("hex");
export const col = (db, name) => db.collection(collectionName(name));
export const version = (actual, expected) => {
  if (!Number.isSafeInteger(expected) || expected < 0)
    fail("PRECONDITION_REQUIRED", 428);
  if (actual !== expected) fail("VERSION_CONFLICT", 409);
};
export function validate(schema, value) {
  if (schema.anyOf) {
    if (
      !schema.anyOf.some((s) => {
        try {
          validate(s, value);
          return true;
        } catch {
          return false;
        }
      })
    )
      fail("INVALID_FIELD_VALUE");
    return;
  }
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (
    !types.some((t) =>
      t === "null"
        ? value === null
        : t === "array"
          ? Array.isArray(value)
          : t === "object"
            ? value && typeof value === "object" && !Array.isArray(value)
            : t === "integer"
              ? Number.isSafeInteger(value)
              : typeof value === t,
    )
  )
    fail("INVALID_FIELD_TYPE");
  if (value === null) return;
  if (schema.enum && !schema.enum.includes(value)) fail("INVALID_FIELD_VALUE");
  if (
    typeof value === "string" &&
    (value.trim().length < (schema.minLength ?? 0) ||
      value.length > (schema.maxLength ?? 10000) ||
      (schema.pattern && !new RegExp(schema.pattern).test(value)))
  )
    fail("INVALID_FIELD_VALUE");
  if (
    schema.format === "date" &&
    (Number.isNaN(Date.parse(value + "T00:00:00Z")) ||
      new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value)
  )
    fail("INVALID_DATE");
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) ||
      value < (schema.minimum ?? -Number.MAX_SAFE_INTEGER) ||
      value > (schema.maximum ?? Number.MAX_SAFE_INTEGER))
  )
    fail("INVALID_FIELD_VALUE");
  if (Array.isArray(value)) {
    if (
      value.length < (schema.minItems ?? 0) ||
      value.length > (schema.maxItems ?? 200) ||
      (schema.uniqueItems &&
        new Set(value.map((x) => JSON.stringify(x))).size !== value.length)
    )
      fail("INVALID_ARRAY");
    for (const v of value) validate(schema.items, v);
  }
  if (types.includes("object")) {
    if ((schema.required || []).some((k) => !(k in value)))
      fail("INVALID_FIELDS");
    for (const [k, v] of Object.entries(value)) {
      if (!schema.properties?.[k]) {
        if (schema.additionalProperties === false) fail("INVALID_FIELDS");
        continue;
      }
      validate(schema.properties[k], v);
    }
  }
}
export async function principal(tx, db, token) {
  if (
    token.email_verified !== true ||
    token.firebase?.sign_in_provider !== "google.com"
  )
    fail("VERIFIED_GOOGLE_ACCOUNT_REQUIRED", 403);
  await guardIntegrationTransaction(tx, db, token);
  const m = (
    await tx.get(db.collection(sharedCollectionName("members")).doc(token.uid))
  ).data();
  return {
    token,
    uid: token.uid,
    member: m,
    modules: studioAccess(m),
    all: !token._integration || token._integration.rowAccess === "all",
  };
}
export function permit(ctx, policy, booking) {
  if (policy === "booking-owner-or-manager") {
    if (!booking) fail("NOT_FOUND", 404);
    if (
      booking.owner !== ctx.uid &&
      (!ctx.all || ctx.modules.bookings !== "manager")
    )
      fail("NOT_FOUND", 404);
    return;
  }
  if (policy === "owner") {
    if (!booking || booking.owner !== ctx.uid) fail("NOT_FOUND", 404);
    return;
  }
  if (policy === "feedback-reader") {
    if (!booking) fail("NOT_FOUND", 404);
    if (
      booking.owner !== ctx.uid &&
      (!ctx.all || ctx.modules.bookings !== "manager")
    )
      fail("NOT_FOUND", 404);
    return;
  }
  if (policy === "booking-viewer") {
    if (!booking) fail("NOT_FOUND", 404);
    if (
      booking.owner !== ctx.uid &&
      (!ctx.all || ctx.modules.bookings === "none")
    )
      fail("NOT_FOUND", 404);
    return;
  }
  if (policy === "booking-manager") {
    if (!ctx.all || ctx.modules.bookings !== "manager") fail("FORBIDDEN", 403);
    if (booking === null) fail("NOT_FOUND", 404);
    return;
  }
  if (policy === "booking-staff") {
    if (!ctx.all || ctx.modules.bookings === "none") fail("FORBIDDEN", 403);
    return;
  }
  if (policy?.startsWith("website-")) {
    const operation = {
      "website-read": "read",
      "website-edit": "edit",
      "website-publish": "publish",
    }[policy];
    if (!ctx.all || !ctx.modules.website || !can(ctx.member?.role, operation))
      fail("FORBIDDEN", 403);
    return;
  }
  if (policy === "access" || policy === "superadmin") {
    if (
      !ctx.all ||
      !ctx.modules.access ||
      (policy === "superadmin" && ctx.member?.role !== "superadmin")
    )
      fail("FORBIDDEN", 403);
    return;
  }
  if (policy !== "self") fail("FORBIDDEN", 403);
}
export function audit(tx, db, ctx, operation, entity, now = Date.now()) {
  tx.set(col(db, "audit").doc(), {
    schemaVersion: 1,
    operation,
    entity,
    actor: ctx.uid,
    grantId: ctx.token._integration?.id ?? null,
    environment: environment.name,
    at: now,
  });
}
export async function transaction(
  db,
  token,
  definition,
  input,
  key,
  handler,
  { requestId } = {},
) {
  validate(definition.input, input);
  const isRead = definition.method === "GET";
  if (!isRead && !/^[A-Za-z0-9-]{8,100}$/.test(key || ""))
    fail("IDEMPOTENCY_KEY_REQUIRED", 400);
  const requestRef = isRead
    ? null
    : col(db, "platform_requests").doc(
        digest(
          token.uid +
            ":" +
            (token._integration?.id || "interactive") +
            ":" +
            key,
        ),
      );
  const hash = digest({ operation: definition.operationId, input });
  return db.runTransaction(async (tx) => {
    const ctx = await principal(tx, db, token);
    ctx.now = Date.now();
    ctx.requestId = requestId;
    ctx.operation = definition.operationId;
    const booking = definition.booking
      ? ((await tx.get(col(db, "bookings").doc(input.id))).data() ?? null)
      : undefined;
    permit(ctx, definition.policy, booking);
    const prior = requestRef ? await tx.get(requestRef) : null;
    if (prior?.exists) {
      if (prior.data().hash !== hash) fail("IDEMPOTENCY_CONFLICT", 409);
      return prior.data().result;
    }
    const result = await handler({ tx, db, ctx, input, booking });
    audit(
      tx,
      db,
      ctx,
      (isRead ? "platform.read." : "platform.") + definition.operationId,
      input.id || input.clientId || ctx.uid,
      ctx.now,
    );
    if (!isRead) {
      tx.set(requestRef, {
        owner: ctx.uid,
        grantId: token._integration?.id ?? null,
        hash,
        result,
        createdAt: ctx.now,
        expireAt: new Date(ctx.now + 90 * 86400000),
      });
      queueCommitted(
        tx,
        db,
        bookingEvent({
          id: requestRef.id,
          type: definition.event || "platform." + definition.operationId,
          authority: "server-confirmed",
          actor: ctx.uid,
          requestId,
          transactionId: requestRef.id,
          entity: input.id,
          outcome: "succeeded",
          at: ctx.now,
        }),
      );
    }
    return result;
  });
}
export async function bounded(tx, query, max = 200) {
  const s = await tx.get(query.limit(max + 1));
  if (s.size > max) fail("RECONCILIATION_REQUIRED", 409);
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function page(tx, db, ctx, view, input, items) {
  const limit = input.limit ?? 25;
  let after = null;
  if (input.cursor) {
    const c = (
      await tx.get(col(db, "platform_cursors").doc(input.cursor))
    ).data();
    if (
      !c ||
      c.owner !== ctx.uid ||
      c.grantId !== (ctx.token._integration?.id ?? null) ||
      c.grantVersion !== (ctx.token._integration?.version ?? 0) ||
      c.view !== view ||
      c.limit !== limit
    )
      fail("INVALID_CURSOR");
    if (c.expiresAt <= ctx.now) fail("CURSOR_EXPIRED", 410);
    after = c.last;
  }
  const sorted = items
    .slice()
    .sort(
      (a, b) =>
        (b.createdAt ?? b.at ?? 0) - (a.createdAt ?? a.at ?? 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  const start = after ? sorted.findIndex((x) => x.id === after) + 1 : 0;
  if (after && !start) fail("INVALID_CURSOR");
  const selected = sorted.slice(start, start + limit);
  let nextCursor = null;
  if (start + limit < sorted.length) {
    nextCursor = randomUUID();
    tx.set(col(db, "platform_cursors").doc(nextCursor), {
      owner: ctx.uid,
      grantId: ctx.token._integration?.id ?? null,
      grantVersion: ctx.token._integration?.version ?? 0,
      view,
      limit,
      last: selected.at(-1).id,
      expiresAt: ctx.now + 900000,
      expireAt: new Date(ctx.now + 900000),
    });
  }
  return { items: selected, nextCursor };
}
// Stable document-id pagination also covers historical audit records without createdAt.
export async function queryPage(
  tx,
  db,
  ctx,
  view,
  input,
  queries,
  projector = (x) => x,
  { orderField, descending = false } = {},
) {
  const limit = input.limit ?? 25;
  let after = null;
  if (input.cursor) {
    const c = (
      await tx.get(col(db, "platform_cursors").doc(input.cursor))
    ).data();
    if (
      !c ||
      c.owner !== ctx.uid ||
      c.grantId !== (ctx.token._integration?.id ?? null) ||
      c.grantVersion !== (ctx.token._integration?.version ?? 0) ||
      c.view !== view ||
      c.limit !== limit
    )
      fail("INVALID_CURSOR");
    if (c.expiresAt <= ctx.now) fail("CURSOR_EXPIRED", 410);
    after = c.last;
  }
  const snapshots = await Promise.all(
    (Array.isArray(queries) ? queries : [queries]).map((q) =>
      tx.get(
        (() => {
          let ordered = orderField
            ? q
                .orderBy(orderField, descending ? "desc" : "asc")
                .orderBy("__name__", descending ? "desc" : "asc")
            : q.orderBy("__name__");
          if (after)
            ordered = orderField
              ? ordered.startAfter(after.value, after.id)
              : ordered.startAfter(after);
          return ordered.limit(limit + 1);
        })(),
      ),
    ),
  );
  const docs = [
    ...new Map(snapshots.flatMap((s) => s.docs).map((d) => [d.id, d])).values(),
  ].sort((a, b) => {
    if (orderField && a.data()[orderField] !== b.data()[orderField])
      return (
        (a.data()[orderField] - b.data()[orderField]) * (descending ? -1 : 1)
      );
    return (
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) *
      (orderField && descending ? -1 : 1)
    );
  });
  const selected = docs.slice(0, limit);
  let nextCursor = null;
  if (docs.length > limit) {
    nextCursor = randomUUID();
    tx.set(col(db, "platform_cursors").doc(nextCursor), {
      owner: ctx.uid,
      grantId: ctx.token._integration?.id ?? null,
      grantVersion: ctx.token._integration?.version ?? 0,
      view,
      limit,
      last: orderField
        ? { id: selected.at(-1).id, value: selected.at(-1).data()[orderField] }
        : selected.at(-1).id,
      expiresAt: ctx.now + 900000,
      expireAt: new Date(ctx.now + 900000),
    });
  }
  return {
    items: selected.map((d) => projector({ id: d.id, ...d.data() })),
    nextCursor,
  };
}
