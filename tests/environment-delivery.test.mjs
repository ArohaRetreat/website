import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {deliveryTarget,assertArtifact,assertPullRequest} from "../scripts/delivery/environment-policy.mjs";
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
    assert.deepEqual(await verifyDesignPreserved(root+"/",{files}),{designFilesMatched:1});
    await writeFile(root+"/dist/design/index.html","changed");await assert.rejects(verifyDesignPreserved(root+"/",{files}),/BYTES_CHANGED/);
    await writeFile(root+"/dist/design/extra.txt","extra");await assert.rejects(verifyDesignPreserved(root+"/",{files}),/FILE_SET_CHANGED/);
    await rm(root+"/dist/design/index.html");await assert.rejects(verifyDesignPreserved(root+"/",{files}),/FILE_SET_CHANGED/);
  }finally{await rm(root,{recursive:true,force:true});}
});
