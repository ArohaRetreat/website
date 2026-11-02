import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateContent,
  packageAvailability,
  enquiryText,
} from "../functions/domain.mjs";
import { renderSite, esc } from "../website/render.mjs";
import { renderMap } from "../website/map-render.mjs";
import { renderLocationMap } from "../website/location-map.mjs";
import {
  initializeAnalytics,
  analyticsPageAllowed,
} from "../website/analytics.mjs";
import { renderHrudhiGuide } from "../website/hrudhi-guide.mjs";
const content = JSON.parse(
  await readFile(new URL("../website/content.json", import.meta.url)),
);
const nature = JSON.parse(
  await readFile(new URL("../website/nature-content.json", import.meta.url)),
);
test("package status is backwards compatible, validates state, and prevents a coming-soon booking enquiry", () => {
  validateContent(content);
  const legacy = structuredClone(content);
  legacy.packages.forEach((p) => delete p.availability);
  delete legacy.visit.address;
  delete legacy.visit.mapEmbedUrl;
  validateContent(legacy);
  assert.equal(
    packageAvailability(legacy.packages.find((p) => p.id === "wellness")),
    "coming-soon",
  );
  const bad = structuredClone(content);
  bad.packages[0].availability = "confirmed";
  assert.throws(() => validateContent(bad));
  assert.throws(
    () => enquiryText(content, { package: "wellness" }),
    /PACKAGE_COMING_SOON/,
  );
  const html = renderSite(content);
  assert.equal((html.match(/class="package-coming-soon"/g) || []).length, 1);
  assert.ok(html.includes('data-coming-soon="wellness"'));
});
test("location is a verified Google embed loaded only on request and arbitrary frame hosts are rejected", () => {
  const html = renderLocationMap(content, { esc });
  assert.match(html, /data-map-src="https:\/\/www.google.com\/maps\/embed/);
  assert.doesNotMatch(html, /<iframe[^>]*\ssrc=/);
  assert.ok(html.includes("maps.app.goo.gl/iXH5a4ri8orrh6G59"));
  for (const url of [
    "https://attacker.example/embed",
    "javascript:alert(1)",
    "https://www.google.com.evil.test/maps/embed?pb=x",
    "not a URL",
  ]) {
    const bad = structuredClone(content);
    bad.visit.mapEmbedUrl = url;
    assert.throws(
      () => validateContent(bad),
      (e) => e.code === "INVALID_MAP_URL",
    );
  }
  const injected = renderLocationMap(
    {
      ...content,
      visit: { ...content.visit, address: "<script>unsafe</script>" },
    },
    { esc },
  );
  assert.ok(injected.includes("&lt;script&gt;"));
});
test("old monitoring consent does not enable Google Analytics; withdrawing during import prevents initialization", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  let choice = null,
    loads = 0,
    enabled = 0,
    resolve;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k) => (k === "aroha-analytics" ? choice : "allowed") },
  });
  try {
    const load = async () => {
      loads++;
      return {
        enable: async () => {
          enabled++;
        },
      };
    };
    await initializeAnalytics({ load, enabled: true });
    assert.equal(loads, 0);
    choice = "allowed";
    const pending = initializeAnalytics({
      enabled: true,
      load: () => {
        loads++;
        return new Promise((r) => (resolve = r));
      },
    });
    choice = "denied";
    resolve({
      enable: async () => {
        enabled++;
      },
    });
    await pending;
    assert.equal(enabled, 0);
    choice = "allowed";
    await initializeAnalytics({ load, enabled: true });
    assert.equal(enabled, 1);
    assert.equal(loads, 2);
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});
test("guest account starts lazily and never imports admin API or Storage code", async () => {
  const source = await readFile(
    new URL("../website/guest-account.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /import\(['"]\.\/firebase-auth\.mjs['"]\)/);
  assert.ok(!source.includes("firebase.mjs"));
  const auth = await readFile(
    new URL("../website/firebase-auth.mjs", import.meta.url),
    "utf8",
  );
  assert.ok(auth.includes("browserSessionPersistence"));
  assert.ok(!auth.includes("firebase/storage"));
  assert.ok(!auth.includes("getAnalytics"));
  const home = renderSite(content),
    map = renderMap(content);
  assert.match(home, /data-guest-account/);
  assert.match(map, /data-guest-account/);
});
test("Hrudhi accompanies both public routes with one guide per view and escaped accessible labels", () => {
  const home = renderSite(content),
    map = renderMap(content);
  assert.equal((home.match(/data-hrudhi-guide="tour"/g) || []).length, 1);
  assert.equal((map.match(/data-hrudhi-guide="map"/g) || []).length, 1);
  assert.equal(
    renderHrudhiGuide("tour", { ...nature.hrudhi, enabled: false }, { esc }),
    "",
  );
  const guide = renderHrudhiGuide(
    "tour",
    { ...nature.hrudhi, portrait: '/assets/retreat/a.webp" onerror="evil' },
    { esc },
  );
  assert.ok(!guide.includes(' onerror="evil'));
  assert.ok(guide.includes("data-src="));
});

test("Analytics excludes admin, private drafts, aliases, HTTP and lookalike origins", () => {
  assert.equal(analyticsPageAllowed("https://aroharetreat.com/"), true);
  assert.equal(
    analyticsPageAllowed("https://aroharetreat.com/map/#pond"),
    true,
  );
  for (const url of [
    "https://aroharetreat.com/?preview=1",
    "https://aroharetreat.com/admin/",
    "https://aroha-retreat.web.app/",
    "http://aroharetreat.com/",
    "https://aroharetreat.com.evil.test/",
    "invalid",
  ]) {
    assert.equal(analyticsPageAllowed(url), false, url);
  }
});

test("signed-in names are bounded and guide updates preserve a host-selected custom asset", async () => {
  const { guestDisplayName } = await import("../website/guest-account.mjs");
  const { guideSheet } = await import("../website/hrudhi-guide.mjs");
  assert.equal(guestDisplayName({ displayName: "  Hrudhi  " }), "Hrudhi");
  assert.equal(guestDisplayName({ email: "private@example.test" }), "Guest");
  assert.equal(guestDisplayName({ displayName: "a".repeat(300) }).length, 80);
  assert.equal(
    guideSheet({ walkSheet: "/assets/retreat/hrudhi-walk-sheet-v1.webp" })
      .layout,
    "directions",
  );
  assert.deepEqual(guideSheet({ walkSheet: "/assets/retreat/custom.webp" }), {
    src: "/assets/retreat/custom.webp",
    layout: "legacy",
  });
});
