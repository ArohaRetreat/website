import {platformScopes,definitionsById} from '../platform/registry.mjs';
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  environment,
  collectionName,
  sharedCollectionName,
  isTester,
} from "../environment.mjs";
import {can} from "../domain.mjs";
import { studioAccess } from "../access.mjs";
import { BookingError } from "../booking/domain.mjs";
export const CONTRACT_VERSION = "1.4.0";
export const READ_SCOPES = Object.freeze([
  "runtime:read",
  "availability:read",
  "calendar:read",
  "reservations:read",
  "inventory:read",
  "content:published:read",
  "communications:read",
]);
export const WRITE_SCOPES = Object.freeze([
  "quotes:create",
  "reservations:create",
  "reservations:cancel",
  "reservations:change",
  "reservations:approve",
  "stays:operate",
  "inventory:write",
  "promotions:read",
  "promotions:write",
  "settings:read",
  "settings:write",
  "profiles:read",
  "profiles:write",
  "notes:write",
  "contacts:read",
]);
export const SCOPES = Object.freeze([...new Set([...READ_SCOPES, ...WRITE_SCOPES, ...platformScopes])]);
export const MCP_OPERATIONS = Object.freeze([
  "getRuntime",
  "getAvailability",
  "getCalendar",
  "listReservations",
  "getReservation",
  "list_units",
  "get_units",
  "getPublishedContent",
  "listCommunications",
]);
const fail = (c, s = 403) => {
  throw new BookingError(c, s);
};
export const digest = (x) => createHash("sha256").update(x).digest("hex");
export const grantCollection = (db) =>
  db.collection(collectionName("integration_tokens"));
const metadata = (g) => ({
  id: g.id,
  name: g.name,
  scopes: g.scopes,
  rowAccess: g.rowAccess,
  purpose: g.purpose,
  version: g.version,
  active: g.active,
  createdAt: g.createdAt,
  expiresAt: g.expiresAt,
  ...(g.clientId?{clientId:g.clientId}:{}),
});
const unexpired = (g, now) =>
  g?.expiresAt === null ||
  (Number.isSafeInteger(g?.expiresAt) && g.expiresAt > now);
export function assertGrant(g, token, now = Date.now()) {
  const a = token._integration;
  if (!a) return;
  if (
    !g ||
    !g.active ||
    g.owner !== token.uid ||
    g.environment !== environment.name ||
    !unexpired(g, now) ||
    g.version !== a.version ||
    !a.scopes.every((s) => g.scopes.includes(s)) ||
    g.purpose !== a.purpose ||
    g.rowAccess !== a.rowAccess
  )
    fail("GRANT_REVOKED");
  if (a.requiredScope && !g.scopes.includes(a.requiredScope))
    fail("INSUFFICIENT_SCOPE");
  if (
    g.purpose === "mcp-readonly" &&
    a.operation &&
    !MCP_OPERATIONS.includes(a.operation)
  )
    fail("OPERATION_NOT_ALLOWED");
}
function assertClient(c,g,now=Date.now()) {
 if(!c||!c.active||c.environment!==environment.name||c.sponsorUid!==g.owner||!unexpired(c,now)||!g.scopes.every(scope=>c.scopeCeiling.includes(scope)))fail('CLIENT_REVOKED');
}
export function scopePermitted(scope,member,rowAccess='all') {
 const a=studioAccess(member);
 if(scope==='integrations:manage')return rowAccess==='all'&&a.access&&member.role==='superadmin';
 if(scope.startsWith('access:')||scope==='audit:read')return rowAccess==='all'&&a.access;
 if(scope.startsWith('content:')&&scope!=='content:published:read'||scope.startsWith('media:'))return rowAccess==='all'&&a.website&&can(member?.role,scope==='content:publish'?'publish':scope.endsWith(':write')?'edit':'read');
 if(['reservations:approve','stays:operate','inventory:write','promotions:write','settings:write','payments:record','payments:reverse','communications:retry','reservations:manual','loyalty:adjust'].includes(scope))return rowAccess==='all'&&a.bookings==='manager';
 if(['promotions:read','settings:read'].includes(scope))return rowAccess==='all'&&a.bookings!=='none';
 return true;
}
export function operationPermitted(operation,member,grant) {
 const d=definitionsById.get(operation);
 if(d){if(environment.preprod&&d.handler==='management'&&d.method!=='GET')return false;if(!(d.scopes||[d.scope]).every(s=>scopePermitted(s,member,grant.rowAccess)))return false;
 const a=studioAccess(member);if(['booking-manager','booking-staff'].includes(d.policy))return grant.rowAccess==='all'&&(d.policy==='booking-manager'?a.bookings==='manager':a.bookings!=='none');}
 return true;
}
export async function guardIntegrationTransaction(tx, db, token) {
  if (token._integration) {
    const s = await tx.get(grantCollection(db).doc(token._integration.id));
    assertGrant(s.data(), token);
    if(s.data()?.clientId)assertClient((await tx.get(db.collection(collectionName("integration_clients")).doc(s.data().clientId))).data(),s.data());
  }
}
export function requireScope(token, scope, operation) {
  const g = token._integration;
  if (!g || !g.scopes.includes(scope)) fail("INSUFFICIENT_SCOPE");
  if (g.purpose === "mcp-readonly" && !MCP_OPERATIONS.includes(operation))
    fail("OPERATION_NOT_ALLOWED");
  g.requiredScope = scope;
  g.operation = operation;
}
export async function verifyIntegration(db, auth, bearer) {
  const m = /^aroha_v1_(prd|ppr)_([a-f0-9]{32})_([A-Za-z0-9_-]{43})$/.exec(
    bearer || "",
  );
  if (!m) fail("INVALID_TOKEN", 401);
  if (m[1] !== (environment.preprod ? "ppr" : "prd"))
    fail("WRONG_ENVIRONMENT", 401);
  const snap = await grantCollection(db).doc(m[2]).get(),
    g = snap.data();
  const supplied = Buffer.from(digest(m[3]), "hex"),
    expected = Buffer.from(g?.secretHash || "0".repeat(64), "hex");
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    fail("INVALID_TOKEN", 401);
  let user;
  try {
    user = await auth.getUser(g.owner);
  } catch {
    fail("INVALID_TOKEN", 401);
  }
  if (
    user.disabled ||
    !user.emailVerified ||
    !user.providerData.some((p) => p.providerId === "google.com") ||
    Math.floor(Date.parse(user.tokensValidAfterTime || 0) / 1000) >
      Math.floor(g.issuedAfter / 1000)
  )
    fail("INVALID_TOKEN", 401);
  const token = {
    uid: user.uid,
    name: user.displayName || "Guest",
    email: user.email,
    email_verified: true,
    firebase: { sign_in_provider: "google.com" },
    _integration: {
      id: g.id,
      version: g.version,
      scopes: g.scopes,
      purpose: g.purpose,
      rowAccess: g.rowAccess,
    },
  };
  assertGrant(g, token);
  if(g.clientId)assertClient((await db.collection(collectionName("integration_clients")).doc(g.clientId).get()).data(),g);
  if (!isTester(token)) fail("PREPROD_TESTER_REQUIRED");
  if (g.rowAccess === "all") {
    const ms = await db
      .collection(sharedCollectionName("members"))
      .doc(token.uid)
      .get();
    const access=studioAccess(ms.data());if(access.bookings==="none"&&!access.website&&!access.access) fail("FORBIDDEN");
  }
  return token;
}
export async function tokenManagement(db, token, method, id, body, key) {
  if (
    token.email_verified !== true ||
    token.firebase?.sign_in_provider !== "google.com"
  )
    fail("VERIFIED_GOOGLE_ACCOUNT_REQUIRED");
  const col = grantCollection(db);
  if (method === "GET" && !id) {
    const result = await col.where("owner", "==", token.uid).limit(51).get();
    return {
      items: result.docs.slice(0, 50).map((d) => metadata(d.data())),
      nextCursor: null,
    };
  }
  if (method === "DELETE" && /^[a-f0-9]{32}$/.test(id || ""))
    return db.runTransaction(async (tx) => {
      const ref = col.doc(id),
        s = await tx.get(ref),
        g = s.data();
      if (!g || g.owner !== token.uid) fail("NOT_FOUND", 404);
      if (g.active) {
        tx.update(ref, { active: false, version: g.version + 1 });
        tx.set(db.collection(collectionName("audit")).doc(), {
          operation: "integration.token.revoked",
          actor: token.uid,
          entity: id,
          at: Date.now(),
        });
      }
      return { id, active: false };
    });
  if (method !== "POST" || id) fail("NOT_FOUND", 404);
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some(
      (k) =>
        !["name", "scopes", "purpose", "rowAccess", "expiresInHours", "clientId"].includes(
          k,
        ),
    )
  )
    fail("INVALID_REQUEST", 422);
  const {
    name,
    scopes,
    purpose = "integration",
    rowAccess = "own",
    expiresInHours = 24,
    clientId,
  } = body;
  if (
    clientId!==undefined&&!/^[a-f0-9-]{36}$/.test(clientId)||
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.length > 80 ||
    /[\x00-\x1f]/.test(name) ||
    !Array.isArray(scopes) ||
    !scopes.length ||
    scopes.length > SCOPES.length ||
    new Set(scopes).size !== scopes.length ||
    scopes.some((s) => !SCOPES.includes(s)) ||
    !["integration", "mcp-readonly", "mcp"].includes(purpose) ||
    !["own", "all"].includes(rowAccess) ||
    (expiresInHours !== null &&
      (!Number.isInteger(expiresInHours) ||
        expiresInHours < 1 ||
        expiresInHours > 168))
  )
    fail("INVALID_REQUEST", 422);
  if (
    purpose === "mcp-readonly" &&
    scopes.some((s) => !READ_SCOPES.includes(s))
  )
    fail("READ_ONLY_TOKEN_REQUIRED");
  if (!/^[A-Za-z0-9-]{8,100}$/.test(key || ""))
    fail("IDEMPOTENCY_KEY_REQUIRED", 400);
  const idValue = digest(token.uid + ":" + key).slice(0, 32),
    secret = randomBytes(32).toString("base64url"),
    now = Date.now();
  return db.runTransaction(async (tx) => {
    const ref = col.doc(idValue);
    const [old, ms, existing] = await Promise.all([
      tx.get(ref),
      tx.get(db.collection(sharedCollectionName("members")).doc(token.uid)),
      tx.get(col.where("owner", "==", token.uid).limit(51)),
    ]);
    if (old.exists) fail("TOKEN_ALREADY_ISSUED", 409);
    if (
      existing.size >= 50 ||
      existing.docs.filter((d) => d.data().active && unexpired(d.data(), now))
        .length >= 20
    )
      fail("TOKEN_LIMIT", 409);
    const access = studioAccess(ms.data());
    if(rowAccess==='all'&&access.bookings==='none'&&!access.website&&!access.access)fail('FORBIDDEN');
    if(!scopes.every(scope=>scopePermitted(scope,ms.data(),rowAccess)))fail('FORBIDDEN');
    if(clientId){const c=(await tx.get(db.collection(collectionName('integration_clients')).doc(clientId))).data();assertClient(c,{owner:token.uid,scopes});}
    const g = {
      id: idValue,
      owner: token.uid,
      name: name.trim(),
      scopes: [...scopes].sort(),
      purpose,
      rowAccess,
      version: 1,
      active: true,
      environment: environment.name,
      secretHash: digest(secret),
      ...(clientId?{clientId}:{}),
      createdAt: now,
      issuedAfter: (token.auth_time || Math.floor(now / 1000)) * 1000,
      expiresAt: expiresInHours === null ? null : now + expiresInHours * 3600000,
      ...(expiresInHours === null
        ? {}
        : { expireAt: new Date(now + expiresInHours * 3600000) }),
    };
    tx.set(ref, g);
    tx.set(db.collection(collectionName("audit")).doc(), {
      operation: "integration.token.created",
      expiresAt: g.expiresAt,
      actor: token.uid,
      entity: idValue,
      at: now,
    });
    return {
      ...metadata(g),
      token: `aroha_v1_${environment.preprod ? "ppr" : "prd"}_${idValue}_${secret}`,
    };
  });
}
