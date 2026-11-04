import { environmentProfile } from "../functions/environment-profile.mjs";
export const environment = environmentProfile(
  typeof __AROHA_ENVIRONMENT__ === "string"
    ? __AROHA_ENVIRONMENT__
    : "production",
);
