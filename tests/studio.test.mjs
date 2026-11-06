import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
async function mount(modules, handler) {
  const dom = new JSDOM('<div id="studio"></div>', {
      url: "https://aroharetreat.com/admin/#website",
      runScripts: "outside-only",
    }),
    w = dom.window,
    d = w.document;
  w.api = handler || (async () => ({
    session: {
      uid: "staff",
      email: "staff@example.test",
      role: "editor",
      modules,
    },
  }));
  w.login = async () => {};
  w.logout = async () => {};
  w.observeAuth = (fn) => (w.start = fn);
  w.confirm = () => false;
  const source = (
    await readFile(new URL("../website/studio.mjs", import.meta.url), "utf8")
  ).replace(/import \{[^\n]+\} from ['"]\.\/material-controls.mjs['"];/, 'const installMaterialControls=()=>{},confirmMaterial=async()=>window.confirm();').replace(
    /import \{[\s\S]*?\} from ["']\.\/firebase.mjs["'];/,
    "const {api,login,logout,observeAuth}=window;",
  );
  w.eval(source);
  await w.start({ uid: "staff" });
  return {
    w,
    d,
    close: () => w.close(),
    wait: () => new Promise((r) => setTimeout(r, 10)),
  };
}
test("one Studio preserves mounted module identity and draft state while switching", async () => {
  const ui = await mount({ website: true, bookings: "manager", access: false });
  try {
    const { w, d, wait } = ui;
    const website = d.querySelector("iframe");
    assert.equal(website.getAttribute("src"), "/admin/modules/website/");
    website.dataset.unsaved = "draft-kept";
    d.querySelector('[data-module="bookings"]').click();
    await wait();
    assert.equal(website.hidden, true);
    const booking = d.querySelector('iframe[src="/admin/modules/bookings/"]');
    assert.ok(booking);
    d.querySelector('[data-module="website"]').click();
    await wait();
    assert.equal(d.querySelector("iframe"), website);
    assert.equal(website.dataset.unsaved, "draft-kept");
    assert.equal(website.hidden, false);
    assert.equal(booking.hidden, true);
    assert.equal(d.querySelectorAll("iframe").length, 2);
  } finally {
    ui.close();
  }
});
test("module navigation shows only assigned capabilities and booking-only staff get no CMS frame", async () => {
  const ui = await mount({ website: false, bookings: "viewer", access: false });
  try {
    assert.equal(ui.d.querySelector('[data-module="website"]'), null);
    assert.equal(ui.d.querySelector('[data-module="access"]'), null);
    assert.equal(
      ui.d.querySelector("iframe").getAttribute("src"),
      "/admin/modules/bookings/",
    );
    assert.match(ui.d.querySelector("#studio-status").textContent, /read-only/);
  } finally {
    ui.close();
  }
});

test("shared access page preserves invitation listing, pagination and revocation", async () => {
  const calls=[];
  const ui=await mount({website:true,bookings:"manager",access:true},async(path,method)=>{calls.push({path,method}); if(path==="/session")return{session:{uid:"staff",email:"owner@example.test",role:"superadmin",modules:{website:true,bookings:"manager",access:true}}}; if(path==="/members")return{members:[]}; if(path==="/invitations")return{invitations:[{id:"pending-1",email:"invite@example.test",role:"editor",status:"pending",expiresAt:Date.now()+100000}],nextCursor:"next-page"}; if(path.includes("cursor="))return{invitations:[]}; return{ok:true};});
  try {ui.d.querySelector('[data-module="access"]').click(); await ui.wait(); assert.match(ui.d.querySelector("#studio-invitations").textContent,/invite@example.test/); ui.d.querySelector("[data-revoke-invite]").click(); await ui.wait(); assert.ok(calls.some(c=>c.path==="/invitations/pending-1"&&c.method==="DELETE")); ui.d.querySelector("#studio-more-invitations").click(); await ui.wait(); assert.ok(calls.some(c=>c.path==="/invitations?cursor=next-page"));}finally{ui.close();}
});
