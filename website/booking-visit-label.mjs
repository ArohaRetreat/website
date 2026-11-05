// The inventory ledger stores day/event departure as an exclusive date. Guests
// should see their actual visit dates, while overnight stays show checkout day.
export function visitDateLabel(booking,format){
  if(booking.kind==='day')return format(booking.arrival);
  const end=booking.kind==='event'?new Date(Date.parse(booking.departure+'T12:00:00Z')-86400000).toISOString().slice(0,10):booking.departure;
  return booking.arrival===end?format(booking.arrival):format(booking.arrival)+' – '+format(end);
}
