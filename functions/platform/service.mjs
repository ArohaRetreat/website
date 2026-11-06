import { communicationsHandler } from "./communications.mjs";
import { mediaHandler, settleMedia } from "./media.mjs";
import { clientsHandler } from "./clients.mjs";
import { managementHandler, contentHandler } from "./management.mjs";
import { profileHandler, auditHandler } from "./profile.mjs";
import { sharedCollectionName } from "../environment.mjs";
import { studioAccess } from "../access.mjs";
import { resourcesHandler } from "./resources.mjs";
import { bookingCommand } from "../booking/store.mjs";
import { validate, digest } from "./core.mjs";
import { definitionsById } from "./registry.mjs";
import { transaction, fail } from "./core.mjs";
import { financeHandler } from "./finance.mjs";
import { feedbackHandler } from "./feedback.mjs";
const handlers = {
  communications: communicationsHandler,
  media: mediaHandler,
  clients: clientsHandler,
  finance: financeHandler,
  feedback: feedbackHandler,
  resources: resourcesHandler,
  management: managementHandler,
  content: contentHandler,
  profile: profileHandler,
  audit: auditHandler,
};
export async function platformOperation(
  db,
  token,
  operation,
  input,
  key,
  options = {},
) {
  const definition = definitionsById.get(operation);
  if (!definition) fail("NOT_FOUND", 404);
  if (definition.handler === "booking-alias") {
    validate(definition.input, input);
    if (!/^[A-Za-z0-9-]{8,100}$/.test(key || ""))
      fail("IDEMPOTENCY_KEY_REQUIRED", 400);
    let manager = definition.policy === "booking-manager";
    if (definition.policy === "booking-owner-or-manager") {
      const m = (
        await db
          .collection(sharedCollectionName("members"))
          .doc(token.uid)
          .get()
      ).data();
      manager =
        studioAccess(m).bookings === "manager" &&
        (!token._integration || token._integration.rowAccess === "all");
    }
    if (manager && token._integration && token._integration.rowAccess !== "all")
      fail("FORBIDDEN", 403);
    const args = { ...input, ...(definition.fixed || {}) };
    if (definition.action) args.action = definition.action;
    return bookingCommand(
      db,
      token,
      definition.command,
      args,
      digest(
        token.uid +
          ":" +
          (token._integration?.id || "interactive") +
          ":" +
          operation +
          ":" +
          key,
      ),
      { admin: manager, requestId: options.requestId },
    );
  }
  const result = await transaction(
    db,
    token,
    definition,
    input,
    key,
    handlers[definition.handler],
    options,
  );
  if (definition.handler === "media")
    return settleMedia(db, token, operation, result);
  return result;
}
