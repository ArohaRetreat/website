// Reservation departure dates are exclusive ledger boundaries. Communications
// should show the actual approved visit interval, including its IST clock time.
export function visitWindow(booking) {
  if (
    Number.isFinite(booking.startsAt) &&
    Number.isFinite(booking.endsAt) &&
    booking.startsAt > 0 &&
    booking.endsAt > booking.startsAt
  ) {
    const format = (value) =>
      new Date(value).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    return format(booking.startsAt) + " to " + format(booking.endsAt) + " IST";
  }
  if (booking.kind === "day") return booking.arrival;
  const end =
    booking.kind === "event"
      ? new Date(Date.parse(booking.departure + "T00:00:00Z") - 86400000)
          .toISOString()
          .slice(0, 10)
      : booking.departure;
  return booking.arrival + " to " + end;
}
