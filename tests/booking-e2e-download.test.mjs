import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {runBookingScenarios,SCENARIOS} from '../website/testing/booking-scenarios.mjs';
test('a finished console run automatically downloads one sanitized report without exposing its session token',async()=>{
 const html=(await readFile(new URL('../website/testing/index.html',import.meta.url),'utf8')).replace('__SOURCE__','a'.repeat(40));
 const dom=new JSDOM(html,{url:'https://aroha-retreat-preprod.web.app/admin/testing/',runScripts:'outside-only'}),w=dom.window;
 let blob,names=[];w.testAuth={auth:{authStateReady:async()=>{},currentUser:{getIdToken:async()=>'synthetic-bearer-private'}},login:async()=>{}};w.testScenarios={runBookingScenarios,SCENARIOS};
 w.Blob=Blob;w.URL.createObjectURL=b=>{blob=b;return'blob:synthetic';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){names.push(this.download);};
 let clock=Date.now();w.Date.now=()=>clock+=10000;
 w.fetch=async path=>Response.json(path.includes('/public')?{environment:'pre-prod',delivery:'email_enabled',settings:{products:{siteAdults:35,nightAdults:10}},units:[]}:path.includes('/calendar')?{days:Array.from({length:14},()=>({available:true}))}:{error:{code:'FORBIDDEN'}},{status:path.includes('/state')?403:200});
 const source=(await readFile(new URL('../website/testing/booking-e2e.mjs',import.meta.url),'utf8')).replace("import {auth, login} from '../firebase-auth.mjs';","const {auth,login}=window.testAuth;").replace("import {runBookingScenarios, SCENARIOS} from './booking-scenarios.mjs';","const {runBookingScenarios,SCENARIOS}=window.testScenarios;").replaceAll('__AROHA_ENVIRONMENT__',"'pre-prod'");
 try{await w.eval('(async()=>{'+source+'})()');await w.document.querySelector('#run').onclick();assert.equal(names.length,1);assert.match(names[0],/^aroha-e2e-[a-f0-9-]{36}\.json$/);const content=await blob.text(),r=JSON.parse(content);assert.equal(r.environment,'pre-prod');assert.equal(r.cleanup.status,'not-needed');assert.ok(r.cases.some(c=>c.status==='blocked'));assert.doesNotMatch(content,/synthetic-bearer-private/);}finally{w.close();}
});
