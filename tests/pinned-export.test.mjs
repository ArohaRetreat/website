import test from 'node:test';import assert from 'node:assert/strict';
import{mkdtemp,mkdir,writeFile,readFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{createHash}from'node:crypto';
import{restorePinnedExport}from'../scripts/restore-pinned-export.mjs';
test('platform-dependent exports restore only exact published bytes and reuse the verified cache',async()=>{
  const root=await mkdtemp(tmpdir()+'/aroha-pinned-export-');
  try{
    await mkdir(root+'/design',{recursive:true});await writeFile(root+'/design/index.html','platform-specific');
    const sha256=createHash('sha256').update('published-original').digest('hex');const pin={files:[{path:'/design/index.html',sha256}]};let calls=0;
    const fetchImpl=async url=>{assert.equal(url,'https://aroharetreat.com/design/index.html');calls++;return new Response('published-original');};
    assert.deepEqual(await restorePinnedExport(root,pin,{cache:root+'/cache',fetchImpl}),{restoredFiles:1,verifiedFiles:1});
    assert.equal(await readFile(root+'/design/index.html','utf8'),'published-original');
    await writeFile(root+'/design/index.html','another-build');await restorePinnedExport(root,pin,{cache:root+'/cache',fetchImpl});assert.equal(calls,1);
    await writeFile(root+'/design/index.html','retain-this-on-error');
    await assert.rejects(restorePinnedExport(root,pin,{fetchImpl:async()=>new Response('unapproved-data')}),/BYTES_CHANGED/);
    assert.equal(await readFile(root+'/design/index.html','utf8'),'retain-this-on-error');
  }finally{await rm(root,{recursive:true,force:true});}
});
