import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeAtmosphere } from '../website/atmosphere.mjs';

test('atmosphere preference accepts only explicit daylight and sunset choices', () => {
  assert.equal(normalizeAtmosphere('evening'), 'evening');
  for (const value of ['day', null, undefined, 'dark', '<script>', {}]) assert.equal(normalizeAtmosphere(value), 'day');
});
test('sunset text and controls retain AA contrast on the forest surfaces', async () => {
  const css = await readFile(new URL('../website/sunset.css', import.meta.url), 'utf8');
  const token = name => css.match(new RegExp(`--dusk-${name}: (#[a-f0-9]{6});`))[1];
  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(v => parseInt(v,16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
    return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
  };
  const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  for (const foreground of ['ink','muted','accent']) for (const background of ['ground','card','raised']) {
    assert.ok(contrast(token(foreground),token(background)) >= 4.5, foreground+' on '+background);
  }
  assert.ok(contrast('#173425', token('accent')) >= 4.5);
});

test('Aroha clock follows IST boundaries independently of visitor timezone', async () => {
  const { arohaClock, resolveAtmosphere } = await import('../website/atmosphere.mjs');
  for (const [stamp,value,next] of [
    ['2026-11-02T00:29:59Z','evening','2026-11-02T00:30:00Z'],
    ['2026-11-02T00:30:00Z','day','2026-11-02T12:30:00Z'],
    ['2026-11-02T12:29:59Z','day','2026-11-02T12:30:00Z'],
    ['2026-11-02T12:30:00Z','evening','2026-11-03T00:30:00Z'],
    ['2026-12-31T20:00:00Z','evening','2027-01-01T00:30:00Z'],
  ]) assert.deepEqual(arohaClock(Date.parse(stamp)),{value,next:Date.parse(next)});
  const at=Date.parse('2026-11-02T10:00:00Z'), until=arohaClock(at).next;
  assert.equal(resolveAtmosphere(at,{value:'evening',until}),'evening');
  assert.equal(resolveAtmosphere(until,{value:'day',until}),'evening');
  assert.equal(resolveAtmosphere(at,{value:'evening',until:until+1}),'day');
  assert.equal(resolveAtmosphere(at,{value:'invalid',until}),'day');
});

test('live clock resumes automatic mode at the boundary and survives denied storage/history', async () => {
  const {startAtmosphereClock,setAtmosphere} = await import('../website/atmosphere.mjs');
  const saved = Object.fromEntries(['document','window','localStorage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const originalNow=Date.now, originalSet=globalThis.setTimeout, originalClear=globalThis.clearTimeout;
  const events=new Map(), docs=new Map();let now=Date.parse('2026-11-02T12:29:59Z'), scheduled;
  const html={dataset:{}};
  Object.defineProperty(globalThis,'document',{configurable:true,value:{documentElement:html,hidden:false,addEventListener:(k,f)=>docs.set(k,f)}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:(k,f)=>events.set(k,f),dispatchEvent:e=>events.get(e.type)?.(e)}});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}});
  Date.now=()=>now;globalThis.setTimeout=(f,ms)=>{scheduled={f,ms};return 1;};globalThis.clearTimeout=()=>{scheduled=null;};
  try {
    startAtmosphereClock();assert.equal(html.dataset.atmosphere,'day');assert.equal(scheduled.ms,1020);
    setAtmosphere('day');now=Date.parse('2026-11-02T12:30:00.020Z');scheduled.f();assert.equal(html.dataset.atmosphere,'sunset');
    events.get('pagehide')();assert.equal(scheduled,null);
    now=Date.parse('2026-11-03T00:30:01Z');events.get('pageshow')();assert.equal(html.dataset.atmosphere,'day');assert.ok(scheduled.ms>0);
    document.hidden=true;docs.get('visibilitychange')();assert.equal(scheduled,null);
  } finally {
    Date.now=originalNow;globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;
    for(const [key,descriptor] of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
});
