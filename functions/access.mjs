// Module capabilities augment existing roles; they never promote a CMS role.
export function studioAccess(member) {
  const m = member || {},
    active = m.active === true;
  const owner = m.role === "superadmin";
  return {
    website: active && (owner || m.websiteAccess !== false),
    bookings: !active
      ? "none"
      : owner
        ? "manager"
        : m.bookingAccess === undefined
          ? ["admin"].includes(m.role)
            ? "manager"
            : "none"
          : ["none", "viewer", "manager"].includes(m.bookingAccess)
            ? m.bookingAccess
            : "none",
    access: active && ["superadmin", "admin"].includes(m.role),
  };
}
export function validModuleAccess(body) {
  return (
    (body.websiteAccess === undefined ||
      typeof body.websiteAccess === "boolean") &&
    (body.bookingAccess === undefined ||
      ["none", "viewer", "manager"].includes(body.bookingAccess))
  );
}
