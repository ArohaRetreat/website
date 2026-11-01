import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('Firebase owns directory slash normalization without a self-redirect',async()=>{
 const {hosting}=JSON.parse(await readFile(new URL('../firebase.json',import.meta.url)));
 assert.equal(hosting.site,'aroha-retreat');assert.equal(hosting.trailingSlash,true);
 assert.equal(hosting.redirects,undefined);assert.ok(hosting.rewrites.some(r=>r.source==='/design/**'&&r.destination==='/design/index.html'));
 assert.ok(hosting.rewrites.some(r=>r.source==='/api/v1/**'&&r.function.functionId==='arohaApi'));
 assert.ok(hosting.rewrites.some(r=>r.source==='/admin/**'&&r.destination==='/admin/index.html'));
});
