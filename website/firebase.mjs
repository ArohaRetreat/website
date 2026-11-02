import { app, isEmulator } from "./firebase-app.mjs";
export { app, isEmulator } from "./firebase-app.mjs";
export { db, subscribeSite } from "./firebase-public.mjs";
import { auth } from "./firebase-auth.mjs";
export { auth, observeAuth, login, logout, emulatorLogin } from "./firebase-auth.mjs";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  connectStorageEmulator,
} from "firebase/storage";
if (isEmulator) connectStorageEmulator(getStorage(app), "127.0.0.1", 9199);
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
