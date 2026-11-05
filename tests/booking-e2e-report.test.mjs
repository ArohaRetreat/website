import test from 'node:test';
import assert from 'node:assert/strict';
import {testEvents} from '../scripts/testing/report.mjs';
import {request} from '../scripts/delivery/transport.mjs';
import {telemetry} from '../scripts/delivery/otlp.mjs';
const report=()=>({schemaVersion:1,environment:'pre-prod',runId:'11111111-1111-4111-8111-111111111111',source:'a'.repeat(40),execution:'emulator',cases:[{id:'day-lifecycle',status:'passed',execution:'emulator',startedAt:'2026-11-05T12:00:00Z',finishedAt:'2026-11-05T12:00:01Z',email:'private@example.test',phone:'private',error:'SECRET'}]});
test('test reports export a stable private-data-free allowlist with explicit emulator authority',()=>{const r=report(),a=testEvents(r),b=testEvents(r);assert.deepEqual(a,b);assert.equal(a[0]['test.project'],'demo-aroha');assert.equal(a[0]['event.authority'],'test-runner-observed');assert.equal(a[0]['test.duration_ms'],1000);assert.doesNotMatch(JSON.stringify(a),/private|SECRET/);});
test('test reports reject production, malformed clocks, unknown execution and duplicate cases',()=>{for(const mutate of [r=>r.environment='production',r=>r.execution='real-e2e',r=>r.cases.push({...r.cases[0]}),r=>r.cases[0].finishedAt='bad',r=>r.cases[0].startedAt='2027-01-01',r=>r.cases[0].id='private@example.test']){const r=report();mutate(r);assert.throws(()=>testEvents(r));}});
test('metadata destinations are restricted and configured tenant is used without leaking credentials',async()=>{let target;const r=await request('/api/v2/bizevents/ingest','[]','synthetic',{origin:'https://example.live.dynatrace.com',fetchImpl:async(url)=>{target=url;return new Response('{}',{status:202});}});assert.equal(r.accepted,true);assert.equal(target,'https://example.live.dynatrace.com/api/v2/bizevents/ingest');await assert.rejects(request('/api/v2/bizevents/ingest','[]','synthetic',{origin:'https://attacker.example'}));});
// Independent protobuf wire reader verifies emitted span timing and parent IDs.
function fields(input){const b=Buffer.from(input),out=[];let p=0;const uint=()=>{let v=0,n=0,x;do{x=b[p++];v+=(x&127)*2**n;n+=7;}while(x&128);return v;};while(p<b.length){const tag=uint(),wire=tag&7;let value;if(wire===2){const n=uint();value=b.subarray(p,p+n);p+=n;}else if(wire===1){value=b.readBigUInt64LE(p);p+=8;}else if(wire===0)value=uint();else if(wire===5){value=b.readUInt32LE(p);p+=4;}else throw Error('UNEXPECTED_PROTOBUF_WIRE');out.push([tag>>>3,value]);}return out;}
test('report root span encloses child work and exports genuine parent context',async()=>{
 const t=telemetry('aroha-e2e-tests-pre-prod','test','pre-prod',{namespace:'testing'}),root=t.beginSpan('root',{'telemetry.mode':'report-processing'});
 await new Promise(r=>setTimeout(r,5));const childSpan=t.beginSpan('child',{},root.context);childSpan.end();await new Promise(r=>setTimeout(r,5));root.end();
 const batch=(await t.batches()).find(b=>b.signal==='traces');
 const spans=fields(batch.body).filter(([n])=>n===1).flatMap(([,r])=>fields(r).filter(([n])=>n===2).flatMap(([,s])=>fields(s).filter(([n])=>n===2).map(([,v])=>new Map(fields(v)))));
 const parent=spans.find(s=>s.get(5).toString()==='root'),child=spans.find(s=>s.get(5).toString()==='child');assert.ok(parent&&child);assert.deepEqual(parent.get(1),child.get(1));assert.deepEqual(parent.get(2),child.get(4));assert.ok(parent.get(7)<=child.get(7));assert.ok(parent.get(8)>=child.get(8));await t.shutdown();
});
