import test from "node:test";
import assert from "node:assert/strict";
import { authAccountDirectory, exportAuthAccounts, listAuthAccounts } from "../functions/platform/accounts.mjs";

test("account directory carries Firebase page tokens and projects only supported fields", async () => {
  const call = [];
  const user = { uid: "guest", email: "guest@example.test", passwordHash: "omitted",
    providerData: [{ providerId: "google.com", uid: "provider-id" }],
    metadata: { creationTime: "Mon, 16 Nov 2026 00:00:00 GMT" } };
  const directory = authAccountDirectory({
    async listUsers(limit, token) {
      call.push([limit, token]);
      return { users: [user], pageToken: token ? undefined : "next" };
    },
  });
  const first = await listAuthAccounts(directory, { limit: 15 });
  assert.deepEqual(first, { items: [{
    uid: "guest", name: "", email: "guest@example.test", providers: ["google.com"],
    createdAt: "2026-11-16T00:00:00.000Z", lastSignInAt: null, disabled: false,
  }], nextCursor: "auth.next" });
  assert.equal((await listAuthAccounts(directory, { limit: 15, cursor: first.nextCursor })).nextCursor, null);
  assert.deepEqual(call, [[15, undefined], [15, "next"]]);
  await assert.rejects(listAuthAccounts(directory, { cursor: "test.15" }), { code: "CURSOR_EXPIRED" });
});

test("CSV covers multiple Firebase batches and neutralizes spreadsheet formulas", async () => {
  const user = { name: ' =1+1,"test"', uid: "guest", email: "guest@example.test", providers: ["google.com"] };
  let count = 0;
  const result = await exportAuthAccounts({
    async list(limit) {
      assert.equal(limit, 1000);
      count++;
      return { items: new Array(1000).fill(user), nextCursor: count < 10 ? "next" : null };
    },
  });
  assert.equal(count, 10);
  assert.equal(result.count, 10_000);
  assert.equal(result.csv.split("\r\n").length, 10_002);
  assert.ok(result.csv.includes(`"' =1+1,""test"""`));
});
