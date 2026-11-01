import test from 'node:test';
import assert from 'node:assert/strict';

test('RUM respects consent, deduplicates concurrent loads and cancels a withdrawn opt-in', async () => {
  const original = Object.fromEntries(['document','localStorage','fetch'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis,k)]));
  let consent = null, calls = 0;
  const scripts = [];
  const tag = 'https://js-cdn.dynatrace.com/jstag/18b1df4492a/bf12470wrz/224aa943b980c761_complete.js';
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>consent}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelector:()=>scripts[0] || null,createElement:()=>({dataset:{}}),head:{append:s=>scripts.push(s)}}});
  globalThis.fetch = async () => { calls++; return {json:async()=>({rumScriptUrl:tag})}; };
  try {
    const {initializeMonitoring} = await import('../website/monitoring.mjs?consent-test');
    await initializeMonitoring();
    assert.equal(calls,0);
    consent = 'allowed';
    await Promise.all([initializeMonitoring(),initializeMonitoring(),initializeMonitoring()]);
    assert.equal(calls,1);
    assert.equal(scripts.length,1);
    assert.equal(scripts[0].src,tag);
    assert.equal(scripts[0].crossOrigin,'anonymous');
    await initializeMonitoring();
    assert.equal(scripts.length,1);
    scripts.length = 0;
    let finish;
    globalThis.fetch = () => new Promise(resolve => {finish=resolve;});
    const pending = initializeMonitoring();
    consent = 'denied';
    finish({json:async()=>({rumScriptUrl:tag})});
    await pending;
    assert.equal(scripts.length,0);
    consent = 'allowed';
    globalThis.fetch = async()=>({json:async()=>({rumScriptUrl:'https://example.com/unapproved.js'})});
    await initializeMonitoring();
    assert.equal(scripts.length,0);
  } finally {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
  }
});
