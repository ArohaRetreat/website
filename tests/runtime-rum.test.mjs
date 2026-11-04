import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
test("pre-production RUM rejects production metadata and waits for optional consent after loading its own tag", async () => {
  const keys = ["window", "document", "localStorage", "location", "fetch"];
  const original = Object.fromEntries(
    keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]),
  );
  const output = await build({
    entryPoints: ["website/rum-loader.mjs"],
    bundle: true,
    minify: true,
    write: false,
    format: "esm",
    platform: "browser",
    define: { __AROHA_ENVIRONMENT__: JSON.stringify("pre-prod") },
  });
  const source = output.outputFiles[0].text;
  assert.ok(!source.includes("224aa943b980c761"));
  try {
    for (const responseEnvironment of ["production", "pre-prod"]) {
      let consent = "denied",
        requests = 0;
      const scripts = [];
      const values = {
        location: { href: "https://aroha-retreat-preprod.web.app/book/" },
        localStorage: { getItem: () => consent },
        window: { dispatchEvent() {} },
        document: {
          querySelector: () => scripts[0],
          createElement: () => ({ dataset: {} }),
          head: { append: (s) => scripts.push(s) },
        },
        fetch: async () => {
          requests++;
          return {
            ok: true,
            json: async () => ({
              environment: responseEnvironment,
              rumScriptUrl:
                "https://js-cdn.dynatrace.com/jstag/18b1df4492a/bf12470wrz/a3e7eb9a9573a1c9_complete.js",
            }),
          };
        },
      };
      for (const [key, value] of Object.entries(values))
        Object.defineProperty(globalThis, key, { configurable: true, value });
      const module = await import(
        "data:text/javascript;base64," +
          Buffer.from(source + "\n//" + responseEnvironment).toString("base64")
      );
      await module.bootstrapRuntimeRum();
      assert.equal(scripts.length, 0);
      consent = "allowed";
      await module.bootstrapRuntimeRum();
      await module.bootstrapRuntimeRum();
      assert.equal(requests, 1);
      assert.equal(scripts.length, responseEnvironment === "pre-prod" ? 1 : 0);
      if (scripts.length)
        assert.ok(scripts[0].src.includes("a3e7eb9a9573a1c9"));
    }
  } finally {
    for (const [key, value] of Object.entries(original))
      if (value) Object.defineProperty(globalThis, key, value);
      else delete globalThis[key];
  }
});
