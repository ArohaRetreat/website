const DAY_MS = 86_400_000;

export const bookingToday = (now = Date.now()) =>
  new Date(now + 19_800_000).toISOString().slice(0, 10);

const dateAfter = (day, count) =>
  new Date(Date.parse(day + "T00:00:00Z") + count * DAY_MS).toISOString().slice(0, 10);

const isDate = (day) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day || "") &&
  Number.isFinite(Date.parse(day + "T00:00:00Z")) &&
  dateAfter(day, 0) === day;

export function readHomepageStay(params, today = bookingToday()) {
  if (params.get("start") !== "stay") return null;
  const arrival = params.get("arrival");
  const departure = params.get("departure");
  const adults = Number(params.get("adults"));
  if (!isDate(arrival) || !isDate(departure) ||
      arrival < today || arrival > dateAfter(today, 365) ||
      departure <= arrival || departure > dateAfter(arrival, 31) ||
      !/^(?:[1-9]|10)$/.test(params.get("adults") || "")) return null;
  return { arrival, departure, adults };
}

export function renderHomepageStay() {
  const options = Array.from({ length: 10 }, (_, i) => {
    const count = i + 1;
    return `<option value="${count}"${count === 2 ? " selected" : ""}>${count} ${count === 1 ? "adult" : "adults"}</option>`;
  }).join("");
  return `<section class="home-stay" id="book-your-stay" aria-labelledby="home-stay-title">
    <div class="home-stay-inner">
      <header class="home-stay-heading">
        <h2 id="home-stay-title">Book your stay</h2>
        <a href="/book/">Day visits &amp; groups <span aria-hidden="true">↗</span></a>
      </header>
      <form action="/book/" method="get" class="home-stay-form">
        <input type="hidden" name="start" value="stay">
        <label for="home-arrival">Check-in<input id="home-arrival" name="arrival" type="date" required></label>
        <label for="home-departure">Checkout<input id="home-departure" name="departure" type="date" required></label>
        <label for="home-adults">Adults <small>Age 10+</small><select id="home-adults" name="adults">${options}</select></label>
        <button type="submit">Book now <span aria-hidden="true">→</span></button>
      </form>
      <p>Check availability after signing in. You can add children in the booking portal.</p>
    </div>
  </section>`;
}

export function bindHomepageStay(form, previous) {
  if (!form) return;
  const { arrival, departure, adults } = form.elements;
  if (previous) {
    arrival.value = previous.get("arrival") || "";
    departure.value = previous.get("departure") || "";
    adults.value = previous.get("adults") || "2";
  }
  const today = bookingToday();
  arrival.min = today;
  arrival.max = dateAfter(today, 365);
  function updateBounds() {
    const start = isDate(arrival.value) ? arrival.value : today;
    departure.min = dateAfter(start, 1);
    departure.max = dateAfter(start, 31);
  }
  form.addEventListener("input", updateBounds);
  form.addEventListener("change", updateBounds);
  updateBounds();
}
