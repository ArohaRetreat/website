// Presentation recommendation only. Availability and every displayed total come from the API;
// the selected room set is validated again by quote/create transactions.
export function recommendPrivate(
  units,
  adults,
  children,
  nights,
  extraChildRate,
) {
  const ready = units.filter(
    (u) => u.available && u.active && Number.isInteger(u.rate) && u.rate >= 0,
  );
  if (
    !Number.isInteger(adults) ||
    !Number.isInteger(children) ||
    !Number.isInteger(nights) ||
    adults < 1 ||
    children < 0 ||
    nights < 1 ||
    ready.length > 9
  )
    return null;
  let best = null;
  function extras(rooms) {
    const memo = new Map();
    function fit(i, a, c) {
      if (i === rooms.length) return a === 0 && c === 0 ? 0 : Infinity;
      const key = [i, a, c].join(":");
      if (memo.has(key)) return memo.get(key);
      const left = rooms.length - i - 1;
      let result = Infinity;
      for (let n = 1; n <= Math.min(2, rooms[i].capacity, a); n++)
        for (let k = 0; k <= Math.min(2, c); k++) {
          if (a - n < left || a - n > left * 2 || c - k > left * 2) continue;
          result = Math.min(
            result,
            Math.max(0, n + k - 2) + fit(i + 1, a - n, c - k),
          );
        }
      memo.set(key, result);
      return result;
    }
    return fit(0, adults, children);
  }
  for (let mask = 1; mask < 2 ** ready.length; mask++) {
    const rooms = ready.filter((_, i) => mask & (1 << i));
    if (
      rooms.length > adults ||
      adults > rooms.length * 2 ||
      children > rooms.length * 2
    )
      continue;
    const childPlaces = extras(rooms);
    if (!Number.isFinite(childPlaces)) continue;
    const estimate =
      (rooms.reduce((n, u) => n + u.rate, 0) + childPlaces * extraChildRate) *
      nights;
    const ids = rooms.map((u) => u.id).sort();
    if (
      !best ||
      estimate < best.estimate ||
      (estimate === best.estimate &&
        (rooms.length < best.units.length ||
          (rooms.length === best.units.length &&
            ids.join().localeCompare(best.units.join()) < 0)))
    )
      best = { units: ids, estimate, extraChildren: childPlaces };
  }
  return best;
}
