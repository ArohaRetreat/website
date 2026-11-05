import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {apiVersion} from '../functions/version.mjs';
import {bookingEvent} from '../functions/booking/observability.mjs';
test('API business events and runtime modules use the package-owned release version',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../functions/package.json',import.meta.url),'utf8'));
 assert.equal(apiVersion,pkg.version);
 assert.equal(bookingEvent({id:'version-test',type:'email.accepted',authority:'server-observed'})['service.version'],apiVersion);
 for(const name of ['index.mjs','telemetry.mjs','booking/store.mjs','booking/observability.mjs']) {
  const source=await readFile(new URL('../functions/'+name,import.meta.url),'utf8');
  assert.ok(!/"0\.8\.\d+"/.test(source),name);
 }
});
