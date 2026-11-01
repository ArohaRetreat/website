const clamp = n => Math.min(1,Math.max(0,Number.isFinite(n)?n:0));
export function createCinematic(root,enabled,requestPaint=()=>{}) {
 const hero=root.querySelector('.world-hero'),camera=root.querySelector('.world-camera');
 const title=root.querySelector('.hero-content'),stage=root.querySelector('.world-stage');
 const foreground=root.querySelector('.world-foreground'),header=root.querySelector('.site-header');
 const journey=root.querySelector('#journey'),photos=[...root.querySelectorAll('.journey-photo')];
 const caption=root.querySelector('.journey-caption'),progressLine=root.querySelector('.journey-progress');
 const gallery=root.querySelector('.gallery-grid'),memories=[...root.querySelectorAll('.memory')];
 const footer=root.querySelector('.site-footer');
 let observer,px=0,py=0;
 if(enabled) {
  root.classList.add('motion-ready');
  if('IntersectionObserver' in window) {
   root.classList.add('reveal-ready');
   observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('revealed');observer.unobserve(entry.target)}}),{threshold:.08,rootMargin:'0px 0px -4% 0px'});
   root.querySelectorAll('.section-heading,.intro-statement,.package,.visit-grid').forEach(el=>{el.setAttribute('data-reveal','');observer.observe(el)});
  }
 }
 const pointer = e => {
  if(!enabled || e.pointerType!=='mouse')return;
  const r=stage.getBoundingClientRect();px=Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1));py=Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1));requestPaint();
 };
 const leave=()=>{px=py=0;requestPaint()};
 stage.addEventListener('pointermove',pointer,{passive:true});stage.addEventListener('pointerleave',leave);
 function paint() {
  const vh=innerHeight,h=hero.getBoundingClientRect(),j=journey?.getBoundingClientRect(),g=gallery?.getBoundingClientRect(),f=footer.getBoundingClientRect();
  const range=journey?Math.max(1,journey.offsetHeight-vh):1;
  header.classList.toggle('is-inland',h.bottom<95&&f.top>95);
  header.classList.toggle('over-night-footer',f.top<=95);
  hero.classList.toggle('world-visible',h.bottom>0&&h.top<vh);
  if(!enabled)return;
  if(h.top<vh&&h.bottom>0) {
   const p=clamp(-h.top/Math.max(1,h.height));
   camera.style.transform=`translate3d(${px*8}px,${py*5-p*30}px,0) rotateX(${-py*1.8}deg) rotateY(${px*2.5}deg) scale(${1+p*.1})`;
   title.style.transform=`translateY(${-p*28}px)`;
   title.style.opacity=1-p*.45;
   if(foreground)foreground.style.transform=`translate3d(${-px*8}px,${p*30}px,0) rotate(${-px}deg)`;
  }
  if(j&&j.top<vh&&j.bottom>0&&photos.length) {
   const p=clamp(-j.top/range),q=p*(photos.length-.0001),i=Math.floor(q),fraction=q-i;
   const blend=clamp((fraction-.83)/.17);
   photos.forEach((el,n)=>{el.style.opacity=n===i?1:n===i+1?blend:0;el.style.zIndex=n===i+1?2:1;if(n===i||n===i+1)el.style.transform=`translateY(${n===i?-fraction*12:14}px) scale(${n===i?1+fraction*.04:.97})`;});
   const alpha=fraction>.83&&i<photos.length-1?1-blend:i>0&&fraction<.06?.7+fraction*5:1;
   caption.style.opacity=alpha;caption.style.transform=`translateY(${(1-alpha)*10}px)`;
   progressLine.style.transform=`scaleX(${p})`;
  }
  if(g&&g.top<vh&&g.bottom>0) {
   const t=Math.max(-1,Math.min(1,(g.top-vh*.25)/vh));
   memories.forEach((el,i)=>el.style.transform=`translateY(${t*(i%2?45:-35)}px) rotate(${[-6,7,-3][i%3]}deg)`);
  }
 }
 return {paint,destroy(){observer?.disconnect();stage.removeEventListener('pointermove',pointer);stage.removeEventListener('pointerleave',leave);root.classList.remove('motion-ready','reveal-ready')}};
}
