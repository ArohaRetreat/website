import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {firebaseClient} from '../delivery/credentials.mjs';
import {telemetry} from '../delivery/otlp.mjs';
import {exportDelivery} from '../delivery/transport.mjs';
import {validateObservabilityConfig} from '../../functions/observability-config.mjs';
import {testEvents} from './report.mjs';
const path=process.argv[2];if(!path)throw Error('REPORT_PATH_REQUIRED');
const report=JSON.parse(await readFile(path,'utf8')),events=testEvents(report);
await mkdir('local/test-evidence',{recursive:true});
const receiptPath=resolve('local/test-evidence',report.runId+'-'+report.execution+'-transport.json');
try{const prior=JSON.parse(await readFile(receiptPath,'utf8'));if(prior.accepted){console.log(JSON.stringify({runId:report.runId,alreadyAccepted:true,receipt:receiptPath}));process.exit(0);}}catch(e){if(e.code!=='ENOENT')throw e;}
const Client=await firebaseClient(),firestore=new Client({urlPrefix:'https://firestore.googleapis.com',apiVersion:'v1',auth:true});
const decode=v=>v.mapValue?Object.fromEntries(Object.entries(v.mapValue.fields).map(([k,x])=>[k,decode(x)])):v.integerValue!==undefined?Number(v.integerValue):v.nullValue!==undefined?null:v.stringValue;
const doc=(await firestore.get('/projects/aroha-retreat/databases/(default)/documents/aroha_runtime_config/observability')).body;
const config=validateObservabilityConfig(decode({mapValue:{fields:doc.fields}})),profile=config.environments['pre-prod'];
const secrets=new Client({urlPrefix:'https://secretmanager.googleapis.com',apiVersion:'v1',auth:true});
const secret=(await secrets.get('/'+profile.tokenSecretVersion+':access')).body;
const token=Buffer.from(secret.payload.data,'base64').toString('utf8').trim();
const otel=telemetry('aroha-e2e-tests-pre-prod',report.source,'pre-prod',{namespace:'testing'});
// These are actual report-processing spans, never invented retrospective API spans.
const root=otel.beginSpan('testing.report.process',{'test.run.id':report.runId,'test.execution.kind':report.execution,'telemetry.mode':'report-processing'});
for(const e of events){const attrs={...e,'telemetry.mode':'report-processing','sdlc.status':e['test.status']};const span=otel.beginSpan('testing.report.case',attrs,root.context);otel.log(attrs,span.context);otel.metric(report.execution,e['test.status'],e['test.duration_ms']/1000);span.end();}
root.end();
const receipt=await exportDelivery(events,otel,token,null,{origin:new URL(profile.otlpEndpoint).origin});
await writeFile(receiptPath,JSON.stringify({runId:report.runId,execution:report.execution,source:report.source,configVersion:config.version,...receipt},null,2),{mode:0o600});
console.log(JSON.stringify({runId:report.runId,execution:report.execution,accepted:receipt.accepted,records:events.length,signals:receipt.signals,receipt:receiptPath}));process.exitCode=receipt.accepted?0:1;
