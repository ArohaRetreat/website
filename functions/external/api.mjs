import { createHash } from "node:crypto";
import {
  environment,
  collectionName,
  sharedCollectionName,
} from "../environment.mjs";
import { studioAccess } from "../access.mjs";
import { bookingCommand, throttleBooking } from "../booking/store.mjs";
import { BookingError } from "../booking/domain.mjs";
import {
  verifyIntegration,
  requireScope,
  CONTRACT_VERSION,
} from "./access.mjs";
import { routes, matchRoute } from "./routes.mjs";
import {
  configRead,
  reservationRead,
  pageRead,
  projectReservation,
  projectUnit,
  availabilityRead,
  publicBookingCalendar,
  ownContact,
  etag,
  expected,
} from "./read.mjs";
const fail = (c, s = 422) => {
  throw new BookingError(c, s);
};
const ownFields = (v, keys) => {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).some((k) => !keys.includes(k))
  )
    fail("INVALID_REQUEST");
};
const ids = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
function visit(q) {
  ownFields(q, [
    "kind",
    "arrival",
    "departure",
    "adults",
    "childrenAges",
    "unitIds",
  ]);
  const ages = ids(q.childrenAges).map(Number);
  return {
    kind: q.kind,
    arrival: q.arrival,
    departure: q.departure,
    adults: Number(q.adults),
    childrenAges: ages,
    guests: Number(q.adults) + ages.length,
    units: ids(q.unitIds),
  };
}
export async function externalApi(db, auth, req, res, requestId) {
  const path =
    req.path.replace(/^\/api\/external\/v1/, "").replace(/\/$/, "") || "/";
  const match = matchRoute(req.method, path);
  if (!match) fail("NOT_FOUND", 404);
  const { row, params } = match,
    [method, , operation, scope, command, action, versionKind] = row;
  req.externalOperation = operation;
  const token = await verifyIntegration(
    db,
    auth,
    req.get("authorization")?.match(/^Bearer (.+)$/)?.[1],
  );
  requireScope(token, scope, operation);
  if (token._integration.purpose === "mcp-readonly" && method !== "GET")
    fail("READ_ONLY_TOKEN_REQUIRED", 403);
  req.externalOperation = operation;
  await throttleBooking(db, "integration:" + token._integration.id);
  const all = token._integration.rowAccess === "all";
  const member = await db
      .collection(sharedCollectionName("members"))
      .doc(token.uid)
      .get(),
    access = studioAccess(member.data());
  const staffReads = ["getSettings", "listBlocks", "listPromotions"];
  if (staffReads.includes(operation) && access.bookings === "none")
    fail("FORBIDDEN", 403);
  if (method === "GET") {
    if (operation === "getRuntime")
      return {
        environment: environment.name,
        contractVersion: CONTRACT_VERSION,
        capabilities: routes
          .filter(
            (r) =>
              r[0] === "GET" &&
              token._integration.scopes.includes(r[3]) &&
              (token._integration.purpose !== "mcp-readonly" ||
                [
                  "getRuntime",
                  "getAvailability",
                  "getCalendar",
                  "listReservations",
                  "getReservation",
                  "list_units",
                  "get_units",
                  "getPublishedContent",
                  "listCommunications",
                ].includes(r[2])),
          )
          .map((r) => r[2]),
      };
    if (operation === "getAvailability")
      return availabilityRead(db, token, visit(req.query));
    if (operation === "getCalendar") {
      ownFields(req.query, ["arrival", "departure"]);
      const days =
        (Date.parse(req.query.departure) - Date.parse(req.query.arrival)) /
        86400000;
      if (!Number.isInteger(days) || days < 1 || days > 31)
        fail("INVALID_CALENDAR_RANGE");
      return publicBookingCalendar(db, {
        start: req.query.arrival,
        days,
        kind: "day",
        adults: 1,
        childrenAges: [],
      });
    }
    if (operation === "listReservations") {
      ownFields(req.query, ["limit", "cursor"]);
      let q = db.collection(collectionName("bookings"));
      if (!all) q = q.where("owner", "==", token.uid);
      return pageRead(
        db,
        token,
        q,
        {
          view: "reservations:" + all,
          limit: req.query.limit === undefined ? 25 : Number(req.query.limit),
          cursor: req.query.cursor,
        },
        projectReservation,
      );
    }
    if (
      operation === "getReservation" ||
      operation === "getReservationContact"
    ) {
      const b = await reservationRead(db, token, params.id);
      if (operation === "getReservationContact") {
        if (!token._integration.scopes.includes("reservations:read"))
          fail("INSUFFICIENT_SCOPE", 403);
        return {
          name: b.contact?.name || "",
          phone: b.contact?.phone || "",
          verifiedEmail: (await auth.getUser(b.owner)).email || "",
        };
      }
      res.set("ETag", etag("reservation", b.id, b.version));
      return projectReservation(b);
    }
    if (operation === "listCommunications") {
      const b = await reservationRead(db, token, params.id);
      ownFields(req.query, ["limit", "cursor"]);
      let q = db
        .collection(collectionName("notifications"))
        .where("bookingId", "==", b.id);
      // Filter channel in the query so private host messages cannot shrink or leak a guest page.
      if (!all)
        q = q.where("channel", "in", [
          "guest_acknowledgement",
          "guest_confirmation",
        ]);
      return pageRead(
        db,
        token,
        q,
        {
          view: "communications:" + b.id + ":" + all,
          limit: req.query.limit === undefined ? 25 : Number(req.query.limit),
          cursor: req.query.cursor,
        },
        (j) => ({
          id: j.id,
          version: j.version,
          channel: j.channel,
          status: j.status,
          createdAt: j.createdAt,
          templateVersion: j.templateVersion,
        }),
      );
    }
    if (operation === "getMyProfile") {
      const d = await db
        .collection(collectionName("booking_profiles"))
        .doc(token.uid)
        .get();
      const profile = ownContact(d.data(), token);
      res.set("ETag", etag("profile", token.uid, profile.version));
      return profile;
    }
    if (operation === "getPublishedContent") {
      const d = await db.collection(collectionName("public")).doc("site").get();
      if (!d.exists) fail("NOT_FOUND", 404);
      return {
        id: "site",
        version: d.data().version,
        content: d.data().content,
      };
    }
    const c = await configRead(db);
    if (operation === "list_units")
      return { items: c.units.map(projectUnit), nextCursor: null };
    if (operation === "get_units") {
      const u = c.units.find((u) => u.id === params.id);
      if (!u) fail("NOT_FOUND", 404);
      res.set("ETag", etag("unit", u.id, u.version));
      return projectUnit(u);
    }
    if (operation === "getSettings") {
      res.set("ETag", etag("settings", "site", c.settings.version));
      return c.settings;
    }
    if (operation === "listBlocks")
      return {
        items: c.blocks.map((b) => ({
          id: b.id,
          arrival: b.arrival,
          departure: b.departure,
          unitId: b.unitId,
        })),
        nextCursor: null,
      };
    if (operation === "listPromotions")
      return { items: c.promos, nextCursor: null };
    fail("NOT_FOUND", 404);
  }
  if (!req.is("application/json")) fail("JSON_REQUIRED", 415);
  const body = req.body || {};
  ownFields(body, Object.keys(body));
  if (req.rawBody?.length > 16000) fail("PAYLOAD_TOO_LARGE", 413);
  if (
    Object.keys(body).some((k) =>
      ["id", "expectedVersion", "action"].includes(k),
    )
  )
    fail("TRANSPORT_FIELD_OVERRIDE");
  const needsManager = [
    "reservations:approve",
    "stays:operate",
    "inventory:write",
    "promotions:write",
    "settings:write",
  ].includes(scope);
  if (needsManager && (access.bookings !== "manager" || !all))
    fail("FORBIDDEN", 403);
  let input = { ...body };
  if (params.id) input.id = params.id;
  if (action) input.action = action;
  if (versionKind) {
    const id =
      versionKind === "profile"
        ? token.uid
        : versionKind === "settings"
          ? "site"
          : params.id;
    input.expectedVersion = expected(req.get("If-Match"), versionKind, id);
  }
  if (command === "quote" || command === "change-quote") {
    if (input.adults !== undefined) {
      input.childrenAges ||= [];
      input.guests = input.adults + input.childrenAges.length;
    }
  }
  if (operation === "updatePromotion")
    requireScope(token, "promotions:write", operation);
  if (operation === "createMyProfile") input.expectedVersion = 0;
  if (command === "promo" && params.id) {
    input.code = params.id;
    delete input.id;
  }
  if (
    command === "settings" &&
    ((input.capacity !== undefined && input.capacity !== 10) ||
      (input.products?.siteAdults !== undefined &&
        input.products.siteAdults !== 35) ||
      (input.products?.nightAdults !== undefined &&
        input.products.nightAdults !== 10))
  )
    fail("CAPACITY_POLICY_FIXED", 403);
  // Existing domain rejects arbitrary cancellation reasons; keep those in facade audit only after validation.
  if (method === "DELETE" && command === "booking-action") {
    ownFields(body, ["reason"]);
    if (
      typeof body.reason !== "string" ||
      body.reason.length < 1 ||
      body.reason.length > 500
    )
      fail("INVALID_REASON");
    delete input.reason;
  }
  const key = req.get("Idempotency-Key");
  if (!/^[A-Za-z0-9-]{8,100}$/.test(key || ""))
    fail("IDEMPOTENCY_KEY_REQUIRED", 400);
  const boundKey = createHash("sha256")
    .update(
      JSON.stringify([token._integration.id, operation, params.id || "", key]),
    )
    .digest("hex");
  try {
    const value = await bookingCommand(db, token, command, input, boundKey, {
      admin: all && command !== "profile",
      requestId,
    });
    if (value?.version)
      res.set(
        "ETag",
        etag(
          versionKind || "reservation",
          value.id || params.id || "site",
          value.version,
        ),
      );
    if (
      [
        "createReservation",
        "createQuote",
        "createMyProfile",
        "createPromotion",
        "createBlock",
      ].includes(operation)
    )
      res.status(201);
    return value?.arrival && value?.status ? projectReservation(value) : value;
  } catch (e) {
    if (e.code === "VERSION_CONFLICT")
      throw new BookingError("VERSION_CONFLICT", 412);
    throw e;
  }
}
