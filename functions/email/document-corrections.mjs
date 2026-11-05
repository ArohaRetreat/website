// Privileged, audited design-only correction. Financial snapshots and original PDFs stay immutable.
import {createHash} from 'node:crypto';
import {collectionName,sharedCollectionName,serviceName} from '../environment.mjs';
import {studioAccess} from '../access.mjs';
import {BookingError} from '../booking/domain.mjs';
import {queueNotifications,invoiceCollection,mailCollection} from './jobs.mjs';
import {bookingEvent,queueCommitted} from '../booking/observability.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail=(c,s=409)=>{throw new BookingError(c,s);};
export async function queueApprovedDocumentCorrection(db,{hostId,operatorId,id,expectedVersion,key,config,now=Date.now()}){
 if(!config?.enabled||!config.issuer?.address)fail('MAIL_NOT_CONFIGURED');
 if(!/^[a-f0-9]{64}$/.test(operatorId||'')||!/^[A-Za-z0-9-]{1,100}$/.test(id||'')||!/^[A-Za-z0-9-]{8,100}$/.test(key||'')||!Number.isInteger(expectedVersion))fail('INVALID_DOCUMENT_CORRECTION',422);
 const actor='operator-'+operatorId,request=db.collection(collectionName('booking_requests')).doc(hash([actor,key])),fingerprint=hash([hostId,id,expectedVersion,'pdf-v4']);
 return db.runTransaction(async tx=>{
  const member=await tx.get(db.collection(sharedCollectionName('members')).doc(hostId));
  if(!member.exists||studioAccess(member.data()).bookings!=='manager')fail('FORBIDDEN',403);
  const ref=db.collection(collectionName('bookings')).doc(id),[bs,rs]=await Promise.all([tx.get(ref),tx.get(request)]);
  if(rs.exists){if(rs.data().hash!==fingerprint)fail('IDEMPOTENCY_CONFLICT');return rs.data().result;}
  const b=bs.data();if(!b||b.version!==expectedVersion||!['confirmed','checked_in'].includes(b.status)||!b.invoiceId)fail('VERSION_CONFLICT');
  const [invoiceDoc,profileDoc,jobs]=await Promise.all([tx.get(invoiceCollection(db).doc(b.invoiceId)),tx.get(db.collection(collectionName('booking_profiles')).doc(b.owner)),tx.get(mailCollection(db).where('bookingId','==',id).limit(51))]);
  const invoice=invoiceDoc.data(),profile=profileDoc.data();
  if(!invoice||invoice.owner!==b.owner||invoice.environment!==config.environment||invoice.test!==config.test||['void','superseded'].includes(invoice.status)||invoice.documentTemplateVersion==='pdf-v4'||invoice.documentDesignVersion==='pdf-v4'||jobs.size>50)fail('DOCUMENT_CORRECTION_NOT_APPLICABLE');
  if(!jobs.docs.some(d=>d.data().channel==='guest_confirmation'&&d.data().invoiceId===invoice.id&&['accepted','delivered'].includes(d.data().status)))fail('PRIOR_CONFIRMATION_REQUIRED');
  if(jobs.docs.some(d=>d.data().documentTemplateVersion==='pdf-v4'))fail('DOCUMENT_CORRECTION_ALREADY_QUEUED');
  const eventId=hash([id,invoice.id,'approved-document-v4-correction']);
  const jobIds=queueNotifications(tx,db,{event:{type:'booking.confirmed',eventId,actor},booking:b,profile,invoice:{...invoice,documentTemplateVersion:'pdf-v4'},documentCorrection:true,config,now});
  tx.update(ref,{documentCorrectionJobId:jobIds[0],version:b.version+1,updatedAt:now});
  const result={id,invoiceId:invoice.id,invoiceNumber:invoice.number,financialSnapshotHash:invoice.snapshotHash,jobIds};
  tx.create(request,{owner:actor,authorisingHost:hostId,hash:fingerprint,result,createdAt:now,expireAt:new Date(now+86400000)});
  const audit=db.collection(collectionName('booking_private_audit')).doc();tx.create(audit,{operation:'invoice.design_corrected',actor,authorisingHost:hostId,bookingId:id,invoiceId:invoice.id,invoiceSnapshotHash:invoice.snapshotHash,previousObject:invoice.object||null,template:'pdf-v4',at:now});
  const event=bookingEvent({id:eventId,type:'invoice.design_correction_queued',authority:'server-confirmed',actor,entity:id,invoiceId:invoice.id,outcome:'succeeded',at:now});event['service.name']=serviceName('aroha-booking-operator');queueCommitted(tx,db,event);
  return result;
 });
}
