// DOM interaction tests, not a rendering engine or physical-device certification.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { JSDOM, VirtualConsole } from "jsdom";
import { createPrototypeServer } from "../prototypes/booking/server.mjs";

const waitFor = async (fn) => {
  for (let i = 0; i < 400; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw Error("DOM condition timed out");
};
test("guest request → host approval → guest note/date change → host change approval → cancellation", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "aroha-booking-dom-")),
    server = await createPrototypeServer({
      stateFile: path.join(folder, "state.json"),
    }),
    errors = [];
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const source = await readFile(
    new URL("../prototypes/booking/app.mjs", import.meta.url),
    "utf8",
  );
  const contexts = [];
  async function context(route) {
    const console = new VirtualConsole();
    console.on("jsdomError", (e) => errors.push(e));
    const html = await (await fetch(origin + route)).text(),
      dom = new JSDOM(html, {
        url: origin + route,
        runScripts: "outside-only",
        virtualConsole: console,
      });
    contexts.push(dom);
    let cookie = "";
    const w = dom.window;
    w.scrollTo = () => {};
    w.confirm = () => true;
    w.HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    w.HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
      this.dispatchEvent(new w.Event("close"));
    };
    w.fetch = async (url, options = {}) => {
      const response = await fetch(new URL(url, origin), {
        ...options,
        headers: {
          ...options.headers,
          ...(cookie ? { Cookie: cookie } : {}),
          Origin: origin,
        },
      });
      const next = response.headers.get("set-cookie");
      if (next) cookie = next.split(";")[0];
      return response;
    };
    await w.eval("(async()=>{" + source + "})()");
    const doc = w.document;
    const click = async (selector) => {
      const el = doc.querySelector(selector);
      assert.ok(el, "Missing " + selector);
      el.click();
      await waitFor(() => !doc.querySelector("#app[aria-busy]"));
    };
    const submit = async (selector) => {
      doc
        .querySelector(selector)
        .dispatchEvent(
          new w.Event("submit", { bubbles: true, cancelable: true }),
        );
      await waitFor(() => !doc.querySelector("#app[aria-busy]"));
    };
    return { w, doc, click, submit };
  }
  try {
    const guest = await context("/prototype/booking/");
    assert.match(guest.doc.querySelector("h1").textContent, /closer/);
    await guest.click("#account");
    await guest.click('[data-persona="guest-1"]');
    await guest.submit("#search-form");
    assert.match(guest.doc.querySelector("h1").textContent, /corner/);
    await guest.click('[data-room="cottage-1"]');
    await guest.click("#review");
    guest.doc.querySelector("#promo").value = "SLOWDAYS";
    await guest.click("#apply-promo");
    assert.match(guest.doc.querySelector(".summary").textContent, /7,560/);
    guest.doc.querySelector("#note").value = "A quiet sample arrival";
    guest.doc.querySelector("#terms").checked = true;
    await guest.submit("#request-form");
    assert.match(
      guest.doc.querySelector("#detail").textContent,
      /Your request is with your hosts/,
    );
    await guest.click("#see-request");
    assert.ok(
      [...guest.doc.querySelectorAll("#detail button")].some(
        (b) => b.textContent === "Edit private request",
      ),
    );
    guest.doc.querySelector("#detail").close();
    const host = await context("/prototype/studio/");
    await host.click("#host-login");
    const request = [...host.doc.querySelectorAll(".visit-card")].find((c) =>
      c.textContent.includes("Cottage 01"),
    );
    assert.ok(request);
    const id = request.querySelector("[data-booking]").dataset.booking;
    await host.click(`[data-booking="${id}"]`);
    await host.click('[data-action="approve"]');
    assert.match(
      host.doc.querySelector("#detail .badge").textContent,
      /Confirmed/,
    );
    host.doc.querySelector("#detail").close();
    guest.w.dispatchEvent(new guest.w.Event("focus"));
    await waitFor(() =>
      [...guest.doc.querySelectorAll(".badge")].some((b) =>
        b.textContent.includes("Confirmed"),
      ),
    );
    await guest.click(`[data-booking="${id}"]`);
    const edit = [...guest.doc.querySelectorAll("#detail button")].find(
      (b) => b.textContent === "Edit private request",
    );
    assert.equal(typeof edit.onclick, "function", String(edit.onclick));
    edit.click();
    assert.ok(
      guest.doc.querySelector("#edit-note textarea"),
      guest.doc.querySelector("#detail").outerHTML +
        " " +
        errors.map((e) => e.message).join("|"),
    );
    guest.doc.querySelector("#edit-note textarea").value =
      "Updated quiet arrival";
    await guest.submit("#edit-note");
    assert.match(
      guest.doc.querySelector(".private-note").textContent,
      /Updated quiet arrival/,
    );
    const change = [...guest.doc.querySelectorAll("#detail button")].find(
      (b) => b.textContent === "Request new dates",
    );
    change.click();
    const arrival = guest.doc.querySelector("[name=arrival]");
    const changedArrival = new Date(
      Date.parse(arrival.value + "T00:00:00Z") + 14 * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    arrival.value = changedArrival;
    guest.doc.querySelector("[name=departure]").value = new Date(
      Date.parse(changedArrival + "T00:00:00Z") + 2 * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    await guest.submit("#change-form");
    await guest.click("#send-change");
    assert.match(
      guest.doc.querySelector("#detail").textContent,
      /Date change awaiting host review/,
    );
    host.w.dispatchEvent(new host.w.Event("focus"));
    await waitFor(() => !host.doc.querySelector("#app[aria-busy]"));
    await host.click('[data-host-tab="reservations"]');
    await host.click(`[data-booking="${id}"]`);
    const approveChange = [...host.doc.querySelectorAll("#detail button")].find(
      (b) => b.textContent === "Approve new dates",
    );
    assert.ok(approveChange);
    approveChange.click();
    await waitFor(() => !host.doc.querySelector("#app[aria-busy]"));
    assert.ok(
      host.doc
        .querySelector(".detail-dates")
        .textContent.includes(String(Number(changedArrival.slice(-2)))),
    );
    host.doc.querySelector("#detail").close();
    guest.doc.querySelector("#detail").close();
    guest.w.dispatchEvent(new guest.w.Event("focus"));
    await waitFor(() => !guest.doc.querySelector("#app[aria-busy]"));
    await guest.click(`[data-booking="${id}"]`);
    await guest.click("[data-cancel]");
    await guest.click("#confirm-cancel");
    assert.match(
      guest.doc.querySelector("#detail .badge").textContent,
      /Cancelled/,
    );
    for (const tab of [
      "calendar",
      "inventory",
      "offers",
      "guests",
      "settings",
      "website",
    ]) {
      await host.click(`[data-host-tab="${tab}"]`);
      assert.ok(host.doc.querySelector("#main h1"));
    }
    await host.click('[data-host-tab="offers"]');
    await host.click("#new-promo");
    host.doc.querySelector("[name=code]").value = "DOMREVIEW";
    await host.submit("#promo-form");
    assert.match(host.doc.querySelector("#main").textContent, /DOMREVIEW/);
    await host.click('[data-host-tab="settings"]');
    host.doc.querySelector("[name=capacity]").value = "12";
    await host.submit("#settings-form");
    assert.equal(host.doc.querySelector("[name=capacity]").value, "12");
    await host.click('[data-host-tab="reservations"]');
    await host.click("#manual-reservation");
    await host.submit("#manual-form");
    await host.click("#create-manual");
    assert.match(
      host.doc.querySelector("#detail .badge").textContent,
      /Awaiting host approval/,
    );
    assert.deepEqual(errors, []);
  } finally {
    contexts.forEach((d) => d.window.close());
    await new Promise((r) => server.close(r));
    await rm(folder, { recursive: true, force: true });
  }
});
