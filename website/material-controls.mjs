// Shared Material 3 interactions. Native form controls remain the source of truth
// for validation, FormData and the existing API handlers.
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const calendarIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/></svg>';
const iso = d => d.toISOString().slice(0,10);
const date = s => new Date(s+'T12:00:00Z');
const today = () => iso(new Date(Date.now()+19800000));
export function parseDate(value) {
  const s=String(value).trim(), m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const v=m?`${m[3]}-${m[2]}-${m[1]}`:s;
  return /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(+date(v))&&iso(date(v))===v?v:'';
}
const displayDate = s => parseDate(s)?s.split('-').reverse().join('/') : '';
const fullDate = s => date(s).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
function fieldName(input) {
  const label=input.labels?.[0]?.cloneNode(true);
  label?.querySelectorAll('input,select,textarea,button').forEach(el=>el.remove());
  return input.getAttribute('aria-label') || label?.textContent.trim() || input.name || 'Choose an option';
}
function changed(input) {
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
}
function shell(input,className) {
  const wrapper=document.createElement('span'); wrapper.className=className;
  input.before(wrapper); wrapper.append(input); return wrapper;
}
let sequence=0;
function upgradeSelect(input) {
  if(input.multiple||input.size>1)return;
  const name=fieldName(input), wrap=shell(input,'md-select'), button=document.createElement('button');
  input.classList.add('md-native');input.tabIndex=-1;input.setAttribute('aria-hidden','true');
  button.type='button';button.className='md-select-button';button.setAttribute('aria-haspopup','listbox');
  button.setAttribute('aria-expanded','false');wrap.append(button);
  const update=()=>{button.innerHTML=`<span>${esc(input.options[input.selectedIndex]?.textContent||'Choose an option')}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>`;button.disabled=input.disabled;button.setAttribute('aria-label',name+': '+(input.options[input.selectedIndex]?.textContent||'Choose an option'));};
  input.addEventListener('change',update); input.addEventListener('focus',()=>button.focus());
  input.addEventListener('invalid',e=>{e.preventDefault();button.setAttribute('aria-invalid','true');button.focus();});
  let popup;
  button.onclick=()=>{
    if(popup?.isConnected){popup.hidePopover();return;}
    update();popup=document.createElement('div');popup.id='md-options-'+(++sequence);popup.className='md-option-menu';popup.popover='auto';popup.setAttribute('role','listbox');popup.setAttribute('aria-label',name);
    button.setAttribute('aria-controls',popup.id);
    popup.innerHTML=[...input.options].map((o,i)=>`<button type="button" role="option" aria-selected="${o.selected}" data-option="${i}" tabindex="-1" ${o.disabled?'disabled':''}><span>${esc(o.textContent)}</span>${o.selected?'<span aria-hidden="true">✓</span>':''}</button>`).join('');
    wrap.append(popup);popup.showPopover();button.setAttribute('aria-expanded','true');
    const r=button.getBoundingClientRect(), w=Math.min(Math.max(r.width,240),innerWidth-24), h=Math.min(popup.scrollHeight,320,innerHeight-32);
    popup.style.cssText=`width:${w}px;max-height:${h}px;left:${Math.max(12,Math.min(r.left,innerWidth-w-12))}px;top:${r.bottom+h+8>innerHeight?Math.max(12,r.top-h-4):r.bottom+4}px`;
    const options=[...popup.querySelectorAll('[role=option]:not(:disabled)')];
    const choose=b=>{input.selectedIndex=Number(b.dataset.option);button.removeAttribute('aria-invalid');changed(input);if(popup.isConnected)popup.hidePopover();if(button.isConnected)button.focus();};
    options.forEach(b=>b.onclick=()=>choose(b));
    let typed='',timer;
    popup.onkeydown=e=>{
      const i=options.indexOf(document.activeElement);let next;
      if(e.key==='ArrowDown')next=(i+1)%options.length;
      if(e.key==='ArrowUp')next=(i-1+options.length)%options.length;
      if(e.key==='Home')next=0;if(e.key==='End')next=options.length-1;
      if(next!==undefined){e.preventDefault();options[next]?.focus();}
      else if(e.key==='Escape'){e.preventDefault();popup.hidePopover();button.focus();}
      else if(e.key==='Tab'){popup.hidePopover();button.focus();}
      else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey){typed+=e.key.toLowerCase();clearTimeout(timer);timer=setTimeout(()=>{typed='';},700);options.find(b=>b.textContent.trim().toLowerCase().startsWith(typed))?.focus();}
    };
    const closeOnMove=e=>{if(e.target!==popup&&!popup.contains(e.target)&&popup.isConnected)popup.hidePopover();};
    window.addEventListener('resize',closeOnMove);document.addEventListener('scroll',closeOnMove,true);
    popup.addEventListener('toggle',e=>{if(e.newState==='closed'){button.setAttribute('aria-expanded','false');clearTimeout(timer);window.removeEventListener('resize',closeOnMove);document.removeEventListener('scroll',closeOnMove,true);popup.remove();}},{once:false});
    (options.find(b=>b.getAttribute('aria-selected')==='true')||options[0])?.focus();
  };
  button.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();button.click();}});
  input._mdUpdate=update;update();
}
function upgradeDate(input) {
  const name=fieldName(input), wrap=shell(input,'md-date-field'), text=document.createElement('input'), button=document.createElement('button');
  input.classList.add('md-native');input.tabIndex=-1;input.setAttribute('aria-hidden','true');
  text.type='text';text.inputMode='numeric';text.placeholder='DD/MM/YYYY';text.setAttribute('aria-label',name+' (DD/MM/YYYY)');text.autocomplete='off';
  button.type='button';button.className='md-calendar-trigger';button.innerHTML=calendarIcon;button.setAttribute('aria-haspopup','dialog');
  wrap.append(text,button);
  const update=()=>{text.value=displayDate(input.value);text.disabled=input.disabled;text.required=input.required;button.disabled=input.disabled;button.setAttribute('aria-label',`Choose ${name.toLowerCase()}${input.value?', '+fullDate(input.value):''}`);};
  input._mdUpdate=update;input.addEventListener('change',update);input.addEventListener('focus',()=>text.focus());
  input.addEventListener('invalid',e=>{e.preventDefault();text.setCustomValidity(input.validationMessage);text.reportValidity();});
  text.addEventListener('input',()=>{text.setCustomValidity('');input.value=parseDate(text.value);input.dispatchEvent(new Event('input',{bubbles:true}));});
  text.addEventListener('change',()=>{const v=parseDate(text.value);text.setCustomValidity(text.value&&!v?'Enter a valid date as DD/MM/YYYY.':'');input.value=v;input.dispatchEvent(new Event('change',{bubbles:true}));if(v)text.value=displayDate(v);});
  button.onclick=()=>{
    const d=document.createElement('dialog');d.className='md-calendar';d.setAttribute('aria-label','Choose '+name.toLowerCase());
    const selected=input.value, clamp=s=>input.min&&s<input.min?input.min:input.max&&s>input.max?input.max:s, initial=clamp(parseDate(selected)||parseDate(input.min)||today());let focus=initial, month=initial.slice(0,7);
    const allowed=s=>(!input.min||s>=input.min)&&(!input.max||s<=input.max);
    function draw(){
      const first=date(month+'-01'),offset=first.getUTCDay(),count=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
      d.innerHTML=`<div class="md-calendar-title"><span>Select ${esc(name.toLowerCase())}</span><button type="button" class="md-icon" data-cancel aria-label="Close calendar">×</button></div><p class="md-calendar-selection">${selected?esc(date(selected).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})):'Choose a date'}</p><div class="md-month-navigation"><button type="button" class="md-icon" data-month="-1" aria-label="Previous month" ${input.min&&month<=input.min.slice(0,7)?'disabled':''}>‹</button><strong aria-live="polite">${first.toLocaleDateString('en-IN',{month:'long',year:'numeric',timeZone:'UTC'})}</strong><button type="button" class="md-icon" data-month="1" aria-label="Next month" ${input.max&&month>=input.max.slice(0,7)?'disabled':''}>›</button></div><table class="md-calendar-grid" role="grid" aria-label="${esc(month)}"><thead><tr>${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(t=>`<th scope="col" abbr="${t}">${t.slice(0,1)}</th>`).join('')}</tr></thead><tbody>${Array.from({length:Math.ceil((offset+count)/7)},(_,row)=>'<tr>'+Array.from({length:7},(_,col)=>{const n=row*7+col-offset+1,s=month+'-'+String(n).padStart(2,'0');return n<1||n>count?'<td></td>':`<td role="gridcell" aria-selected="${s===selected}"><button type="button" data-day="${s}" tabindex="${s===focus?'0':'-1'}" aria-label="${esc(fullDate(s))}" ${s===today()?'aria-current="date"':''} ${allowed(s)?'':'disabled'}>${n}</button></td>`;}).join('')+'</tr>').join('')}</tbody></table><p class="md-calendar-help">DD/MM/YYYY · Use arrow keys to move between days.</p><div class="md-calendar-actions"><button type="button" data-today>Today</button><button type="button" data-cancel>Cancel</button></div>`;
      d.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>d.close());
      d.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{const dt=date(month+'-01');dt.setUTCMonth(dt.getUTCMonth()+Number(b.dataset.month));month=iso(dt).slice(0,7);focus=clamp(month+'-01');draw();d.querySelector(`[data-month="${b.dataset.month}"]`)?.focus();});
      const choose=s=>{if(!allowed(s))return;input.value=s;text.setCustomValidity('');changed(input);d.close();};
      d.querySelectorAll('[data-day]').forEach(b=>{b.onclick=()=>choose(b.dataset.day);b.onkeydown=e=>{const dt=date(b.dataset.day);let move=0;if(e.key==='ArrowLeft')move=-1;if(e.key==='ArrowRight')move=1;if(e.key==='ArrowUp')move=-7;if(e.key==='ArrowDown')move=7;if(e.key==='Home')move=-dt.getUTCDay();if(e.key==='End')move=6-dt.getUTCDay();if(e.key==='PageUp'||e.key==='PageDown'){dt.setUTCDate(1);dt.setUTCMonth(dt.getUTCMonth()+(e.key==='PageUp'?-1:1)*(e.shiftKey?12:1));move=0;}else if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();dt.setUTCDate(dt.getUTCDate()+move);focus=clamp(iso(dt));month=focus.slice(0,7);draw();d.querySelector(`[data-day="${focus}"]:not(:disabled)`)?.focus();};});
      const t=d.querySelector('[data-today]');t.disabled=!allowed(today());t.onclick=()=>choose(today());
    }
    // A nested modal stays above a booking dialog and cannot be clipped by it.
    (input.closest('dialog')||document.body).append(d);draw();d.showModal();
    (d.querySelector(`[data-day="${focus}"]:not(:disabled)`)||d.querySelector('[data-month="1"]')).focus();
    d.addEventListener('close',()=>{d.remove();if(button.isConnected)button.focus();},{once:true});
  };
  update();
}
function upgradeStepper(input) {
  const name=fieldName(input),wrap=shell(input,'md-stepper');input.classList.add('md-count');
  const buttons=[-1,1].map(direction=>{const b=document.createElement('button');b.type='button';b.textContent=direction<0?'−':'+';b.setAttribute('aria-label',(direction<0?'Decrease ':'Increase ')+name.toLowerCase());b.onclick=()=>{try{direction<0?input.stepDown():input.stepUp();changed(input);}catch{}};return b;});
  wrap.prepend(buttons[0]);wrap.append(buttons[1]);
  const update=()=>{buttons.forEach((b,i)=>b.disabled=input.disabled||(input.value!==''&&(i===0&&input.min!==''&&Number(input.value)<=Number(input.min)||i===1&&input.max!==''&&Number(input.value)>=Number(input.max))));};
  input._mdUpdate=update;input.addEventListener('input',update);input.addEventListener('change',update);update();
}
export function installMaterialControls(root=document) {
  if(root._materialControls)return;root._materialControls=true;document.documentElement.classList.add('material-app');
  let queued=false;
  const scan=()=>{
    queued=false;
    root.querySelectorAll('select:not([data-md-ready]),input[type=date]:not([data-md-ready]),input[type=number][data-stepper]:not([data-md-ready]),input[type=number][name=adults]:not([data-md-ready]),input[type=number][name=childrenCount]:not([data-md-ready])').forEach(input=>{
      input.dataset.mdReady='';if(input.tagName==='SELECT')upgradeSelect(input);else if(input.type==='date')upgradeDate(input);else upgradeStepper(input);
    });
    root.querySelectorAll('[data-md-ready]').forEach(input=>input._mdUpdate?.());
  };
  const schedule=()=>{if(!queued){queued=true;queueMicrotask(scan);}};
  new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'?(r.target.matches?.('[data-md-ready],option')):[...r.addedNodes].some(n=>n.nodeType===1&&!n.closest?.('.md-select-button,.md-option-menu,.md-calendar'))))schedule();}).observe(root.documentElement||root,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','min','max','required','selected']});
  root.addEventListener('reset',()=>setTimeout(scan,0));scan();
}
export function confirmMaterial(message,{title='Confirm this change',action='Confirm',danger=false}={}) {
  return new Promise(resolve=>{const d=document.createElement('dialog');d.className='md-confirm';d.innerHTML=`<h2>${esc(title)}</h2><p>${esc(message)}</p><div class="md-confirm-actions"><button type="button" data-keep>Keep reviewing</button><button type="button" class="${danger?'danger':'primary'}" data-confirm>${esc(action)}</button></div>`;d.setAttribute('aria-label',title);(document.querySelector('dialog[open]')||document.body).append(d);d.showModal();let yes=false;d.querySelector('[data-keep]').onclick=()=>d.close();d.querySelector('[data-confirm]').onclick=()=>{yes=true;d.close();};d.addEventListener('close',()=>{d.remove();resolve(yes);},{once:true});});
}
