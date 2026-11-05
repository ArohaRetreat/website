import { createConsentNotice } from "./consent-notice.mjs";
import { esc } from "./render.mjs";
let modulePromise;
const loadAuth = () =>
  (modulePromise ||= import("./firebase-auth.mjs").catch((e) => {
    modulePromise = null;
    throw e;
  }));
const messages = {
  "auth/popup-blocked":
    "The sign-in window was blocked. Allow the popup and try again.",
  "auth/popup-closed-by-user":
    "Sign-in was closed. You can try again whenever you’re ready.",
  "auth/cancelled-popup-request": "A sign-in window is already open.",
  "auth/network-request-failed":
    "Google sign-in could not connect. Check your connection and try again.",
  "auth/unauthorized-domain":
    "Sign-in is unavailable on this preview. Please use aroharetreat.com.",
};
export function guestDisplayName(user) {
  return typeof user?.displayName === "string" && user.displayName.trim()
    ? user.displayName.trim().slice(0, 80)
    : "Guest";
}

export function googlePhotoUrl(user) {
  const providerPhoto = user?.providerData?.find(p => p.providerId === "google.com")?.photoURL;
  for (const value of [providerPhoto, user?.photoURL]) {
    try { const u = new URL(value); if (u.protocol === "https:" && (u.hostname === "googleusercontent.com" || u.hostname.endsWith(".googleusercontent.com")) && !u.username && !u.password) return u.href; } catch {}
  }
  return "";
}
export function guestAvatar(user) {
  const url = googlePhotoUrl(user);
  return `<span class="guest-avatar" aria-hidden="true" data-dt-mask><span>${esc(guestDisplayName(user).slice(0,1))}</span>${url ? `<img data-guest-photo src="${esc(url)}" alt="" width="60" height="60" referrerpolicy="no-referrer">` : ""}</span>`;
}

export function createGuestAccount(
  root,
  { show, close, closeMenu = async () => {}, onEnquire },
) {
  let disposed = false,
    generation = 0,
    unsubscribe,
    authModule;
  const buttons = [...root.querySelectorAll("[data-guest-account]")];
  const notice = createConsentNotice(root, { show });
  const photoError = event => { if (event.target.matches?.("img[data-guest-photo]")) event.target.hidden = true; };
  root.addEventListener("error", photoError, true);
  const leaf = document.createElement("div");
  leaf.id = "guest-account-leaf";
  leaf.className = "account-leaf-menu";
  leaf.setAttribute("popover", "auto");
  leaf.setAttribute("aria-label", "Account options");
  root.append(leaf);
  let signedUser, menuTrigger;
  function hideMenu() {
    if (leaf.matches(":popover-open")) leaf.hidePopover();
    buttons.forEach((b) => b.setAttribute("aria-expanded", "false"));
  }
  function showLeaf(trigger) {
    hideMenu();
    menuTrigger = trigger;
    leaf.innerHTML = `<svg class="account-leaf-watermark" viewBox="0 0 100 150" aria-hidden="true"><path d="M10 140C-5 65 45 0 95 5C99 69 68 129 10 140Z" fill="currentColor"/><path d="M12 137L84 20M36 102L25 65M53 77L75 74" stroke="currentColor" fill="none" stroke-width="2"/></svg><p class="eyebrow">YOUR CORNER OF AROHA</p>${guestAvatar(signedUser)}<p class="account-leaf-name" data-dt-mask>${esc(guestDisplayName(signedUser))}</p><nav aria-label="Your account"><button data-account-enquire>Enquire on WhatsApp <span aria-hidden="true">↗</span></button><a href="/book/" data-dt-name="Book a stay">Book a stay <span aria-hidden="true">↗</span></a><a href="/book/#visits" data-dt-name="My bookings">My bookings <span aria-hidden="true">↗</span></a><a href="/book/#profile" data-dt-name="Guest profile">My profile <span aria-hidden="true">↗</span></a><button data-account-signout data-dt-name="Sign out">Sign out <span aria-hidden="true">↗</span></button></nav><p class="account-leaf-note" role="status">Your next visit starts with a conversation.</p>`;
    const anchor = root.querySelector("#guest-account-header") || trigger,
      r = anchor.getBoundingClientRect();
    leaf.style.top = Math.max(12, r.bottom + 12) + "px";
    leaf.style.left =
      Math.max(12, Math.min(innerWidth - 292, r.right - 280)) + "px";
    if (typeof leaf.showPopover !== "function") {
      open();
      return;
    }
    leaf.showPopover();
    trigger.setAttribute("aria-expanded", "true");
    leaf.querySelector("[data-account-enquire]").onclick=()=>{hideMenu();onEnquire?.();};
    leaf.querySelector("[data-account-signout]").onclick = async (e) => {
      e.currentTarget.disabled = true;
      try {
        await authModule.logout();
        hideMenu();
        labels(null);
        menuTrigger?.focus({ preventScroll: true });
      } catch {
        leaf.querySelector('[role="status"]').textContent =
          "Sign-out could not finish. Please try again.";
        e.currentTarget.disabled = false;
      }
    };
    leaf.querySelector("nav a, nav button").focus({ preventScroll: true });
  }
  const toggle = () => {
    if (!leaf.matches(":popover-open")) {
      buttons.forEach((b) => b.setAttribute("aria-expanded", "false"));
      if (leaf.contains(document.activeElement))
        menuTrigger?.focus({ preventScroll: true });
    }
  };
  leaf.addEventListener("toggle", toggle);
  window.addEventListener("resize", hideMenu);
  window.addEventListener("scroll", hideMenu, { passive: true });

  function remembered(value) {
    try {
      value
        ? sessionStorage.setItem("aroha-guest-session", "1")
        : sessionStorage.removeItem("aroha-guest-session");
    } catch {}
  }
  function labels(user) {
    if (disposed) return;
    signedUser = user;
    buttons.forEach((b) => {
      b.innerHTML = user
        ? `${guestAvatar(user)}<span class="guest-trigger-name" data-dt-mask>${esc(guestDisplayName(user))}</span>`
        : b.closest("header")
          ? "Sign in"
          : "Guest sign in";
      b.dataset.signedIn = user ? "true" : "false";
      b.dataset.dtName = user ? "Account menu" : "Guest sign in";
      b.setAttribute("aria-label", user ? "Open account menu" : "Sign in");
      b.setAttribute("aria-haspopup", user ? "true" : "dialog");
      b.setAttribute("aria-controls", user ? leaf.id : "details-dialog");
      b.setAttribute("aria-expanded", "false");
    });
    if (!user) hideMenu();
    remembered(!!user);
  }
  async function accountAction(event) {
    const trigger = event.currentTarget;
    if (signedUser) {
      await closeMenu();
      if (!disposed) showLeaf(trigger);
    } else open();
  }
  async function open() {
    await closeMenu();
    if (disposed) return;
    const request = ++generation;
    show(
      `<div class="dialog-copy guest-account"><p class="eyebrow">A LITTLE CLOSER TO AROHA</p><h2 id="dialog-title">Your Aroha account</h2><div id="guest-account-body"><p role="status">Preparing secure Google sign-in…</p></div></div>`,
    );
    function current() {
      return (
        !disposed &&
        request === generation &&
        root.querySelector("#details-dialog")?.open &&
        !!root.querySelector("#guest-account-body")
      );
    }
    try {
      const m = authModule || (await loadAuth());
      authModule = m;
      if (!unsubscribe) unsubscribe = m.observeAuth(labels);
      await m.auth.authStateReady();
      if (!current()) return;
      const body = root.querySelector("#guest-account-body");
      const paint = () => {
        if (!current()) return;
        const user = m.auth.currentUser;
        body.innerHTML = user
          ? `<div class="guest-account-person" data-dt-mask>${guestAvatar(user)}<div><strong>${esc(user.displayName || "Welcome to Aroha")}</strong><p>${esc(user.email || "")}</p></div></div><p>You’re signed in. Your hosts review every stay request personally. Choose a conversation or a booking request. Enquiries open WhatsApp; bookings need host approval.</p><div class="guest-account-actions"><button class="button" id="guest-enquire">Enquire on WhatsApp ↗</button><a class="button" href="/book/">Book a stay ↗</a><button class="text-link" id="guest-signout">Sign out</button></div>`
          : `<p>A familiar welcome, with one secure Google sign-in.</p><button type="button" class="google-signin" id="guest-google-login">Continue with Google <span aria-hidden="true">↗</span></button><p class="guest-auth-note">We use your Google name and email for your account. Signing in does not confirm a booking or give access to the host studio.</p>`;
        const status = document.createElement("p");
        status.setAttribute("role", "status");
        body.append(status);
        root
          .querySelector("#guest-account-done")
          ?.addEventListener("click", close);
        root.querySelector("#guest-enquire")?.addEventListener("click",()=>onEnquire?.());
        const login = root.querySelector("#guest-google-login");
        login?.addEventListener("click", () => {
          login.disabled = true;
          status.textContent = "Complete sign-in in the Google window.";
          // Call directly in the user gesture, after the Auth module is ready.
          m.login()
            .then(() => {
              labels(m.auth.currentUser);
              if(current()) paint();
            })
            .catch((e) => {
              if (current()) {
                status.textContent =
                  messages[e.code] ||
                  "Sign-in could not finish. Please try again.";
                login.disabled = false;
              }
            });
        });
        root
          .querySelector("#guest-signout")
          ?.addEventListener("click", async (e) => {
            e.currentTarget.disabled = true;
            try {
              await m.logout();
              labels(null);
              paint();
            } catch {
              if (current())
                status.textContent =
                  "Sign-out could not finish. Please try again.";
            }
          });
      };
      paint();
    } catch {
      if (current())
        root.querySelector("#guest-account-body").innerHTML =
          '<p role="alert">Sign-in could not load. Please close this window and try again.</p>';
    }
  }
  const authReady=()=>{loadAuth().then(m=>{if(!disposed){authModule=m;if(!unsubscribe)unsubscribe=m.observeAuth(labels);}}).catch(()=>{});};
  document.addEventListener("aroha-auth-ready",authReady);
  buttons.forEach((b) => b.addEventListener("click", accountAction));
  try {
    if (sessionStorage.getItem("aroha-guest-session") === "1")
      loadAuth()
        .then((m) => {
          if (!disposed) {
            authModule = m;
            if (!unsubscribe) unsubscribe = m.observeAuth(labels);
          }
        })
        .catch(() => {});
  } catch {}
  return {
    destroy() {
      disposed = true;
      generation++;
      unsubscribe?.();
      document.removeEventListener("aroha-auth-ready",authReady);
      hideMenu();
      leaf.remove();
      notice.destroy();
      root.removeEventListener("error", photoError, true);
      window.removeEventListener("resize", hideMenu);
      window.removeEventListener("scroll", hideMenu);
      leaf.removeEventListener("toggle", toggle);
      buttons.forEach((b) => b.removeEventListener("click", accountAction));
    },
  };
}
