import test from 'node:test';
import assert from 'node:assert/strict';
import {visitDateLabel} from '../website/booking-visit-label.mjs';
test('day visits never advertise the ledger departure as a second visit day',()=>{assert.equal(visitDateLabel({kind:'day',arrival:'2027-02-16',departure:'2027-02-17'},x=>x),'2027-02-16');});
test('exclusive ranges show the inclusive last day across month/year while rooms show checkout',()=>{assert.equal(visitDateLabel({kind:'event',arrival:'2026-12-20',departure:'2027-01-06'},x=>x),'2026-12-20 – 2027-01-05');assert.equal(visitDateLabel({kind:'private',arrival:'2026-12-31',departure:'2027-01-01'},x=>x),'2026-12-31 – 2027-01-01');assert.equal(visitDateLabel({kind:'event',arrival:'2027-02-16',departure:'2027-02-17'},x=>x),'2027-02-16');});
