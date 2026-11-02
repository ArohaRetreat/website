import {setMonitoringUser} from "./monitoring.mjs";
import { app, isEmulator } from "./firebase-app.mjs";
import {
  initializeAuth,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  onAuthStateChanged,
  signOut,
  browserSessionPersistence,
  connectAuthEmulator,
} from "firebase/auth";
const emulated = isEmulator;
export const auth = initializeAuth(app, {
  persistence: browserSessionPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});
if (emulated) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}
onAuthStateChanged(auth,user=>setMonitoringUser(user));
export const observeAuth = (fn) => onAuthStateChanged(auth, fn);
export const login = () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
};
export const logout = () => signOut(auth);
export async function emulatorLogin(email) {
  if (!emulated) throw Error("EMULATOR_ONLY");
  const encode = (v) =>
    btoa(JSON.stringify(v))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
  const token =
    encode({ alg: "none", typ: "JWT" }) +
    "." +
    encode({
      sub: email,
      email,
      email_verified: true,
      iss: "https://accounts.google.com",
      aud: "demo-aroha",
    }) +
    ".";
  return signInWithCredential(auth, GoogleAuthProvider.credential(token));
}
