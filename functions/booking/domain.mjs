import {
  productAvailability,
  productPrice,
  assertLegacyCapacity,
  interval,
  productDefaults,
  peakOccupancy,
} from "./products.mjs";
// Production booking policy. Firestore adapter loads and commits bounded transactional ledgers.
import { createHash, randomUUID } from "node:crypto";
import {DomainError} from "../domain.mjs";
export class BookingError extends DomainError {
  constructor(code, status = 422) {
    super(code,status);
  }
}
const fail = (code, status) => {
  throw new BookingError(code, status);
};
export const addDays = (date, days) =>
  new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
export const todayIST = (now = Date.now()) =>
  new Date(now + 19800000).toISOString().slice(0, 10);
const date = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    fail("INVALID_DATE");
  return value;
};
const int = (v, min, max) => {
  if (!Number.isInteger(v) || v < min || v > max) fail("INVALID_NUMBER");
  return v;
};
const text = (v, max = 1000) => {
  if (typeof v !== "string" || v.length > max) fail("INVALID_TEXT");
  return v.trim();
};
export function initialState() {
  const units = [
    ["tree-1", "Tree house 01", "Tree house", 2, true, "20261028_093817.webp"],
    ["tree-2", "Tree house 02", "Tree house", 2, true, "20261028_093813.webp"],
    ["cottage-1", "Cottage 01", "Cottage", 2, true, "DSC_3795.webp"],
    ["cottage-2", "Cottage 02", "Cottage", 2, true, "DSC_3795.webp"],
    ["unmapped", "Master room", "Room", 2, true, null],
    ...Array.from({ length: 4 }, (_, i) => [
      `future-${i + 1}`,
      `Future room 0${i + 1}`,
      "Under construction",
      5,
      false,
      null,
    ]),
  ].map(([id, name, type, capacity, active, image]) => ({
    id,
    name,
    type,
    capacity,
    active,
    image,
    rate: null,
    version: 1,
  }));
  return {
    schemaVersion: 1,
    revision: 1,
    users: [],
    units,
    bookings: [],
    blocks: [],
    quotes: [],
    requests: {},
    audit: [],
    outbox: [],
    promos: [],
    stats: {},
    settings: {
      version: 1,
      products: { ...productDefaults },
      capacity: 10,
      approvalHours: 24,
      cancelHours: 0,
      friendAt: 6,
      familyAt: 10,
      friendDiscount: 0,
      familyDiscount: 0,
      paused: false,
      checkIn: "14:00",
      checkOut: "11:00",
    },
  };
}
export const tier = (state, uid) => {
  const stays =
    state.stats?.[uid] ??
    state.bookings.filter(
      (b) =>
        b.owner === uid &&
        b.status === "completed" &&
        !["day", "event"].includes(b.kind),
    ).length;
  const s = state.settings,
    name =
      stays >= s.familyAt
        ? "Family"
        : stays >= s.friendAt
          ? "Friend"
          : "Visitor";
  return {
    name,
    stays,
    discount:
      name === "Family"
        ? s.familyDiscount
        : name === "Friend"
          ? s.friendDiscount
          : 0,
    nextAt:
      name === "Family" ? null : name === "Friend" ? s.familyAt : s.friendAt,
  };
};
export const occupies = (b, now) =>
  ["confirmed", "checked_in"].includes(b.status) ||
  (b.status === "pending_approval" && b.expiresAt > now);
const overlaps = (a, b) => a.arrival < b.departure && b.arrival < a.departure;
function stay(input, now) {
  const arrival = date(input.arrival),
    departure = date(input.departure),
    day = todayIST(now);
  if (
    arrival < addDays(day, 1) ||
    arrival > addDays(day, 365) ||
    departure <= arrival ||
    departure > addDays(arrival, 31)
  )
    fail("INVALID_STAY_DATES");
  return { arrival, departure, guests: int(input.guests, 1, 30) };
}
export function availability(state, input, now = Date.now(), exclude) {
  if (input.kind) return productAvailability(state, input, now, exclude);
  const selection = stay(input, now),
    active = state.bookings.filter(
      (b) => b.id !== exclude && occupies(b, now) && overlaps(b, selection),
    );
  let remaining = state.settings.capacity;
  for (let d = selection.arrival; d < selection.departure; d = addDays(d, 1)) {
    remaining = Math.min(
      remaining,
      state.settings.capacity -
        active
          .filter((b) => b.arrival <= d && b.departure > d)
          .reduce((n, b) => n + b.guests, 0),
    );
  }
  const units = state.units.map((u) => ({
    ...u,
    available:
      u.active &&
      !state.settings.paused &&
      remaining >= selection.guests &&
      !active.some((b) => b.units.includes(u.id)) &&
      !state.blocks.some(
        (b) =>
          (b.unitId === u.id || b.unitId === "site") &&
          (!b.expiresAt || b.expiresAt > now) &&
          overlaps(b, selection),
      ),
  }));
  return { ...selection, remaining, units };
}
const promoUses = (state, code, now, exclude) =>
  state.promoCounts?.[code] !== undefined
    ? Math.max(
        0,
        state.promoCounts[code] -
          (exclude &&
          state.bookings.some(
            (b) =>
              b.id === exclude &&
              b.promo === code &&
              (occupies(b, now) || ["completed", "no_show"].includes(b.status)),
          )
            ? 1
            : 0),
      )
    : state.bookings.filter(
        (b) =>
          b.id !== exclude &&
          b.promo === code &&
          (occupies(b, now) || ["completed", "no_show"].includes(b.status)),
      ).length;
export function price(state, uid, input, now = Date.now(), exclude) {
  if(input.redeemCredits&&!input.kind)fail('LOYALTY_REQUIRES_OVERNIGHT_PRODUCT');
  if (input.kind) return productPrice(state, uid, input, now, exclude);
  assertLegacyCapacity(state, input, now, exclude);
  const available = availability(state, input, now, exclude);
  if (state.settings.paused) fail("BOOKINGS_PAUSED", 409);
  if (
    !Array.isArray(input.units) ||
    input.units.length < 1 ||
    input.units.length > 9 ||
    new Set(input.units).size !== input.units.length
  )
    fail("SELECT_ROOMS");
  const chosen = input.units.map((id) =>
    available.units.find((u) => u.id === id),
  );
  if (chosen.some((u) => !u?.available)) fail("AVAILABILITY_CHANGED", 409);
  if (
    chosen.length > input.guests ||
    chosen.reduce((n, u) => n + u.capacity, 0) < input.guests ||
    available.remaining < input.guests
  )
    fail("PARTY_CAPACITY_EXCEEDED", 409);
  const unpriced = chosen.some((u) => u.rate === null);
  const nights = Math.round(
      (Date.parse(input.departure) - Date.parse(input.arrival)) / 86400000,
    ),
    subtotal = chosen.reduce((n, u) => n + u.rate, 0) * nights;
  const loyalty = tier(state, uid),
    code = text(input.promo || "", 32).toUpperCase();
  let discount = Math.round((subtotal * loyalty.discount) / 100),
    offer = loyalty.discount
      ? `${loyalty.name} benefit · ${loyalty.discount}%`
      : "No offer";
  if (code && unpriced) fail("PRICING_NOT_CONFIGURED", 409);
  if (code) {
    const p = state.promos.find((p) => p.code === code && p.active);
    if (!p || todayIST(now) < p.from || todayIST(now) > p.until)
      fail("PROMO_NOT_VALID");
    if (promoUses(state, code, now, exclude) >= p.maxUses)
      fail("PROMO_EXHAUSTED", 409);
    const amount =
      p.kind === "percent" ? Math.round((subtotal * p.value) / 100) : p.value;
    if (amount <= discount) fail("LOYALTY_IS_BETTER");
    discount = Math.min(subtotal, amount);
    offer = `${code} · ${p.kind === "percent" ? p.value + "%" : "fixed offer"}`;
  }
  return {
    arrival: available.arrival,
    departure: available.departure,
    guests: input.guests,
    units: [...input.units],
    unitNames: chosen.map((u) => u.name),
    nights,
    subtotal: unpriced ? null : subtotal,
    discount: unpriced ? 0 : discount,
    total: unpriced ? null : subtotal - discount,
    offer: unpriced ? "Price agreed with your host" : offer,
    promo: code,
    settingsVersion: state.settings.version,
    cancelHours: state.settings.cancelHours,
    currency: "INR",
  };
}
function event(state, actor, type, entity, now) {
  const e = {
    eventId: randomUUID(),
    type,
    entity,
    actor: actor.id,
    at: now,
    delivery: "not_configured",
    ...(type.startsWith("booking.")
      ? {
          bookingKind:
            state.bookings.find((b) => b.id === entity)?.kind || "legacy",
        }
      : {}),
  };
  state.audit.push(e);
  state.outbox.push(e);
  state.revision++;
}
const host = (actor) => {
  if (actor?.role !== "host") fail("FORBIDDEN", 403);
};
const version = (record, expected) => {
  if (record.version !== expected) fail("VERSION_CONFLICT", 409);
};
export function expire(state, now = Date.now()) {
  for (const b of state.bookings)
    if (b.status === "pending_approval" && b.expiresAt <= now) {
      b.status = "expired";
      b.version++;
      b.history.push({ status: "expired", at: now });
      event(state, { id: "system" }, "booking.expired", b.id, now);
    }
}
export function mutate(state, actor, operation, input, now = Date.now()) {
  if (!actor) fail("SIGN_IN_REQUIRED", 401);

  if (
    operation === "note" ||
    operation === "change-quote" ||
    operation === "change-request"
  ) {
    const b = state.bookings.find((b) => b.id === input.id);
    if (!b || !(actor.ownerIds||[actor.id]).includes(b.owner)) fail("NOT_FOUND", 404);
    version(b, input.expectedVersion);
    if (!["pending_approval", "confirmed"].includes(b.status))
      fail("INVALID_TRANSITION", 409);
    if (operation === "note") {
      b.note = text(input.note);
      b.version++;
      event(state, actor, "booking.note_updated", b.id, now);
      return b;
    }
    if (b.status !== "confirmed") fail("CONFIRMED_STAY_REQUIRED", 409);
    if (b.kind === "event") fail("EVENT_CHANGE_REQUIRES_NEW_REQUEST", 409);
    if (operation === "change-quote") {
      const q = {
        ...price(
          state,
          actor.id,
          {
            ...b,
            ...input,
            units: b.kind === "private" || !b.kind ? b.units : [],
          },
          now,
          b.id,
        ),
        id: randomUUID(),
        owner: actor.id,
        bookingId: b.id,
        expiresAt: now + 600000,
      };
      state.quotes.push(q);
      return q;
    }
    const q = state.quotes.find(
      (q) =>
        q.id === input.quoteId && q.owner === actor.id && q.bookingId === b.id,
    );
    if (!q || q.expiresAt <= now) fail("QUOTE_EXPIRED", 410);
    const current = price(state, actor.id, q, now, b.id);
    if (
      current.total !== q.total ||
      current.settingsVersion !== q.settingsVersion
    )
      fail("QUOTE_CHANGED", 409);
    b.changeRequest = { ...current, id:q.id, requestedAt: now };
    b.version++;
    event(state, actor, "booking.change_requested", b.id, now);
    return b;
  }
  if (operation === "quote") {
    const customer =
      actor.role === "host" && input.guestId
        ? state.users.find((u) => u.id === input.guestId && u.role === "guest")
        : actor;
    if (!customer) fail("INVALID_GUEST");
    const q = {
      ...price(state, customer.id, input, now),
      id: randomUUID(),
      owner: actor.id,
      guestId: customer.id,
      expiresAt: now + 600000,
    };
    state.quotes = state.quotes.filter((q) => q.expiresAt > now);
    state.quotes.push(q);
    return q;
  }
  if (operation === "create") {
    const q = state.quotes.find(
      (q) => q.id === input.quoteId && q.owner === actor.id,
    );
    if (!q || q.bookingId || q.consumedBy || q.expiresAt <= now) fail("QUOTE_EXPIRED", 410);
    const owner = actor.role === "host" ? q.guestId : actor.id;
    const current = price(state, owner, q, now);
    if (
      current.total !== q.total ||
      current.settingsVersion !== q.settingsVersion
    )
      fail("QUOTE_CHANGED", 409);
    if (
      state.bookings.filter((b) => (actor.customerOwnerIds||[owner]).includes(b.owner) && occupies(b, now))
        .length >= 3
    )
      fail("REQUEST_LIMIT", 429);
    const b = {
      ...current,
      id: randomUUID(),
      reference: `AR-${randomUUID().slice(0, 8).toUpperCase()}`,
      owner,
      note: text(input.note || ""),
      status: "pending_approval",
      version: 1,
      createdAt: now,
      expiresAt: Math.min(
        now + state.settings.approvalHours * 3600000,
        (q.kind && (q.kind === "day" || q.startsAt <= now)
          ? q.endsAt
          : q.startsAt) ??
          Date.parse(q.arrival + "T" + state.settings.checkIn + ":00+05:30"),
      ),
      history: [{ status: "pending_approval", at: now }],
    };
    state.bookings.push(b);
    q.consumedBy=b.id;
    event(state, actor, "booking.requested", b.id, now);
    return b;
  }
  if (operation === "booking-action") {
    const b = state.bookings.find((b) => b.id === input.id);
    if (!b || (actor.role !== "host" && !(actor.ownerIds||[actor.id]).includes(b.owner)))
      fail("NOT_FOUND", 404);
    version(b, input.expectedVersion);
    if(input.changeId&&input.changeId!==(b.changeRequest?.id||('legacy-change-'+b.changeRequest?.requestedAt)))fail('NOT_FOUND',404);
    if(input.offerId&&input.offerId!==b.currentOffer?.id)fail('NOT_FOUND',404);
    if(input.action==='withdraw_change'){
      if(b.status!=='confirmed'||!b.changeRequest)fail('INVALID_TRANSITION',409);
      b.changeHistory=[...(b.changeHistory||[]),{...b.changeRequest,status:'withdrawn',resolvedAt:now}].slice(-20);delete b.changeRequest;b.version++;b.history.push({status:'change_withdrawn',at:now});event(state,actor,'booking.change_withdrawn',b.id,now);return b;
    }
    if(input.action==='withdraw_offer'){
      host(actor);if(b.kind!=='event'||b.pricingVersion||b.status!=='pending_approval'||!b.currentOffer||b.quoteAccepted)fail('INVALID_TRANSITION',409);
      b.currentOffer={...b.currentOffer,status:'withdrawn',version:b.currentOffer.version+1};b.total=null;b.subtotal=null;b.lineItems=[];b.quoteAccepted=false;state.blocks=state.blocks.filter(x=>x.bookingId!==b.id);b.version++;b.history.push({status:'offer_withdrawn',at:now});event(state,actor,'booking.offer_withdrawn',b.id,now);return b;
    }
    if (["approve_change", "decline_change"].includes(input.action)) {
      host(actor);
      if (b.status !== "confirmed" || !b.changeRequest)
        fail("INVALID_TRANSITION", 409);
      if (input.action === "approve_change") {
        const q = b.changeRequest,
          current = price(state, b.owner, q, now, b.id);
        if (
          current.total !== q.total ||
          current.settingsVersion !== q.settingsVersion
        )
          fail("QUOTE_CHANGED", 409);
        Object.assign(b, current);
        b.history.push({ status: "dates_changed", at: now });
      } else b.history.push({ status: "change_declined", at: now });
      delete b.changeRequest;
      b.version++;
      event(state, actor, "booking." + input.action, b.id, now);
      return b;
    }
    if (["offer_event", "accept_event"].includes(input.action)) {
      if (
        b.kind !== "event" ||
        b.status !== "pending_approval" ||
        b.expiresAt <= now
      )
        fail("INVALID_TRANSITION", 409);
      if (b.pricingVersion) fail("PUBLISHED_EVENT_RATE", 409);
      if (input.action === "offer_event") {
        host(actor);
        if (input.holdHours) {
          const check = productAvailability(state, b, now, b.id);
          if (!check.available) fail("AVAILABILITY_CHANGED", 409);
          state.blocks = state.blocks.filter((x) => x.bookingId !== b.id);
          if (state.blocks.length >= 100) fail("BLOCK_LIMIT", 409);
          state.blocks.push({
            id: randomUUID(),
            unitId: "site",
            bookingId: b.id,
            arrival: b.arrival,
            departure: b.departure,
            reason: "Exclusive event offer",
            startsAt: b.startsAt,
            endsAt: b.endsAt,
            expiresAt: Math.min(
              b.expiresAt,
              now + int(input.holdHours, 1, 72) * 3600000,
            ),
          });
        }
        if(b.currentOffer)b.offerHistory=[...(b.offerHistory||[]),b.currentOffer].slice(-20);
        b.currentOffer={id:randomUUID(),amount:input.amount,createdAt:now,status:'pending',version:1};
        b.total = int(input.amount, 10000, 100000000);
        b.subtotal = b.total;
        b.quoteAccepted = false;
        b.lineItems = [
          { label: "Exclusive retreat · host offer", amount: b.total },
        ];
      } else {
        if (!(actor.ownerIds||[actor.id]).includes(b.owner)) fail("FORBIDDEN", 403);
        if (b.total === null) fail("EVENT_QUOTE_REQUIRED", 409);
        b.quoteAccepted = true;
        if(b.currentOffer)b.currentOffer={...b.currentOffer,status:'accepted',acceptedAt:now,version:b.currentOffer.version+1};
      }
      b.version++;
      b.history.push({ status: input.action, at: now });
      event(state, actor, "booking." + input.action, b.id, now);
      return b;
    }
    if (input.action === "approve" && b.kind) {
      if (b.kind === "event" && (!b.quoteAccepted || b.total === null))
        fail("EVENT_QUOTE_REQUIRED", 409);
      const check = productAvailability(state, b, now, b.id);
      if (!check.available) fail("AVAILABILITY_CHANGED", 409);
      // Keep the guest's snapshotted amount and original assigned sleeping places.
      if (
        b.kind === "individual" &&
        b.allocations.some(
          (x) =>
            !check.units.find((u) => u.id === x.unitId)?.freeAdults ||
            check.units.find((u) => u.id === x.unitId).freeAdults < x.adults,
        )
      )
        fail("AVAILABILITY_CHANGED", 409);
    }
    if (input.action === "assign_rooms") {
      host(actor);
      if (
        b.kind !== "individual" ||
        !["pending_approval", "confirmed"].includes(b.status)
      )
        fail("INVALID_TRANSITION", 409);
      if (
        !Array.isArray(input.units) ||
        !input.units.length ||
        input.units.length > 9
      )
        fail("SELECT_ROOMS");
      const check = productAvailability(
        state,
        { ...b, preferredUnits: input.units },
        now,
        b.id,
      );
      if (!check.available) fail("AVAILABILITY_CHANGED", 409);
      b.units = check.allocations.map((a) => a.unitId);
      b.allocations = check.allocations;
      b.version++;
      b.history.push({ status: "rooms_assigned", at: now });
      event(state, actor, "booking.rooms_assigned", b.id, now);
      return b;
    }
    const transitions = {
      approve: ["pending_approval", "confirmed"],
      decline: ["pending_approval", "declined"],
      checkin: ["confirmed", "checked_in"],
      complete: ["checked_in", "completed"],
      no_show: ["confirmed", "no_show"],
    };
    let next;
    if (input.action === "cancel") {
      if (!["pending_approval", "confirmed"].includes(b.status))
        fail("INVALID_TRANSITION", 409);
      if (
        actor.role !== "host" &&
        b.status === "confirmed" &&
        (b.startsAt ??
          Date.parse(b.arrival + "T" + state.settings.checkIn + ":00+05:30")) -
          now <
          (b.cancelHours ?? 48) * 3600000
      )
        fail("HOST_CANCELLATION_REQUIRED", 409);
      next = "cancelled";
    } else {
      host(actor);
      const t = transitions[input.action];
      if (!t || b.status !== t[0]) fail("INVALID_TRANSITION", 409);
      if (
        (input.action === "checkin" &&
          (b.kind ? now < b.startsAt : todayIST(now) < b.arrival)) ||
        (["complete", "no_show"].includes(input.action) &&
          (b.kind ? now < b.endsAt : todayIST(now) < b.departure))
      )
        fail("STAY_NOT_STARTED_OR_FINISHED", 409);
      next = t[1];
    }
    if (
      input.action === "checkin" &&
      b.kind &&
      b.units.some(
        (id) => state.units.find((u) => u.id === id)?.ready === false,
      )
    )
      fail("ROOM_TURNOVER_REQUIRED", 409);
    if (
      input.action === "complete" &&
      b.kind &&
      !["day", "event"].includes(b.kind)
    )
      for (const id of b.units) {
        const u = state.units.find((u) => u.id === id);
        if (u) {
          u.ready = false;
          u.version++;
        }
      }
    if (
      b.kind === "event" &&
      ["confirmed", "declined", "cancelled"].includes(next)
    )
      state.blocks = state.blocks.filter((x) => x.bookingId !== b.id);
    b.status = next;
    if(next==='checked_in')b.checkedInAt=now;
    if(next==='completed')b.checkedOutAt=now;
    delete b.changeRequest;
    b.version++;
    b.history.push({ status: next, at: now });
    event(state, actor, `booking.${next}`, b.id, now);
    return b;
  }
  host(actor);
  if (operation === "readiness") {
    const u = state.units.find((u) => u.id === input.id);
    if (!u) fail("NOT_FOUND", 404);
    version(u, input.expectedVersion);
    u.ready = input.ready === true;
    u.version++;
    event(state, actor, "unit.readiness_updated", u.id, now);
    return u;
  }
  if (operation === "settings") {
    const s = state.settings;
    version(s, input.expectedVersion);
    const next = {
      ...s,
      capacity: int(input.capacity, 1, 100),
      approvalHours: int(input.approvalHours, 1, 72),
      cancelHours: int(input.cancelHours, 0, 336),
      friendAt: int(input.friendAt, 1, 100),
      familyAt: int(input.familyAt, 2, 200),
      friendDiscount: int(input.friendDiscount, 0, 50),
      familyDiscount: int(input.familyDiscount, 0, 50),
      paused: input.paused === true,
    };
    if (next.familyAt <= next.friendAt) fail("INVALID_TIER_THRESHOLDS");
    for (const b of state.bookings.filter((b) => !b.kind && occupies(b, now))) {
      for (let d = b.arrival; d < b.departure; d = addDays(d, 1))
        if (
          state.bookings
            .filter(
              (x) =>
                !x.kind &&
                occupies(x, now) &&
                x.arrival <= d &&
                x.departure > d,
            )
            .reduce((n, x) => n + x.guests, 0) > next.capacity
        )
          fail("EXISTING_BOOKINGS_CONFLICT", 409);
    }
    if (input.products) {
      const p = { ...productDefaults, ...s.products, ...input.products };
      for (const k of ["siteAdults", "nightAdults"]) int(p[k], 1, 100);
      if (p.nightAdults > p.siteAdults) fail("INVALID_CAPACITY");
      for (const k of [
        "eventDayRate",
        "dayAdultRate",
        "dayChildRate",
        "individualRate",
        "roomRate",
        "extraChildRate",
      ])
        int(p[k], 0, 100000000);
      for (const k of ["dayStart", "dayEnd", "stayStart", "stayEnd"])
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(p[k]))
          fail("INVALID_TIME_WINDOW");
      if (p.dayStart >= p.dayEnd) fail("INVALID_TIME_WINDOW");
      for (const b of state.bookings.filter((b) => occupies(b, now))) {
        const peak = peakOccupancy(state, b, now);
        if (peak.adults > p.siteAdults || peak.nightAdults > p.nightAdults)
          fail("EXISTING_BOOKINGS_CONFLICT", 409);
      }
      next.products = p;
    }
    if(input.facilities!==undefined){
      if(!Array.isArray(input.facilities)||input.facilities.length>20||new Set(input.facilities.map(f=>f.id)).size!==input.facilities.length)fail('INVALID_FACILITIES');
      next.facilities=input.facilities.map(f=>({id:text(f.id,64),name:text(f.name,80),available:f.available===true}));
    }
    next.version++;
    state.settings = next;
    event(state, actor, "settings.updated", "settings", now);
    return next;
  }
  if (operation === "unit") {
    const u = state.units.find((u) => u.id === input.id);
    if (!u) fail("NOT_FOUND", 404);
    version(u, input.expectedVersion);
    if(u.retired)fail('UNIT_RETIRED',409);
    const capacity = int(input.capacity, 1, 10),
      rate = input.rate === null ? null : int(input.rate, 10000, 100000000);
    if (
      (!input.active || capacity < u.capacity) &&
      state.bookings.some((b) => occupies(b, now) && b.units.includes(u.id))
    )
      fail("EXISTING_BOOKINGS_CONFLICT", 409);

    const needsVerification = ["Unconfigured", "Under construction"].includes(
      u.type,
    );
    if (needsVerification && input.active && input.verified !== true)
      fail("ROOM_NOT_READY");
    const name = input.name === undefined ? u.name : text(input.name, 120);
    if (
      !name ||
      (needsVerification &&
        input.active &&
        /future|fifth room|details needed/i.test(name))
    )
      fail("ROOM_NAME_REQUIRED");
    Object.assign(u, {
      name,
      type: needsVerification && input.verified === true ? "Room" : u.type,
      rate,
      capacity,
      active: input.active === true,
      version: u.version + 1,
    });
    event(state, actor, "unit.updated", u.id, now);
    return u;
  }
  if (operation === "promo") {
    const code = text(input.code, 24).toUpperCase();
    if (!/^[A-Z0-9]{4,24}$/.test(code)) fail("INVALID_PROMO_CODE");
    const p = state.promos.find((p) => p.code === code);
    if (p) {
      version(p, input.expectedVersion);
      p.active = input.active === true;
      p.version++;
      event(state, actor, "promo.updated", p.id, now);
      return p;
    }
    const promo = {
      id: randomUUID(),
      code,
      kind: input.kind === "fixed" ? "fixed" : "percent",
      value: int(input.value, 1, input.kind === "fixed" ? 10000000 : 50),
      maxUses: int(input.maxUses, 1, 100),
      active: true,
      from: date(input.from),
      until: date(input.until),
      version: 1,
    };
    if (promo.until < promo.from) fail("INVALID_PROMO_DATES");
    state.promos.push(promo);
    event(state, actor, "promo.created", promo.id, now);
    return promo;
  }
  if (operation === "block") {
    const period = stay({ ...input, guests: 1 }, now);
    if (
      input.unitId !== "site" &&
      !state.units.some((u) => u.id === input.unitId && u.active)
    )
      fail("INVALID_UNIT");
    if (
      state.bookings.some(
        (b) =>
          occupies(b, now) &&
          (input.unitId === "site" || b.units.includes(input.unitId)) &&
          interval(b, state).start <
            Date.parse(period.departure + "T00:00:00+05:30") &&
          interval(b, state).end >
            Date.parse(period.arrival + "T00:00:00+05:30"),
      )
    )
      fail("EXISTING_BOOKINGS_CONFLICT", 409);
    const b = {
      id: randomUUID(),
      unitId: input.unitId,
      ...period,
      reason: text(input.reason, 120),
    };
    state.blocks.push(b);
    event(state, actor, "inventory.blocked", b.id, now);
    return b;
  }
  if (operation === "unblock") {
    const i = state.blocks.findIndex((b) => b.id === input.id);
    if (i < 0) fail("NOT_FOUND", 404);
    state.blocks.splice(i, 1);
    event(state, actor, "inventory.unblocked", input.id, now);
    return { released: true };
  }
  fail("NOT_FOUND", 404);
}
export function command(state, actor, operation, input, key, now = Date.now()) {
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(key || ""))
    fail("IDEMPOTENCY_KEY_REQUIRED", 400);
  const scope = `${actor?.id}:${key}`,
    hash = createHash("sha256")
      .update(JSON.stringify({ operation, input }))
      .digest("hex");
  const prior = state.requests[scope];
  if (prior) {
    if (prior.hash !== hash) fail("IDEMPOTENCY_CONFLICT", 409);
    return structuredClone(prior.result);
  }
  const result = mutate(state, actor, operation, input, now);
  if (operation === "create")
    state.bookings.find((b) => b.id === result.id).cancelHours =
      state.settings.cancelHours;
  state.requests[scope] = { hash, result: structuredClone(result) };
  return result;
}
export function snapshot(state, actor, now = Date.now()) {
  const isHost = actor?.role === "host";
  return {
    prototype: true,
    now,
    actor: actor || null,
    settings: state.settings,
    units: state.units,
    bookings: actor
      ? state.bookings.filter((b) => isHost || b.owner === actor.id)
      : [],
    loyalty: actor ? tier(state, actor.id) : null,
    promos: isHost
      ? state.promos.map((p) => ({ ...p, uses: promoUses(state, p.code, now) }))
      : [],
    users: isHost ? state.users : [],
    blocks: isHost ? state.blocks : [],
    audit: isHost ? state.audit.slice(-30).reverse() : [],
    delivery: "not_configured",
    revision: state.revision,
  };
}
