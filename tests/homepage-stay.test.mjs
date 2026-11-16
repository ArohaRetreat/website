import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import content from "../website/content.json" with { type: "json" };
import { renderSite } from "../website/render.mjs";
import { bindHomepageStay, bookingToday, readHomepageStay } from "../website/homepage-stay.mjs";

test("the homepage exposes a labelled booking form immediately after the hero", () => {
  const dom = new JSDOM(renderSite(content), { url: "http://localhost/" });
  try {
    const d = dom.window.document;
    const section = d.querySelector(".field-hero").nextElementSibling;
    assert.equal(section.id, "book-your-stay");
    const form = section.querySelector("form");
    assert.equal(form.action, "http://localhost/book/");
    const arrival = form.elements.arrival;
    const departure = form.elements.departure;
    bindHomepageStay(form, new URLSearchParams("arrival=2026-11-20&departure=2026-11-22&adults=3"));
    assert.equal(arrival.value, "2026-11-20");
    assert.equal(form.elements.adults.value, "3");
    assert.equal(departure.min, "2026-11-21");
    arrival.value = "2026-11-22";
    arrival.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    assert.equal(departure.validity.rangeUnderflow, true);
  } finally { dom.window.close(); }
});

test("booking draft rejects invalid dates and counts and uses the IST day", () => {
  assert.equal(bookingToday(Date.parse("2026-11-16T18:31:00Z")), "2026-11-17");
  const today = "2026-11-17";
  const query = (arrival, departure, adults = 2) =>
    new URLSearchParams({ start: "stay", arrival, departure, adults });
  assert.deepEqual(readHomepageStay(query(today, "2026-11-18"), today), {
    arrival: today, departure: "2026-11-18", adults: 2,
  });
  assert.equal(readHomepageStay(query("2026-11-16", today), today), null);
  assert.equal(readHomepageStay(query("2026-11-31", "2026-12-03"), today), null);
  assert.equal(readHomepageStay(query(today, today), today), null);
  assert.equal(readHomepageStay(query(today, "2026-11-18", 11), today), null);
});
