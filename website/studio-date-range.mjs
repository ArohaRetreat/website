import { openStudioDialog } from "./studio-feedback.mjs";

const toDate = (day) => new Date(day + "T12:00:00Z");
const iso = (value) => value.toISOString().slice(0, 10);
const shift = (day, offset) => iso(new Date(+toDate(day) + offset * 86_400_000));
const monthOf = (day, offset = 0) => {
  const value = toDate(day.slice(0, 7) + "-01");
  value.setUTCMonth(value.getUTCMonth() + offset);
  return iso(value);
};
const distance = (a, b) => Math.round((toDate(b) - toDate(a)) / 86_400_000);
const weekday = (day) => (toDate(day).getUTCDay() + 6) % 7;
const rangeDateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const rangeFullDateFormatter = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const stayDateLabel = (day) => rangeDateFormatter.format(toDate(day));

export function chooseStudioDates(options) {
  chooseDates({ ...options, parent: document.body, trigger: document.activeElement });
}

export function chooseStayDates(options) {
  chooseDates({ ...options, homepage: true });
}

function chooseDates({
  kind, arrival, departure, today, parent, trigger, onApply, onClose,
  advanceDays = 366, maxNights = 31, initialStep = "start", homepage = false,
}) {
  const dialog = parent.ownerDocument.createElement("dialog");
  const single = kind === "day";
  const event = kind === "event";
  const latestArrival = shift(today, advanceDays);
  const endLabel = event ? "Last day" : "Checkout";
  const heading = homepage ? "Choose your dates" : single ? "Choose visit date" : "Choose booking dates";
  let start = arrival;
  let end = event ? shift(departure, -1) : departure;
  let choosing = start ? initialStep : "start";
  let focus = choosing === "end" ? end || shift(start, 1) : start || today;

  dialog.className = homepage ? "md-calendar studio-range home-stay-calendar" : "md-calendar studio-range";
  dialog.setAttribute("data-dt-mask", "");
  dialog.setAttribute("aria-label", heading);
  parent.append(dialog);
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    onClose?.();
  }, { once: true });

  const bounds = () => choosing === "start"
    ? [today, latestArrival]
    : [shift(start, event ? 0 : 1), shift(start, event ? 30 : maxNights)];
  const limit = (day) => {
    const [min, max] = bounds();
    return day < min ? min : day > max ? max : day;
  };
  const focusDay = () => dialog.querySelector('[data-range-day][tabindex="0"]')?.focus({ preventScroll: true });
  const jump = (day) => {
    focus = limit(day);
    draw();
    focusDay();
  };
  function draw() {
    const [min, max] = bounds();
    const month = monthOf(focus);
    const endOfMonth = monthOf(focus, 1);
    const count = distance(month, endOfMonth);
    const offset = weekday(month);
    const title = toDate(month).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
    const rowCount = homepage ? 6 : Math.ceil((offset + count) / 7);
    const filledRange = homepage && start && end;
    const rows = Array.from({ length: rowCount }, (_, row) => "<tr>" + Array.from({ length: 7 }, (_, col) => {
      const index = row * 7 + col - offset;
      const day = shift(month, index);
      if (index < 0 || index >= count) {
        return homepage ? `<td class="outside-month" aria-hidden="true">${Number(day.slice(-2))}</td>` : "<td></td>";
      }
      const selected = day === start || (!single && day === end);
      let range = "";
      if (!single && day > start && day < end) range = "in-range";
      else if (filledRange && day === start) range = "range-start";
      else if (filledRange && day === end) range = "range-end";
      return `<td role="gridcell" aria-selected="${selected}" class="${range}"><button type="button" data-range-day="${day}" tabindex="${day === focus ? "0" : "-1"}" aria-label="${rangeFullDateFormatter.format(toDate(day))}" ${day === today ? 'aria-current="date"' : ""} ${day < min || day > max ? "disabled" : ""}>${index + 1}</button></td>`;
    }).join("") + "</tr>").join("");
    const nights = start && end ? distance(start, end) : 0;
    let help = "Select one date.";
    if (!single) {
      if (!start) help = "Choose your check-in date.";
      else if (!end) help = `Choose the ${endLabel.toLowerCase()} date.`;
      else if (event) help = `${nights + 1} event day(s)`;
      else help = nights === 1 ? "1 night" : `${nights} nights`;
    }
    dialog.innerHTML = `<div class="dialog-head"><h2>${heading}</h2><button type="button" class="md-icon" data-close aria-label="Close calendar">×</button></div>
      ${single ? "" : `<div class="studio-range-steps"><button type="button" data-range-step="start" aria-pressed="${choosing === "start"}"><small>Check-in${event ? " / first day" : ""}</small><strong>${start ? stayDateLabel(start) : "Choose date"}</strong></button><button type="button" data-range-step="end" aria-pressed="${choosing === "end"}" ${start ? "" : "disabled"}><small>${endLabel}</small><strong>${end ? stayDateLabel(end) : "Choose date"}</strong></button></div>`}
      <div class="md-month-navigation"><button type="button" class="md-icon" data-range-month="-1" aria-label="Previous month" ${month <= monthOf(min) ? "disabled" : ""}>‹</button><strong aria-live="polite">${title}</strong><button type="button" class="md-icon" data-range-month="1" aria-label="Next month" ${endOfMonth > monthOf(max) ? "disabled" : ""}>›</button></div>
      <table class="md-calendar-grid" role="grid" aria-label="${title}"><thead><tr>${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => `<th scope="col">${name}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
      <p class="md-calendar-help" aria-live="polite">${help}</p>
      <div class="md-calendar-actions"><button type="button" data-close>Cancel</button><button class="primary" type="button" data-apply ${!start || (!single && !end) ? "disabled" : ""}>${single ? "Use visit date" : "Use dates"}</button></div>`;
    dialog.querySelectorAll("[data-close]").forEach((button) => { button.onclick = () => dialog.close(); });
    dialog.querySelector("[data-apply]").onclick = () => {
      onApply(start, single ? shift(start, 1) : event ? shift(end, 1) : end);
      dialog.close();
    };
    dialog.querySelectorAll("[data-range-step]").forEach((button) => {
      button.onclick = () => {
        choosing = button.dataset.rangeStep;
        jump(choosing === "start" ? start || today : end || bounds()[0]);
      };
    });
    dialog.querySelectorAll("[data-range-month]").forEach((button) => {
      button.onclick = () => {
        const step = button.dataset.rangeMonth;
        focus = limit(monthOf(focus, Number(step)));
        draw();
        const next = dialog.querySelector(`[data-range-month="${step}"]:not(:disabled)`);
        if (next) next.focus({ preventScroll: true });
        else focusDay();
      };
    });
    dialog.querySelectorAll("[data-range-day]").forEach((button) => {
      const day = button.dataset.rangeDay;
      button.onclick = () => {
        if (choosing === "end") {
          end = day;
          jump(day);
        } else {
          start = day;
          if (single) jump(day);
          else {
            choosing = "end";
            if (end !== limit(end)) end = "";
            jump(end || bounds()[0]);
          }
        }
      };
      button.onkeydown = (key) => {
        const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday(day), End: 6 - weekday(day) };
        if (Object.hasOwn(offsets, key.key)) {
          key.preventDefault();
          jump(shift(day, offsets[key.key]));
        } else if (key.key === "PageUp" || key.key === "PageDown") {
          key.preventDefault();
          const next = monthOf(day, key.key === "PageUp" ? -1 : 1);
          const dayOfMonth = Number(day.slice(-2));
          jump(shift(next, Math.min(dayOfMonth, distance(next, monthOf(next, 1))) - 1));
        }
      };
    });
  }
  focus = limit(focus);
  draw();
  if (homepage) dialog.showModal();
  else openStudioDialog(dialog);
  focusDay();
}
