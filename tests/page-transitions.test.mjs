import test from 'node:test';
import assert from 'node:assert/strict';
import { publicDestination, validArrival } from '../website/page-transitions.mjs';

test('page transition destinations admit only different implemented same-origin public pages', () => {
  const from = 'https://aroharetreat.com/';
  assert.equal(publicDestination('/map/#pond', from)?.href, from + 'map/#pond');
  assert.equal(publicDestination('/#visit', from + 'map/')?.href, from + '#visit');
  for (const href of ['/#packages', '/admin/', '/design/', '/future/', '//evil.test/map/', 'javascript:alert(1)', '/map/?preview']) {
    assert.equal(publicDestination(href, from), null, href);
  }
  assert.equal(publicDestination('/map/', from + '?preview'), null);
  assert.equal(publicDestination('/map/', from + 'admin/'), null);
});
test('route arrival markers expire and bind to the exact destination including fragments', () => {
  const record = {to: '/#visit', at: 1000, motion: true};
  assert.equal(validArrival(record, '/#visit', 2000), true);
  assert.equal(Boolean(validArrival(record, '/', 2000)), false);
  assert.equal(Boolean(validArrival(record, '/#visit', 16000)), false);
  assert.equal(Boolean(validArrival(record, '/#visit', 999)), false);
  for (const bad of [null, {}, {...record, at: NaN}, {...record, motion: 'true'}]) {
    assert.equal(Boolean(validArrival(bad, '/#visit', 2000)), false);
  }
  assert.equal(validArrival({...record, motion: false}, '/#visit', 2000), true);
});
