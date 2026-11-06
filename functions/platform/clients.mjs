import { randomUUID } from "node:crypto";
import { col, fail, version, queryPage, bounded } from "./core.mjs";
import { sharedCollectionName, environment } from "../environment.mjs";
const view = (c) => ({
  id: c.id,
  name: c.name,
  sponsorUid: c.sponsorUid,
  scopeCeiling: c.scopeCeiling,
  environment: c.environment,
  active: c.active,
  expiresAt: c.expiresAt,
  version: c.version,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});
const grantView = (g) => ({
  id: g.id,
  name: g.name,
  owner: g.owner,
  scopes: g.scopes,
  purpose: g.purpose,
  rowAccess: g.rowAccess,
  active: g.active,
  expiresAt: g.expiresAt,
  version: g.version,
  createdAt: g.createdAt,
});
export async function clientsHandler({ tx, db, ctx, input }) {
  const op = ctx.operation;
  if (op === "listIntegrationClients")
    return queryPage(
      tx,
      db,
      ctx,
      op,
      input,
      col(db, "integration_clients"),
      view,
    );
  if (op === "createIntegrationClient") {
    const sponsor = (
      await tx.get(
        db.collection(sharedCollectionName("members")).doc(input.sponsorUid),
      )
    ).data();
    if (!sponsor?.active) fail("ACTIVE_HUMAN_SPONSOR_REQUIRED", 409);
    if (input.expiresAt !== null && input.expiresAt <= ctx.now)
      fail("INVALID_EXPIRY");
    const item = {
      id: randomUUID(),
      name: input.name.trim(),
      sponsorUid: input.sponsorUid,
      scopeCeiling: input.scopeCeiling,
      environment: environment.name,
      active: true,
      expiresAt: input.expiresAt,
      version: 1,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    };
    tx.create(col(db, "integration_clients").doc(item.id), item);
    return view(item);
  }
  const ref = col(db, "integration_clients").doc(input.id),
    item = (await tx.get(ref)).data();
  if (!item) fail("NOT_FOUND", 404);
  if (op === "getIntegrationClient") return view(item);
  if (op === "listIntegrationGrants")
    return queryPage(
      tx,
      db,
      ctx,
      op + ":" + item.id,
      input,
      col(db, "integration_tokens").where("clientId", "==", item.id),
      grantView,
    );
  if (op === "revokeIntegrationGrant") {
    const grantRef = col(db, "integration_tokens").doc(input.grantId),
      grant = (await tx.get(grantRef)).data();
    if (!grant || grant.clientId !== item.id) fail("NOT_FOUND", 404);
    version(grant.version, input.expectedVersion);
    tx.update(grantRef, { active: false, version: grant.version + 1 });
    return { ...grantView(grant), active: false, version: grant.version + 1 };
  }
  version(item.version, input.expectedVersion);
  if (
    input.expiresAt !== undefined &&
    input.expiresAt !== null &&
    input.expiresAt <= ctx.now
  )
    fail("INVALID_EXPIRY");
  const next = {
    ...item,
    ...(input.name === undefined ? {} : { name: input.name.trim() }),
    ...(input.scopeCeiling === undefined
      ? {}
      : { scopeCeiling: input.scopeCeiling }),
    ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
    active:
      op === "revokeIntegrationClient" ? false : (input.active ?? item.active),
    version: item.version + 1,
    updatedAt: ctx.now,
  };
  tx.set(ref, next);
  return view(next);
}
