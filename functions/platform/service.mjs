import { communicationsHandler } from "./communications.mjs";
import { customersHandler } from "./customers.mjs";
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
import { hostHandler } from "./host.mjs";
const handlers = {
  host: hostHandler,
  customers: customersHandler,
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
    const result = await bookingCommand(
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
    if (operation === "quoteManualBooking")
      return {
        id: result.id,
        version: 0,
        customerId: result.customerId,
        kind: result.kind,
        arrival: result.arrival,
        departure: result.departure,
        adults: result.adults,
        childrenCount: result.children || 0,
        unitIds: result.units,
        unitNames: result.unitNames,
        subtotalPaise: result.subtotal,
        priceBenefitDiscountPaise: result.priceBenefitDiscount || 0,
        loyaltyCredits: result.loyaltyCredits || 0,
        loyaltyDiscountPaise: result.loyaltyDiscount || 0,
        totalPaise: result.total,
        expiresAt: result.expiresAt,
        settingsVersion: result.settingsVersion,
        contact: { ...result.manualContact, email: result.manualEmail },
      };
    return result;
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
