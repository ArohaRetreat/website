import {mailSettings} from "../functions/email/config.mjs";
import {environmentProfile} from "../functions/environment-profile.mjs";
// Explicit backend release; never invoked by branch frontend automation.
import {readFile,writeFile,mkdir,cp,rm,lstat} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {spawnSync} from "node:child_process";
if(!process.argv.includes("--production") || !process.env.AROHA_PRODUCTION_CONFIG_FILE)throw Error("EXPLICIT_PRODUCTION_CONFIG_REQUIRED");
const input=JSON.parse(await readFile(process.env.AROHA_PRODUCTION_CONFIG_FILE));
if(!input.SUPER_ADMIN_EMAILS || input.DT_EXPORT_ENABLED!=="true" || input.AROHA_ENVIRONMENT==="pre-prod")throw Error("PRODUCTION_OWNER_REQUIRED");
const allowed=['SUPER_ADMIN_EMAILS','DT_EXPORT_ENABLED','MAIL_ENABLED','MAIL_FROM','MAIL_REPLY_TO','MAIL_HOST_TO','MAIL_RECIPIENT_MODE','BILLING_DISPLAY_NAME','BILLING_ADDRESS','BILLING_PAYMENT_INSTRUCTIONS','BILLING_CONFIG_VERSION','BILLING_REGISTRATION_NUMBER'];
if(Object.keys(input).some(k=>!allowed.includes(k))||Object.values(input).some(v=>typeof v!=='string'||/[\r\n]/.test(v))||!['true','false'].includes(input.MAIL_ENABLED))throw Error('INVALID_PRODUCTION_CONFIGURATION');
if(input.MAIL_RECIPIENT_MODE && input.MAIL_RECIPIENT_MODE!=='booking')throw Error('PRODUCTION_BOOKING_RECIPIENTS_REQUIRED');
const mail=mailSettings({...input,MAIL_RECIPIENT_MODE:'booking'},environmentProfile('production'));
const git=(...args)=>{const r=spawnSync("git",args,{encoding:"utf8"});if(r.status)throw Error("GIT_CHECK_FAILED");return r.stdout.trim();};
if(git("status","--porcelain"))throw Error("CLEAN_COMMITTED_SOURCE_REQUIRED");
const source=git("rev-parse","HEAD"),output=resolve("local/production-functions");
try{const s=await lstat(output);if(s.isSymbolicLink() || JSON.parse(await readFile(resolve(output,"release.json"))).environment!=="production")throw Error("UNRECOGNISED_PRODUCTION_OUTPUT");}catch(e){if(e.code!=="ENOENT")throw e;}
await mkdir("local",{recursive:true});await rm(output,{recursive:true,force:true});
await cp("functions",output,{recursive:true,filter:path=>!["node_modules","tests"].includes(basename(path))&&!/^\.(env|secret)/.test(basename(path))&&!path.endsWith(".log")&&!path.endsWith(".md")});
await cp(resolve(output,"index.mjs"),resolve(output,"application.mjs"));
await writeFile(resolve(output,"index.mjs"),"if(process.env.AROHA_ENVIRONMENT!=='production'||process.env.MAIL_ENABLED!=="+JSON.stringify(input.MAIL_ENABLED)+")throw Error('PRODUCTION_ENVIRONMENT_REQUIRED');\nconst application=await import('./application.mjs');\nexport const arohaApi=application.arohaApi;\nexport const arohaBookingEmailRetry=application.arohaBookingEmailRetry;\n"+(mail.enabled?"export const arohaBookingEmailDispatch=application.arohaBookingEmailDispatch;\n":""));
await writeFile(resolve(output,".env.aroha-retreat"),Object.entries({...input,AROHA_ENVIRONMENT:"production",MAIL_RECIPIENT_MODE:"booking"}).map(([k,v])=>k+"="+JSON.stringify(v)).join("\n")+"\n",{mode:0o600});
await writeFile(resolve(output,"release.json"),JSON.stringify({source,environment:"production",codebase:"aroha-website",mailEnabled:mail.enabled},null,2));
const config=JSON.parse(await readFile("firebase.json"));
if(config.functions.length!==1||config.functions[0].codebase!=="aroha-website")throw Error("PRODUCTION_CODEBASE_REQUIRED");
config.functions[0].source="local/production-functions";
// Config is at repository root so Firebase resolves source paths correctly.
await writeFile(".production-api.firebase.json",JSON.stringify(config,null,2));
const r=spawnSync("npm",["ci","--ignore-scripts"],{cwd:output,stdio:"inherit"});if(r.status)throw Error("PRODUCTION_INSTALL_FAILED");
console.log("Prepared production API source "+source+" with existing owner and mail="+mail.enabled+"; environment-guarded exports.");
