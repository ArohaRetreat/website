import { openStudioDialog } from "./studio-feedback.mjs";
const toDate = (day) => new Date(day + "T12:00:00Z");
const iso = (value) => value.toISOString().slice(0,10);
const shift = (day, offset) => iso(new Date(+toDate(day) + offset * 86400000));
const monthOf = (day, offset = 0) => {
  const value = toDate(day.slice(0,7) + "-01");
  value.setUTCMonth(value.getUTCMonth()+offset);
  return iso(value);
};
const distance = (a,b) => Math.round((toDate(b)-toDate(a)) / 86400000);
const textDate = (value) => toDate(value).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});

export function chooseStudioDates({ kind, arrival, departure, today, onApply }) {
  const dialog = document.createElement("dialog");
  const single = kind === "day", event = kind === "event";
  const latestArrival = shift(today, 366);
  const endLabel = event ? "Last day" : "Checkout";
  const trigger = document.activeElement;
  let start = arrival, end = event ? shift(departure,-1) : departure, choosing = "start", focus = start;
  dialog.className = "md-calendar studio-range";
  dialog.setAttribute("data-dt-mask","");
  dialog.setAttribute("aria-label",single ? "Choose visit date" : "Choose booking dates");
  document.body.append(dialog);
  dialog.addEventListener("close", () => { dialog.remove(); if (trigger?.isConnected) trigger.focus(); }, {once:true});
  const bounds = () => choosing === "start" ? [today,latestArrival] : [shift(start,event?0:1),shift(start,event?30:31)];
  const limit = (day) => {
    const [min,max] = bounds();
    return day < min ? min : day > max ? max : day;
  };
  const jump = (day) => { focus = limit(day); draw(true); };
  function draw(restoreFocus = false) {
    const [min,max] = bounds();
    const month = monthOf(focus);
    const endOfMonth = monthOf(focus,1);
    const count = distance(month,endOfMonth);
    const offset = (toDate(month).getUTCDay()+6)%7;
    const selected = (day) => day === start || (!single && day === end);
    const title = toDate(month).toLocaleDateString("en-IN",{month:"long",year:"numeric",timeZone:"UTC"});
    const rows = Array.from({length:Math.ceil((offset+count)/7)},(_,row)=>"<tr>"+Array.from({length:7},(_,col)=>{
      const index = row*7+col-offset;
      if (index < 0 || index >= count) return "<td></td>";
      const day = shift(month,index);
      return `<td role="gridcell" aria-selected="${selected(day)}" class="${!single && day>start && day<end ? "in-range" : ""}"><button type="button" data-range-day="${day}" tabindex="${day===focus?"0":"-1"}" aria-label="${textDate(day)}" ${day===today?'aria-current="date"':""} ${day<min||day>max?"disabled":""}>${index+1}</button></td>`;
    }).join("")+"</tr>").join("");
    dialog.innerHTML = `<div class="dialog-head"><h2>${single?"Choose visit date":"Choose booking dates"}</h2><button type="button" class="md-icon" data-close aria-label="Close calendar">×</button></div>
      ${single ? "" : `<div class="studio-range-steps"><button type="button" data-range-step="start" aria-pressed="${choosing==="start"}"><small>Check-in${event?" / first day":""}</small><strong>${textDate(start)}</strong></button><button type="button" data-range-step="end" aria-pressed="${choosing==="end"}"><small>${endLabel}</small><strong>${end?textDate(end):"Choose date"}</strong></button></div>`}
      <div class="md-month-navigation"><button type="button" class="md-icon" data-range-month="-1" aria-label="Previous month" ${month<=monthOf(min)?"disabled":""}>‹</button><strong aria-live="polite">${title}</strong><button type="button" class="md-icon" data-range-month="1" aria-label="Next month" ${endOfMonth>monthOf(max)?"disabled":""}>›</button></div>
      <table class="md-calendar-grid" role="grid" aria-label="${title}"><thead><tr>${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((name)=>`<th scope="col">${name}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
      <p class="md-calendar-help" aria-live="polite">${single?"Select one date.":!end?"Choose the " + endLabel.toLowerCase() + " date.":event?`${distance(start,end)+1} event day(s)`:`${distance(start,end)} night(s)`}</p>
      <div class="md-calendar-actions"><button type="button" data-close>Cancel</button><button class="primary" type="button" data-apply ${!single&&!end?"disabled":""}>${single?"Use visit date":"Use dates"}</button></div>`;
    dialog.querySelectorAll("[data-close]").forEach((button)=>button.onclick=()=>dialog.close());
    dialog.querySelector("[data-apply]").onclick=()=>{
      onApply(start,single?shift(start,1):event?shift(end,1):end);
      dialog.close();
    };
    dialog.querySelectorAll("[data-range-step]").forEach((button)=>button.onclick=()=>{
      choosing=button.dataset.rangeStep;
      jump(choosing==="start"?start:end||bounds()[0]);
    });
    dialog.querySelectorAll("[data-range-month]").forEach((button)=>button.onclick=()=>{
      const step=button.dataset.rangeMonth;
      focus=limit(monthOf(focus,Number(step)));
      draw();
      (dialog.querySelector(`[data-range-month="${step}"]:not(:disabled)`) || dialog.querySelector('[data-range-day][tabindex="0"]'))?.focus();
    });
    dialog.querySelectorAll("[data-range-day]").forEach((button)=>{
      const day=button.dataset.rangeDay;
      button.onclick=()=>{
        if (choosing==="start") {
          start=day;
          if (!single) {
            choosing="end";
            if (end!==limit(end)) end="";
            jump(end||bounds()[0]);
            return;
          }
        } else end=day;
        jump(day);
      };
      button.onkeydown=(event)=>{
        const weekday=(toDate(day).getUTCDay()+6)%7;
        const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-weekday,End:6-weekday};
        if (!(event.key in offsets) && !["PageUp","PageDown"].includes(event.key)) return;
        event.preventDefault();
        jump(event.key in offsets ? shift(day,offsets[event.key]) : monthOf(day,event.key==="PageUp"?-1:1));
      };
    });
    if (restoreFocus) dialog.querySelector('[data-range-day][tabindex="0"]')?.focus();
  }
  focus=limit(focus);
  draw();
  openStudioDialog(dialog);
  dialog.querySelector('[data-range-day][tabindex="0"]')?.focus();
}
