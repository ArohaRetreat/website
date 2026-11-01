import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserSessionPersistence,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  onSnapshot,
  connectFirestoreEmulator,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  connectStorageEmulator,
} from "firebase/storage";
import config from "../config/firebase.web.json";
const emulated =
  typeof __AROHA_EMULATORS__ !== "undefined" &&
  __AROHA_EMULATORS__ &&
  ["localhost", "127.0.0.1"].includes(location.hostname);
export const isEmulator = emulated;
export const app = initializeApp(
    emulated
      ? { ...config, projectId: "demo-aroha", apiKey: "demo-api-key" }
      : config,
  ),
  db = getFirestore(app);
export const subscribeSite = (next, error) =>
  onSnapshot(
    doc(db, "aroha_public", "site"),
    (s) => s.exists() && next(s.data()),
    error,
  );
export const auth = getAuth(app);
if (emulated) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(getStorage(app), "127.0.0.1", 9199);
}
export const observeAuth = (fn) => onAuthStateChanged(auth, fn);
export const login = async () => {
  await setPersistence(auth, browserSessionPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
};
export const logout = () => signOut(auth);
export async function emulatorLogin(email) {
  if (!emulated) throw Error("EMULATOR_ONLY");
  await setPersistence(auth, browserSessionPersistence);
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
export async function api(path, method = "GET", body) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw Error("SIGN_IN_REQUIRED");
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch("/api/v1" + path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw Error("API_NOT_CONFIGURED");
    }
    if (!response.ok) throw Error(data.error?.code || "REQUEST_FAILED");
    return data;
  } finally {
    clearTimeout(timer);
  }
}
export async function upload(file, onProgress, kind = "image") {
  const video = kind === "video";
  if (
    !(
      video
        ? ["video/mp4", "video/webm"]
        : ["image/jpeg", "image/png", "image/webp", "image/avif"]
    ).includes(file.type) ||
    file.size >= (video ? 40 : 10) * 1024 * 1024
  )
    throw Error(
      video ? "USE_A_WEB_VIDEO_UNDER_40_MB" : "USE_AN_IMAGE_UNDER_10_MB",
    );
  const ext = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/webm": "webm",
  }[file.type];
  const target = ref(
    getStorage(app),
    "media/" + crypto.randomUUID() + "." + ext,
  );
  await new Promise((resolve, reject) => {
    uploadBytesResumable(target, file, {
      contentType: file.type,
      cacheControl: "public,max-age=31536000,immutable",
    }).on(
      "state_changed",
      (s) =>
        onProgress?.(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      reject,
      resolve,
    );
  });
  return getDownloadURL(target);
}
