import {auth, login} from '../firebase-auth.mjs';
import {runBookingScenarios, SCENARIOS} from './booking-scenarios.mjs';

// This entry is emitted only in the pre-production build. All permissions remain
// enforced by the existing server; this page cannot grant a test identity access.
if (__AROHA_ENVIRONMENT__ !== 'pre-prod' || location.origin !== 'https://aroha-retreat-preprod.web.app') throw Error('PREPROD_ONLY');
const $=s=>document.querySelector(s), key='aroha-e2e-recovery-v1';
let busy=false, stopped=false, lastCall=0, report;
const status=s=>{$('#status').textContent=s;};
const download=(value,name)=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
async function call(runId,op,body,{admin=false,anonymous=false,start,key:requestKey}={}) {
  // A single session also shares the durable API rate limiter with Host Studio.
  await new Promise(r=>setTimeout(r,Math.max(0,lastCall+1500-Date.now())));lastCall=Date.now();
  const query=new URLSearchParams();if(admin)query.set('admin','1');if(start)query.set('start',start);
  const token=anonymous?null:await auth.currentUser?.getIdToken();
  if(!anonymous&&!token)throw Object.assign(Error('GOOGLE_SESSION_REQUIRED'),{code:'GOOGLE_SESSION_REQUIRED'});
  const response=await fetch('/api/v1/booking/'+op+(query.size?'?'+query:''),{
    method:body===undefined?'GET':'POST',cache:'no-store',signal:AbortSignal.timeout(30000),
    headers:{'X-Aroha-Journey':runId,...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json','Idempotency-Key':requestKey||crypto.randomUUID()})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  const result=await response.json();return{status:response.status,body:result,code:result.error?.code,requestId:response.headers.get('X-Request-Id')};
}
async function identity(){await auth.authStateReady();$('#run').disabled=!auth.currentUser||busy;status(auth.currentUser?'Signed in. The server will verify host-manager access before creating fixtures.':'Sign in with an existing authorized Google host account.');}
$('#signin').onclick=async()=>{try{await login();await identity();}catch(e){status('Sign-in did not complete. '+(e.code||'AUTH_FAILED'));}};
$('#stop').onclick=()=>{stopped=true;status('Stopping after the current request. Run-owned reservations will still be retired.');};
$('#download').onclick=()=>{if(report)download(report,'aroha-e2e-'+report.runId+'.json');};
$('#recover').onclick=async()=>{
  if(busy)return;busy=true;
  try{
    await auth.authStateReady();const m=JSON.parse(localStorage.getItem(key)||'null');if(!m)throw Error('NO_RECOVERY_MANIFEST');
    if(!/^[a-f0-9-]{36}$/.test(m.runId)||!/^([a-f0-9]{40}|local-validation)$/.test(m.source))throw Error('REVIEW_MANIFEST_SOURCE');
    const req=(op,b,opt)=>call(m.runId,op,b,opt),s=await req('state');if(s.status!==200)throw Error('GOOGLE_SESSION_REQUIRED');
    for(const id of m.createdIds){const r=await req('reservation-detail',{id},{admin:true}),b=r.body;
      if(r.status!==200||b.owner!==s.body.actor.id||!b.note?.startsWith('Internal E2E '+m.runId+' / '))throw Error('FIXTURE_OWNERSHIP_MISMATCH');
      if(['pending_approval','confirmed'].includes(b.status)){const a=await req('booking-action',{id,expectedVersion:b.version,action:'cancel'},{admin:true});if(a.status!==200)throw Error('CLEANUP_FAILED');}
    }
    if(m.promos?.length){const r=await req('state',undefined,{admin:true});if(r.status!==200)throw Error('MANAGER_REQUIRED');
      for(const code of m.promos){if(code!=='E2E'+m.runId.replaceAll('-','').slice(0,12).toUpperCase())throw Error('PROMO_OWNERSHIP_MISMATCH');const p=r.body.promos.find(x=>x.code===code);if(p?.active){const a=await req('promo',{code,active:false,expectedVersion:p.version},{admin:true});if(a.status!==200)throw Error('PROMO_CLEANUP_FAILED');}}
    }
    localStorage.removeItem(key);status('Recovery complete: run-owned pending/confirmed reservations cancelled and test promos disabled.');
  }catch(e){status('Recovery requires review: '+e.message);}finally{busy=false;}
};
$('#run').onclick=async()=>{
  if(busy)return;if(localStorage.getItem(key)){status('Recover the unfinished run before creating more fixtures.');return;}
  busy=true;stopped=false;$('#run').disabled=true;$('#results').replaceChildren();
  const runId=crypto.randomUUID(),source=$('#source').textContent;
  try{report=await runBookingScenarios({runId,source,call:(...a)=>call(runId,...a),stop:()=>stopped,
    onCheckpoint:m=>localStorage.setItem(key,JSON.stringify(m)),
    onProgress:id=>status('Running '+id+' · '+runId),
    onCase:c=>{const li=document.createElement('li');li.textContent=c.status.toUpperCase()+' — '+(SCENARIOS.find(s=>s[0]===c.id)?.[1]||c.id)+(c.code?' ('+c.code+')':'');li.dataset.status=c.status;$('#results').append(li);}
  });if(report.cleanup.status==='passed')localStorage.removeItem(key);$('#download').disabled=false;
  download(report,'aroha-e2e-'+report.runId+'.json');
  status('Run finished. '+report.cases.filter(c=>c.status==='passed').length+' passed; '+report.cases.filter(c=>c.status==='failed').length+' failed; '+report.cases.filter(c=>c.status==='blocked').length+' blocked. Cleanup: '+report.cleanup.status+'. Download the sanitized report for telemetry export.');
  }catch{status('Run interrupted. Recover run-owned fixtures before running again.');}finally{busy=false;$('#run').disabled=false;}
};
await identity();
