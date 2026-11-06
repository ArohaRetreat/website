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
