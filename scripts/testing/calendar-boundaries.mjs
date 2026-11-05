import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
const origin='https://aroha-retreat-preprod.web.app',runId=randomUUID(),execution='live-api-read';
const release=await fetch(origin+'/website-release.json',{signal:AbortSignal.timeout(20000)}).then(r=>r.json());
if(release.environment!=='pre-prod'||release.emulators!==false)throw Error('PREPROD_REQUIRED');
const date=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
const report={schemaVersion:1,runId,source:release.revision,environment:'pre-prod',execution,cases:[],requestIds:[],startedAt:new Date().toISOString(),cleanup:{status:'not-needed'}};
async function calendar(body){const r=await fetch(origin+'/api/v1/booking/calendar',{method:'POST',headers:{'Content-Type':'application/json','X-Aroha-Journey':runId},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(r.headers.get('X-Request-Id'))report.requestIds.push(r.headers.get('X-Request-Id'));if(!r.ok)throw Error('CALENDAR_FAILED');return r.json();}
const check=async(label,fn)=>{const c={id:'case-'+createHash('sha256').update(label).digest('hex'),status:'passed',execution,startedAt:new Date().toISOString()};try{await fn();}catch{c.status='failed';}c.finishedAt=new Date().toISOString();report.cases.push(c);console.log(label+': '+c.status);};
const assert=v=>{if(!v)throw Error('ASSERTION_FAILED');};
// Find dates that public inventory actually reports free; never mutate a ledger.
let start;for(let n=100;n<240;n+=14){const days=await calendar({start:date(n),days:14,kind:'event',adults:1,childrenAges:[]});if(days.days.every(d=>d.available)){start=date(n);break;}}
if(!start)throw Error('NO_EMPTY_WINDOW');
for(const [label,kind,adults,childrenAges,available]of [
 ['day-35-adults-plus-children','day',35,[4,8],true],['day-36-adults-denied','day',36,[],false],
 ['stay-10-adults-available','stay',10,[],true],['stay-11-adults-denied','stay',11,[],false],
 ['family-two-adults-two-kids-available','stay',2,[4,8],true],['exclusive-35-plus-children','event',35,[4,8],true],
])await check(label,async()=>{const r=await calendar({start,days:1,kind,adults,childrenAges});assert(r.days[0].available===available);});
// Optional date must come from an independently observed host exclusive/closure.
// Event unavailability alone cannot imply that day visits are also blocked.
const closed=process.argv[2];
if(closed){if(!/^\d{4}-\d{2}-\d{2}$/.test(closed))throw Error('INVALID_EXCLUSIVE_DATE');await check('existing-exclusive-or-closure-calendar-denial',async()=>{for(const kind of ['day','stay','event']){const r=await calendar({start:closed,days:1,kind,adults:1,childrenAges:[]});assert(r.days[0].available===false);}});}
report.finishedAt=new Date().toISOString();await mkdir('local/test-evidence',{recursive:true});const path='local/test-evidence/'+runId+'-calendar-boundaries.json';await writeFile(path,JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({runId,source:report.source,cases:report.cases.length,path}));process.exitCode=report.cases.some(c=>c.status==='failed')?1:0;
