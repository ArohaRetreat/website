import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {compatibleBookingApi,deliveryTarget,assertArtifact,assertPullRequest,branchChecks} from "../scripts/delivery/environment-policy.mjs";
import {verifyDesignPreserved} from "../scripts/delivery/preserve-design.mjs";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {createHash} from "node:crypto";
import {gzipSync} from "node:zlib";
test("only exact environment branches can select a deployment target",()=>{
  assert.equal(deliveryTarget("refs/heads/main").site,"aroha-retreat");
  assert.equal(deliveryTarget("refs/heads/preprod").site,"aroha-retreat-preprod");
  for(const ref of ["main","refs/tags/main","refs/pull/2/merge","refs/heads/pre-prod","refs/heads/preprod/feature",undefined])assert.throws(()=>deliveryTarget(ref));
});
test('deployment gate isolates same-SHA PR failures and the opposite branch from matching push checks',()=>{
  const sha='a'.repeat(40),app={slug:'github-actions'};
  const runs=[['Website application checks',1],['Foundation checks',2],['Environment branch policy',3]].map(([name,id])=>({name,id,check_suite_id:id,event:'push',head_branch:'preprod',head_sha:sha}));
  const checks=['application','website-integration','foundation','branch-policy'].map((name,i)=>({id:i+1,name,app,status:'completed',conclusion:'success',check_suite:{id:i<2?1:i===2?2:3}}));
  runs.push({...runs[2],id:10,check_suite_id:10,event:'pull_request_target'}, {...runs[0],id:11,check_suite_id:11,head_branch:'main'});
  checks.push({...checks[3],id:100,conclusion:'failure',check_suite:{id:10}},{...checks[0],id:101,conclusion:'failure',check_suite:{id:11}});
  assert(branchChecks(checks,runs,'preprod',sha).every(c=>c.conclusion==='success'));
  assert(branchChecks(checks,runs,'preprod','b'.repeat(40)).every(c=>c===undefined));
  runs.push({...runs[0],id:12,check_suite_id:12});
  assert.equal(branchChecks(checks,runs,'preprod',sha)[0],undefined);
  checks.push({...checks[0],id:102,conclusion:'failure',check_suite:{id:12}});
  assert.equal(branchChecks(checks,runs,'preprod',sha)[0].conclusion,'failure');
});
test("cross-environment artifacts, demo builds and source mismatches cannot deploy",()=>{
  const revision="a".repeat(40);
  for(const branch of ["main","preprod"]){
    const target=deliveryTarget("refs/heads/"+branch),config={hosting:{site:target.site,public:target.directory}},release={revision,environment:target.environment,emulators:false};
    assert.doesNotThrow(()=>assertArtifact(target,release,revision,config));
    for(const bad of [{...release,environment:branch==="main"?"pre-prod":"production"},{...release,emulators:true},{...release,revision:"b".repeat(40)}])assert.throws(()=>assertArtifact(target,bad,revision,config));
    assert.throws(()=>assertArtifact(target,release,revision,{hosting:{site:branch==="main"?"aroha-retreat-preprod":"aroha-retreat",public:target.directory}}));
  }
});
test("direct main/preprod PRs fail while selected changes use independent feature/release PRs",()=>{
  assert.throws(()=>assertPullRequest("preprod","main"));
  assert.throws(()=>assertPullRequest("main","preprod"));
  assert.doesNotThrow(()=>assertPullRequest("release/approved-booking","main"));
  assert.doesNotThrow(()=>assertPullRequest("feat/booking","preprod"));
});
test("trusted branch policy never checks out or executes a PR revision",async()=>{
  const source=await readFile(new URL("../.github/workflows/branch-policy.yml",import.meta.url),"utf8");
  assert.match(source,/pull_request_target/);assert.doesNotMatch(source,/uses:|secrets\.|\$\{\{/);
  assert.match(source,/\['main','preprod'\]\.includes\(pr.head.ref\)/);
});
test("frontend workflow uses separate environments and no backend/rules deployment",async()=>{
  const workflow=await readFile(new URL("../.github/workflows/deploy-environment.yml",import.meta.url),"utf8");
  assert.match(workflow,/branches: \[main, preprod\]/);assert.match(workflow,/id-token: write/);
  assert.doesNotMatch(workflow,/FIREBASE_TOKEN|credentials_json|pull_request:/);
  const source=await readFile(new URL("../scripts/deploy-frontend.mjs",import.meta.url),"utf8");
  assert.match(source,/"hosting:"\+target.site/);assert.doesNotMatch(source,/"--force"|"functions"|"firestore"/);
});
test("production preservation rejects changed, missing and additional Natura bytes",async()=>{
  const root=await mkdtemp(tmpdir()+"/aroha-preserve-design-");
  try{
    await mkdir(root+"/dist/design",{recursive:true});await writeFile(root+"/dist/design/index.html","original");
    const files=[{path:"/design/index.html",hash:createHash("sha256").update(gzipSync("original",{level:9})).digest("hex")}];
    const pin={version:'0.6.1',revision:'a'.repeat(40),files:[{path:files[0].path,sha256:createHash('sha256').update('original').digest('hex'),hostingHash:files[0].hash}]};
    assert.deepEqual(await verifyDesignPreserved(root+"/",{files,pin}),{designFilesMatched:1});
    const linux=[{path:files[0].path,hash:'different-runtime-compression'}];
    const composition={design:{version:pin.version,revision:pin.revision},files:[{path:'design/index.html',sha256:pin.files[0].sha256}],designHostingFiles:linux};
    assert.deepEqual(await verifyDesignPreserved(root+'/',{files:linux,pin,composition}),{designFilesMatched:1});
    await assert.rejects(verifyDesignPreserved(root+'/',{files:[{path:files[0].path,hash:'unexplained-change'}],pin,composition}),/HOSTING_HASH_CHANGED/);
    await writeFile(root+"/dist/design/index.html","changed");await assert.rejects(verifyDesignPreserved(root+"/",{files,pin}),/BYTES_CHANGED/);
    await writeFile(root+"/dist/design/extra.txt","extra");await assert.rejects(verifyDesignPreserved(root+"/",{files,pin}),/FILE_SET_CHANGED/);
    await rm(root+"/dist/design/index.html");await assert.rejects(verifyDesignPreserved(root+"/",{files,pin}),/FILE_SET_CHANGED/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test("publication and live verification share the website-to-API version contract",()=>{
 assert.equal(compatibleBookingApi("0.21.7","0.7.1"),true);
 assert.equal(compatibleBookingApi("0.22.0","0.8.0"),true);
 assert.equal(compatibleBookingApi("0.22.1","0.8.2"),true);
 assert.equal(compatibleBookingApi("0.23.0","0.8.0"),false);
 assert.equal(compatibleBookingApi("0.23.0","0.8.1"),true);
 assert.equal(compatibleBookingApi("0.22.0","0.7.1"),false);
 assert.equal(compatibleBookingApi("0.21.7","0.8.0"),false);
 assert.equal(compatibleBookingApi("bad","0.8.0"),false);
});


test("scoped API releases preserve known booking compatibility without accepting unknown minors", () => {
 for (const website of ["0.23.11", "0.25.1"]) {
  for (const api of ["0.10.0", "0.11.0", "0.12.0"]) assert.equal(compatibleBookingApi(website, api), true);
  assert.equal(compatibleBookingApi(website, "0.13.0"), false);
 }
});

test("CRUD frontends require the deployed lifecycle API",()=>{assert.equal(compatibleBookingApi("0.26.0","0.11.0"),false);assert.equal(compatibleBookingApi("0.26.0","0.12.0"),true);assert.equal(compatibleBookingApi("0.26.0","0.13.0"),true);});

test("nightly credit UI requires its deployed policy and unknown future versions stay blocked",()=>{assert.equal(compatibleBookingApi("0.27.0","0.12.1"),false);assert.equal(compatibleBookingApi("0.27.0","0.13.0"),true);assert.equal(compatibleBookingApi("0.27.0","0.14.0"),false);assert.equal(compatibleBookingApi("0.29.0","0.13.0"),false);});


test("Host Studio 0.28 explicitly retains API 0.13 without allowing unknown backend contracts",async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(compatibleBookingApi(pkg.version,'0.15.0'),true);
 assert.equal(compatibleBookingApi('0.30.0','0.14.0'),false);
 assert.equal(compatibleBookingApi('0.30.0','0.16.0'),false);
 assert.equal(compatibleBookingApi('0.29.0','0.15.0'),true);
 assert.equal(compatibleBookingApi('0.28.0','0.13.0'),true);
 assert.equal(compatibleBookingApi('0.28.1','0.13.2'),true);
 for(const api of ['0.12.1','0.14.0','bad'])assert.equal(compatibleBookingApi('0.28.0',api),false);
 assert.equal(compatibleBookingApi('0.29.0','0.13.0'),false);
});
