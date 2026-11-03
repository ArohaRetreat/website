import test from 'node:test';
import assert from 'node:assert/strict';
import {transparentHeader} from '../website/header-appearance.mjs';

test('header restores photo transparency only when the complete header is over the story',()=>{
  for(const height of [84,96]){
    const journey=[
      [0,null,true], [24,null,true], [25,null,false],
      [900,{top:height,bottom:2000},false],
      [1000,{top:0,bottom:2000},true],
      [1800,{top:-800,bottom:height},true],
      [1801,{top:-801,bottom:height-1},false],
      [2100,{top:-1100,bottom:-1},false],
    ];
    for(const route of [journey,[...journey].reverse()])
      for(const [y,rect,expected]of route) assert.equal(transparentHeader(y,rect,height),expected);
  }
});
test('direct/restored positions and text-only or missing story do not retain stale transparency',()=>{
  assert.equal(transparentHeader(1200,{top:-200,bottom:1500},96),true);
  assert.equal(transparentHeader(1200,null,96),false);
  assert.equal(transparentHeader(2000,{top:-2000,bottom:-20},84),false);
  assert.equal(transparentHeader(-10),true);
});
