import { getDoc, getFirestore, doc, onSnapshot, connectFirestoreEmulator } from "firebase/firestore";
import { app, isEmulator } from "./firebase-app.mjs";
export const db = getFirestore(app);
if (isEmulator) connectFirestoreEmulator(db, "127.0.0.1", 8080);
export const subscribeSite = (next, error) =>
  onSnapshot(doc(db, "aroha_public", "site"), (s) => s.exists() && next(s.data()), error);

export async function readPublishedSite() { const s=await getDoc(doc(db,"aroha_public","site")); if(!s.exists()) throw Error("SITE_UNAVAILABLE"); return s.data().content; }
