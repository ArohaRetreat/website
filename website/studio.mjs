import { studioStatus } from "./studio-feedback.mjs";
import {installMaterialControls, confirmMaterial} from './material-controls.mjs';
installMaterialControls();
import { api, login, logout, observeAuth } from "./firebase.mjs";
const root = document.querySelector("#studio"),
  frames = new Map();
let session,
  dirty = false,
  generation = 0;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const modules = () => [
  ...(["viewer", "manager"].includes(session?.modules?.bookings) ? ["bookings"] : []),
  ...(session?.modules?.website ? ["website"] : []),
  ...(session?.modules?.access ? ["access"] : []),
];
const labels = {
  website: "Website changes",
  bookings: "Bookings",
  access: "People & access",
};
function message(text) {
  document.querySelector("#studio-status").textContent = text;
}
function loginScreen(error = "") {
  frames.clear();
  document.body.classList.remove("booking-workspace","booking-navigation-ready");
  root.innerHTML = `<main class="studio-login"><img src="/assets/brand/logo-forest.svg" alt="Aroha Retreat" width="190"><h1>Host Studio</h1><p>One workspace for your website and bookings. Your access determines which modules you can use.</p><p role="status" data-studio-session-status>${esc(error)}</p><button id="studio-login">Sign in with Google</button><a href="/">Return to Aroha</a></main>`;
  const signIn = document.querySelector("#studio-login");
  signIn.onclick = () => {
    signIn.disabled = true;
    studioStatus(root.querySelector("[data-studio-session-status]"), "Opening Google sign-in…", true);
    void login().catch(() => loginScreen("Sign-in could not complete. Please try again."));
  };
}
function shell() {
  root.innerHTML = `<header class="studio-bar"><a href="/"><img src="/assets/brand/logo-white.svg" alt="Aroha Retreat" width="142"></a><strong>Host Studio</strong><nav aria-label="Studio modules">${modules()
    .map((m) => `<button data-module="${m}">${labels[m]}</button>`)
    .join(
      "",
    )}</nav><span data-dt-mask>${esc(session.email)}</span><button id="studio-signout">Sign out</button></header><p id="studio-status" role="status">${session.modules.bookings === "viewer" ? "Booking access is read-only." : ""}</p><main id="studio-workspace"><section id="studio-access" hidden></section></main>`;
  document.querySelectorAll("[data-module]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.module === "access") {accessCursor = ""; inviteCursor = "";}
        location.hash = b.dataset.module;
      }),
  );
  document.querySelector("#studio-signout").onclick = async () => {
    if (
      dirty &&
      !await confirmMaterial("There are unsaved website changes. Sign out and discard them?")
    )
      return;
    await logout();
  };
  void showModule();
}
async function showModule() {
  if (!session) return;
  let selected = location.hash.slice(1);
  if (!modules().includes(selected)) selected = modules()[0];
  if (!selected) {
    message("No Studio modules have been assigned. Contact the retreat owner.");
    return;
  }
  document.querySelectorAll("[data-module]").forEach((b) => {
    if (b.dataset.module === selected) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  for (const [m, f] of frames) {
    f.hidden = m !== selected;
    f.inert = m !== selected;
    f.contentWindow?.postMessage(
      { type: "aroha-studio-visibility", visible: m === selected },
      location.origin,
    );
  }
  document.body.classList.toggle("booking-workspace", selected === "bookings");
  const access = document.querySelector("#studio-access");
  access.hidden = selected !== "access";
  if (selected === "access") {
    await renderAccess();
    return;
  }
  if (!frames.has(selected)) {
    const frame = document.createElement("iframe");
    frame.title = labels[selected];
    frame.src = "/admin/modules/" + selected + "/";
    frame.className = "studio-module";
    if (selected === "bookings") frame.addEventListener("load", shareBookingNavigation);
    document.querySelector("#studio-workspace").append(frame);
    frames.set(selected, frame);
  }
}
async function renderAccess() {
  const target = document.querySelector("#studio-access");
  target.innerHTML = '<p role="status" data-studio-progress>Loading access settings…</p>';
  try {
    const { members, nextCursor } = await api(
      "/members" +
        (accessCursor ? "?cursor=" + encodeURIComponent(accessCursor) : ""),
    );
    target.innerHTML = `<h1>People & access</h1><p>Website permission is independent of booking access. Existing roles still govern website editing, publishing and who can manage access.</p><form id="studio-invite"><h2>Invite a staff member</h2><label>Email<input name="email" type="email" maxlength="254" required></label><label>Website role<select name="role">${(session.role === "superadmin" ? ["admin", "editor", "viewer"] : ["editor", "viewer"]).map((r) => `<option>${r}</option>`).join("")}</select></label><label><input type="checkbox" name="websiteAccess" checked>Website access</label><label>Bookings<select name="bookingAccess"><option value="none">No access</option><option value="viewer">View bookings</option><option value="manager">Manage bookings</option></select></label><button>Generate invitation</button><p id="invite-status" role="status"></p></form><div id="studio-members">${members
      .map((m) => {
        const editable =
          m.id !== session.uid &&
          m.role !== "superadmin" &&
          (session.role === "superadmin" ||
            ["viewer", "editor"].includes(m.role));
        return `<form data-member="${esc(m.id)}" data-version="${m.version || 0}"><h2 data-dt-mask>${esc(m.email)}</h2><fieldset ${editable ? "" : "disabled"}><label>Role<select name="role">${(m.role === "superadmin" ? ["superadmin"] : ["admin", "editor", "viewer"]).map((r) => `<option ${m.role === r ? "selected" : ""} ${r === "admin" && session.role !== "superadmin" ? "disabled" : ""}>${r}</option>`).join("")}</select></label><label><input name="active" type="checkbox" ${m.active ? "checked" : ""}>Active</label><label><input name="websiteAccess" type="checkbox" ${m.websiteAccess !== false ? "checked" : ""}>Website access</label><label>Bookings<select name="bookingAccess">${["none", "viewer", "manager"].map((v) => `<option value="${v}" ${(m.bookingAccess ?? (["admin", "superadmin"].includes(m.role) ? "manager" : "none")) === v ? "selected" : ""}>${v === "none" ? "No access" : v === "viewer" ? "View bookings" : "Manage bookings"}</option>`).join("")}</select></label><button>Save access</button></fieldset></form>`;
      })
      .join(
        "",
      )}</div><section><h2>Invitations</h2><div id="studio-invitations"></div></section>${nextCursor ? '<p>More staff exist. Use the next page to review their access.</p><button id="studio-more-members">Next page</button>' : ""}`;
    await renderInvitations();
    document.querySelector("#studio-invite").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      try {
        const r = await api("/invitations", "POST", {
          email: f.get("email"),
          role: f.get("role"),
          websiteAccess: f.has("websiteAccess"),
          bookingAccess: f.get("bookingAccess"),
        });
        inviteCursor = "";
        await renderInvitations();
        document.querySelector("#invite-status").textContent =
          "Invitation ready: " +
          r.inviteUrl +
          " — share it with the invited person. No email was sent.";
      } catch {
        message("Invitation could not be saved. Check your access and retry.");
      }
    };
    target.querySelectorAll("[data-member]").forEach(
      (form) =>
        (form.onsubmit = async (e) => {
          e.preventDefault();
          const f = new FormData(form);
          try {
            await api("/members/" + form.dataset.member, "POST", {
              expectedVersion: Number(form.dataset.version),
              role: f.get("role"),
              active: f.has("active"),
              websiteAccess: f.has("websiteAccess"),
              bookingAccess: f.get("bookingAccess"),
            });
            message("Access updated.");
            await renderAccess();
          } catch {
            message(
              "Access could not be updated. Refresh and check your permission.",
            );
          }
        }),
    );
    // Cursor navigation is bounded; no staff are silently omitted from access management.
    if (nextCursor)
      document.querySelector("#studio-more-members").onclick = () =>
        renderAccessPage(nextCursor);
  } catch {
    target.textContent =
      "Access settings could not load. Your permissions may have changed.";
  }
}
// Reuse rendering while explicitly carrying the server-issued staff cursor.
let accessCursor = "", inviteCursor = "";
async function renderInvitations() {
  const target = document.querySelector("#studio-invitations");
  try {
    const {invitations, nextCursor} = await api("/invitations" + (inviteCursor ? "?cursor=" + encodeURIComponent(inviteCursor) : ""));
    target.innerHTML = invitations.map(i => `<article class="studio-invitation"><strong data-dt-mask>${esc(i.email)}</strong><p>${esc(i.role)} · ${esc(i.status === "pending" && i.expiresAt < Date.now() ? "expired" : i.status)}</p>${i.status === "pending" ? `<button data-revoke-invite="${esc(i.id)}">Revoke invitation</button>` : ""}</article>`).join("") || "<p>No invitations yet.</p>";
    if (nextCursor) target.insertAdjacentHTML("beforeend", '<button id="studio-more-invitations">Next invitations</button>');
    target.querySelectorAll("[data-revoke-invite]").forEach(b => b.onclick = async () => { try {await api("/invitations/" + encodeURIComponent(b.dataset.revokeInvite), "DELETE"); await renderInvitations(); message("Invitation revoked.");} catch {message("Invitation could not be revoked. Check your access.");} });
    if (nextCursor) target.querySelector("#studio-more-invitations").onclick = () => {inviteCursor = nextCursor; void renderInvitations();};
  } catch { target.textContent = "Invitations could not load. Refresh and check your access."; }
}
async function renderAccessPage(cursor) {
  accessCursor = cursor;
  await renderAccess();
}
function shareBookingNavigation() {
  frames.get("bookings")?.contentWindow?.postMessage({
    type:"aroha-studio-navigation",
    website:modules().includes("website"),
    access:modules().includes("access"),
  },location.origin);
}
window.addEventListener("message", (event) => {
  if (event.origin !== location.origin || !session) return;
  if (event.source === frames.get("website")?.contentWindow && event.data?.type === "aroha-studio-dirty")
    dirty = event.data.dirty === true;
  if (event.source !== frames.get("bookings")?.contentWindow) return;
  if (event.data?.type === "aroha-studio-bookings-ready") shareBookingNavigation();
  if (event.data?.type === "aroha-studio-navigation-ready")
    document.body.classList.add("booking-navigation-ready");
  if (event.data?.type === "aroha-studio-open-module" && ["website","access"].includes(event.data.module) && modules().includes(event.data.module))
    location.hash = event.data.module;
});
window.addEventListener("hashchange", () => void showModule());
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
observeAuth(async (user) => {
  const current = ++generation;
  if (!user) {
    session = null;
    dirty = false;
    loginScreen();
    return;
  }
  const status = root.querySelector("[data-studio-session-status]");
  if (status) studioStatus(status, "Verifying your Studio access…", true);
  try {
    const r = await api("/session", "POST", {});
    if (current !== generation) return;
    session = r.session;
    frames.clear();
    shell();
  } catch {
    if (current === generation)
      loginScreen("This account does not have active Host Studio access.");
  }
});
