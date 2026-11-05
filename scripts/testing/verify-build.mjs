import {readFile,access,readdir} from 'node:fs/promises';
const preprod=process.argv[2]==='pre-prod',root=preprod?'dist-preprod':'dist';
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
for(const path of ['admin/testing/index.html','assets/booking-e2e.js'])if(await exists(root+'/'+path)!==preprod)throw Error('TEST_CONSOLE_BUILD_SCOPE');
if(!preprod){
  for(const dir of ['assets','assets/chunks'])for(const f of await readdir(root+'/'+dir))if(f.endsWith('.js')){const s=await readFile(root+'/'+dir+'/'+f,'utf8');if(/aroha-e2e-recovery-v1|Internal E2E |TEST_ACCOUNT_ACTIVE_LIMIT_HEADROOM/.test(s))throw Error('TEST_RUNNER_LEAKED_TO_PRODUCTION');}
}
console.log('Verified '+(preprod?'preprod test console presence':'production test console exclusion')+'.');
