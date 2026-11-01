import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateContent,
  classifyError,
  can,
  mayManage,
  expectedVersion,
  enquiryText,
  imageUrl,
  emailKey,
} from "../functions/domain.mjs";
import { renderSite } from "../website/render.mjs";
const seed = JSON.parse(
  await readFile(new URL("../website/content.json", import.meta.url), "utf8"),
);
const copy = () => structuredClone(seed);
test("published schema accepts the supplied retreat content and rejects unknown executable fields", () => {
  assert.equal(validateContent(copy()).schemaVersion, 1);
  const c = copy();
  c.script = "alert(1)";
  assert.throws(() => validateContent(c), /INVALID_CONTENT/);
});
test("CMS arrays reject duplicate IDs, unknown sections and oversized content", () => {
  let c = copy();
  c.cottages.push({ ...c.cottages[0] });
  assert.throws(() => validateContent(c), /DUPLICATE_ID/);
  c = copy();
  c.sections[0].id = "script";
  assert.throws(() => validateContent(c), /INVALID_SECTION/);
  c = copy();
  c.hero.title = "x".repeat(10000);
  assert.throws(() => validateContent(c), /INVALID_CONTENT/);
});
test("member roles enforce edit, publishing and access separation", () => {
  assert.equal(can("viewer", "edit"), false);
  assert.equal(can("editor", "edit"), true);
  assert.equal(can("editor", "publish"), false);
  assert.equal(can("admin", "publish"), true);
  assert.equal(can("editor", "access"), false);
  assert.equal(can("unknown", "read"), false);
});
test("access management cannot escalate to superadmin or manage peers as admin", () => {
  for (const actor of ["admin", "editor", "viewer"])
    assert.equal(mayManage(actor, "admin", "editor"), false);
  assert.equal(mayManage("superadmin", "superadmin", "viewer"), false);
  assert.equal(mayManage("superadmin", "viewer", "superadmin"), false);
  assert.equal(mayManage("superadmin", "viewer", "made-up-role"), false);
  assert.equal(mayManage("admin", "viewer", "editor"), true);
  assert.equal(mayManage("admin", "viewer", "admin"), false);
});
test("draft revisions reject stale and malformed expected versions", () => {
  expectedVersion(3, 3);
  assert.throws(() => expectedVersion(2, 3), /VERSION_CONFLICT/);
  for (const n of [-1, NaN, 1.5, "3"])
    assert.throws(() => expectedVersion(n, 3), /INVALID_VERSION/);
});
test("media URLs cannot escape into script or arbitrary tracking hosts", () => {
  imageUrl("/assets/retreat/DSC_3795.webp");
  imageUrl(
    "https://firebasestorage.googleapis.com/v0/b/aroha-retreat.firebasestorage.app/o/media%2Fimage.png?alt=media&token=example",
  );
  for (const url of [
    "javascript:alert(1)",
    "https://example.com/tracker.png",
    "//example.com/a.png",
    "/assets/retreat/../../a.png",
    "https://firebasestorage.googleapis.com/v0/b/other/o/media%2Fx",
  ])
    assert.throws(() => imageUrl(url), /INVALID_IMAGE_URL/);
});
test("rendering escapes admin content without interpreting markup", () => {
  const c = copy();
  c.hero.title = "<script>alert(1)</script>";
  c.cottages[0].name = 'Room " onclick="alert(1)';
  const html = renderSite(c);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>alert"));
  assert.ok(html.includes("Room &quot; onclick=&quot;"));
});
test("day enquiry excludes accommodation and overnight dates", () => {
  const text = enquiryText(seed, {
    package: "day",
    guests: "2",
    checkin: "2026-12-01",
    checkout: "",
    cottage: "aframe",
    name: "Test Guest",
    phone: "9999999999",
    message: "",
  });
  assert.ok(text.includes("Day Visit"));
  assert.ok(!text.includes("Preferred cottage"));
  assert.match(text, /Date: 2026-12-01\nGuests:/);
});
test("overnight enquiry validates calendar dates and preferred cottage", () => {
  const f = {
    package: "stay",
    guests: 2,
    checkin: "2026-12-01",
    checkout: "2026-12-02",
    cottage: "aframe",
    name: "Test Guest",
    phone: "9999999999",
    message: "Test only",
  };
  assert.ok(enquiryText(seed, f).includes("A-Frame Cottages"));
  assert.throws(
    () => enquiryText(seed, { ...f, checkout: "2026-12-01" }),
    /INVALID_CHECKOUT/,
  );
  assert.throws(
    () => enquiryText(seed, { ...f, checkin: "2026-02-31" }),
    /CHOOSE_DATE/,
  );
  assert.throws(
    () => enquiryText(seed, { ...f, cottage: "other" }),
    /INVALID_COTTAGE/,
  );
});
test("tariffs reject negative prices and contacts cannot carry executable URLs", () => {
  let c = copy();
  c.packages[0].price = -1;
  assert.throws(() => validateContent(c), /INVALID_PRICE/);
  c = copy();
  c.visit.mapUrl = "javascript:alert(1)";
  assert.throws(() => validateContent(c), /INVALID_MAP_URL/);
  assert.equal(emailKey("HOST@EXAMPLE.COM"), "host@example.com");
});

test("dependency failures retain bounded quota, timeout and contention classifications", () => {
  assert.equal(classifyError({ code: 8 }).code, "DEPENDENCY_QUOTA");
  assert.equal(classifyError({ code: 4 }).status, 504);
  assert.equal(classifyError({ code: 10 }).status, 409);
  assert.deepEqual(classifyError({ message: "private vendor details" }), {
    code: "INTERNAL_ERROR",
    status: 500,
  });
});

test("illustrated hero assets remain optional for existing published records and enforce media URL policy", () => {
  const old = copy();
  for (const key of ["worldImage", "eveningImage", "foregroundImage"]) delete old.hero[key];
  assert.equal(validateContent(old).schemaVersion, 1);
  assert.ok(renderSite(old).includes(old.hero.image));
  for (const key of ["worldImage", "eveningImage", "foregroundImage"]) {
    const invalid = copy(); invalid.hero[key] = "https://example.com/tracker.png";
    assert.throws(() => validateContent(invalid), /INVALID_IMAGE_URL/);
  }
});
