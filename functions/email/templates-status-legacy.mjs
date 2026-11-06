import {environment} from '../environment.mjs';
import {visitWindow} from './visit-window.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Cancellation branches from the journey; it does not imply checkout or a refund.
export function statusEmailTemplate(job){
 const b=job.snapshot, cancelled=job.channel==='guest_cancelled';
 if(!cancelled&&job.channel!=='guest_declined')throw Error('INVALID_STATUS_CHANNEL');
 const heading=cancelled?'Your booking has been cancelled.':'Your booking request was declined.';
 const note='This notice does not record a payment or refund. If you have already paid, contact your hosts to arrange the next steps.';
 const url=environment.origin+'/book/#visits';
 const test=job.test?'PRE-PRODUCTION TEST · No real reservation or payment.\n\n':'';
 const text=test+'Dear '+b.guestName+',\n\n'+heading+'\nBooking '+b.reference+' · '+visitWindow(b)+'\n\n'+note+'\n\nYour visits: '+url+'\n\nWith warmth,\nYour hosts at Aroha';
 return{subject:(job.subjectPrefix||'')+(cancelled?'Booking cancelled':'Booking request declined')+' · '+b.reference,text,html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#e7e3d9;color:#263e2d;font-family:Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:640px;background:#fffcf5"><tr><td style="padding:32px"><p style="letter-spacing:3px">AROHA RETREAT</p>${test?'<p>'+esc(test)+'</p>':''}<h1 style="font-family:Georgia,serif;font-weight:400">${heading}</h1><p>Dear ${esc(b.guestName)},</p><p>Booking <strong>${esc(b.reference)}</strong></p><p>${esc(visitWindow(b))}</p><p style="line-height:1.7">${note}</p><p><a href="${url}" style="color:#163e2d">Your visits →</a></p><p>With warmth,<br>Your hosts at Aroha</p></td></tr></table></td></tr></table></body></html>`,attachments:[]};
}
