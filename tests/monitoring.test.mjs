import test from "node:test";
import assert from "node:assert/strict";

test("RUM loader requires live origin and explicit consent, deduplicates insertion and handles late withdrawal", async () => {
  const keys = ["window", "document", "localStorage", "location"],
    original = Object.fromEntries(
      keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]),
    );
  let choice = null;
  const scripts = [];
  try {
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { href: "https://aroharetreat.com/" },
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => choice },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        dispatchEvent() {},
        dtrum: {
          disable() {
            scripts[0].disabled = true;
          },
        },
      },
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        querySelector: () => scripts[0],
        createElement: () => ({ dataset: {} }),
        head: { append: (s) => scripts.push(s) },
      },
    });
    const { bootstrapRum, APPROVED_RUM_SCRIPT, monitoringPageAllowed } =
      await import("../website/rum-loader.mjs");
    bootstrapRum();
    assert.equal(scripts.length, 0);
    choice = "allowed";
    bootstrapRum("https://example.com/evil.js");
    assert.equal(scripts.length, 0);
    bootstrapRum();
    bootstrapRum();
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].src, APPROVED_RUM_SCRIPT);
    assert.equal(scripts[0].crossOrigin, "anonymous");
    choice = "denied";
    scripts[0].onload();
    assert.equal(scripts[0].disabled, true);
    for (const url of [
      "http://localhost:8773/",
      "https://aroharetreat.com/?preview=1",
      "https://aroharetreat.com/design/",
      "https://aroharetreat.com.evil.test/",
    ])
      assert.equal(monitoringPageAllowed(url), false);
  } finally {
    for (const [k, v] of Object.entries(original))
      if (v) Object.defineProperty(globalThis, k, v);
      else delete globalThis[k];
  }
});

test("map events require consent and allowlisted place/outcome values; extra fields never leave the browser", async () => {
  const original = Object.fromEntries(
    ["window", "localStorage"].map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  );
  let consent = "denied";
  const events = [];
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => consent },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener() {},
      dynatrace: { sendBizEvent: (name, data) => events.push({ name, data }) },
    },
  });
  try {
    const { track } =
      await import("../website/monitoring.mjs?map-contract-test");
    track("map.place-opened", { section: "pond", outcome: "selected" });
    assert.equal(events.length, 0);
    consent = "allowed";
    track("map.place-opened", {
      section: "unbounded-place",
      outcome: "selected",
    });
    track("map.fallback", {
      section: "map",
      outcome: "arbitrary failure text",
    });
    assert.equal(events.length, 0);
    track("map.place-opened", {
      section: "pond",
      outcome: "selected",
      email: "private@example.test",
      caption: "Private text",
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].data["event.authority"], "client-observed");
    assert.equal(events[0].data.section, "pond");
    assert.ok(!("email" in events[0].data));
    assert.ok(!("caption" in events[0].data));
    window.dynatrace = { sendEvent: (data) => events.push({ data }) };
    track("map.place-opened", {
      section: "house",
      outcome: "selected",
      email: "private@example.test",
    });
    assert.deepEqual(events.at(-1).data, {
      "event_properties.action": "map.place-opened",
      "event_properties.authority": "client-observed",
      "event_properties.section": "house",
      "event_properties.outcome": "selected",
    });
  } finally {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
