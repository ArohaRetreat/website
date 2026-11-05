import test from 'node:test';import assert from 'node:assert/strict';
import {finishGuestSignIn} from '../website/guest-signin-return.mjs';
test('guest login returns to same-origin homepage and remembers the session without storage dependency',()=>{
 const paths=[],calls=[];
 assert.deepEqual(finishGuestSignIn({navigate:p=>paths.push(p),storage:{setItem:(...a)=>calls.push(a)}}),{redirecting:true});
 assert.deepEqual(paths,['/']);assert.deepEqual(calls,[['aroha-guest-session','1']]);
 finishGuestSignIn({navigate:p=>paths.push(p),storage:{setItem:()=>{throw Error('blocked')}}});assert.deepEqual(paths,['/','/']);
});
