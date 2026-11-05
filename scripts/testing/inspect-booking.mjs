import {firebaseClient} from '../delivery/credentials.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const [runId,reference]=process.argv.slice(2);
if(!/^[a-f0-9-]{36}$/.test(runId||'')||!/^AR-[A-F0-9]{8}$/.test(reference||''))throw Error('RUN_REFERENCE_REQUIRED');
const Client=await firebaseClient(),db=new Client({urlPrefix:'https://firestore.googleapis.com',apiVersion:'v1',auth:true});
const base='/projects/aroha-retreat/databases/(default)/documents';
const decode=v=>v?.mapValue?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)])):v?.arrayValue?(v.arrayValue.values||[]).map(decode):v?.integerValue!==undefined?Number(v.integerValue):v?.doubleValue!==undefined?v.doubleValue:v?.booleanValue!==undefined?v.booleanValue:v?.nullValue!==undefined?null:v?.timestampValue||v?.stringValue;
async function query(collection,field,value){const r=await db.post(base+':runQuery',{structuredQuery:{from:[{collectionId:collection}],where:{fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:{stringValue:value}}},limit:30}});return r.body.filter(x=>x.document).map(x=>decode({mapValue:{fields:x.document.fields}}));}
const rows=await query('aroha_preprod_bookings','reference',reference);if(rows.length!==1||!rows[0].note?.startsWith('Internal E2E '+runId+' / '))throw Error('RUN_OWNERSHIP_MISMATCH');
const b=rows[0],jobs=await query('aroha_preprod_notifications','bookingId',b.id);
const inv=b.invoiceId?(await db.get(base+'/aroha_preprod_invoices/'+b.invoiceId)).body:null;
const invoice=inv?decode({mapValue:{fields:inv.fields}}):null;
const record={runId,reference,id:b.id,status:b.status,version:b.version,kind:b.kind,arrival:b.arrival,departure:b.departure,total:b.total,createdAt:b.createdAt,invoice:invoice?{id:invoice.id,number:invoice.number,status:invoice.status,total:invoice.total,balanceDue:invoice.balanceDue,test:invoice.test,documentTemplateVersion:invoice.documentTemplateVersion}:null,notifications:jobs.map(j=>({id:j.id,channel:j.channel,status:j.status,attempts:j.attempts,templateVersion:j.templateVersion,documentTemplateVersion:j.documentTemplateVersion,test:j.test,subjectPrefix:j.subjectPrefix,createdAt:j.createdAt,acceptedAt:j.acceptedAt,deliveredAt:j.deliveredAt}))};
await mkdir('local/test-evidence',{recursive:true});await writeFile('local/test-evidence/'+runId+'-booking.json',JSON.stringify(record,null,2),{mode:0o600});console.log(JSON.stringify(record));
