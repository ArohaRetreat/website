import test from 'node:test';
import assert from 'node:assert/strict';
import {financialSummary} from '../functions/platform/finance.mjs';
import {commitStayLifecycle} from '../functions/platform/lifecycle.mjs';
import {validMediaSignature} from '../functions/platform/media.mjs';
test('financial reconciliation rejects an approved total below actual paid and duplicate reversals',()=>{
 const p={id:'p1',kind:'payment',amountPaise:50000};assert.equal(financialSummary({id:'b',total:100000},[p]).balanceDuePaise,50000);
 assert.throws(()=>financialSummary({id:'b',total:49000},[p]),e=>e.code==='FINANCIAL_RECONCILIATION_REQUIRED');
 assert.throws(()=>financialSummary({id:'b',total:100000},[p,{kind:'reversal',reverses:'p1',amountPaise:50000},{kind:'reversal',reverses:'p1',amountPaise:50000}]),e=>e.code==='FINANCIAL_RECONCILIATION_REQUIRED');
});
test('actual checkout queues one operational message now and optional private feedback at least 24 hours later',()=>{
 const vars={MAIL_ENABLED:'true',MAIL_FROM:'host@example.test',MAIL_REPLY_TO:'host@example.test',MAIL_HOST_TO:'host@example.test',MAIL_RECIPIENT_MODE:'booking',BILLING_ADDRESS:'Synthetic address',BILLING_PAYMENT_INSTRUCTIONS:'Arrange with the synthetic host'};const old=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]]));Object.assign(process.env,vars);
 const jobs=[];const tx={set:(ref,data)=>jobs.push(data)};const db={collection:()=>({doc:id=>({id})})};const now=1800000000000,booking={id:'synthetic',owner:'synthetic-owner',reference:'SYNTHETIC',status:'completed',version:2,kind:'day',total:100000,arrival:'2027-01-01',departure:'2027-01-02'};
 try{commitStayLifecycle(tx,db,{prepared:{action:'complete',summary:{paidPaise:25000,balanceDuePaise:75000},prepared:null},booking,profile:{name:'Synthetic Guest',email:'guest@example.test'},settings:{},now});assert.equal(booking.checkedOutAt,now);assert.equal(booking.outstandingAtCheckout,75000);assert.equal(jobs.length,2);assert.equal(jobs.find(j=>j.channel==='guest_checkout').nextAttemptAt,now);assert.equal(jobs.find(j=>j.channel==='guest_feedback').nextAttemptAt,now+86400000);assert.equal(jobs.find(j=>j.channel==='guest_checkout').snapshot.amountPaid,25000);
 jobs.length=0;commitStayLifecycle(tx,db,{prepared:{action:'complete',summary:null,prepared:null},booking:{...booking,source:'host_private'},profile:{email:'guest@example.test'},settings:{},now});assert.equal(jobs.length,1);assert.equal(jobs[0].snapshot.pricingPending,true);
 }finally{for(const[k,v]of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
test('media signatures exclude executable markup and cross-type content',()=>{const png=Buffer.from([137,80,78,71,13,10,26,10]);assert.equal(validMediaSignature(png,'image/png'),true);assert.equal(validMediaSignature(png,'image/jpeg'),false);assert.equal(validMediaSignature(Buffer.from('<svg><script/></svg>'),'image/png'),false);assert.equal(validMediaSignature(Buffer.from('0000ftypavif0000'),'video/mp4'),false);});

test('inactive invoices retain historical charges and verified payments without an outstanding balance or automatic refund',()=>{for(const status of ['cancelled','declined','expired']){const result=financialSummary({id:'b',status,total:100000},[{id:'p',kind:'payment',amountPaise:25000}]);assert.equal(result.totalPaise,100000);assert.equal(result.paidPaise,25000);assert.equal(result.balanceDuePaise,0);assert.equal(result.requiresPaymentReview,true);assert.equal(result.unappliedPaymentPaise,25000);assert.equal(result.hasOutstandingBalance,false);}});
