import test from "node:test";
import assert from "node:assert/strict";
import {
  createRumIdentity,
  monitoringUserTag,
} from "../website/rum-identity.mjs";
test("RUM uses UID only; logout and consent changes cannot leak a former identity", () => {
  const sent = [],
    jobs = [];
  let allowed = false,
    ready = false;
  const identity = createRumIdentity({
    agent: () => (ready ? { identifyUser: (v) => sent.push(v) } : null),
    consented: () => allowed,
    schedule: (fn) => {
      jobs.push(fn);
      return fn;
    },
    cancel: () => {},
  });
  identity.setUser({
    uid: "first",
    displayName: "Private Name",
    email: "private@example.test",
  });
  assert.deepEqual(sent, []);
  allowed = true;
  identity.sync();
  identity.setUser({ uid: "second" });
  ready = true;
  jobs.forEach((fn) => fn());
  assert.deepEqual(sent, ["firebase:second"]);
  identity.setUser(null);
  assert.equal(sent.at(-1), "");
  identity.setUser({ uid: "third" });
  allowed = false;
  identity.withdraw();
  assert.equal(sent.at(-1), "");
  identity.destroy();
  assert.ok(sent.every((s) => !s.includes("@") && !s.includes("Private")));
  assert.equal(monitoringUserTag({ uid: "bad\nvalue" }), "");
});
test("new RUM readiness retries are bounded and destruction cancels delayed identity", () => {
  const jobs = [];
  let calls = 0;
  const identity = createRumIdentity({
    agent: () => null,
    consented: () => true,
    schedule: (fn) => {
      jobs.push(fn);
      calls++;
      return fn;
    },
    cancel: () => {},
  });
  identity.setUser({ uid: "test" });
  while (jobs.length) jobs.shift()();
  assert.equal(calls, 19);
  identity.destroy();
});
