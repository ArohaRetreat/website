import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const [path,execution='application-unit',source='local-validation']=process.argv.slice(2);
if(!path||!['application-unit','emulator'].includes(execution))throw Error('NATIVE_REPORT_ARGUMENTS');
const rows=(await readFile(path,'utf8')).trim().split('\n').map(s=>JSON.parse(s)).filter(r=>r.kind==='test');
if(!rows.length)throw Error('NO_NATIVE_CASES');
const cases=rows.map(r=>{if(r.schema!==1||!/^[a-f0-9]{64}$/.test(r.id)||!['passed','failed','skipped'].includes(r.status)||!Number.isFinite(Date.parse(r.completedAt))||!Number.isFinite(r.durationMs)||r.durationMs<0)throw Error('INVALID_NATIVE_CASE');return{id:'case-'+r.id,status:r.status,execution,startedAt:new Date(Date.parse(r.completedAt)-r.durationMs).toISOString(),finishedAt:r.completedAt};});
const runId=randomUUID(),report={schemaVersion:1,runId,source,environment:'pre-prod',execution,startedAt:cases[0].startedAt,finishedAt:cases.at(-1).finishedAt,cases,cleanup:{status:'not-needed'}};
await mkdir('local/test-evidence',{recursive:true});const output='local/test-evidence/'+runId+'-'+execution+'.json';await writeFile(output,JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({runId,execution,records:cases.length,path:output}));
