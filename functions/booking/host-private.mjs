import {apiVersion} from "../version.mjs";
import {createHash,randomUUID} from 'node:crypto';
import {initialState,addDays,todayIST,BookingError,occupies} from './domain.mjs';
import {productDefaults,productAvailability,bookingOnDate,reservesCapacity} from './products.mjs';
import {studioAccess} from '../access.mjs';
import {collectionName,sharedCollectionName,environment,serviceName} from '../environment.mjs';
import {bookingEvent,queueCommitted} from './observability.mjs';
import {mailSettings,validEmail} from '../email/config.mjs';
import {invoiceSnapshot,invoiceYear,invoiceCollection,queueNotifications} from '../email/jobs.mjs';
const operatorEvent=(operatorId,args)=>{const event=bookingEvent(args);if(operatorId)event['service.name']=serviceName('aroha-booking-operator');return event;};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=(code,status=422)=>{throw new BookingError(code,status)};
const col=(db,k)=>db.collection(collectionName('booking_'+k));
const bookings=db=>db.collection(collectionName('bookings'));
const configState=x=>{const s=initialState();return {...s,...x,settings:{...s.settings,...x.settings,products:{...productDefaults,...x.settings?.products}},bookings:[]}};
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
function rangesInput(input,now) {
 if(!input||Object.keys(input).some(k=>!['name','email','ranges'].includes(k))||typeof input.name!=='string'||input.name.trim().length<2||input.name.length>120||/[\x00-\x1f\x7f]/.test(input.name)||!validEmail(input.email)||!Array.isArray(input.ranges)||input.ranges.length<1||input.ranges.length>2)fail('INVALID_PRIVATE_RESERVATION');
 return input.ranges.map(r=>{
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!['arrival','lastDay','dayRate','existingId','expectedVersion'].includes(k))||!validDate(r.arrival)||!validDate(r.lastDay)||r.lastDay<r.arrival||r.arrival<todayIST(now)||r.lastDay>addDays(r.arrival,30)||r.arrival>addDays(todayIST(now),365)||!Number.isSafeInteger(r.dayRate)||r.dayRate<10000||r.dayRate>100000000||(r.existingId!==undefined&&(typeof r.existingId!=='string'||!/^[A-Za-z0-9-]{1,100}$/.test(r.existingId)||!Number.isInteger(r.expectedVersion)))||(r.expectedVersion!==undefined&&!r.existingId))fail('INVALID_PRIVATE_RESERVATION');
  return {...r,departure:addDays(r.lastDay,1),days:Math.round((Date.parse(r.lastDay)-Date.parse(r.arrival))/86400000)+1};
 });
}
async function manager(tx,db,hostId) {
 if(typeof hostId!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(hostId))fail('FORBIDDEN',403);
 const m=await tx.get(db.collection(sharedCollectionName('members')).doc(hostId));
 if(!m.exists||studioAccess(m.data()).bookings!=='manager')fail('FORBIDDEN',403);
}
export async function recordPrivateReservations(db,{hostId,operatorId,key,input,now=Date.now(),dryRun=false}) {
 const ranges=rangesInput(input,now);if(!/^[A-Za-z0-9-]{8,100}$/.test(key||''))fail('IDEMPOTENCY_KEY_REQUIRED',400);
 if(operatorId!==undefined&&!/^[a-f0-9]{64}$/.test(operatorId))fail('INVALID_OPERATOR');
 const actorId=operatorId?'operator-'+operatorId:hostId;
 const request=col(db,'requests').doc(hash([actorId,key])),fingerprint=hash({hostId,input}),owner='external-'+hash(input.email.toLowerCase()).slice(0,32);
 return db.runTransaction(async tx=>{
  await manager(tx,db,hostId);
  const configRef=col(db,'config').doc('site'),profileRef=col(db,'profiles').doc(owner);
  const [cs,rs,ps,active]=await Promise.all([tx.get(configRef),tx.get(request),tx.get(profileRef),tx.get(bookings(db).where('status','in',['pending_approval','confirmed','checked_in']).limit(201))]);
  if(rs.exists){if(rs.data().hash!==fingerprint)fail('IDEMPOTENCY_CONFLICT',409);return rs.data().result;}
  if(active.size>200)fail('RECONCILIATION_REQUIRED',409);
  if(!cs.exists)fail('CONFIG_REQUIRED',409);
  const state=configState(cs.data()||{});state.bookings=active.docs.map(d=>d.data());
  const targets=[];for(const r of ranges){const old=r.existingId?(await tx.get(bookings(db).doc(r.existingId))).data():null;if(r.existingId&&(!old||old.kind!=='event'||old.invoiceId||old.status!=='pending_approval'||old.version!==r.expectedVersion||old.arrival!==r.arrival||old.departure!==r.departure))fail('VERSION_CONFLICT',409);targets.push(old);}
  if(new Set(ranges.filter(r=>r.existingId).map(r=>r.existingId)).size!==ranges.filter(r=>r.existingId).length)fail('INVALID_PRIVATE_RESERVATION');
  const originalProfiles=new Map();for(const old of targets.filter(Boolean)){if(old.owner!==owner&&!originalProfiles.has(old.owner))originalProfiles.set(old.owner,await tx.get(col(db,'profiles').doc(old.owner)));}
  const days=[...new Set(ranges.flatMap(r=>{const a=[];for(let d=addDays(r.arrival,-1);d<=r.departure;d=addDays(d,1))a.push(d);return a}))].sort();
  const refs=days.map(d=>col(db,'days').doc(d)),ledgers=await tx.getAll(...refs);
  const result=[];
  for(let i=0;i<ranges.length;i++){
   const r=ranges[i],old=targets[i],selection={kind:'event',arrival:r.arrival,departure:r.departure,adults:1,guests:1,childrenAges:[],units:[]};
   const a=productAvailability(state,selection,now,old?.id);if(!a.available)fail('AVAILABILITY_CHANGED',409);
   const total=r.days*r.dayRate;if(!Number.isSafeInteger(total)||total>100000000)fail('INVALID_PRIVATE_RESERVATION');
   const id=old?.id||randomUUID(),b={...(old||{}),id,owner,reference:old?.reference||'AR-'+randomUUID().slice(0,8).toUpperCase(),kind:'event',source:'host_private',label:'Privately booked',recordedBy:actorId,authorisingHost:hostId,acceptanceSource:'host_instruction',note:'Host-recorded private booking; attendance and arrival arrangements to be agreed.',guestName:input.name.trim(),guestCountPending:true,guests:0,adults:0,children:0,childrenAges:[],units:[],unitNames:[],allocations:[],arrival:r.arrival,departure:r.departure,startsAt:Date.parse(r.arrival+'T'+state.settings.products.dayStart+':00+05:30'),endsAt:Date.parse(r.lastDay+'T'+state.settings.products.dayEnd+':00+05:30'),pricingVersion:1,quoteAccepted:true,dayRate:r.dayRate,days:r.days,subtotal:total,discount:0,total,lineItems:[{label:`Privately booked · exclusive retreat × ${r.days} day(s) at ₹${r.dayRate/100}/day`,amount:total}],status:'confirmed',version:(old?.version||0)+1,expiresAt:0,promo:'',cancelHours:state.settings.cancelHours,contact:{name:input.name.trim(),phone:''},createdAt:old?.createdAt||now,updatedAt:now,confirmedAt:now,history:[...(old?.history||[]),{status:'confirmed',at:now,source:'host_private'}]};
   delete b.changeRequest;delete b.invoiceId;
   state.bookings=state.bookings.filter(x=>x.id!==id);state.bookings.push(b);state.blocks=state.blocks.filter(x=>x.bookingId!==id);
   result.push(b);
  }
  if(ps.exists&&ps.data().email!==input.email.toLowerCase())fail('PRIVATE_CUSTOMER_CONFLICT',409);
  if(dryRun)return result.map(({id,reference,arrival,departure,total,days,source})=>({id,reference,arrival,departure,total,days,source,dryRun:true}));
  for(let i=0;i<result.length;i++){
   const b=result[i],old=targets[i];tx.set(bookings(db).doc(b.id),b);
   if(old)tx.create(col(db,'private_audit').doc(randomUUID()),{bookingId:b.id,actor:actorId,authorisingHost:hostId,at:now,previous:old,action:'host_private_conversion'});
   const eventId=hash([request.id,b.id,'private-recorded']);
   const safe={eventId,type:'booking.private_recorded',entity:b.id,actor:actorId,authorisingHost:hostId,at:now,environment:environment.name,apiVersion,bookingKind:'event'};
   tx.create(col(db,'audit').doc(eventId),safe);tx.create(col(db,'outbox').doc(eventId),safe);
   queueCommitted(tx,db,operatorEvent(operatorId,{id:eventId,type:'booking.private_recorded',authority:'server-confirmed',actor:actorId,entity:b.id,kind:'event',outcome:'succeeded',at:now}));
  }
  for(let i=0;i<refs.length;i++){
   const entries=Object.fromEntries(Object.entries(ledgers[i].data()?.entries||{}).filter(([id,b])=>!result.some(x=>x.id===id)&&occupies(b,now)));
   for(const b of result)if(bookingOnDate(state,b,days[i])){entries[b.id]=Object.fromEntries(['id','owner','reference','kind','source','label','guestCountPending','pricingVersion','arrival','departure','startsAt','endsAt','status','expiresAt','guests','adults','children','units','allocations'].map(k=>[k,b[k]]));}
   tx.set(refs[i],{date:days[i],entries,updatedAt:now});
  }
  for(const [uid,snap]of originalProfiles)if(snap.exists)tx.update(col(db,'profiles').doc(uid),{activeIds:(snap.data().activeIds||[]).filter(id=>!targets.some(b=>b?.id===id)),updatedAt:now});
  tx.set(profileRef,{...(ps.data()||{}),id:owner,name:input.name.trim(),email:input.email.toLowerCase(),identitySource:'host_recorded',completedStays:ps.data()?.completedStays||0,activeIds:[...new Set([...(ps.data()?.activeIds||[]),...result.map(b=>b.id)])],createdAt:ps.data()?.createdAt||now,updatedAt:now});
  tx.set(configRef,{...cs.data(),blocks:state.blocks,guardVersion:(cs.data()?.guardVersion||0)+1});
  const response=result.map(({id,reference,arrival,departure,total,days,source})=>({id,reference,arrival,departure,total,days,source}));
  tx.create(request,{owner:actorId,authorisingHost:hostId,hash:fingerprint,result:response,createdAt:now,expireAt:new Date(now+86400000)});return response;
 });
}
export async function confirmPrivateReservationByEmail(db,{hostId,operatorId,id,expectedVersion,key,now=Date.now(),config=mailSettings()}) {
 if(!/^[A-Za-z0-9-]{1,100}$/.test(id||'')||!Number.isInteger(expectedVersion)||expectedVersion<1)fail('INVALID_ID');
 if(!config.enabled)fail('MAIL_NOT_CONFIGURED',409);
 if(!/^[A-Za-z0-9-]{8,100}$/.test(key||''))fail('IDEMPOTENCY_KEY_REQUIRED',400);
 if(operatorId!==undefined&&!/^[a-f0-9]{64}$/.test(operatorId))fail('INVALID_OPERATOR');
 const actorId=operatorId?'operator-'+operatorId:hostId;
 const request=col(db,'requests').doc(hash([actorId,key]));
 return db.runTransaction(async tx=>{
  await manager(tx,db,hostId);
  const ref=bookings(db).doc(id),counter= db.collection(collectionName('invoice_counters')).doc(String(invoiceYear(now)));
  const [bs,rs,cs]=await Promise.all([tx.get(ref),tx.get(request),tx.get(counter)]),b=bs.data();
  const fingerprint=hash([hostId,id,expectedVersion,'private-confirmation']);
  if(rs.exists){if(rs.data().hash!==fingerprint)fail('IDEMPOTENCY_CONFLICT',409);return rs.data().result;}
  if(!b||b.source!=='host_private'||b.status!=='confirmed'||b.version!==expectedVersion||b.invoiceId)fail('VERSION_CONFLICT',409);
  const profile=(await tx.get(col(db,'profiles').doc(b.owner))).data();if(!validEmail(profile?.email))fail('INVALID_PRIVATE_CUSTOMER');
  const invoice=invoiceSnapshot(b,profile,(cs.data()?.sequence||0)+1,config,now),eventId=hash([id,'private-confirmation']);
  const jobIds=queueNotifications(tx,db,{event:{type:'booking.confirmed',eventId,actor:actorId},booking:b,profile,config,invoice,now});
  tx.create(invoiceCollection(db).doc(invoice.id),invoice);tx.set(counter,{sequence:(cs.data()?.sequence||0)+1,updatedAt:now});tx.update(ref,{invoiceId:invoice.id,version:b.version+1,updatedAt:now});
  const result={id,invoiceId:invoice.id,jobIds};tx.create(request,{owner:actorId,authorisingHost:hostId,hash:fingerprint,result,createdAt:now,expireAt:new Date(now+86400000)});
  queueCommitted(tx,db,operatorEvent(operatorId,{id:eventId,type:'booking.private_confirmation_queued',authority:'server-confirmed',actor:actorId,entity:id,kind:'event',invoiceId:invoice.id,outcome:'succeeded',at:now}));return result;
 });
}
