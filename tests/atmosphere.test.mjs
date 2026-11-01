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
