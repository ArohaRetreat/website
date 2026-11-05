// Privileged operator only; never bundled into the browser or exposed as an HTTP route.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {firebaseClient} from './delivery/credentials.mjs';
async function main(){
 const args=process.argv.slice(2),mode=args.includes('--notify')?'notify':'reserve',apply=args.includes('--apply');
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
 if(mode==='notify'&&Object.keys(input).some(k=>!['id','expectedVersion'].includes(k)))throw Error('INVALID_NOTIFICATION_INPUT');
 const cfg=JSON.parse(await readFile(process.env.AROHA_PRODUCTION_CONFIG_FILE,'utf8'));
 if(apply){const release=await(await fetch('https://aroharetreat.com/website-release.json',{cache:'no-store'})).json();if(release.environment!=='production'||release.revision!==source||release.emulators)throw Error('VERIFY_MATCHING_PRODUCTION_RELEASE_FIRST');}
 await firebaseClient();
 const cliRequire=createRequire(process.env.FIREBASE_CLI_PATH),lib=dirname(dirname(process.env.FIREBASE_CLI_PATH)),auth=cliRequire(lib+'/auth.js');
 const account=auth.getProjectDefaultAccount(process.cwd())||auth.getGlobalDefaultAccount();
 const owners=(cfg.SUPER_ADMIN_EMAILS||'').toLowerCase().split(',').map(s=>s.trim());
 if(!account||!owners.includes(String(account.user?.email||'').toLowerCase()))throw Error('CONFIGURED_OWNER_CREDENTIAL_REQUIRED');
 const require=createRequire(new URL('../functions/package.json',import.meta.url)),{initializeApp}=require('firebase-admin/app'),{getFirestore}=require('firebase-admin/firestore');
 const app=initializeApp({projectId:'aroha-retreat',credential:{async getAccessToken(){const t=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);return {access_token:t.access_token,expires_in:Math.max(60,Math.floor(((t.expires_at||Date.now()+3600000)-Date.now())/1000))}}}},'private-reservation-operator');
 const db=getFirestore(app);
 try{
  const members=await db.collection('aroha_members').where('email','==',account.user.email.toLowerCase()).limit(2).get();if(members.size!==1)throw Error('OWNER_MEMBERSHIP_REQUIRED');const hostId=members.docs[0].id;
  const {recordPrivateReservations,confirmPrivateReservationByEmail}=await import('../functions/booking/host-private.mjs');
  const {mailSettings}=await import('../functions/email/config.mjs');
  const result=mode==='notify'?(apply?await confirmPrivateReservationByEmail(db,{hostId,key,id:input.id,expectedVersion:input.expectedVersion,config:mailSettings({...cfg,MAIL_RECIPIENT_MODE:'booking'})}):{notificationNotSent:true}):await recordPrivateReservations(db,{hostId,key,input,dryRun:!apply});
  if(receipt)await writeFile(receipt,JSON.stringify({source,environment:'production',mode,applied:apply,at:new Date().toISOString(),result},null,2),{mode:0o600});
  console.log(JSON.stringify({mode,applied:apply,result}));
 }finally{await db.terminate()}
}
main().catch(e=>{console.error(/^[A-Z_]+$/.test(e.code||e.message||'')?(e.code||e.message):'PRIVATE_RESERVATION_COMMAND_FAILED');process.exitCode=1});
