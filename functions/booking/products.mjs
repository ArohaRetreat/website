// One policy for guest and host mixed-product reservations. Monetary values are paise.
import { BookingError, addDays, todayIST, occupies, tier } from "./domain.mjs";
const fail = (code, status = 422) => {
  throw new BookingError(code, status);
};
export const productDefaults = Object.freeze({
  siteAdults: 35,
  nightAdults: 10,
  eventDayRate: 3000000,
  dayAdultRate: 120000,
  dayChildRate: 70000,
  individualRate: 350000,
  roomRate: 600000,
  extraChildRate: 150000,
  dayStart: "06:00",
  dayEnd: "18:00",
  stayStart: "11:00",
  stayEnd: "11:00",
});
export const productPolicy = (s) => ({
  ...productDefaults,
  ...s.settings.products,
});
const integer = (v, min, max) => {
  if (!Number.isInteger(v) || v < min || v > max) fail("INVALID_NUMBER");
  return v;
};
const local = (d, t) => Date.parse(`${d}T${t}:00+05:30`);
export function interval(b, state, now) {
  if (Number.isFinite(b.startsAt) && Number.isFinite(b.endsAt))
    return {
      start: b.startsAt,
      end: b.status === "checked_in" && now >= b.endsAt ? Infinity : b.endsAt,
    };
  return {
    start: local(b.arrival, state.settings.checkIn || "14:00"),
    end:
      b.status === "checked_in" &&
      now >= local(b.departure, state.settings.checkOut || "11:00")
        ? Infinity
        : local(b.departure, state.settings.checkOut || "11:00"),
  };
}
export const reservesCapacity = (b, now) =>
  occupies(b, now) && !(b.kind === "event" && b.status === "pending_approval" && !b.pricingVersion);
const intersects = (a, b) => a.start < b.end && b.start < a.end;
export function productSelection(state, input, now = Date.now()) {
  const p = productPolicy(state),
    kind = input.kind;
  if (!["day", "individual", "private", "event"].includes(kind))
    fail("INVALID_BOOKING_KIND");
  for (const d of [input.arrival, input.departure])
    if (
      typeof d !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
      !Number.isFinite(Date.parse(d + "T00:00:00Z")) ||
      new Date(d + "T00:00:00Z").toISOString().slice(0, 10) !== d
    )
      fail("INVALID_DATE");
  const short = kind === "day",
    event = kind === "event";
  if (
    input.arrival < todayIST(now) ||
    input.arrival > addDays(todayIST(now), 365) ||
    input.departure <= input.arrival ||
    input.departure > addDays(input.arrival, short ? 1 : 31)
  )
    fail("INVALID_STAY_DATES");
  const adults = integer(input.adults, 1, p.siteAdults),
    ages = input.childrenAges || [];
  if (
    !Array.isArray(ages) ||
    ages.length > 100 ||
    ages.some((a) => !Number.isInteger(a) || a < 0 || a >= 10)
  )
    fail("INVALID_CHILD_AGE");
  if (input.guests !== adults + ages.length) fail("PARTY_COUNT_MISMATCH");
  if (kind === "individual" && ages.length)
    fail("CHILDREN_REQUIRE_PRIVATE_ROOM");
  const startsAt =
      input.policy &&
      Number.isFinite(input.startsAt) &&
      todayIST(input.startsAt) === input.arrival
        ? input.startsAt
        : Math.max(
            local(input.arrival, short || event ? p.dayStart : p.stayStart),
            input.arrival === todayIST(now) ? now : 0,
          ),
    endsAt =
      input.policy &&
      Number.isFinite(input.endsAt) &&
      todayIST(input.endsAt) ===
        (short
          ? input.arrival
          : event
            ? addDays(input.departure, -1)
            : input.departure)
        ? input.endsAt
        : local(
            short
              ? input.arrival
              : event
                ? addDays(input.departure, -1)
                : input.departure,
            short || event ? p.dayEnd : p.stayEnd,
          );
  if (endsAt <= startsAt || endsAt <= now) fail("INVALID_TIME_WINDOW");
  return {
    kind,
    arrival: input.arrival,
    departure: input.departure,
    adults,
    childrenAges: [...ages],
    children: ages.length,
    guests: adults + ages.length,
    startsAt,
    endsAt,
    nights:
      short || event
        ? 0
        : Math.round(
            (Date.parse(input.departure) - Date.parse(input.arrival)) /
              86400000,
          ),
  };
}
const adultCount = (b) => b.adults ?? b.guests;
export function peakOccupancy(state, selection, now, exclude) {
  const period =
      selection.start !== undefined ? selection : interval(selection, state),
    rows = state.bookings.filter(
      (b) =>
        b.id !== exclude &&
        reservesCapacity(b, now) &&
        intersects(interval(b, state, now), period),
    );
  const points = [
    period.start,
    ...rows.flatMap((b) => {
      const i = interval(b, state, now);
      return [i.start, i.end].filter(
        (t) => t >= period.start && t < period.end,
      );
    }),
  ];
  let adults = 0,
    children = 0,
    nightAdults = 0;
  for (const t of points) {
    const present = rows.filter((b) => {
      const i = interval(b, state, now);
      return i.start <= t && i.end > t;
    });
    adults = Math.max(
      adults,
      present.reduce((n, b) => n + adultCount(b), 0),
    );
    children = Math.max(
      children,
      present.reduce(
        (n, b) => n + (b.children ?? b.childrenAges?.length ?? 0),
        0,
      ),
    );
    nightAdults = Math.max(
      nightAdults,
      present
        .filter((b) => !["day", "event"].includes(b.kind))
        .reduce((n, b) => n + adultCount(b), 0),
    );
  }
  return { adults, children, nightAdults, rows };
}
function privateAllocation(rooms, adults, kids) {
  let best = null;
  function assign(i, a, c, rows, extras) {
    if (i === rooms.length) {
      if (a === 0 && c === 0 && (!best || extras < best.extras))
        best = { rows, extras };
      return;
    }
    const left = rooms.length - i - 1;
    for (let n = 1; n <= Math.min(2, rooms[i].capacity, a); n++)
      for (let k = 0; k <= Math.min(2, c); k++)
        if (a - n >= left && a - n <= left * 2 && c - k <= left * 2)
          assign(
            i + 1,
            a - n,
            c - k,
            [
              ...rows,
              { unitId: rooms[i].id, adults: n, children: k, private: true },
            ],
            extras + Math.max(0, n + k - 2),
          );
  }
  assign(0, adults, kids, [], 0);
  return best;
}
export function productAvailability(state, input, now = Date.now(), exclude) {
  const selection = productSelection(state, input, now),
    p = productPolicy(state),
    period = interval(selection, state),
    peak = peakOccupancy(state, period, now, exclude),
    event = peak.rows.some((b) => b.kind === "event");
  const allActive = peak.rows;
  const blocked = state.blocks.some(
    (b) =>
      b.unitId === "site" &&
      (!exclude || b.bookingId !== exclude) &&
      (!b.expiresAt || b.expiresAt > now) &&
      intersects(
        {
          start: b.startsAt ?? local(b.arrival, "00:00"),
          end: b.endsAt ?? local(b.departure, "00:00"),
        },
        period,
      ),
  );
  const enough =
    !state.settings.paused &&
    !blocked &&
    !event &&
    peak.adults + selection.adults <= p.siteAdults &&
    (!["individual", "private"].includes(selection.kind) ||
      peak.nightAdults + selection.adults <= p.nightAdults) &&
    (selection.kind !== "event" || allActive.length === 0);
  const units = state.units.map((u) => {
    const used = allActive.filter((b) => b.units?.includes(u.id)),
      closed = state.blocks.some(
        (b) =>
          b.unitId === u.id &&
          (!b.expiresAt || b.expiresAt > now) &&
          intersects(
            {
              start: b.startsAt ?? local(b.arrival, "00:00"),
              end: b.endsAt ?? local(b.departure, "00:00"),
            },
            period,
          ),
      );
    let free = Math.min(2, u.capacity);
    if (used.some((b) => b.kind !== "individual")) free = 0;
    else if (used.length) {
      const points = [
        period.start,
        ...used.flatMap((b) => {
          const i = interval(b, state, now);
          return [i.start, i.end].filter(
            (t) => t >= period.start && t < period.end,
          );
        }),
      ];
      for (const t of points) {
        const n = used
          .filter((b) => {
            const i = interval(b, state, now);
            return i.start <= t && i.end > t;
          })
          .reduce(
            (n, b) =>
              n +
              (b.allocations?.find((a) => a.unitId === u.id)?.adults ??
                u.capacity),
            0,
          );
        free = Math.min(free, Math.min(2, u.capacity) - n);
      }
    }
    return {
      ...u,
      rate: u.rate ?? p.roomRate,
      freeAdults: u.active && !closed ? Math.max(0, free) : 0,
      available: enough && u.active && !closed && used.length === 0,
    };
  });
  let allocations = [],
    chosen = [],
    extraChildren = 0;
  if (
    selection.kind === "private" &&
    Array.isArray(input.units) &&
    input.units.length
  ) {
    if (
      new Set(input.units).size !== input.units.length ||
      input.units.length > 9
    )
      fail("SELECT_ROOMS");
    chosen = input.units.map((id) => units.find((u) => u.id === id));
    if (chosen.some((u) => !u?.available)) fail("AVAILABILITY_CHANGED", 409);
    const fit = privateAllocation(chosen, selection.adults, selection.children);
    if (!fit) fail("ROOM_PARTY_LIMIT", 409);
    allocations = fit.rows;
    extraChildren = fit.extras;
  }
  if (selection.kind === "individual") {
    let remaining = selection.adults;
    for (const u of units
      .filter(
        (u) =>
          u.freeAdults > 0 &&
          (!input.preferredUnits || input.preferredUnits.includes(u.id)),
      )
      .sort(
        (a, b) => a.freeAdults - b.freeAdults || a.id.localeCompare(b.id),
      )) {
      const n = Math.min(remaining, u.freeAdults);
      if (n) {
        allocations.push({
          unitId: u.id,
          adults: n,
          children: 0,
          private: false,
        });
        remaining -= n;
      }
    }
    if (remaining) allocations = [];
    chosen = allocations.map((a) => units.find((u) => u.id === a.unitId));
  }
  const canBook =
    enough &&
    (selection.kind !== "individual" || allocations.length > 0) &&
    (selection.kind !== "private" || allocations.length > 0);
  return {
    ...selection,
    remaining: Math.max(0, p.siteAdults - peak.adults),
    remainingOvernight: Math.max(0, p.nightAdults - peak.nightAdults),
    available: canBook,
    units,
    allocations,
    extraChildren,
    selectedUnitNames: chosen.map((u) => u.name),
  };
}
export function productPrice(state, uid, input, now = Date.now(), exclude) {
  const a = productAvailability(state, input, now, exclude),
    p = productPolicy(state);
  if (state.settings.paused) fail("BOOKINGS_PAUSED", 409);
  if (a.kind === "private" && !input.units?.length) fail("SELECT_ROOMS");
  if (!a.available) fail("AVAILABILITY_CHANGED", 409);
  let subtotal = null,
    lineItems = [];
  if (a.kind === "day") {
    lineItems = [
      {
        label: `${a.adults} day admission(s), age10+`,
        amount: a.adults * p.dayAdultRate,
      },
      {
        label: `${a.children} under10 day admission(s)`,
        amount: a.children * p.dayChildRate,
      },
    ];
  }
  if (a.kind === "individual")
    lineItems = [
      {
        label: `${a.adults} individual sleeping place(s) × ${a.nights} night(s)`,
        amount: a.adults * a.nights * p.individualRate,
      },
    ];
  if (a.kind === "private")
    lineItems = [
      ...a.allocations.map((x) => ({
        label: `${state.units.find((u) => u.id === x.unitId).name} × ${a.nights} night(s)`,
        amount:
          (state.units.find((u) => u.id === x.unitId).rate ?? p.roomRate) *
          a.nights,
      })),
      {
        label: `${a.extraChildren} additional child place(s) × ${a.nights} night(s)`,
        amount: a.extraChildren * p.extraChildRate * a.nights,
      },
    ];
  if (a.kind === "event") {
    const days = Math.round((Date.parse(a.departure) - Date.parse(a.arrival)) / 86400000);
    lineItems = [{ label: `Exclusive retreat × ${days} day(s)`, amount: days * p.eventDayRate }];
  }
  subtotal = lineItems.reduce((n, x) => n + x.amount, 0);
  const code = String(input.promo || "")
    .trim()
    .toUpperCase();
  let discount = 0,
    offer = "Published rate";
  if (a.kind === "event" && code) fail("PROMO_NOT_VALID");
  if (subtotal !== null) {
    const loyalty = tier(state, uid);
    discount = ["private", "individual"].includes(a.kind)
      ? Math.round((subtotal * loyalty.discount) / 100)
      : 0;
    if (discount) offer = loyalty.name + " benefit";
    if (code) {
      const promo = state.promos.find((x) => x.code === code && x.active);
      if (!promo || todayIST(now) < promo.from || todayIST(now) > promo.until)
        fail("PROMO_NOT_VALID");
      const uses =
        state.promoCounts?.[code] ??
        state.bookings.filter(
          (b) =>
            b.id !== exclude &&
            b.promo === code &&
            (occupies(b, now) || ["completed", "no_show"].includes(b.status)),
        ).length;
      if (uses >= promo.maxUses) fail("PROMO_EXHAUSTED", 409);
      const amount =
        promo.kind === "percent"
          ? Math.round((subtotal * promo.value) / 100)
          : promo.value;
      if (amount <= discount) fail("LOYALTY_IS_BETTER");
      discount = Math.min(subtotal, amount);
      offer = code;
    }
  }

  return {
    ...a,
    units: a.allocations.map((x) => x.unitId),
    unitNames:
      a.kind === "individual"
        ? ["Host-allocated shared accommodation"]
        : a.selectedUnitNames,
    subtotal,
    discount,
    total: subtotal === null ? null : subtotal - discount,
    lineItems,
    promo: code,
    offer,
    settingsVersion: state.settings.version,
    cancelHours: state.settings.cancelHours,
    currency: "INR",
    policy: { ...p },
    quoteAccepted: true,
    ...(a.kind === "event" ? { pricingVersion: 1 } : {}),
  };
}
export function assertLegacyCapacity(state, b, now, exclude) {
  const peak = peakOccupancy(state, b, now, exclude);
  if (
    peak.rows.some((x) => x.kind === "event") ||
    peak.adults + (b.adults ?? b.guests) > productPolicy(state).siteAdults
  )
    fail("AVAILABILITY_CHANGED", 409);
}
export function calendarSummary(state, date, now = Date.now()) {
  const p = productPolicy(state),
    peak = peakOccupancy(
      state,
      { start: local(date, p.dayStart), end: local(date, p.dayEnd) },
      now,
    );
  return {
    date,
    adults: peak.adults,
    children: peak.children,
    nightAdults: peak.nightAdults,
    adultCapacity: p.siteAdults,
    event: peak.rows.some((b) => b.kind === "event"),
    reservations: peak.rows.map((b) => ({
      id: b.id,
      reference: b.reference || "",
      kind: b.kind || "legacy",
      adults: b.adults ?? b.guests,
      children: b.children ?? 0,
      units: b.units,
      allocations: b.allocations || [],
      status: b.status,
      arrival: b.arrival,
      departure: b.departure,
    })),
  };
}

export const bookingOnDate = (state, b, d) =>
  intersects(interval(b, state), {
    start: local(d, "00:00"),
    end: local(addDays(d, 1), "00:00"),
  });

// Privacy-safe date-picker read. No reservation, room or customer data is projected.
export function calendarWindow(input, now = Date.now()) {
  const validDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d+'T00:00:00Z')) && new Date(d+'T00:00:00Z').toISOString().slice(0,10) === d;
  if (!validDate(input.start) || !Number.isInteger(input.days) || input.days < 1 || input.days > 62 || !['stay','day','event'].includes(input.kind) || !Number.isInteger(input.adults) || input.adults < 1 || input.adults > 100 || !Array.isArray(input.childrenAges) || input.childrenAges.length > 100 || input.childrenAges.some(a=>!Number.isInteger(a)||a<0||a>9) || (input.arrival !== undefined && !validDate(input.arrival))) fail('INVALID_CALENDAR');
  const today = todayIST(now), last = addDays(input.start,input.days-1);
  if (input.start < addDays(today,-31) || input.start > addDays(today,365) || last > addDays(today,427) || (input.arrival && (input.arrival < today || input.arrival > addDays(today,365) || input.arrival > last || input.arrival < addDays(input.start,-31)))) fail('INVALID_CALENDAR');
  return {start: addDays(input.arrival && input.arrival < input.start ? input.arrival : input.start,-1), end:addDays(last,1)};
}
export function availabilityCalendar(state, input, now = Date.now()) {
  calendarWindow(input,now);
  function canFit(arrival, departure) {
    const selection = {arrival,departure,adults:input.adults,childrenAges:input.childrenAges,guests:input.adults+input.childrenAges.length,units:[]};
    try {
      if(input.kind !== 'stay') return productAvailability(state,{...selection,kind:input.kind},now).available;
      if(!input.childrenAges.length && productAvailability(state,{...selection,kind:'individual'},now).available) return true;
      const a = productAvailability(state,{...selection,kind:'private'},now);
      const rooms = a.units.filter(u=>u.available).sort((a,b)=>b.capacity-a.capacity);
      for(let n=Math.max(1,Math.ceil(input.adults/2),Math.ceil(input.childrenAges.length/2)); n<=Math.min(rooms.length,input.adults); n++) if(privateAllocation(rooms.slice(0,n),input.adults,input.childrenAges.length)) return true;
      return false;
    } catch(e) {
      if(['INVALID_STAY_DATES','INVALID_TIME_WINDOW','INVALID_NUMBER'].includes(e.code)) return false;
      throw e;
    }
  }
  return {settingsVersion:state.settings.version,asOf:now,days:Array.from({length:input.days},(_,n)=>{
    const date=addDays(input.start,n),arrival=input.arrival||date;
    const departure=input.arrival ? (input.kind==='event'?addDays(date,1):date) : addDays(date,1);
    return {date,available:canFit(arrival,departure)};
  })};
}
