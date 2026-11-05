// Privileged operator only; never bundled into the browser or exposed as an HTTP route.
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {firebaseClient} from './delivery/credentials.mjs';
async function main(){
 const args=process.argv.slice(2),mode=args.includes('--correct-documents')?'correct-documents':args.includes('--notify')?'notify':'reserve',apply=args.includes('--apply');
 if(!args.includes('--production')||process.env.FIRESTORE_EMULATOR_HOST||process.env.FUNCTIONS_EMULATOR||process.env.AROHA_ENVIRONMENT==='pre-prod')throw Error('EXPLICIT_PRODUCTION_REQUIRED');
 const value=flag=>{const i=args.indexOf(flag);return i<0?undefined:args[i+1]};
 const path=value('--input'),key=value('--key'),receipt=value('--receipt');
 if(!path||!key||!process.env.AROHA_PRODUCTION_CONFIG_FILE)throw Error('PRIVATE_INPUT_CONFIGURATION_REQUIRED');
 if(apply&&(!receipt||!resolve(receipt).startsWith(resolve('local')+'/')))throw Error('PRIVATE_RECEIPT_REQUIRED');
 const git=(...a)=>{const r=spawnSync('git',a,{encoding:'utf8'});if(r.status)throw Error('GIT_GUARD_FAILED');return r.stdout.trim()};
 const source=git('rev-parse','HEAD');
 if(apply&&(git('status','--porcelain')||source!==git('rev-parse','origin/main')))throw Error('CLEAN_CURRENT_MAIN_REQUIRED');
 if(spawnSync('git',['ls-files','--error-unmatch',resolve(path)],{stdio:'ignore'}).status===0)throw Error('PRIVATE_INPUT_MUST_NOT_BE_TRACKED');
 const input=JSON.parse(await readFile(path,'utf8'));
 if(mode!=='reserve'&&Object.keys(input).some(k=>!['id','expectedVersion'].includes(k)))throw Error('INVALID_NOTIFICATION_INPUT');
 const cfg=JSON.parse(await readFile(process.env.AROHA_PRODUCTION_CONFIG_FILE,'utf8'));
 if(apply){const release=await(await fetch('https://aroharetreat.com/website-release.json',{cache:'no-store'})).json();if(release.environment!=='production'||release.revision!==source||release.emulators)throw Error('VERIFY_MATCHING_PRODUCTION_RELEASE_FIRST');}
 await firebaseClient();
 const cliRequire=createRequire(process.env.FIREBASE_CLI_PATH),lib=dirname(dirname(process.env.FIREBASE_CLI_PATH)),auth=cliRequire(lib+'/auth.js');
 const account=auth.getProjectDefaultAccount(process.cwd())||auth.getGlobalDefaultAccount();
 const owners=(cfg.SUPER_ADMIN_EMAILS||'').toLowerCase().split(',').map(s=>s.trim());
 if(!account?.user?.email||!owners.length)throw Error('AUTHENTICATED_PROJECT_CREDENTIAL_REQUIRED');
 const operatorId=createHash('sha256').update(account.user.email.toLowerCase()).digest('hex');
 const require=createRequire(new URL('../functions/package.json',import.meta.url)),{initializeApp,applicationDefault}=require('firebase-admin/app'),{getFirestore}=require('firebase-admin/firestore');
 const api=cliRequire(lib+'/api.js'),credentialFile=resolve('local/operator-credentials-'+randomUUID()+'.tmp'),previousCredentials=process.env.GOOGLE_APPLICATION_CREDENTIALS;
 await writeFile(credentialFile,JSON.stringify({type:'authorized_user',client_id:api.clientId(),client_secret:api.clientSecret(),refresh_token:account.tokens.refresh_token,quota_project_id:'aroha-retreat'}),{mode:0o600,flag:'wx'});
 process.env.GOOGLE_APPLICATION_CREDENTIALS=credentialFile;
 let db;
 try{
  const app=initializeApp({projectId:'aroha-retreat',credential:applicationDefault()},'private-reservation-operator');db=getFirestore(app);
  const members=await db.collection('aroha_members').where('email','in',owners.slice(0,30)).limit(31).get();const hosts=members.docs.filter(d=>d.data().active===true&&d.data().role==='superadmin');if(hosts.length!==1)throw Error('UNAMBIGUOUS_AUTHORISING_HOST_REQUIRED');const hostId=hosts[0].id;
  const {recordPrivateReservations,confirmPrivateReservationByEmail}=await import('../functions/booking/host-private.mjs');
  const {mailSettings}=await import('../functions/email/config.mjs');
  const {queueApprovedDocumentCorrection}=await import('../functions/email/document-corrections.mjs');
  const result=mode==='correct-documents'?(apply?await queueApprovedDocumentCorrection(db,{hostId,operatorId,key,id:input.id,expectedVersion:input.expectedVersion,config:mailSettings({...cfg,MAIL_RECIPIENT_MODE:'booking'})}):{correctionNotSent:true}):mode==='notify'?(apply?await confirmPrivateReservationByEmail(db,{hostId,operatorId,key,id:input.id,expectedVersion:input.expectedVersion,config:mailSettings({...cfg,MAIL_RECIPIENT_MODE:'booking'})}):{notificationNotSent:true}):await recordPrivateReservations(db,{hostId,operatorId,key,input,dryRun:!apply});
  if(receipt)await writeFile(receipt,JSON.stringify({source,environment:'production',mode,applied:apply,at:new Date().toISOString(),result},null,2),{mode:0o600});
  console.log(JSON.stringify({mode,applied:apply,result}));
 }finally{if(db)await db.terminate();await unlink(credentialFile);if(previousCredentials===undefined)delete process.env.GOOGLE_APPLICATION_CREDENTIALS;else process.env.GOOGLE_APPLICATION_CREDENTIALS=previousCredentials;}
}
main().catch(e=>{console.error(Number.isInteger(e.code)?'OPERATOR_DEPENDENCY_ERROR_'+e.code:/^[A-Z_]+$/.test(e.code||e.message||'')?(e.code||e.message):'PRIVATE_RESERVATION_COMMAND_FAILED');process.exitCode=1});
