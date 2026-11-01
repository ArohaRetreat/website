import test from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_ORIGIN, isAllowedOrigin } from "../functions/origins.mjs";
test("canonical and legacy origins are admitted without widening authentication or trusting lookalikes", () => {
  assert.equal(PUBLIC_ORIGIN, "https://aroharetreat.com");
  for (const origin of [PUBLIC_ORIGIN, "https://aroha-retreat.web.app", "https://aroha-retreat.firebaseapp.com", undefined])
    assert.equal(isAllowedOrigin(origin), true);
  for (const origin of ["https://aroharetreat.com.evil.test", "https://evil.test", "http://aroharetreat.com", "https://aroharetreat.com:444", "https://www.aroharetreat.com", "null", "http://localhost:8770"])
    assert.equal(isAllowedOrigin(origin), false, origin);
  assert.equal(isAllowedOrigin("http://localhost:8770", true), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:8770", true), true);
  assert.equal(isAllowedOrigin("https://evil.test", true), false);
});
