// Raster derivatives of the approved email-v3 artwork. Runtime needs no renderer.
// npm install --prefix local/email-art-tool --ignore-scripts @resvg/resvg-js@2.6.2
// node scripts/build-email-art.mjs
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(new URL('../local/email-art-tool/package.json',import.meta.url));
const {Resvg}=require('@resvg/resvg-js');
const root=new URL('../functions/email/assets/',import.meta.url);
const icons=JSON.parse(readFileSync(new URL('journey-icons.json',root)));
const labels=['Request sent','Review','Confirmed','Check in','Check out','Feedback'];
const positions=[[90,40],[270,40],[450,40],[450,170],[270,170],[90,170]];
const render=(svg,file,width)=>writeFileSync(new URL(file,root),new Resvg(svg,{fitTo:{mode:'width',value:width},font:{fontFiles:[new URL('SourceSans3-Regular.ttf',root).pathname],loadSystemFonts:false,defaultFontFamily:'Source Sans 3'}}).render().asPng());
for(const [name,stage] of [['request',0],['confirmed',2]]) {
 const nodes=positions.map(([x,y],i)=>{
  const current=i===stage,done=i<stage,color=current?'#8f5734':done?'#fffdf1':'#7c8b70';
  return `<g transform="translate(${x},${y})">${current?'<circle r="38" fill="none" stroke="#e4d8bc" stroke-width="5"/>':''}<circle r="34" fill="${done?'#234c35':current?'#fcf8ed':'#f0f1e6'}" stroke="${current?'#9a633d':done?'#234c35':'#c1cab3'}"/><g transform="translate(-17,-17) scale(.94)" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${icons[i]}</g>${done?'<circle cx="25" cy="26" r="10" fill="#234c35" stroke="#f0f1e6" stroke-width="2"/><path d="m21 26 3 3 5-6" fill="none" stroke="white" stroke-width="1.5"/>':''}<text y="59" text-anchor="middle" font-size="14" fill="${current?'#734529':'#55664b'}">${labels[i]}</text>${current?'<rect x="-42" y="67" width="84" height="18" rx="9" fill="#e5d7b9"/>':''}<text y="79" text-anchor="middle" font-size="10" fill="${current?'#734529':'#78846d'}">${done?'Complete':current?'You are here':'Coming up'}</text></g>`;
 }).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 270"><rect width="540" height="270" fill="#f0f1e6"/><path d="M90 40H450C530 40 530 170 450 170H90" fill="none" stroke="#c4cbb9" stroke-width="1.5" stroke-dasharray="3 5"/><path d="m178 36 5 4-5 4m178-8 5 4-5 4m139 52 4 5 4-5m-137 70-5 4 5 4m-178-8-5 4 5 4" fill="none" stroke="#89977d" stroke-width="1.3"/><g font-family="Source Sans 3">${nodes}</g></svg>`;
 render(svg,`journey-${name}.png`,1080);
}
render(readFileSync(new URL('logo-forest.svg',root),'utf8'),'logo-forest.png',528);
