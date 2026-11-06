import test from "node:test";
import assert from "node:assert/strict";
import { routes, matchRoute } from "../functions/external/routes.mjs";
import {
  SCOPES,
  READ_SCOPES,
  MCP_OPERATIONS,
  assertGrant,
} from "../functions/external/access.mjs";
import { projectReservation, expected } from "../functions/external/read.mjs";
test("external route inventory has unique operations, explicit scopes and no MCP business mutation", () => {
  assert.equal(new Set(routes.map((r) => r[2])).size, routes.length);
  assert.ok(routes.every((r) => SCOPES.includes(r[3])));
  for (const r of routes.filter((r) => MCP_OPERATIONS.includes(r[2])))
    assert.equal(r[0], "GET");
  assert.ok(READ_SCOPES.every((s) => s.endsWith(":read")));
  assert.equal(matchRoute("POST", "/reservations/../../x"), null);
});
test("projection removes customer/financial free text and stale preconditions are bounded", () => {
  const r = projectReservation({
    id: "test",
    owner: "private-owner",
    contact: { name: "private-name" },
    note: "private-note",
    version: 1,
    total: 120000,
    status: "confirmed",
    arrival: "2026-12-01",
    departure: "2026-12-02",
  });
  assert.ok(
    !JSON.stringify(r).includes("private-name") &&
      !("owner" in r) &&
      !("note" in r),
  );
  assert.equal(r.totalPaise, 120000);
  assert.throws(
    () => expected(undefined, "reservation", "test"),
    (e) => e.status === 428,
  );
  assert.throws(
    () => expected("*", "reservation", "test"),
    (e) => e.status === 412,
  );
});
test("mutation grant recheck rejects changed/revoked/expired grants and MCP non-read operations", () => {
  const token = {
    uid: "guest",
    _integration: {
      id: "grant",
      version: 1,
      scopes: ["reservations:read"],
      rowAccess: "own",
      purpose: "mcp-readonly",
      requiredScope: "reservations:read",
      operation: "getReservation",
    },
  };
  const g = {
    owner: "guest",
    version: 1,
    scopes: ["reservations:read"],
    rowAccess: "own",
    purpose: "mcp-readonly",
    active: true,
    environment: "production",
    expiresAt: Date.now() + 10000,
  };
  assert.doesNotThrow(() => assertGrant(g, token));
  const permanent = { ...g, expiresAt: null };
  assert.doesNotThrow(() => assertGrant(permanent, token, Date.now() + 365 * 86400000));
  assert.throws(() => assertGrant({ ...permanent, active: false }, token));
  assert.throws(() => assertGrant({ ...permanent, version: 2 }, token));
  for (const patch of [
    { active: false },
    { version: 2 },
    { expiresAt: 0 },
    ...[undefined, "", "never", Number.NaN, Number.POSITIVE_INFINITY].map(expiresAt => ({ expiresAt })),
    { owner: "other" },
    { rowAccess: "all" },
    { scopes: [] },
  ])
    assert.throws(() => assertGrant({ ...g, ...patch }, token));
  assert.throws(() =>
    assertGrant(g, {
      ...token,
      _integration: { ...token._integration, operation: "createReservation" },
    }),
  );
});

test('both environment Hosting configs route external API to the matching function', async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const [file,id]of [['firebase.json','arohaApi'],['firebase.preprod.json','arohaApiPreprod']]){const c=JSON.parse(await readFile(new URL('../'+file,import.meta.url)));const r=c.hosting.rewrites.find(r=>r.source==='/api/external/v1/**');assert.equal(r?.function?.functionId,id);}
});
