import test from 'node:test';
import assert from 'node:assert/strict';
import {installBrowserBranding} from '../website/browser-branding.mjs';
import {googlePhotoUrl,guestAvatar} from '../website/guest-account.mjs';
test('Google photo URL is restricted to HTTPS provider hosts and avatar names are escaped',()=>{
  const photo='https://lh3.googleusercontent.com/a/test=s96-c';
  assert.equal(googlePhotoUrl({photoURL:photo}),photo);
  for(const bad of ['javascript:alert(1)','http://lh3.googleusercontent.com/a','https://lh3.googleusercontent.com.evil.test/a','https://user:secret@lh3.googleusercontent.com/a','/image.svg'])assert.equal(googlePhotoUrl({photoURL:bad}),'');
  const html=guestAvatar({displayName:'<img onerror=alert(1)>',photoURL:photo});
  assert.ok(html.includes('&lt;'));assert.ok(!html.includes('<img onerror'));assert.ok(html.includes('data-guest-photo'));assert.ok(html.includes('referrerpolicy="no-referrer"'));
  assert.ok(!guestAvatar({displayName:'Visitor'}).includes('<img'));
});
test('favicon follows browser colour preference independently of IST mode and chrome stays green',()=>{
  const savedDoc=globalThis.document,savedMatch=globalThis.matchMedia;
  const icon={},meta={},scheme={matches:true,addEventListener(_k,fn){this.change=fn;}};
  globalThis.document={querySelector:()=>icon,querySelectorAll:()=>[meta]};globalThis.matchMedia=()=>scheme;
  try {installBrowserBranding();assert.match(icon.href,/favicon-dark.svg$/);assert.equal(meta.content,'#163e2d');scheme.matches=false;scheme.change();assert.match(icon.href,/favicon-light.svg$/);assert.equal(meta.content,'#163e2d');}
  finally{globalThis.document=savedDoc;globalThis.matchMedia=savedMatch;}
});

test('head bootstrap updates a favicon parsed after the script and later browser changes',()=>{
  const savedDoc=globalThis.document,savedMatch=globalThis.matchMedia;let icon,ready;
  const scheme={matches:true,addEventListener(_k,fn){this.change=fn;}};
  globalThis.document={readyState:'loading',querySelector:()=>icon,querySelectorAll:()=>[],addEventListener(_k,fn){ready=fn;}};globalThis.matchMedia=()=>scheme;
  try{installBrowserBranding();icon={};ready();assert.match(icon.href,/favicon-dark.svg$/);scheme.matches=false;scheme.change();assert.match(icon.href,/favicon-light.svg$/);}
  finally{globalThis.document=savedDoc;globalThis.matchMedia=savedMatch;}
});
