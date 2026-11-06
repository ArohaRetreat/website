// CAS-protected derived fields only. This release is authorised for preprod only.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {firebaseClient} from './delivery/credentials.mjs';
import {deskFields} from '../functions/booking/desk.mjs';
if(!process.argv.includes('--environment')||process.argv[process.argv.indexOf('--environment')+1]!=='pre-prod')throw Error('PREPROD_ONLY');
const apply=process.argv.includes('--apply');
const Client=await firebaseClient(),client=new Client({urlPrefix:'https://firestore.googleapis.com',apiVersion:'v1',auth:true});
const decode=v=>v?.stringValue??(v?.integerValue!==undefined?Number(v.integerValue):v?.booleanValue!==undefined?v.booleanValue:v?.nullValue!==undefined?null:v?.mapValue?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)])):undefined);
const canonical=v=>JSON.stringify(Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))));
let pageToken,visited=0,changed=0;const receipts=[];
do {
 const page=(await client.get('/projects/aroha-retreat/databases/(default)/documents/aroha_preprod_bookings',{queryParams:{pageSize:100,...(pageToken?{pageToken}:{})}})).body;
 for(const d of page.documents||[]){visited++;const source=d.fields||{},b=Object.fromEntries(Object.entries(source).map(([k,v])=>[k,decode(v)])),derived=deskFields(b),fields=Object.fromEntries(Object.entries(derived).map(([k,v])=>[k,typeof v==='string'?{stringValue:v}:{integerValue:String(v)}]));if(Object.entries(derived).every(([k,v])=>b[k]===v))continue;changed++;
 if(apply){await client.post('/projects/aroha-retreat/databases/(default)/documents:commit',{writes:[{update:{name:d.name,fields},updateMask:{fieldPaths:Object.keys(fields)},currentDocument:{updateTime:d.updateTime}}]});const after=(await client.get('/'+d.name)).body.fields||{};if(Object.entries(derived).some(([k,v])=>decode(after[k])!==v))throw Error('DERIVED_FIELD_VERIFICATION_FAILED');const rest=o=>Object.fromEntries(Object.entries(o).filter(([k])=>!Object.hasOwn(derived,k)));if(canonical(rest(source))!==canonical(rest(after)))throw Error('CONCURRENT_CHANGE_REVIEW_REQUIRED');}
 receipts.push({recordHash:createHash('sha256').update(d.name).digest('hex'),sourceUpdateTime:d.updateTime,fields:Object.keys(fields)});
 }
 pageToken=page.nextPageToken;if(visited>=20000&&pageToken)throw Error('BACKFILL_BATCH_LIMIT');
}while(pageToken);
await mkdir('local',{recursive:true,mode:0o700});await writeFile(`local/booking-desk-${apply?'apply':'dry-run'}.json`,JSON.stringify({environment:'pre-prod',apply,visited,changed,receipts},null,2),{mode:0o600});console.log(JSON.stringify({environment:'pre-prod',apply,visited,changed}));
