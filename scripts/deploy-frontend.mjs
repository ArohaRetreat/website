import {readFile,writeFile,mkdir} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {compatibleBookingApi,deliveryTarget,assertArtifact,repository} from "./delivery/environment-policy.mjs";
import {verifyHostingComposition} from "./hosting-composition.mjs";
import {verifyDesignPreserved} from "./delivery/preserve-design.mjs";
import {hostingRelease,deliveryToken} from "./delivery/credentials.mjs";
import {reportDeployment} from "./delivery/deployment.mjs";
import {verifyLive} from "./delivery/verify-live.mjs";
const target=deliveryTarget(process.env.GITHUB_REF);
if(process.env.GITHUB_REPOSITORY!==repository || !["push","workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME))throw Error("TRUSTED_BRANCH_EVENT_REQUIRED");
const root=process.cwd()+"/",cli=process.env.FIREBASE_CLI_PATH;
if(!cli)throw Error("FIREBASE_CLI_REQUIRED");
const git=(...args)=>{const r=spawnSync("git",args,{encoding:"utf8"});if(r.status)throw Error("GIT_CHECK_FAILED");return r.stdout.trim();};
if(git("status","--porcelain") || git("rev-parse","HEAD")!==process.env.GITHUB_SHA)throw Error("CLEAN_EXACT_SOURCE_REQUIRED");
const configFile=target.branch==="main"?"firebase.json":"firebase.preprod.json";
const config=JSON.parse(await readFile(configFile));
const website=JSON.parse(await readFile(target.directory+"/website-release.json"));
assertArtifact(target,website,process.env.GITHUB_SHA,config);
if(target.branch==="main"){await verifyHostingComposition(root,website.revision);await verifyDesignPreserved(root);}
const request=async path=>{const r=await fetch(target.origin+path,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error("API_COMPATIBILITY_CHECK_FAILED");return r.json();};
const runtime=await request("/api/v1/runtime-config"),booking=await request("/api/v1/booking/public");
if(runtime.environment!==target.environment || booking.environment!==target.environment || !compatibleBookingApi(website.version,booking.apiVersion) || !Number.isSafeInteger(runtime.configVersion))throw Error("UPGRADE_MATCHING_BACKEND_BEFORE_FRONTEND");
const otherSite=target.branch==="main"?"aroha-retreat-preprod":"aroha-retreat";
const otherBefore=await hostingRelease(otherSite),token=await deliveryToken();
const record={schemaVersion:1,id:randomUUID(),website,before:await hostingRelease(target.site),startedAt:new Date().toISOString(),status:"pending",verification:{status:"not-run"}};
await mkdir("local/delivery-outbox",{recursive:true});
const path="local/delivery-outbox/frontend-"+record.id+".json";
const save=()=>writeFile(path,JSON.stringify(record,null,2));await save();
const r=spawnSync(process.execPath,[cli,"deploy","--config",configFile,"--only","hosting:"+target.site,"--project","aroha-retreat","--non-interactive"],{stdio:"inherit"});
record.cliExitCode=r.status??1;record.finishedAt=new Date().toISOString();record.after=await hostingRelease(target.site);
record.otherEnvironmentPreserved=JSON.stringify(otherBefore)===JSON.stringify(await hostingRelease(otherSite));
record.status=r.status===0 && record.after.version!==record.before.version && Date.parse(record.after.releaseTime)>=Date.parse(record.startedAt)-1000?"deployed":"failed-or-partial";await save();
if(record.status==="deployed"){
  record.verificationStartedAt=new Date().toISOString();
  for(let attempt=0;attempt<5;attempt++){
    try{record.verification=await verifyLive(root,website,{origin:target.origin,directory:target.directory,includeDesign:target.branch==="main"});break;}
    catch{record.verification={status:"failed",reason:"LIVE_VERIFICATION_FAILED"};if(attempt<4)await new Promise(r=>setTimeout(r,2000));}
  }
  record.verificationFinishedAt=new Date().toISOString();
}
await save();
try{record.telemetry=await reportDeployment(record,token);}catch{record.telemetry={accepted:false,reason:"EXPORT_FAILED"};}
await save();console.log(JSON.stringify({status:record.status,verification:record.verification.status,telemetry:record.telemetry,receipt:path}));
process.exitCode=record.status==="deployed"&&record.verification.status==="verified"&&record.otherEnvironmentPreserved&&record.telemetry.accepted?0:1;
