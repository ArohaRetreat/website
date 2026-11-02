import test from 'node:test';
import assert from 'node:assert/strict';
import { createFaqMotion } from '../website/faq-motion.mjs';
function fixture() {
  const callbacks=new Map();
  const summary={attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},addEventListener(n,fn){callbacks.set(n,fn);},removeEventListener(n){callbacks.delete(n);}};
  const animations=[];
  const detail={open:false,style:{},querySelector:()=>summary,getBoundingClientRect(){return {height:this.style.height&&this.style.height!=='auto'?parseFloat(this.style.height):this.open?190:94};},animate(frames,options){const a={frames,options,cancelled:false,cancel(){this.cancelled=true;}};animations.push(a);return a;}};
  const media={matches:false,addEventListener(){},removeEventListener(){}};
  return {detail,summary,animations,media,click:()=>callbacks.get('click')({preventDefault(){}}),root:{querySelectorAll:()=>[detail]}};
}
test('FAQ closes to its full padded summary height, reverses from current geometry and cleans up',()=>{
  const f=fixture();const oldMatch=globalThis.matchMedia,oldWindow=globalThis.window;
  globalThis.matchMedia=()=>f.media;globalThis.window={addEventListener(){},removeEventListener(){}};
  try {
    const c=createFaqMotion(f.root);f.click();assert.equal(f.detail.open,true);assert.equal(f.animations[0].frames[1].height,'190px');
    f.detail.style.height='140px';f.click();assert.equal(f.animations[0].cancelled,true);assert.equal(f.animations[1].frames[0].height,'140px');assert.equal(f.animations[1].frames[1].height,'94px');
    assert.equal(f.detail.open,true);f.animations[1].onfinish();assert.equal(f.detail.open,false);assert.equal(f.detail.style.height,'');
    f.media.matches=true;f.click();assert.equal(f.detail.open,true);assert.equal(f.animations.length,2);c.destroy();assert.equal(f.detail.style.overflow,'');
  }finally{globalThis.matchMedia=oldMatch;globalThis.window=oldWindow;}
});
