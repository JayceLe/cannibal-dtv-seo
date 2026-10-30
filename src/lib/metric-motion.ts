import {gsap} from 'gsap';

const surface='[data-metric-surface]';
const content='.highlight-label,.highlight-main,.highlight-footer,.report-card-label,.report-card-value,.report-card-detail,.ratio-visual,.ratio-copy > *';

/** Card surfaces own hover; their children own entrance. Values never scale or replay on hover. */
export function mountMetricMotion(root:HTMLElement){
 const seen=new WeakSet<HTMLElement>(),media=gsap.matchMedia();
 media.add({motion:'(prefers-reduced-motion: no-preference)',hover:'(hover: hover) and (pointer: fine)'},context=>{
  if(!context.conditions?.motion)return;
  const canHover=Boolean(context.conditions.hover),observed=new Set<HTMLElement>(),styled=new Set<HTMLElement>();
  const tweens=new Set<gsap.core.Tween>(),lights=new Map<HTMLElement,{x:gsap.QuickToFunc;y:gsap.QuickToFunc}>();
  let pointer:HTMLElement|null=null,focused:HTMLElement|null=null,pressed:HTMLElement|null=null,alive=true;
  const animate=(target:gsap.TweenTarget,vars:gsap.TweenVars)=>{
   let tween:gsap.core.Tween;
   const forget=()=>tweens.delete(tween);
   tween=gsap.to(target,{...vars,onComplete:forget,onInterrupt:forget});tweens.add(tween);return tween;
  };
  const find=(target:EventTarget|null)=>target instanceof Element?target.closest<HTMLElement>(surface):null;
  const enabled=(el:HTMLElement|null):el is HTMLElement=>Boolean(el&&root.contains(el)&&!el.matches(':disabled')&&!el.closest('[aria-busy="true"]'));
  const illuminate=(el:HTMLElement,active:boolean)=>{
   styled.add(el);el.toggleAttribute('data-metric-active',active);
   animate(el,{'--metric-light':active?1:0,duration:active?.32:.42,ease:'power2.out',overwrite:'auto'});
  };
  const point=(el:HTMLElement,e:PointerEvent)=>{
   const rect=el.getBoundingClientRect();if(!rect.width||!rect.height)return;
   let light=lights.get(el);
   if(!light){
    gsap.set(el,{'--spot-x':50,'--spot-y':50});
    light={x:gsap.quickTo(el,'--spot-x',{duration:.36,ease:'power3.out'}),y:gsap.quickTo(el,'--spot-y',{duration:.36,ease:'power3.out'})};
    lights.set(el,light);
   }
   light.x(Math.max(0,Math.min(100,(e.clientX-rect.left)/rect.width*100)));
   light.y(Math.max(0,Math.min(100,(e.clientY-rect.top)/rect.height*100)));
  };
  const over=(e:PointerEvent)=>{
   if(!canHover||e.pointerType==='touch')return;
   const el=find(e.target);if(!enabled(el)||e.relatedTarget instanceof Node&&el.contains(e.relatedTarget))return;
   pointer=el;illuminate(el,true);point(el,e);
  };
  const out=(e:PointerEvent)=>{
   const el=find(e.target);if(!el||!root.contains(el)||e.relatedTarget instanceof Node&&el.contains(e.relatedTarget))return;
   if(pointer===el)pointer=null;illuminate(el,focused===el);el.removeAttribute('data-metric-pressed');
  };
  const move=(e:PointerEvent)=>{if(canHover&&e.pointerType!=='touch'&&enabled(pointer))point(pointer,e);};
  const focus=(e:FocusEvent)=>{const el=find(e.target);if(enabled(el)&&el.matches(':focus-visible')){focused=el;illuminate(el,true);}};
  const blur=(e:FocusEvent)=>{const el=find(e.target);if(el&&focused===el){focused=null;illuminate(el,pointer===el);}};
  const press=(target:EventTarget|null)=>{const el=find(target);if(enabled(el)&&el.matches('button')){pressed=el;styled.add(el);el.setAttribute('data-metric-pressed','');}};
  const down=(e:PointerEvent)=>{if(e.button===0)press(e.target);};
  const release=()=>{pressed?.removeAttribute('data-metric-pressed');pressed=null;};
  const keydown=(e:KeyboardEvent)=>{if(!e.repeat&&['Enter',' '].includes(e.key))press(e.target);};
  const keyup=(e:KeyboardEvent)=>{if(['Enter',' '].includes(e.key))release();};
  const reveal=(el:HTMLElement,index:number)=>{
   if(!alive||seen.has(el)||!root.contains(el))return;
   seen.add(el);styled.add(el);
   const children=[...el.querySelectorAll<HTMLElement>(content)];
   // Readable server output remains in place; only a short, partial fade begins on intersection.
   gsap.set(children,{opacity:.68,y:8});
   animate(children,{opacity:1,y:0,duration:.54,delay:Math.min(index*.055,.165),stagger:.055,ease:'power3.out',clearProps:'opacity,transform'});
   const arc=el.querySelector<SVGElement>('[data-ratio-progress]');
   if(arc){
    const value=Number(arc.dataset.ratioProgress);
    gsap.set(arc,{strokeDasharray:'0 100'});
    animate(arc,{strokeDasharray:`${value} ${100-value}`,duration:.82,delay:.08,ease:'power2.out',clearProps:'strokeDasharray'});
   }
  };
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
   entries.filter(e=>e.isIntersecting).forEach((entry,index)=>{const el=entry.target as HTMLElement;observer?.unobserve(el);observed.delete(el);reveal(el,index);});
  },{threshold:.12,rootMargin:'0px 0px -12px 0px'});
  const scan=(node:HTMLElement)=>{
   const nodes=[...(node.matches(surface)?[node]:[]),...node.querySelectorAll<HTMLElement>(surface)];
   nodes.forEach(el=>{if(!seen.has(el)&&!observed.has(el)){if(observer){observer.observe(el);observed.add(el);}else reveal(el,0);}});
  };
  const reset=(el:HTMLElement)=>{
   const light=lights.get(el);light?.x.tween.kill();light?.y.tween.kill();lights.delete(el);
   const targets=[el,...el.querySelectorAll<HTMLElement|SVGElement>(`${content},[data-ratio-progress]`)];
   targets.forEach(target=>{tweens.forEach(t=>{if(t.targets().includes(target)){t.kill();tweens.delete(t);}});});
   gsap.set(el,{clearProps:'--metric-light,--spot-x,--spot-y'});
   gsap.set(el.querySelectorAll(content),{clearProps:'opacity,transform'});
   el.querySelector<SVGElement>('[data-ratio-progress]')?.style.removeProperty('stroke-dasharray');
   el.removeAttribute('data-metric-active');el.removeAttribute('data-metric-pressed');styled.delete(el);
  };
  const changes=new MutationObserver(records=>{
   let removed=false;
   for(const record of records){
    record.addedNodes.forEach(node=>{if(node instanceof HTMLElement)scan(node);});
    if([...record.removedNodes].some(node=>node instanceof Element))removed=true;
   }
   if(!removed)return;
   for(const el of observed)if(!root.contains(el)){observer?.unobserve(el);observed.delete(el);}
   for(const el of styled)if(!root.contains(el)){reset(el);if(pointer===el)pointer=null;if(focused===el)focused=null;if(pressed===el)pressed=null;}
  });
  scan(root);changes.observe(root,{childList:true,subtree:true});
  root.addEventListener('pointerover',over);root.addEventListener('pointerout',out);root.addEventListener('pointermove',move,{passive:true});
  root.addEventListener('focusin',focus);root.addEventListener('focusout',blur);root.addEventListener('pointerdown',down);root.addEventListener('keydown',keydown);
  window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);window.addEventListener('keyup',keyup);window.addEventListener('blur',release);
  return()=>{
   alive=false;observer?.disconnect();changes.disconnect();
   root.removeEventListener('pointerover',over);root.removeEventListener('pointerout',out);root.removeEventListener('pointermove',move);
   root.removeEventListener('focusin',focus);root.removeEventListener('focusout',blur);root.removeEventListener('pointerdown',down);root.removeEventListener('keydown',keydown);
   window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',release);
   tweens.forEach(t=>t.kill());tweens.clear();styled.forEach(reset);observed.clear();
  };
 });
 return()=>media.revert();
}
