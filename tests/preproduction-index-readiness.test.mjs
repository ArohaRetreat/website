import test from "node:test";
import assert from "node:assert/strict";
import { indexReady } from "../scripts/delivery/firestore-index-readiness.mjs";

test("staging readiness rejects a ready production lookalike and wrong cursor ordering", () => {
  const required = { collectionGroup: "aroha_preprod_bookings", queryScope: "COLLECTION", fields: [
    {fieldPath:"owner",order:"ASCENDING"}, {fieldPath:"createdAt",order:"DESCENDING"},
  ] };
  const actual = {name:"projects/demo/databases/(default)/collectionGroups/aroha_bookings/indexes/ready", queryScope:"COLLECTION", state:"READY", fields:[...required.fields,{fieldPath:"__name__",order:"DESCENDING"}]};
  assert.equal(indexReady(actual,required),false);
  actual.name=actual.name.replace("/aroha_bookings/","/aroha_preprod_bookings/");
  assert.equal(indexReady(actual,required),true);
  assert.equal(indexReady({...actual,state:"CREATING"},required),false);
  assert.equal(indexReady({...actual,fields:[...required.fields,{fieldPath:"__name__",order:"ASCENDING"}]},required),false);
});
