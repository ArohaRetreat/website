import { FieldValue } from "firebase-admin/firestore";
import { collectionName, environment } from "../environment.mjs";
// A required security audit is distinct from optional operational telemetry.
export async function auditSensitiveRead(db, token, id, requestId) {
  await db
    .collection(collectionName("audit"))
    .doc(requestId)
    .set({
      schemaVersion: 1,
      eventId: requestId,
      actor: token.uid,
      operation: "integration.reservation.contact.read",
      entity: id,
      grantId: token._integration.id,
      environment: environment.name,
      occurredAt: FieldValue.serverTimestamp(),
    });
}
