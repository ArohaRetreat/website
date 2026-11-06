import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountStayPanel} from '../website/stay-panel.mjs';
test('payment UI freezes an uncertain write and retries its original key and payload',async()=>{
 const dom=new JSDOM('<main><div id="panel"></div></main>');const old=globalThis.document;globalThis.document=dom.window.document;const target=document.querySelector('#panel');let attempts=[];
 const call=async(op,input,key)=>{
  if(op==='getFinancialSummary')return{totalPaise:100000,paidPaise:0,balanceDuePaise:100000,version:3};
  if(['listPayments','listDocuments'].includes(op))return{items:[],nextCursor:null};
  if(op==='recordPayment'){attempts.push({input:structuredClone(input),key});if(attempts.length===1)throw Error('timeout');return{};}
  throw Error('Unexpected operation');
 };
 try{await mountStayPanel(target,{booking:{id:'synthetic',status:'confirmed'},manager:true,call});const form=target.querySelector('[data-payment]');form.elements.amount.value='250';form.elements.method.value='cash';form.elements.verified.checked=true;
 await form.onsubmit({preventDefault(){}});assert.equal(attempts.length,1);assert.equal(attempts[0].input.amountPaise,25000);assert.equal(attempts[0].input.expectedVersion,3);assert.ok(form.elements.amount.disabled);form.elements.amount.value='999';
 await form.onsubmit({preventDefault(){}});assert.equal(attempts.length,2);assert.deepEqual(attempts[1],attempts[0]);assert.ok(target.querySelector('[data-payment]'));
 }finally{globalThis.document=old;dom.window.close();}
});
test('guest feedback renders safely and never presents host payment controls',async()=>{
 const dom=new JSDOM('<div id="panel"></div>');const old=globalThis.document;globalThis.document=dom.window.document;
 try{const target=document.querySelector('#panel');await mountStayPanel(target,{booking:{id:'synthetic',status:'completed'},call:async op=>op==='getFinancialSummary'?{totalPaise:100,paidPaise:0,balanceDuePaise:100,version:0}:op==='getReservationFeedback'?{rating:4,comment:'</textarea><script>bad()</script>',version:1}:{items:[],nextCursor:null}});assert.equal(target.querySelector('script'),null);assert.equal(target.querySelector('[data-payment]'),null);assert.match(target.querySelector('textarea').value,/<script>/);assert.ok(target.querySelector('[data-feedback]'));}finally{globalThis.document=old;dom.window.close();}
});
test('a committed payment followed by refresh failure cannot be submitted again',async()=>{
 const dom=new JSDOM('<div id="panel"></div>');const old=globalThis.document;globalThis.document=dom.window.document;let paid=false,writes=0;
 try{const target=document.querySelector('#panel');await mountStayPanel(target,{booking:{id:'synthetic',status:'confirmed'},manager:true,call:async op=>{if(op==='recordPayment'){paid=true;writes++;return{};}if(paid)throw Error('refresh failed');return op==='getFinancialSummary'?{totalPaise:10000,paidPaise:0,balanceDuePaise:10000,version:0}:{items:[],nextCursor:null};}});const form=target.querySelector('[data-payment]');form.elements.amount.value='10';form.elements.verified.checked=true;await form.onsubmit({preventDefault(){}});await form.onsubmit({preventDefault(){}});assert.equal(writes,1);assert.ok(form.querySelector('button').disabled);assert.match(target.textContent,/change was saved/);
 }finally{globalThis.document=old;dom.window.close();}
});
test('booking viewers never receive private feedback editing controls',async()=>{
 const dom=new JSDOM('<div id="panel"></div>');const old=globalThis.document;globalThis.document=dom.window.document;const calls=[];
 try{const target=document.querySelector('#panel');await mountStayPanel(target,{booking:{id:'synthetic',status:'completed'},staff:true,manager:false,call:async op=>{calls.push(op);return op==='getFinancialSummary'?{totalPaise:100,paidPaise:0,balanceDuePaise:100,version:0}:{items:[],nextCursor:null};}});assert.ok(!calls.includes('getReservationFeedback'));assert.equal(target.querySelector('[data-feedback]'),null);assert.equal(target.querySelector('[data-payment]'),null);assert.match(target.textContent,/Balance due/);
 }finally{globalThis.document=old;dom.window.close();}
});
