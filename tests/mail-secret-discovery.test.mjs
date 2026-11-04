import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
function discover(environment,enabled){
  const r=spawnSync(process.execPath,['--input-type=module','-e',"import './index.mjs';import{declaredParams}from'firebase-functions/params';console.log(JSON.stringify(declaredParams.map(p=>p.name)))"],{cwd:new URL('../functions/',import.meta.url),encoding:'utf8',env:{...process.env,GCLOUD_PROJECT:'demo-aroha',FIREBASE_CONFIG:JSON.stringify({projectId:'demo-aroha',storageBucket:'demo-aroha.appspot.com'}),AROHA_ENVIRONMENT:environment,MAIL_ENABLED:enabled?'true':'false',DT_EXPORT_ENABLED:'false'}});
  assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout.trim().split('\n').at(-1));
}
test('actual Firebase discovery requires no Resend secrets when production mail is disabled',()=>{
  assert.deepEqual(discover('production',false).filter(n=>n.startsWith('RESEND_')),[]);
});
test('enabled mail declares only its own environment sending/webhook secrets',()=>{
  assert.deepEqual(discover('pre-prod',true).filter(n=>n.startsWith('RESEND_')).sort(),['RESEND_API_KEY_PREPROD','RESEND_WEBHOOK_SECRET_PREPROD']);
  assert.deepEqual(discover('production',true).filter(n=>n.startsWith('RESEND_')).sort(),['RESEND_API_KEY','RESEND_WEBHOOK_SECRET']);
});
