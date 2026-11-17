import { chooseStayDates, stayDateLabel } from "./studio-date-range.mjs";

const DAY_MS = 86_400_000;
const ADVANCE_DAYS = 365;
const MAX_NIGHTS = 31;
const ADULT_COUNTS = Array.from({ length: 10 }, (_, index) => index + 1);
const adultLabel = (count) => `${count} ${count === 1 ? "adult" : "adults"}`;

const icon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
const calendar = icon("M8 3v4m8-4v4M5 10h14M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2 9h2m4 0h2m-8 3h2");
const person = icon("M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 20v-1a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1");
const chevron = icon("m7 10 5 5 5-5");
const check = icon("m5 12 4 4L19 6");
const arrow = icon("M4 12h15m-6-6 6 6-6 6");

export const bookingToday = (now = Date.now()) =>
  new Date(now + 19_800_000).toISOString().slice(0, 10);

const dateAfter = (day, count) =>
  new Date(Date.parse(day + "T00:00:00Z") + count * DAY_MS).toISOString().slice(0, 10);

const isDate = (day) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day || "") &&
  Number.isFinite(Date.parse(day + "T00:00:00Z")) &&
  dateAfter(day, 0) === day;

const validArrival = (day, today) =>
  isDate(day) && day >= today && day <= dateAfter(today, ADVANCE_DAYS);

const validDeparture = (day, arrival) =>
  isDate(day) && day > arrival && day <= dateAfter(arrival, MAX_NIGHTS);

export function readHomepageStay(params, today = bookingToday()) {
  if (params.get("start") !== "stay") return null;
  const arrival = params.get("arrival");
  const departure = params.get("departure");
  const adults = Number(params.get("adults"));
  if (!validArrival(arrival, today) || !validDeparture(departure, arrival) ||
      !/^(?:[1-9]|10)$/.test(params.get("adults") || "")) return null;
  return { arrival, departure, adults };
}

function dateField(name, label, step) {
  return `<label for="home-${name}" class="home-stay-native"><span>${label}</span><input id="home-${name}" name="${name}" type="date" required></label>
    <button type="button" id="home-${name}-trigger" class="home-stay-control home-stay-date" aria-haspopup="dialog" data-home-date="${step}" hidden>
      <span class="home-stay-control-icon">${calendar}</span>
      <span><span class="home-stay-label">${label}</span><span class="home-stay-value" data-home-value>Choose date</span></span>
    </button>`;
}

export function renderHomepageStay() {
  const options = ADULT_COUNTS.map((count) =>
    `<option value="${count}"${count === 2 ? " selected" : ""}>${adultLabel(count)}</option>`).join("");
  const guests = ADULT_COUNTS.map((count) =>
    `<div role="option" id="home-adult-${count}" aria-selected="${count === 2}" data-count="${count}"><span>${adultLabel(count)}</span>${check}</div>`).join("");
  return `<section class="home-stay" id="book-your-stay" aria-labelledby="home-stay-title">
    <div class="home-stay-inner">
      <h2 id="home-stay-title">Book your stay</h2>
      <form action="/book/" method="get" class="home-stay-form">
        <input type="hidden" name="start" value="stay">
        <div class="home-stay-dates" role="group" aria-label="Stay dates">
          ${dateField("arrival", "Check-in", "start")}
          ${dateField("departure", "Checkout", "end")}
        </div>
        <div class="home-stay-guests">
          <label for="home-adults" class="home-stay-native"><span>Adults · age 10+</span><select id="home-adults" name="adults">${options}</select></label>
          <button type="button" id="home-adult-trigger" class="home-stay-control home-stay-adults" aria-haspopup="listbox" aria-expanded="false" aria-controls="home-adult-menu" popovertarget="home-adult-menu" hidden>
            <span class="home-stay-control-icon">${person}</span>
            <span><span class="home-stay-label">Adults <small>10+</small></span><span class="home-stay-value" data-home-value>2 adults</span></span>
            <span class="home-stay-chevron">${chevron}</span>
          </button>
          <div id="home-adult-menu" class="home-stay-menu" popover role="listbox" aria-label="Adults, ages 10 and over" tabindex="-1" hidden>${guests}</div>
        </div>
        <button type="submit" class="home-stay-book">Book now ${arrow}</button>
        <p id="home-stay-error" class="home-stay-error" role="alert"></p>
      </form>
      <div class="home-stay-foot">
        <p>Sign in to check availability and add children.</p>
        <a href="/book/">Day visits &amp; groups <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  </section>`;
}

function bindAdultMenu(form, select, onClose) {
  const menu = form.querySelector("#home-adult-menu");
  if (typeof menu.showPopover !== "function") return;

  const trigger = form.querySelector("#home-adult-trigger");
  const options = [...menu.children];
  const value = trigger.querySelector("[data-home-value]");
  let active;
  let digits = "";
  let lastDigit = 0;
  let positioning;
  const view = form.ownerDocument.defaultView;

  function showValue() {
    value.textContent = select.selectedOptions[0]?.textContent || "Choose adults";
    options.forEach((option) => option.setAttribute("aria-selected", String(option.dataset.count === select.value)));
  }
  function focusOption(index) {
    options[active]?.removeAttribute("data-active");
    active = Math.max(0, Math.min(index, options.length - 1));
    const option = options[active];
    option.setAttribute("data-active", "");
    menu.setAttribute("aria-activedescendant", option.id);
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < menu.scrollTop) menu.scrollTop = top;
    else if (bottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = bottom - menu.clientHeight;
  }
  function choose(option) {
    select.value = option.dataset.count;
    showValue();
    menu.hidePopover();
    trigger.focus({ preventScroll: true });
  }
  function place() {
    const rect = trigger.getBoundingClientRect();
    const height = form.ownerDocument.documentElement.clientHeight;
    if (!menu.isConnected || rect.bottom <= 0 || rect.top >= height) {
      positioning?.abort();
      if (menu.matches(":popover-open")) menu.hidePopover();
      return;
    }
    const below = height - rect.bottom - 16;
    const above = rect.top - 16;
    const upwards = below < 260 && above > below;
    menu.style.left = `${rect.left}px`;
    menu.style.inlineSize = `${rect.width}px`;
    menu.style.maxBlockSize = `${Math.min(260, upwards ? above : below)}px`;
    menu.style.top = upwards ? "auto" : `${rect.bottom + 6}px`;
    menu.style.bottom = upwards ? `${height - rect.top + 6}px` : "auto";
  }
  menu.addEventListener("beforetoggle", (event) => {
    const open = event.newState === "open";
    trigger.setAttribute("aria-expanded", String(open));
    positioning?.abort();
    if (!open) return;
    place();
    // Keep the top-layer menu attached to its field while the viewport moves.
    positioning = new view.AbortController();
    const { signal } = positioning;
    view.addEventListener("resize", place, { signal });
    view.addEventListener("scroll", place, { signal, passive: true });
  });
  menu.addEventListener("toggle", (event) => {
    if (event.newState === "closed") {
      if (menu.contains(form.ownerDocument.activeElement)) trigger.focus({ preventScroll: true });
      onClose?.();
      return;
    }
    digits = "";
    menu.focus({ preventScroll: true });
    focusOption(select.selectedIndex);
  });
  menu.addEventListener("click", (event) => {
    const option = event.target.closest("[role=option]");
    if (option) choose(option);
  });
  menu.addEventListener("focusout", (event) => {
    const target = event.relatedTarget;
    if (target && target !== trigger && !menu.contains(target) && menu.matches(":popover-open")) menu.hidePopover();
  });
  menu.addEventListener("keydown", (event) => {
    const positions = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: options.length - 1 };
    if (Object.hasOwn(positions, event.key)) {
      event.preventDefault();
      focusOption(positions[event.key]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(options[active]);
    } else if (/^\d$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      digits = (event.timeStamp - lastDigit < 650 ? digits : "") + event.key;
      lastDigit = event.timeStamp;
      const index = options.findIndex((option) => option.dataset.count === digits);
      if (index >= 0) focusOption(index);
    } else if (event.key === "Escape") {
      event.preventDefault();
      menu.hidePopover();
      trigger.focus({ preventScroll: true });
    } else if (event.key === "Tab") {
      view.requestAnimationFrame(() => {
        if (menu.matches(":popover-open")) menu.hidePopover();
      });
    }
  });
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      menu.showPopover();
    }
  });
  showValue();
  select.closest("label").hidden = true;
  trigger.hidden = false;
  menu.hidden = false;
}

export function bindHomepageStay(form, previous, onControlsClosed) {
  if (!form) return;
  const { arrival, departure, adults } = form.elements;
  const { FormData } = form.ownerDocument.defaultView;
  if (previous) {
    arrival.value = previous.get("arrival") || "";
    departure.value = previous.get("departure") || "";
    adults.value = previous.get("adults") || "2";
  }
  function updateBounds() {
    const today = bookingToday();
    const start = isDate(arrival.value) ? arrival.value : today;
    arrival.min = today;
    arrival.max = dateAfter(today, ADVANCE_DAYS);
    departure.min = dateAfter(start, 1);
    departure.max = dateAfter(start, MAX_NIGHTS);
  }
  form.addEventListener("input", updateBounds);
  form.addEventListener("change", updateBounds);
  updateBounds();
  bindAdultMenu(form, adults, onControlsClosed);

  if (typeof form.ownerDocument.createElement("dialog").showModal !== "function") return;
  const dates = form.querySelector(".home-stay-dates");
  const [checkIn, checkout] = dates.querySelectorAll("[data-home-date]");
  const error = form.querySelector("#home-stay-error");
  function showDates() {
    for (const [input, trigger] of [[arrival, checkIn], [departure, checkout]]) {
      trigger.querySelector("[data-home-value]").textContent = input.value ? stayDateLabel(input.value) : "Choose date";
      trigger.toggleAttribute("data-filled", Boolean(input.value));
      trigger.removeAttribute("aria-invalid");
      trigger.removeAttribute("aria-describedby");
    }
    error.textContent = "";
  }
  for (const trigger of [checkIn, checkout]) {
    trigger.hidden = false;
    trigger.addEventListener("click", () => {
      const today = bookingToday();
      const start = validArrival(arrival.value, today) ? arrival.value : "";
      chooseStayDates({
        parent: dates,
        trigger,
        arrival: start,
        departure: start && validDeparture(departure.value, start) ? departure.value : "",
        today,
        advanceDays: ADVANCE_DAYS,
        maxNights: MAX_NIGHTS,
        initialStep: trigger.dataset.homeDate,
        onApply: (start, end) => {
          arrival.value = start;
          departure.value = end;
          updateBounds();
          showDates();
        },
        onClose: onControlsClosed,
      });
    });
  }
  dates.querySelectorAll(".home-stay-native").forEach((label) => { label.hidden = true; });
  dates.classList.add("has-picker");
  showDates();
  form.noValidate = true;
  form.addEventListener("submit", (event) => {
    const today = bookingToday();
    if (readHomepageStay(new FormData(form), today)) return;
    event.preventDefault();
    showDates();
    const missingStart = !validArrival(arrival.value, today);
    const trigger = missingStart ? checkIn : checkout;
    error.textContent = missingStart ? "Choose your check-in date." : "Choose your checkout date.";
    trigger.setAttribute("aria-invalid", "true");
    trigger.setAttribute("aria-describedby", error.id);
    trigger.focus();
  });
}
