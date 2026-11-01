import {additionalDefinitions,additionalBody,buildAdditionalTimeline} from './additional-scenes.js';
// Shared playback for twelve independently drawn, explicitly played nature studies.
export const sceneDefinitions={
 leaf:{title:'Leaf drift',duration:3200,stages:['Release','Flutter','Drift','Settle'],description:'A leaf releases from its branch, turns in the breeze and comes to rest on the ground.'},
 seed:{title:'Seed germination',duration:5200,stages:['Seed opens','Root emerges','Shoot rises','Leaves unfold'],description:'The shell separates, roots establish, a shoot rises and two cotyledons open in sequence.'},
 water:{title:'Water ripple',duration:2600,stages:['Droplet falls','Surface impact','Ripples spread','Water stills'],description:'A falling droplet touches the surface and sends three widening ripples across the water.'},
 path:{title:'Trail journey',duration:3600,stages:['Begin','Follow the bend','Find the ascent','Arrive'],description:'A trail is drawn through the landscape while a traveller follows its actual curved route.'}
};
Object.assign(sceneDefinitions,additionalDefinitions);
const svg=(kind,body)=>`<svg xmlns="http://www.w3.org/2000/svg" class="nature-scene scene-${kind}" data-scene="${kind}" viewBox="0 0 240 200" role="img" aria-label="${sceneDefinitions[kind].description}"><title>${sceneDefinitions[kind].title}</title><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
export function sceneSvg(kind){
 if(kind==='leaf')return svg(kind,`<path d="M19 40 Q63 47 111 27 M57 43 L67 24 M87 34 L100 17" fill="none" stroke="#163E2D" stroke-width="2"/><path d="M30 171 Q117 165 213 173" fill="none" stroke="#86613B" stroke-width="1.4"/><path d="M48 170 q4-12 7-13 m0 13 q6-9 10-8 M190 172 q2-12 8-16" fill="none" stroke="#60833D" stroke-width="1.4"/><ellipse class="leaf-shadow" cx="167" cy="171" rx="20" ry="3" fill="#163E2D" opacity=".1"/><g class="drifting-leaf"><path d="M100 32 C87 32 73 45 72 68 C93 69 112 56 100 32Z" fill="#60833D" stroke="#163E2D" stroke-width="1.2"/><path d="M73 67 Q87 54 100 32 M87 53 L77 50 M88 51 L99 51" fill="none" stroke="#FAF7EF" stroke-width="1"/></g>`);
 if(kind==='seed')return svg(kind,`<path d="M23 148 Q80 140 123 148 T219 148" fill="none" stroke="#86613B" stroke-width="1.5"/><path d="M27 161 h11 m15 16 h8 m103-13 h10 m15 17 h12 m-92-3 h7" fill="none" stroke="#C5B29A" stroke-width="1"/><g fill="none" stroke="#86613B" stroke-width="1.6"><path class="seed-root" d="M119 149 Q110 165 120 189"/><path class="seed-root branch-root" d="M115 166 Q100 168 97 181 M117 174 Q132 173 137 184"/></g><path class="seed-shoot" d="M120 147 C111 131 130 110 119 93 Q111 82 119 71" fill="none" stroke="#163E2D" stroke-width="3"/><g class="seed-shell-left"><path d="M119 136 Q103 132 105 145 Q106 157 119 155Z" fill="#B1946B" stroke="#86613B" stroke-width="1.2"/></g><g class="seed-shell-right"><path d="M121 136 Q136 133 135 146 Q133 157 121 155Z" fill="#C4A77D" stroke="#86613B" stroke-width="1.2"/></g><g class="seed-leaf-left"><path d="M119 75 C89 82 72 65 66 45 C93 40 117 49 119 75Z" fill="#60833D" stroke="#163E2D" stroke-width="1.2"/><path d="M117 74 L78 52" stroke="#DDE5D7" stroke-width="1"/></g><g class="seed-leaf-right"><path d="M119 75 C121 46 144 35 170 39 C166 64 144 81 119 75Z" fill="#7C985C" stroke="#163E2D" stroke-width="1.2"/><path d="M122 73 L157 47" stroke="#DDE5D7" stroke-width="1"/></g>`);
 if(kind==='water')return svg(kind,`<path d="M18 125 Q51 121 83 125 T148 125 T221 125" fill="none" stroke="#A9BCAD" stroke-width="1.2"/><g fill="none" stroke="#60833D" stroke-width="1.5"><ellipse class="water-ring ring-one" cx="120" cy="126" rx="21" ry="6"/><ellipse class="water-ring ring-two" cx="120" cy="126" rx="21" ry="6"/><ellipse class="water-ring ring-three" cx="120" cy="126" rx="21" ry="6"/></g><g class="water-splash" fill="none" stroke="#60833D" stroke-width="1.5"><path d="M110 117 l-6-9 M130 117 l6-9 M120 111 v-10"/></g><path class="water-drop" d="M120 21 C116 30 111 35 111 41 A9 9 0 0 0 129 41 C129 35 124 30 120 21Z" fill="#60833D" stroke="#163E2D" stroke-width="1"/><path d="M33 155 Q84 151 108 155 M154 155 q23-3 42 0" stroke="#DDE5D7" stroke-width="1.2" fill="none"/>`);
 if(kind==='path')return svg(kind,`<path d="M19 171 Q67 154 111 168 T222 168 M22 99 Q53 70 80 81 M156 49 Q186 25 218 33" fill="none" stroke="#CDD8C4" stroke-width="1.4"/><path d="M41 91 v-28 m-10 10 l10-23 10 23Z M190 160 v-27 m-10 12 10-24 10 24Z" fill="#E8EEE1" stroke="#60833D" stroke-width="1.3"/><path class="trail-guide" d="M22 154 C50 155 48 110 89 117 S140 145 150 94 S180 43 218 49" fill="none" stroke="#E0E7DC" stroke-width="2"/><path class="trail-line" d="M22 154 C50 155 48 110 89 117 S140 145 150 94 S180 43 218 49" fill="none" stroke="#86613B" stroke-width="2.5"/><circle cx="22" cy="154" r="5" fill="#FFFFFF" stroke="#163E2D" stroke-width="1.5"/><circle cx="218" cy="49" r="5" fill="#FFFFFF" stroke="#163E2D" stroke-width="1.5"/><circle class="trail-walker" cx="22" cy="154" r="4" fill="#163E2D" stroke="#FFFFFF" stroke-width="1.5"/>`);
 const extra=additionalBody(kind);if(extra)return svg(kind,extra);
 throw Error('Unknown Natura scene.');
}
export function stageAt(kind,progress){const spec=sceneDefinitions[kind];if(!spec)throw Error('Unknown scene.');const time=Math.max(0,Math.min(1,progress))*spec.duration;const boundaries={leaf:[0,640,1376,2912],seed:[0,500,1700,3500],water:[0,580,800,2300],path:[0,900,1800,2700]}[kind]||spec.phaseMs;return spec.stages[boundaries.filter(x=>time>=x).length-1];}
// WAAPI owns the timelines. The interval below only reports scrubber state, never draws frames.
export function createScenePlayer(root,kind,onUpdate=()=>{}){
 const spec=sceneDefinitions[kind];if(!spec)throw Error('Unknown scene.');
 let animations=[],master,tick,state='ready',rate=1;
 const query=s=>root.querySelector(s);
 const update=()=>{const progress=master?Math.max(0,Math.min(1,Number(master.currentTime||0)/spec.duration)):0;onUpdate({kind,state,progress,stage:stageAt(kind,progress),duration:spec.duration});};
 const clear=()=>{clearInterval(tick);for(const a of animations)a.cancel();animations=[];master=undefined;};
 function animate(target,frames,options){const animation=target.animate(frames,{fill:'both',easing:'linear',...options});animations.push(animation);return animation;}
 function setup(){
  clear();
  if(kind==='leaf'){
   const leaf=query('.drifting-leaf');leaf.style.transformOrigin='91px 48px';
   animate(leaf,[{transform:'translate(0px,0px) rotate(0deg)'},{transform:'translate(24px,14px) rotate(-20deg)',offset:.2},{transform:'translate(4px,55px) rotate(35deg)',offset:.43},{transform:'translate(55px,79px) rotate(-12deg)',offset:.68},{transform:'translate(76px,116px) rotate(65deg)',offset:.91},{transform:'translate(75px,116px) rotate(72deg)'}],{duration:spec.duration,easing:'cubic-bezier(.77,0,.175,1)'});
   const shadow=query('.leaf-shadow');shadow.style.transformOrigin='167px 171px';animate(shadow,[{opacity:0,transform:'scaleX(.4)'},{opacity:.13,transform:'scaleX(1)'}],{duration:1500,delay:1700});
  }
  if(kind==='seed'){
   for(const [selector,rotate,x] of [['.seed-shell-left',-35,-8],['.seed-shell-right',32,8]]){const node=query(selector);node.style.transformOrigin='120px 146px';animate(node,[{transform:'translateX(0px) rotate(0deg)'},{transform:`translateX(${x}px) rotate(${rotate}deg)`}],{duration:900,delay:200,easing:'cubic-bezier(.23,1,.32,1)'});}
   for(const node of root.querySelectorAll('.seed-root')){const length=node.getTotalLength();node.style.strokeDasharray=String(length);animate(node,[{strokeDashoffset:length,opacity:0},{strokeDashoffset:0,opacity:1}],{duration:1400,delay:node.classList.contains('branch-root')?950:500});}
   const shoot=query('.seed-shoot'),length=shoot.getTotalLength();shoot.style.strokeDasharray=String(length);animate(shoot,[{strokeDashoffset:length,opacity:0},{strokeDashoffset:0,opacity:1}],{duration:1800,delay:1700});
   for(const [selector,angle,delay] of [['.seed-leaf-left',80,3500],['.seed-leaf-right',-76,3800]]){const node=query(selector);node.style.transformOrigin='119px 75px';animate(node,[{transform:`rotate(${angle}deg)`,opacity:0},{transform:'rotate(0deg)',opacity:1}],{duration:1400,delay,easing:'cubic-bezier(.23,1,.32,1)'});}
  }
  if(kind==='water'){
   animate(query('.water-drop'),[{transform:'translateY(0px)',opacity:1},{transform:'translateY(78px)',opacity:1,offset:.88},{transform:'translateY(80px) scale(.75)',opacity:0}],{duration:650,easing:'linear'});
   for(const [index,node] of [...root.querySelectorAll('.water-ring')].entries()){node.style.transformOrigin='120px 126px';animate(node,[{transform:'scale(.3)',opacity:0},{transform:'scale(.65)',opacity:.7,offset:.15},{transform:'scale(4.4)',opacity:0}],{duration:1700,delay:600+index*150,easing:'cubic-bezier(.23,1,.32,1)'});}
   animate(query('.water-splash'),[{opacity:0,transform:'translateY(7px)'},{opacity:.8,transform:'translateY(0px)',offset:.3},{opacity:0,transform:'translateY(5px)'}],{duration:600,delay:580});
  }
  if(kind==='path'){
   const path=query('.trail-line'),length=path.getTotalLength();path.style.strokeDasharray=String(length);animate(path,[{strokeDashoffset:length},{strokeDashoffset:0}],{duration:spec.duration});
   const walker=query('.trail-walker');walker.setAttribute('cx','0');walker.setAttribute('cy','0');walker.style.offsetPath='path("M22 154 C50 155 48 110 89 117 S140 145 150 94 S180 43 218 49")';walker.style.offsetRotate='0deg';
   animate(walker,[{offsetDistance:'0%'},{offsetDistance:'100%'}],{duration:spec.duration});
  }
  if(Object.hasOwn(additionalDefinitions,kind))buildAdditionalTimeline(kind,{root,animate,query});
  master=animate(root,[{opacity:1},{opacity:1}],{duration:spec.duration});
  const start=document.timeline.currentTime;for(const animation of animations){animation.playbackRate=rate;animation.startTime=start;}
  master.onfinish=()=>{state='complete';clearInterval(tick);update();};
 }
 return {
  play({reducedMotion=false,speed=1}={}){rate=speed;setup();if(reducedMotion){for(const animation of animations)animation.finish();state='complete';update();return;}state='playing';tick=setInterval(update,100);update();},
  pause(){if(!master)return;const time=Number(master.currentTime||0);for(const animation of animations){animation.pause();animation.currentTime=time;}state='paused';clearInterval(tick);update();},
  resume(){if(!master||Number(master.currentTime)>=spec.duration)return;for(const animation of animations)animation.play();state='playing';tick=setInterval(update,100);update();},
  seek(progress){if(!master)setup();const time=Math.max(0,Math.min(1,progress))*spec.duration;for(const animation of animations){animation.pause();animation.currentTime=time;}state=time===spec.duration?'complete':'paused';clearInterval(tick);update();},
  speed(value){rate=value;for(const animation of animations)animation.updatePlaybackRate(value);},
  reset(){clear();state='ready';update();},
  dispose(){clear();},
  get state(){return state;}
 };
}
