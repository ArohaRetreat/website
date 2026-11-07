import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
const source = (
  await readFile(
    new URL("../website/host-operations.mjs", import.meta.url),
    "utf8",
  )
)
  .replace(/import \{[^\n]+\} from ['"]\.\/material-controls.mjs['"];/, 'const installMaterialControls=()=>{},confirmMaterial=async()=>window.confirm();')
  .replaceAll("export async function", "async function")
  .replaceAll("export function", "function");
async function mount() {
  const dom = new JSDOM("<main></main>", {
      url: "https://example.test/admin/bookings/",
      runScripts: "outside-only",
    }),
    w = dom.window;
  w.confirm = () => true;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event("close"));
  };
  w.eval(
    source +
      "\nwindow.operations={mountHostOperations,openManualBooking,mountCreditWallet};",
  );
  return { dom, w, target: w.document.querySelector("main"), ...w.operations };
}
async function until(fn) {
  const end = Date.now() + 2000;
  while (Date.now() < end) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 2));
  }
  assert.fail("UI did not settle");
}
const submit = (w, f) =>
  f.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
test("customer desk starts empty, submits a private bounded lookup and safely displays long names", async () => {
  const m = await mount(),
    calls = [];
  try {
    await m.mountHostOperations(m.target, {
      tab: "guests",
      manager: true,
      call: async (op, input) => {
        calls.push({ op, input });
        return {
          items: [
            {
              id: "guest",
              name: "<img onerror=alert(1)> Very Long Synthetic Customer ".repeat(
                5,
              ),
              email: "long.synthetic@example.test",
              phone: "+12025550123",
            },
          ],
          hasMore: false,
        };
      },
    });
    assert.equal(calls.length, 0);
    m.target.querySelector("[name=mode]").value = "email";
    m.target.querySelector("[name=search]").value =
      "long.synthetic@example.test";
    submit(m.w, m.target.querySelector("form"));
    await until(() => m.target.querySelector("[data-customer-id]"));
    assert.equal(calls[0].op, "lookupCustomers");
    assert.equal(calls[0].input.limit, 10);
    assert.equal(calls[0].input.search, "long.synthetic@example.test");
    assert.equal(m.target.querySelectorAll("img").length, 0);
    assert.match(m.target.textContent, /Very Long Synthetic Customer/);
  } finally {
    m.dom.window.close();
  }
});
test("manual booking review precedes one confirmation and an uncertain response retries a frozen key and payload", async () => {
  const m = await mount(),
    calls = [];
  let tries = 0,
    saved;
  try {
    m.openManualBooking({
      identity: "host",
      units: [],
      call: async (op, input, key) => {
        calls.push({ op, input: JSON.parse(JSON.stringify(input)), key });
        if (op === "quoteManualBooking")
          return {
            id: "q".repeat(36),
            contact: input.customer,
            kind: input.kind,
            adults: input.adults,
            childrenCount: 0,
            arrival: input.arrival,
            departure: input.departure,
            unitNames: [],
            subtotalPaise: 700000,
            priceBenefitDiscountPaise: 0,
            loyaltyCredits: 0,
            loyaltyDiscountPaise: 0,
            totalPaise: 700000,
          };
        if (++tries === 1) throw Error("Synthetic response lost");
        return { id: "saved" };
      },
      onBooked: async (b) => {
        saved = b;
      },
    });
    const d = m.w.document.querySelector("dialog");
    for (const [k, v] of Object.entries({
      name: "Synthetic Walk-in",
      email: "walkin@example.test",
      phone: "+12025550123",
    }))
      d.querySelector(`[name=${k}]`).value = v;
    submit(m.w, d.querySelector("form"));
    assert.match(d.textContent, /Plan their visit/);
    d.querySelector("[name=arrival]").value = "2026-11-08";
    d.querySelector("[name=departure]").value = "2026-11-10";
    submit(m.w, d.querySelector("form"));
    await until(() => d.textContent.includes("Review & confirm"));
    assert.equal(calls.length, 1);
    assert.match(d.textContent, /walkin@example.test/);
    assert.match(d.textContent, /7,000/);
    d.querySelector("[name=consent]").checked = true;
    submit(m.w, d.querySelector("form"));
    await until(() => d.textContent.includes("uncertain"));
    assert.equal(d.querySelector("[data-back]"), null);
    submit(m.w, d.querySelector("form"));
    await until(() => saved);
    assert.equal(saved.id, "saved");
    assert.deepEqual(calls[1], calls[2]);
    assert.equal(m.w.document.querySelector("dialog"), null);
  } finally {
    m.dom.window.close();
  }
});
test("reservation filters are sent to server and each next page retains the same filter", async () => {
  const m = await mount(),
    calls = [];
  try {
    await m.mountHostOperations(m.target, {
      tab: "reservations",
      manager: false,
      openBooking: () => {},
      call: async (op, input) => {
        calls.push({ op, input });
        return { items: [], nextCursor: calls.length === 2 ? "cursor" : null };
      },
    });
    m.target.querySelector("[name=status]").value = "confirmed";
    m.target.querySelector("[name=reference]").value = "AR-SYNTHETIC";
    submit(m.w, m.target.querySelector("form"));
    await until(() => !m.target.querySelector("[data-more]").disabled);
    m.target.querySelector("[data-more]").click();
    await until(() => calls.length === 3);
    assert.equal(calls[1].input.status, "confirmed");
    assert.equal(calls[2].input.reference, "AR-SYNTHETIC");
    assert.equal(calls[2].input.cursor, "cursor");
  } finally {
    m.dom.window.close();
  }
});


test('review desk queries pending requests and pagination replaces rather than appends rows', async()=>{
 const m=await mount(),calls=[];const row=id=>({id,reference:'AR-'+id,kind:'individual',status:'pending_approval',arrival:'2026-11-08',departure:'2026-11-10',adults:1,childrenCount:0,totalPaise:700000});
 try{await m.mountHostOperations(m.target,{tab:'overview',manager:true,openBooking:()=>{},call:async(op,input)=>{calls.push({op,input});return{items:[row(input.cursor?'SECOND':'FIRST')],nextCursor:input.cursor?null:'next'};}});
 assert.equal(calls[0].input.status,'pending_approval');assert.equal(calls[0].input.limit,25);assert.match(m.target.textContent,/Review request/);
 m.target.querySelector('[data-more]').click();await until(()=>m.target.textContent.includes('AR-SECOND'));assert.ok(!m.target.textContent.includes('AR-FIRST'));assert.equal(m.target.querySelectorAll('[data-open]').length,1);
 m.target.querySelector('[data-previous]').click();await until(()=>m.target.textContent.includes('AR-FIRST'));assert.equal(calls[2].input.cursor,undefined);assert.equal(m.target.querySelector('[data-previous]').disabled,true);
 }finally{m.dom.window.close();}
});

test('walk-in draft survives Back and changing visit type with an empty arrival stays valid',async()=>{
 const m=await mount();try{
 m.openManualBooking({identity:'draft-host',units:[],call:async()=>{throw Error('No quote expected');},onBooked:()=>{}});
 let f=m.w.document.querySelector('dialog form');f.elements.name.value='Synthetic Draft';f.elements.email.value='draft@example.test';f.elements.phone.value='+12025550123';submit(m.w,f);
 f=m.w.document.querySelector('dialog form');f.elements.arrival.value='';f.elements.visitKind.value='event';f.querySelector('.visit-choices').dispatchEvent(new m.w.Event('change',{bubbles:true}));assert.equal(f.elements.kind.value,'event');assert.equal(f.elements.departure.hasAttribute('min'),false);
 f.elements.promo.value='DRAFT';f.dispatchEvent(new m.w.Event('input',{bubbles:true}));m.w.document.querySelector('[data-back]').click();submit(m.w,m.w.document.querySelector('dialog form'));assert.equal(m.w.document.querySelector('[name=promo]').value,'DRAFT');assert.equal(m.w.document.querySelector('[name=arrival]').value,'');
 }finally{m.dom.window.close();}
});
