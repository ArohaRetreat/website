import { mailSettings } from "../email/config.mjs";
import {
  queueNotifications,
  invoiceSnapshot,
  invoiceYear,
  invoiceCollection,
} from "../email/jobs.mjs";
import {
  collectionName,
  sharedCollectionName,
  environment,
} from "../environment.mjs";
import { bookingEvent, queueCommitted } from "./observability.mjs";
import { studioAccess } from "../access.mjs";
import { contactDetails, ownContact, withoutContact } from "./contact.mjs";
import {
  availabilityCalendar,
  calendarWindow,
  productDefaults,
  reservesCapacity,
  bookingOnDate,
  calendarSummary,
} from "./products.mjs";
import { createHash, randomUUID } from "node:crypto";
import {
  initialState,
  mutate,
  availability,
  tier,
  occupies,
  addDays,
  todayIST,
  BookingError,
} from "./domain.mjs";
import { readFileSync } from "node:fs";
const schemas = JSON.parse(
  readFileSync(new URL("./contract.json", import.meta.url), "utf8"),
);
const fail = (code, status = 422) => {
  throw new BookingError(code, status);
};
const stable = (v) =>
  v && typeof v === "object"
    ? Array.isArray(v)
      ? v.map(stable)
      : Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, stable(v[k])]),
        )
    : v;
const hash = (v) => createHash("sha256").update(v).digest("hex");
const collection = (db, name) =>
  db.collection(collectionName("booking_" + name));
const reservations = (db) => db.collection(collectionName("bookings"));
const dates = (arrival, departure) => {
  if (
    typeof arrival !== "string" ||
    typeof departure !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(arrival) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(departure)
  )
    fail("INVALID_DATE");
  if (
    !Number.isFinite(Date.parse(arrival)) ||
    !Number.isFinite(Date.parse(departure)) ||
    departure <= arrival ||
    Date.parse(departure) - Date.parse(arrival) > 31 * 86400000
  )
    fail("INVALID_STAY_DATES");
  const rows = [];
  for (let d = addDays(arrival, -1); d <= departure; d = addDays(d, 1))
    rows.push(d);
  return rows;
};
function validate(schema, value) {
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail("INVALID_BODY", 400);
    if (
      (schema.required || []).some((k) => !(k in value)) ||
      Object.keys(value).some((k) => !schema.properties[k])
    )
      fail("INVALID_FIELDS");
    for (const [k, v] of Object.entries(value))
      validate(schema.properties[k], v);
  } else if (schema.type === "array") {
    if (
      !Array.isArray(value) ||
      value.length < (schema.minItems || 0) ||
      value.length > (schema.maxItems || 100) ||
      (schema.uniqueItems && new Set(value).size !== value.length)
    )
      fail("INVALID_ARRAY");
    value.forEach((v) => validate(schema.items, v));
  } else {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (
      !types.some((t) =>
        t === "null"
          ? value === null
          : t === "integer"
            ? Number.isInteger(value)
            : typeof value === t,
      )
    )
      fail("INVALID_FIELD_TYPE");
    if (value === null) return;
    if (
      (schema.minimum !== undefined && value < schema.minimum) ||
      (schema.maximum !== undefined && value > schema.maximum) ||
      (schema.maxLength && value.length > schema.maxLength) ||
      (schema.enum && !schema.enum.includes(value)) ||
      (schema.pattern && !new RegExp(schema.pattern).test(value))
    )
      fail("INVALID_FIELD_VALUE");
  }
}
const effective = (b, now) =>
  b.status === "pending_approval" && b.expiresAt <= now
    ? { ...b, status: "expired" }
    : b;
const guardMember = (m, write = false) =>
  m.exists &&
  (write
    ? studioAccess(m.data()).bookings === "manager"
    : studioAccess(m.data()).bookings !== "none");
const pickConfig = (s) => ({
  schemaVersion: 1,
  settings: s.settings,
  units: s.units,
  promos: s.promos,
  blocks: s.blocks,
});
const loadConfig = (snap) => {
  const initial = initialState(),
    stored = snap.exists ? snap.data() : {};
  return {
    ...initial,
    ...stored,
    settings: {
      ...initial.settings,
      ...stored.settings,
      products: { ...productDefaults, ...stored.settings?.products },
    },
  };
};
const project = (s, actor, profile, bookings, extra = {}) => ({
  actor,
  settings: s.settings,
  units: s.units,
  bookings: bookings.map(withoutContact),
  profile: actor ? ownContact(profile) : null,
  loyalty: actor
    ? {
        ...tier(
          { ...s, stats: { [actor.id]: profile.completedStays || 0 } },
          actor.id,
        ),
      }
    : null,
  promos: actor?.role === "host" ? s.promos : [],
  users: [],
  blocks: actor?.role === "host" ? s.blocks : [],
  audit: [],
  delivery: mailSettings().enabled ? "email_enabled" : "not_configured",
  environment: environment.name,
  apiVersion: "0.8.0",
  ...extra,
});
export async function publicBookingState(db) {
  const snap = await collection(db, "config").doc("site").get();
  return project(loadConfig(snap), null, {}, []);
}
export async function publicBookingCalendar(db, input) {
  validate(schemas.calendar, input);
  const now = Date.now(), range = calendarWindow(input, now);
  return db.runTransaction(async tx => {
    const refs = [];
    for(let d=range.start;d<=range.end;d=addDays(d,1)) refs.push(collection(db,"days").doc(d));
    if(refs.length>96) fail("CALENDAR_LIMIT");
    const [config, ledgers, overdue] = await Promise.all([
      tx.get(collection(db,"config").doc("site")),
      tx.getAll(...refs),
      tx.get(reservations(db).where("status","==","checked_in").where("departure","<=",todayIST(now)).limit(201)),
    ]);
    if(overdue.size>200) fail("RECONCILIATION_REQUIRED",409);
    const state=loadConfig(config), rows=new Map();
    for(const ledger of ledgers) for(const b of Object.values(ledger.data()?.entries||{})) rows.set(b.id,b);
    for(const b of overdue.docs) rows.set(b.id,b.data());
    state.bookings=[...rows.values()];
    return availabilityCalendar(state,input,now);
  });
}
export async function bookingState(
  db,
  token,
  { admin = false, start = todayIST(), cursor } = {},
) {
  const configRef = collection(db, "config").doc("site"),
    profileRef = collection(db, "profiles").doc(token.uid),
    memberRef = db.collection(sharedCollectionName("members")).doc(token.uid);
  const { s, profile, actor } = await db.runTransaction(async (tx) => {
    const [cs, ms, ps] = await Promise.all([
      tx.get(configRef),
      tx.get(memberRef),
      tx.get(profileRef),
    ]);
    if (admin && !guardMember(ms)) fail("FORBIDDEN", 403);
    const actor = {
      id: token.uid,
      name: String(token.name || "Guest").slice(0, 80),
      role: admin ? "host" : "guest",
      ...(admin ? { bookingAccess: studioAccess(ms.data()).bookings } : {}),
    };
    const profile = ps.exists
      ? ps.data()
      : {
          id: token.uid,
          name: actor.name,
          email: String(token.email || "").slice(0, 254),
          completedStays: 0,
          activeIds: [],
          createdAt: Date.now(),
        };
    const email = String(token.email || "").slice(0, 254);
    if (!ps.exists || profile.name !== actor.name || profile.email !== email) {
      profile.name = actor.name;
      profile.email = email;
      tx.set(profileRef, profile);
    }
    return { s: loadConfig(cs), profile, actor };
  });
  const now = Date.now(),
    col = reservations(db);
  let query = admin ? col : col.where("owner", "==", token.uid);
  query = query
    .orderBy("createdAt", "desc")
    .orderBy("__name__", "desc")
    .limit(26);
  if (cursor) {
    if (typeof cursor !== "string" || !/^[-a-z0-9]{36}$/.test(cursor))
      fail("INVALID_CURSOR");
    const cs = await collection(db, "cursors").doc(cursor).get(),
      c = cs.data();
    if (
      !cs.exists ||
      c.owner !== token.uid ||
      c.admin !== admin ||
      c.expiresAt < now
    )
      fail("INVALID_CURSOR");
    query = query.startAfter(c.createdAt, c.id);
  }
  const result = await query.get(),
    page = result.docs.slice(0, 25),
    all = new Map(page.map((d) => [d.id, effective(d.data(), now)]));
  let nextCursor = null;
  if (result.docs.length > 25) {
    nextCursor = randomUUID();
    const last = page.at(-1);
    await collection(db, "cursors")
      .doc(nextCursor)
      .set({
        owner: token.uid,
        admin,
        id: last.id,
        createdAt: last.data().createdAt,
        expiresAt: now + 900000,
        expireAt: new Date(now + 900000),
      });
  }
  let users = [],
    calendarDays = [],
    audit = [],
    activeBookings = [];
  if (!admin && !cursor && (profile.activeIds || []).length) {
    const rows = await db.getAll(
      ...profile.activeIds.slice(0, 3).map((id) => col.doc(id)),
    );
    activeBookings = rows
      .filter((d) => d.exists && d.data().owner === token.uid)
      .map((d) => effective(d.data(), now));
  }
  if (admin) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
      start < addDays(todayIST(), -365) ||
      start > addDays(todayIST(), 396)
    )
      fail("INVALID_CALENDAR_RANGE");
    const dayRefs = Array.from({ length: 14 }, (_, i) =>
      collection(db, "days").doc(addDays(start, i)),
    );
    const ledgers = await db.getAll(
      ...dayRefs,
      collection(db, "days").doc(addDays(start, -1)),
    );
    const overdue = await reservations(db)
      .where("status", "==", "checked_in")
      .where("departure", "<=", todayIST(now))
      .limit(201)
      .get();
    if (overdue.size > 200) fail("RECONCILIATION_REQUIRED", 409);
    for (const d of overdue.docs) all.set(d.id, effective(d.data(), now));
    calendarDays = dayRefs.map((r, i) =>
      calendarSummary(
        {
          ...s,
          bookings: [
            ...new Map(
              [
                ...Object.values(ledgers[i].data()?.entries || {}),
                ...Object.values(
                  ledgers[i === 0 ? 14 : i - 1].data()?.entries || {},
                ),
                ...overdue.docs.map((d) => d.data()),
              ].map((b) => [b.id, b]),
            ).values(),
          ],
        },
        r.id,
        now,
      ),
    );
    const ids = new Set(
      ledgers.flatMap((d) =>
        Object.values(d.data()?.entries || {})
          .filter((b) => occupies(b, now))
          .map((b) => b.id),
      ),
    );
    const missing = [...ids].filter((id) => !all.has(id));
    missing.splice(150);
    if (missing.length)
      for (const d of await db.getAll(...missing.map((id) => col.doc(id))))
        if (d.exists) all.set(d.id, effective(d.data(), now));
    const ps = await collection(db, "profiles")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    users = ps.docs.map((d) => ({
      id: d.id,
      name: d.data().name || "Guest",
      role: "guest",
      stays: d.data().completedStays || 0,
    }));
    const as = await collection(db, "audit")
      .orderBy("at", "desc")
      .limit(10)
      .get();
    audit = as.docs.map((d) => d.data());
  }
  return project(s, actor, profile, [...all.values()], {
    users,
    audit,
    nextCursor,
    activeBookings,
    calendarDays,
  });
}
export async function throttleBooking(db, uid) {
  const ref = collection(db, "limits").doc(hash(uid)),
    minute = Math.floor(Date.now() / 60000);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref),
      p = snap.data();
    if (p?.minute === minute && p.count >= 60) fail("RATE_LIMIT", 429);
    tx.set(ref, { minute, count: p?.minute === minute ? p.count + 1 : 1 });
  });
}
export async function bookingCommand(
  db,
  token,
  operation,
  input,
  key,
  { admin = false, journeyId, requestId } = {},
) {
  if (!schemas[operation]) fail("NOT_FOUND", 404);
  validate(schemas[operation], input);
  if (
    [
      "settings",
      "unit",
      "promo",
      "block",
      "unblock",
      "readiness",
      "guest-profile",
    ].includes(operation) &&
    !admin
  )
    fail("FORBIDDEN", 403);
  if (!/^[A-Za-z0-9-]{8,100}$/.test(key || ""))
    fail("IDEMPOTENCY_KEY_REQUIRED", 400);
  const requestRef = collection(db, "requests").doc(
      hash(token.uid + ":" + key),
    ),
    requestHash = hash(JSON.stringify(stable({ operation, input, admin })));
  return db.runTransaction(async (tx) => {
    const now = Date.now(),
      configRef = collection(db, "config").doc("site"),
      profileRef = collection(db, "profiles").doc(token.uid),
      memberRef = db.collection(sharedCollectionName("members")).doc(token.uid);
    const [cs, ms, ps, rs] = await Promise.all([
      tx.get(configRef),
      tx.get(memberRef),
      tx.get(profileRef),
      tx.get(requestRef),
    ]);
    if (
      admin &&
      !guardMember(
        ms,
        !["availability", "guest-contact", "reservation-detail"].includes(
          operation,
        ),
      )
    )
      fail("FORBIDDEN", 403);
    const actor = {
      id: token.uid,
      name: String(token.name || "Guest").slice(0, 80),
      role: admin ? "host" : "guest",
      ...(admin ? { bookingAccess: studioAccess(ms.data()).bookings } : {}),
    };
    if (rs.exists) {
      if (rs.data().hash !== requestHash) fail("IDEMPOTENCY_CONFLICT", 409);
      return rs.data().result;
    }
    const s = loadConfig(cs),
      profile = ps.exists
        ? ps.data()
        : {
            id: token.uid,
            name: actor.name,
            email: String(token.email || "").slice(0, 254),
            completedStays: 0,
            activeIds: [],
            createdAt: now,
          };
    if (operation === "profile") {
      if (admin) fail("FORBIDDEN", 403);
      if (input.expectedVersion !== (profile.contactVersion || 0))
        fail("VERSION_CONFLICT", 409);
      const contact = contactDetails({ name: input.name, phone: input.phone });
      tx.set(profileRef, {
        ...profile,
        email: String(token.email || ""),
        contact,
        contactVersion: (profile.contactVersion || 0) + 1,
        updatedAt: now,
      });
      queueCommitted(
        tx,
        db,
        bookingEvent({
          type: "guest.profile_updated",
          journeyId,
          requestId,
          transactionId: requestRef.id,
          authority: "server-confirmed",
          actor: token.uid,
          phone: contact.phone,
          operation: "profile",
          outcome: "succeeded",
        }),
      );
      const result = ownContact(
        {
          ...profile,
          contact,
          contactVersion: (profile.contactVersion || 0) + 1,
        },
        token,
      );
      tx.set(requestRef, {
        owner: token.uid,
        hash: requestHash,
        result,
        createdAt: now,
        expireAt: new Date(now + 86400000),
      });
      return result;
    }
    if (input.id && !/^[A-Za-z0-9-]{1,100}$/.test(input.id)) fail("INVALID_ID");
    if (input.quoteId && !/^[a-z0-9-]{36}$/.test(input.quoteId))
      fail("INVALID_ID");
    if (input.guestId && !/^[A-Za-z0-9:_-]{1,128}$/.test(input.guestId))
      fail("INVALID_GUEST");
    const targetRef = input.id ? reservations(db).doc(input.id) : null;
    let target = targetRef ? await tx.get(targetRef) : null;
    target = target?.exists ? target.data() : null;
    const priorStatus = target?.status;
    if (target && actor.role !== "host" && target.owner !== actor.id)
      fail("NOT_FOUND", 404);
    const qSnap = input.quoteId
        ? await tx.get(collection(db, "quotes").doc(input.quoteId))
        : null,
      q = qSnap?.exists ? qSnap.data() : null;
    if (input.quoteId && !/^[a-z0-9-]{36}$/.test(input.quoteId))
      fail("INVALID_ID");
    let owner =
      target?.owner ||
      (admin ? input.guestId || q?.guestId : token.uid) ||
      token.uid;
    const ownerRef = collection(db, "profiles").doc(owner),
      ownerSnap = owner === token.uid ? ps : await tx.get(ownerRef);
    if (owner !== token.uid && !ownerSnap.exists) fail("INVALID_GUEST");
    const ownerProfile = ownerSnap.exists ? ownerSnap.data() : profile;
    if (operation === "guest-profile") {
      if (!admin) fail("FORBIDDEN", 403);
      return ownContact(ownerProfile);
    }
    if (operation === "reservation-detail") {
      if (!target) fail("NOT_FOUND", 404);
      return withoutContact(effective(target, now));
    }
    const completing =
      operation === "booking-action" &&
      input.action === "complete" &&
      target?.status === "checked_in" &&
      !["day", "event"].includes(target?.kind);
    const creditRows = completing
      ? await tx.get(
          collection(db, "credits")
            .where("owner", "==", owner)
            .where("active", "==", true)
            .where("arrival", "<=", target.departure)
            .where("departure", ">=", target.arrival)
            .limit(40),
        )
      : null;
    if (creditRows?.size >= 40) fail("RECONCILIATION_REQUIRED", 409);

    s.users = [
      { id: owner, name: ownerProfile.name || actor.name, role: "guest" },
    ];
    s.stats = {
      [owner]: ownerProfile.completedStays || 0,
      [token.uid]: profile.completedStays || 0,
    };
    let range = input.arrival ? input : q || target;
    const periods = [range, target, target?.changeRequest].filter(
      (p) => p?.arrival && p?.departure,
    );
    const days = [
      ...new Set(periods.flatMap((p) => dates(p.arrival, p.departure))),
    ];
    if (days.length > 102) fail("CALENDAR_LIMIT");
    const dayRefs = days.map((d) => collection(db, "days").doc(d)),
      daySnaps = days.length ? await tx.getAll(...dayRefs) : [];
    const map = new Map(
      daySnaps.flatMap((d) =>
        Object.values(d.data()?.entries || {}).map((b) => [
          b.id,
          { ...b, history: [] },
        ]),
      ),
    );
    const activeIds = (ownerProfile.activeIds || []).slice(0, 3),
      activeSnaps = activeIds.length
        ? await tx.getAll(...activeIds.map((id) => reservations(db).doc(id)))
        : [];
    for (const d of activeSnaps) if (d.exists) map.set(d.id, d.data());
    if (target) map.set(target.id, effective(target, now));
    if (days.length) {
      const overdue = await tx.get(
        reservations(db)
          .where("status", "==", "checked_in")
          .where("departure", "<=", todayIST(now))
          .limit(201),
      );
      if (overdue.size > 200) fail("RECONCILIATION_REQUIRED", 409);
      for (const d of overdue.docs)
        if (d.id !== target?.id) map.set(d.id, d.data());
    }
    const changingUnit = s.units.find((u) => u.id === input.id);
    const needsConflictScan =
      (operation === "settings" &&
        (input.capacity < s.settings.capacity ||
          input.products?.siteAdults < s.settings.products.siteAdults ||
          input.products?.nightAdults < s.settings.products.nightAdults)) ||
      (operation === "unit" &&
        changingUnit &&
        (!input.active || input.capacity < changingUnit.capacity));
    if (needsConflictScan) {
      const confirmed = await tx.get(
        reservations(db)
          .where("status", "in", ["confirmed", "checked_in"])
          .where("departure", ">", todayIST(now))
          .limit(201),
      );
      const pending = await tx.get(
        reservations(db)
          .where("status", "==", "pending_approval")
          .where("expiresAt", ">", now)
          .limit(201),
      );
      if (confirmed.size + pending.size > 200)
        fail("RECONCILIATION_REQUIRED", 409);
      [...confirmed.docs, ...pending.docs].forEach((d) =>
        map.set(d.id, d.data()),
      );
    }
    if (operation === "guest-contact") {
      if (!target) fail("NOT_FOUND", 404);
      return {
        ...(target.contact || {
          name: ownerProfile.name || "Guest",
          phone: ownerProfile.contact?.phone || "",
        }),
        email: ownerProfile.email || "",
      };
    }
    s.bookings = [...map.values()];
    s.quotes = q ? [q] : [];
    s.audit = [];
    s.outbox = [];
    const promo = (
      input.promo ||
      q?.promo ||
      target?.changeRequest?.promo ||
      target?.promo ||
      ""
    ).toUpperCase();
    if (promo) {
      const used = await tx.get(
        reservations(db)
          .where("promo", "==", promo)
          .where("status", "in", [
            "confirmed",
            "checked_in",
            "completed",
            "no_show",
          ])
          .limit(101),
      );
      const pending = await tx.get(
        reservations(db)
          .where("promo", "==", promo)
          .where("status", "==", "pending_approval")
          .where("expiresAt", ">", now)
          .limit(101),
      );
      s.promoCounts = { [promo]: used.size + pending.size };
    }
    if (
      operation === "promo" &&
      !s.promos.some((p) => p.code === String(input.code).toUpperCase()) &&
      s.promos.length >= 20
    )
      fail("PROMO_LIMIT");
    if (operation === "block" && s.blocks.length >= 100) fail("BLOCK_LIMIT");
    const emailConfig = mailSettings();
    const invoiceApproval =
      (emailConfig.enabled || !!target?.invoiceId) &&
      operation === "booking-action" &&
      ["approve", "approve_change"].includes(input.action);
    const counterRef = db
      .collection(collectionName("invoice_counters"))
      .doc(String(invoiceYear(now)));
    const counterSnap = invoiceApproval ? await tx.get(counterRef) : null;
    const previousInvoice =
      target?.invoiceId
        ? (await tx.get(invoiceCollection(db).doc(target.invoiceId))).data()
        : null;
    let contact;
    if (operation === "create") {
      if (!input.contact && !ownerProfile.contact?.phone)
        fail("CONTACT_REQUIRED", 422);
      contact = contactDetails(input.contact || ownerProfile.contact);
    }
    const result =
      operation === "availability"
        ? availability(s, input, now)
        : mutate(s, actor, operation, input, now);
    if (operation === "availability") return result;
    if (operation === "quote" || operation === "change-quote")
      tx.set(collection(db, "quotes").doc(result.id), {
        ...result,
        expireAt: new Date(result.expiresAt + 86400000),
      });
    const reservationMutation = [
      "create",
      "booking-action",
      "note",
      "change-request",
    ].includes(operation);
    let invoice;
    if (invoiceApproval) {
      try {
        invoice = invoiceSnapshot(
          result,
          ownerProfile,
          (counterSnap.data()?.sequence || 0) + 1,
          !emailConfig.enabled && previousInvoice
            ? { ...emailConfig, issuer: previousInvoice.issuer }
            : emailConfig,
          now,
          previousInvoice,
        );
      } catch (e) {
        if (e.message === "INVOICE_PRICE_REQUIRED")
          fail("INVOICE_PRICE_REQUIRED", 409);
        throw e;
      }
      tx.create(invoiceCollection(db).doc(invoice.id), invoice);
      if (previousInvoice)
        tx.update(invoiceCollection(db).doc(previousInvoice.id), {
          status: "superseded",
          supersededBy: invoice.id,
        });
      tx.set(counterRef, {
        sequence: (counterSnap.data()?.sequence || 0) + 1,
        updatedAt: now,
      });
      result.invoiceId = invoice.id;
    }
    if (
      previousInvoice &&
      operation === "booking-action" &&
      ["cancel", "decline"].includes(input.action)
    )
      tx.update(invoiceCollection(db).doc(previousInvoice.id), {
        status: "void",
        voidedAt: now,
      });
    if (reservationMutation) {
      const b = result;
      if (operation === "create") b.contact = contact;
      if (operation === "create")
        b.guestName = String(ownerProfile.name || actor.name || "Guest").slice(
          0,
          80,
        );
      if (!b?.id) fail("INVALID_MUTATION", 500);
      tx.set(reservations(db).doc(b.id), b);
      for (let i = 0; i < days.length; i++) {
        const d = days[i],
          entries = Object.fromEntries(
            Object.entries(daySnaps[i].data()?.entries || {}).filter(
              ([id, x]) => id !== b.id && occupies(x, now),
            ),
          );
        if (reservesCapacity(b, now) && bookingOnDate(s, b, d))
          entries[b.id] = {
            id: b.id,
            owner: b.owner,
            arrival: b.arrival,
            departure: b.departure,
            guests: b.guests,
            units: b.units,
            status: b.status,
            expiresAt: b.expiresAt || 0,
            promo: b.promo || "",
            reference: b.reference || "",
            ...(b.kind
              ? {
                  kind: b.kind,
                  ...(b.pricingVersion ? {pricingVersion:b.pricingVersion} : {}),
                  adults: b.adults,
                  children: b.children,
                  startsAt: b.startsAt,
                  endsAt: b.endsAt,
                  allocations: b.allocations,
                }
              : {}),
          };
        tx.set(dayRefs[i], { date: d, entries, updatedAt: now });
      }
      const active = activeSnaps
        .filter((d) => d.exists && d.id !== b.id && occupies(d.data(), now))
        .map((d) => d.id);
      if (occupies(b, now)) active.push(b.id);
      const completed =
        (ownerProfile.completedStays || 0) +
        (completing && b.status === "completed" && priorStatus !== "completed"
          ? 1 - (creditRows?.size || 0)
          : 0);
      if (completing && b.status === "completed") {
        const creditId = hash(owner + ":" + b.id),
          old = creditRows.docs.map((d) => d.data());
        tx.set(collection(db, "credits").doc(creditId), {
          owner,
          active: true,
          arrival: [b.arrival, ...old.map((x) => x.arrival)].sort()[0],
          departure: [b.departure, ...old.map((x) => x.departure)]
            .sort()
            .at(-1),
          bookingId: b.id,
          createdAt: now,
        });
        for (const d of creditRows.docs)
          tx.update(d.ref, { active: false, supersededBy: creditId });
      }
      tx.set(ownerRef, {
        ...ownerProfile,
        activeIds: [...new Set(active)],
        completedStays: completed,
        updatedAt: now,
      });
    }
    if (
      !cs.exists ||
      !["availability", "quote", "change-quote"].includes(operation)
    )
      tx.set(configRef, {
        ...pickConfig(s),
        guardVersion: (cs.data()?.guardVersion || 0) + 1,
      });
    for (const e of s.audit) {
      if (
        emailConfig.enabled &&
        [
          "booking.requested",
          "booking.confirmed",
          "booking.approve_change",
        ].includes(e.type)
      )
        queueNotifications(tx, db, {
          event: e,
          booking: result,
          profile: ownerProfile,
          config: emailConfig,
          invoice,
          now,
        });
      const safe = {
        eventId: e.eventId,
        type: e.type,
        entity: e.entity,
        actor: e.actor,
        at: e.at,
        delivery: mailSettings().enabled ? "email_enabled" : "not_configured",
        environment: environment.name,
        apiVersion: "0.8.0",
        ...(e.bookingKind ? { bookingKind: e.bookingKind } : {}),
      };
      tx.set(collection(db, "audit").doc(e.eventId), safe);
      tx.set(collection(db, "outbox").doc(e.eventId), safe);
      queueCommitted(
        tx,
        db,
        bookingEvent({
          id: e.eventId,
          journeyId,
          requestId,
          transactionId: requestRef.id,
          type: e.type,
          authority: "server-confirmed",
          actor: e.actor,
          phone: result?.contact?.phone || ownerProfile.contact?.phone,
          operation,
          kind: e.bookingKind,
          entity: e.entity,
          outcome: "succeeded",
          at: e.at,
        }),
      );
    }
    tx.set(requestRef, {
      owner: token.uid,
      hash: requestHash,
      result: reservationMutation ? withoutContact(result) : result,
      createdAt: now,
      expireAt: new Date(now + 90 * 86400000),
    });
    return reservationMutation ? withoutContact(result) : result;
  });
}
export function validateBookingOperation(operation, body) {
  if (!schemas[operation]) fail("NOT_FOUND", 404);
  validate(schemas[operation], body);
}
