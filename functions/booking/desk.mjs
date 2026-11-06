// Derived query fields only; no additional customer identity or contact copies.
export function deskFields(b) {
  const attention = b.status === 'pending_approval' ? (b.kind === 'event' && !b.pricingVersion && !b.quoteAccepted ? 'offer' : 'new') : b.status === 'confirmed' && b.changeRequest ? 'change' : 'none';
  return { deskKind:b.kind || 'private', deskAttention:attention, deskDeadline:attention === 'change' ? Number.MAX_SAFE_INTEGER : Number.isFinite(b.expiresAt) ? b.expiresAt : Number.MAX_SAFE_INTEGER };
}
