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
export function createGuestAccount(
  root,
  { show, close, closeMenu = async () => {} },
) {
  let disposed = false,
    generation = 0,
    unsubscribe,
    authModule;
  const buttons = [...root.querySelectorAll("[data-guest-account]")];
  function remembered(value) {
    try {
      value
        ? sessionStorage.setItem("aroha-guest-session", "1")
        : sessionStorage.removeItem("aroha-guest-session");
    } catch {}
  }
  function labels(user) {
    if (disposed) return;
    buttons.forEach(
      (b) =>
        (b.textContent = user
          ? "My account"
          : b.closest("header")
            ? "Sign in"
            : "Guest sign in"),
    );
    remembered(!!user);
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
          ? `<div class="guest-account-person"><span aria-hidden="true">${esc((user.displayName || "Guest").slice(0, 1))}</span><div><strong>${esc(user.displayName || "Welcome to Aroha")}</strong><p>${esc(user.email || "")}</p></div></div><p>You’re signed in. Your hosts still confirm visits personally; online bookings will be added later.</p><div class="guest-account-actions"><button class="button" id="guest-account-done">Keep exploring ↗</button><button class="text-link" id="guest-signout">Sign out</button></div>`
          : `<p>A familiar welcome, with one secure Google sign-in.</p><button type="button" class="google-signin" id="guest-google-login">Continue with Google <span aria-hidden="true">↗</span></button><p class="guest-auth-note">We use your Google name and email for your account. Signing in does not confirm a booking or give access to the host studio.</p>`;
        const status = document.createElement("p");
        status.setAttribute("role", "status");
        body.append(status);
        root
          .querySelector("#guest-account-done")
          ?.addEventListener("click", close);
        const login = root.querySelector("#guest-google-login");
        login?.addEventListener("click", () => {
          login.disabled = true;
          status.textContent = "Complete sign-in in the Google window.";
          // Call directly in the user gesture, after the Auth module is ready.
          m.login()
            .then(() => {
              labels(m.auth.currentUser);
              paint();
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
  buttons.forEach((b) => b.addEventListener("click", open));
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
      buttons.forEach((b) => b.removeEventListener("click", open));
    },
  };
}
