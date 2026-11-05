import {createHash} from 'node:crypto';
import {SCENARIOS} from '../../website/testing/booking-scenarios.mjs';
const digest=x=>createHash('sha256').update(x).digest('hex');
const ids=new Set([...SCENARIOS.map(s=>s[0]),'anonymous-authorization','runtime-isolation','calendar-invalid-range','actual-guest-ui','real-google-login','cross-account-live','checkout-receipt-flow','feedback-scheduler','inbox-rendering']);
const kinds=new Set(['live-browser-api','live-api-read','emulator','live-guest-ui','application-unit']);
export function testEvents(report){
  if(report?.schemaVersion!==1||report.environment!=='pre-prod'||!/^\b[a-f0-9-]{36}$/.test(report.runId)||!kinds.has(report.execution)||!/^([a-f0-9]{40}|local-validation)$/.test(report.source)||!Array.isArray(report.cases)||report.cases.length>2000)throw Error('INVALID_TEST_REPORT');
  const seen=new Set();
  return report.cases.map(c=>{
    if((!ids.has(c.id)&&!/^case-[a-f0-9]{64}$/.test(c.id))||seen.has(c.id)||!['passed','failed','blocked','skipped'].includes(c.status)||!Number.isFinite(Date.parse(c.startedAt))||!Number.isFinite(Date.parse(c.finishedAt))||Date.parse(c.finishedAt)<Date.parse(c.startedAt)||c.execution!==report.execution)throw Error('INVALID_TEST_CASE');
    seen.add(c.id);
    // Deliberate allowlist: never forward report bodies, user fields or exception text.
    return{'event.id':digest(report.runId+'\0'+report.execution+'\0'+c.id),'event.provider':'aroha.testing','event.type':'test.scenario.finished','event.category':'testing','event.authority':'test-runner-observed','event.source':'native-test-report','event.created_at':c.finishedAt,'deployment.environment.name':'pre-prod','service.name':'aroha-e2e-tests-pre-prod','service.version':report.source,'test.is_synthetic':true,'test.run.id':report.runId,'test.scenario.id':c.id,'test.status':c.status,'test.execution.kind':report.execution,'test.duration_ms':Date.parse(c.finishedAt)-Date.parse(c.startedAt),'source.revision':report.source,...(['product','runner','prerequisite'].includes(c.classification)?{'test.failure.classification':c.classification}:{}),...(['two-held','held-and-quoted'].includes(c.variant)?{'test.inventory.variant':c.variant}:{}),...(report.execution==='emulator'?{'test.project':'demo-aroha'}:{})};
  });
}
