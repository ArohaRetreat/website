// Owner-confirmed fifth operating room. CAS prevents overwriting a concurrent host edit.
import { isDeepStrictEqual } from "node:util";
import { firebaseClient } from "./delivery/credentials.mjs";
const Client = await firebaseClient();
const client = new Client({
  urlPrefix: "https://firestore.googleapis.com",
  apiVersion: "v1",
  auth: true,
});
const path =
  "/projects/aroha-retreat/databases/(default)/documents/aroha_booking_config/site";
const doc = (await client.get(path)).body;
const units = structuredClone(doc.fields.units);
const room = units.arrayValue.values.find(
  (v) => v.mapValue.fields.id.stringValue === "unmapped",
);
if (!room) throw Error("FIFTH_ROOM_NOT_FOUND");
const f = room.mapValue.fields;
const before = {
  name: f.name.stringValue,
  active: f.active.booleanValue,
  capacity: Number(f.capacity.integerValue),
};
if (before.name === "Master room" && before.active && before.capacity === 2) {
  console.log(JSON.stringify({ changed: false, room: "Master room" }));
  process.exit(0);
}
if (before.active || before.name !== "Fifth room · details needed")
  throw Error("ROOM_ALREADY_EDITED_REVIEW_REQUIRED");
f.name = { stringValue: "Master room" };
f.type = { stringValue: "Room" };
f.capacity = { integerValue: "2" };
f.active = { booleanValue: true };
f.version = { integerValue: String(Number(f.version?.integerValue || 0) + 1) };
const receipt = {
  apply: process.argv.includes("--apply"),
  before,
  after: { name: "Master room", active: true, capacity: 2 },
  preserved: "All other units, rates, settings, blocks and reservations",
};
if (receipt.apply) {
  await client.post(
    "/projects/aroha-retreat/databases/(default)/documents:commit",
    {
      writes: [
        {
          update: {
            name: doc.name,
            fields: {
              units,
              guardVersion: {
                integerValue: String(
                  Number(doc.fields.guardVersion?.integerValue || 0) + 1,
                ),
              },
            },
          },
          updateMask: { fieldPaths: ["units", "guardVersion"] },
          currentDocument: { updateTime: doc.updateTime },
        },
      ],
    },
  );
  const verify = (await client.get(path)).body;
  if (!isDeepStrictEqual(verify.fields.units, units))
    throw Error("MIGRATION_VERIFICATION_FAILED");
  receipt.updateTime = verify.updateTime;
}
console.log(JSON.stringify(receipt, null, 2));
