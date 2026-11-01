import { initializeApp } from "firebase/app";
import config from "../config/firebase.web.json";
export const isEmulator =
  typeof __AROHA_EMULATORS__ !== "undefined" &&
  __AROHA_EMULATORS__ &&
  ["localhost", "127.0.0.1"].includes(location.hostname);
export const app = initializeApp(
  isEmulator ? { ...config, projectId: "demo-aroha", apiKey: "demo-api-key" } : config,
);
