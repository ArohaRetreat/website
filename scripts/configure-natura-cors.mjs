import { firebaseClient } from "./delivery/credentials.mjs";
import { mediaBucket } from "./hosting-media.mjs";

const environments = {
  "--pre-prod": [
    "https://aroha-retreat-preprod.web.app", "https://aroha-retreat-preprod.firebaseapp.com",
  ],
  "--production": [
    "https://aroharetreat.com", "https://www.aroharetreat.com",
    "https://aroha-retreat.web.app", "https://aroha-retreat.firebaseapp.com",
  ],
};
const [environment, apply] = process.argv.slice(2);
if (!Object.hasOwn(environments, environment) || apply !== "--apply")
  throw Error("EXPLICIT_NATURA_CORS_ENVIRONMENT_REQUIRED");
const Client = await firebaseClient();
const storage = new Client({ urlPrefix: "https://storage.googleapis.com", apiVersion: "storage/v1", auth: true });
const path = "/b/" + mediaBucket;
const { body: bucket } = await storage.get(path, {
  queryParams: { fields: "name,location,metageneration,cors" },
});
if (bucket.name !== mediaBucket || bucket.location !== "ASIA-SOUTH2" || !bucket.metageneration)
  throw Error("UNEXPECTED_NATURA_BUCKET");
const cors = bucket.cors || [];
const policy = {
  origin: environments[environment], method: ["GET", "HEAD"],
  responseHeader: ["Content-Disposition", "Content-Length", "Content-Range", "Content-Type", "Range"],
  maxAgeSeconds: 3600,
};
const present = cors.some(rule =>
  Object.entries(policy).every(([key, value]) => JSON.stringify(rule[key]) === JSON.stringify(value)));
if (!present) {
  await storage.patch(path, { cors: [...cors, policy] }, {
    queryParams: { ifMetagenerationMatch: bucket.metageneration, fields: "metageneration,cors" },
    skipLog: { body: true },
  });
}
console.log(JSON.stringify({ bucket: mediaBucket, origins: policy.origin, added: !present }));
