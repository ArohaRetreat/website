import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const source=(await readFile(new URL('../website/material-controls.mjs',import.meta.url),'utf8')).replaceAll('export ','');
const settle=()=>new Promise(r=>setTimeout(r,0));
function mount(markup){
 const dom=new JSDOM(markup,{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.HTMLElement.prototype.showPopover=function(){this.dataset.open='true';};w.HTMLElement.prototype.hidePopover=function(){this.dispatchEvent(new w.Event('close'));this.remove();};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.eval(source+'\nwindow.material={installMaterialControls,parseDate,confirmMaterial};');w.material.installMaterialControls();
 return{w,d:w.document,close:()=>dom.window.close()};
}
test('calendar validates typed dates and preserves the native ISO form contract',async()=>{
 const m=mount('<form><label>Arrival<input name="arrival" type="date" required min="2026-11-01" max="2026-12-31"></label></form>');
 try{const native=m.d.querySelector('[name=arrival]'),text=m.d.querySelector('.md-date-field input[type=text]');assert.equal(m.w.material.parseDate('31/02/2027'),'');assert.equal(m.w.material.parseDate('29/02/2028'),'2028-02-29');
 text.value='21/11/2026';text.dispatchEvent(new m.w.Event('input',{bubbles:true}));text.dispatchEvent(new m.w.Event('change',{bubbles:true}));assert.equal(new m.w.FormData(m.d.querySelector('form')).get('arrival'),'2026-11-21');
 m.d.querySelector('.md-calendar-trigger').click();const d=m.d.querySelector('.md-calendar');assert.ok(d.open);assert.equal(m.d.activeElement.dataset.day,'2026-11-21');d.querySelector('[data-day="2026-11-22"]').click();assert.equal(native.value,'2026-11-22');assert.equal(text.value,'22/11/2026');assert.equal(m.d.querySelector('.md-calendar'),null);assert.equal(m.d.activeElement.className,'md-calendar-trigger');
 }finally{m.close();}
});
test('calendar keyboard crosses month boundaries and honours disabled dates',async()=>{
 const m=mount('<label>Departure<input type="date" value="2026-11-30" min="2026-11-15" max="2026-12-10"></label>');
 try{m.d.querySelector('.md-calendar-trigger').click();assert.equal(m.d.querySelector('[data-day="2026-11-14"]').disabled,true);m.d.querySelector('[data-day="2026-11-30"]').dispatchEvent(new m.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(m.d.activeElement.dataset.day,'2026-12-01');assert.equal(m.d.querySelector('[data-day="2026-12-11"]').disabled,true);
 }finally{m.close();}
});
test('select menus keep labels, disabled choices, keyboard selection and native change handlers',async()=>{
 const m=mount('<form><label>Method<select name="method"><option value="cash">Cash</option><option value="upi">UPI</option><option disabled>Unavailable</option><option value="bank">Bank &lt;transfer&gt;</option></select></label></form>');
 try{let calls=0;const select=m.d.querySelector('select');select.onchange=()=>calls++;const button=m.d.querySelector('.md-select-button');button.click();assert.match(button.getAttribute('aria-label'),/Method/);assert.equal(m.d.querySelectorAll('.md-option-menu button:disabled').length,1);const menu=m.d.querySelector('[role=listbox]');menu.dispatchEvent(new m.w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));assert.equal(m.d.activeElement.textContent,'UPI');m.d.activeElement.click();assert.equal(select.value,'upi');assert.equal(calls,1);assert.equal(new m.w.FormData(m.d.querySelector('form')).get('method'),'upi');assert.match(button.textContent,/UPI/);select.disabled=true;await settle();assert.equal(button.disabled,true);
 }finally{m.close();}
});
test('guest steppers use bounded values and notify dependent child-age fields',async()=>{
 const m=mount('<label>Children under 10<input name="childrenCount" type="number" min="0" max="2" value="0"></label>');
 try{let changes=0;const input=m.d.querySelector('input');input.oninput=()=>changes++;const buttons=m.d.querySelectorAll('.md-stepper button');assert.equal(buttons[0].disabled,true);buttons[1].click();buttons[1].click();assert.equal(input.value,'2');assert.equal(changes,2);assert.equal(buttons[1].disabled,true);buttons[0].click();assert.equal(input.value,'1');
 }finally{m.close();}
});
test('new controls are upgraded once and resets restore the displayed values',async()=>{
 const m=mount('<form><label>Visit<select name="kind"><option>A</option><option>B</option></select></label></form>');
 try{const s=m.d.querySelector('select');s.value='B';s.dispatchEvent(new m.w.Event('change'));m.d.querySelector('form').reset();await settle();assert.match(m.d.querySelector('.md-select-button').textContent,/A/);m.d.querySelector('form').insertAdjacentHTML('beforeend','<label>Arrival<input type="date" name="arrival"></label>');await settle();assert.equal(m.d.querySelectorAll('.md-date-field').length,1);assert.equal(m.d.querySelectorAll('.md-select').length,1);
 }finally{m.close();}
});
test('destructive confirmation is a cancellable nested modal before any mutation',async()=>{
 const m=mount('<dialog open><h2>Booking</h2></dialog>');
 try{const result=m.w.material.confirmMaterial('This releases the booking.',{title:'Cancel booking?',action:'Cancel booking',danger:true});const modal=m.d.querySelector('.md-confirm');assert.ok(modal.closest('dialog')!==modal.parentElement);assert.equal(modal.parentElement.tagName,'DIALOG');modal.querySelector('[data-keep]').click();assert.equal(await result,false);assert.equal(m.d.querySelector('.md-confirm'),null);
 }finally{m.close();}
});

test('required menu fields explain missing choices and clear the error after selection',async()=>{
 const m=mount('<form><label>Child age<select name="age" required><option value="">Choose age</option><option value="2">2 years</option></select></label></form>');
 try{const select=m.d.querySelector('select'),button=m.d.querySelector('.md-select-button');select.dispatchEvent(new m.w.Event('invalid',{cancelable:true}));assert.equal(button.getAttribute('aria-invalid'),'true');assert.match(m.d.querySelector('[role=alert]').textContent,/Choose an option for child age/);button.click();m.d.querySelector('[data-option="1"]').click();assert.equal(button.hasAttribute('aria-invalid'),false);assert.equal(m.d.querySelector('[role=alert]').textContent,'');
 }finally{m.close();}
});

test('time picker uses bounded 24-hour entry and commits only on explicit confirmation',async()=>{
 const m=mount('<form><label>Stay check-in<input name="checkIn" type="time" required value="11:00"></label></form>');
 try{m.d.querySelector('.md-calendar-trigger').click();const d=m.d.querySelector('.md-time-picker');d.querySelector('[name=hour]').value='14';d.querySelector('[name=minute]').value='30';assert.equal(m.d.querySelector('[name=checkIn]').value,'11:00');d.querySelector('form').dispatchEvent(new m.w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(new m.w.FormData(m.d.querySelector('form')).get('checkIn'),'14:30');assert.equal(m.d.querySelector('input[type=text]').value,'14:30');assert.equal(m.d.querySelector('.md-time-picker'),null);
 }finally{m.close();}
});
test('payment date/time retains partial entry and preserves the original datetime FormData contract',async()=>{
 const m=mount('<form><label>Received at<input name="receivedAt" type="datetime-local" required></label></form>');
 try{await settle();const texts=m.d.querySelectorAll('input[type=text]');assert.equal(texts.length,2);texts[0].value='22/11/2026';texts[0].dispatchEvent(new m.w.Event('input',{bubbles:true}));texts[0].dispatchEvent(new m.w.Event('change',{bubbles:true}));await settle();assert.equal(texts[0].value,'22/11/2026');texts[1].value='14:30';texts[1].dispatchEvent(new m.w.Event('input',{bubbles:true}));texts[1].dispatchEvent(new m.w.Event('change',{bubbles:true}));assert.equal(new m.w.FormData(m.d.querySelector('form')).get('receivedAt'),'2026-11-22T14:30');m.d.querySelector('[name=receivedAt]').disabled=true;await settle();assert.equal(texts[0].disabled,true);assert.equal(texts[1].disabled,true);
 }finally{m.close();}
});

test('private popups retain explicit masking outside the page container',async()=>{
 const m=mount('<main data-dt-mask><label>Arrival<input type="date" value="2026-11-22"></label><label>Policy time<input type="time" value="11:00"></label><label>Private selection<select><option>Synthetic private label</option></select></label></main>');
 try{
 m.d.querySelector('.md-calendar-trigger').click();let popup=m.d.querySelector('.md-calendar');assert.equal(popup.parentElement,m.d.body);assert.ok(popup.hasAttribute('data-dt-mask'));popup.close();
 m.d.querySelectorAll('.md-calendar-trigger')[1].click();popup=m.d.querySelector('.md-time-picker');assert.equal(popup.parentElement,m.d.body);assert.ok(popup.hasAttribute('data-dt-mask'));popup.close();
 m.d.querySelector('.md-select-button').click();assert.ok(m.d.querySelector('.md-option-menu').hasAttribute('data-dt-mask'));m.d.querySelector('.md-option-menu').hidePopover();
 const pending=m.w.material.confirmMaterial('Synthetic private adjustment reason');popup=m.d.querySelector('.md-confirm');assert.equal(popup.parentElement,m.d.body);assert.ok(popup.hasAttribute('data-dt-mask'));popup.querySelector('[data-keep]').click();assert.equal(await pending,false);
 }finally{m.close();}
});
