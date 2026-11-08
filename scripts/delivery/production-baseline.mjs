import { createHash } from "node:crypto";
import { firebaseClient, hostingRelease } from "./credentials.mjs";
const stable = (v) =>
  v && typeof v === "object"
    ? Array.isArray(v)
      ? v.map(stable)
      : Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, stable(v[k])]),
        )
    : v;
export async function productionBaseline() {
  const Client = await firebaseClient(),
    functions = new Client({
      urlPrefix: "https://cloudfunctions.googleapis.com",
      apiVersion: "v2",
      auth: true,
    }),
    firestore = new Client({
      urlPrefix: "https://firestore.googleapis.com",
      apiVersion: "v1",
      auth: true,
    });
  const revisions = [];
  for (const name of ["arohaApi", "arohaBookingEmailDispatch", "arohaBookingEmailRetry"]) {
    const f = (
      await functions.get(
        "/projects/aroha-retreat/locations/asia-south2/functions/" + name,
      )
    ).body;
    revisions.push({
      name,
      revision: f.serviceConfig?.revision,
      updateTime: f.updateTime,
    });
  }
  const cms = (
    await firestore.get(
      "/projects/aroha-retreat/databases/(default)/documents/aroha_public/site",
    )
  ).body;
  return {
    hosting: await hostingRelease(),
    functions: revisions,
    cms: {
      version: Number(cms.fields?.version?.integerValue),
      updateTime: cms.updateTime,
      sha256: createHash("sha256")
        .update(JSON.stringify(stable(cms.fields)))
        .digest("hex"),
    },
  };
}
