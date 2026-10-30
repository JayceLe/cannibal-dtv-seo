import {gsap} from 'gsap';
import {mountMetricMotion} from './metric-motion';

export const motionTiming={reveal:.58,hover:.24,press:.12,release:.24,update:.32,open:.38,close:.26} as const;
const interactiveSelector='.select-menu-trigger, .comparison-report-card:is(button):not([data-metric-surface]), .report-metric-toggle button, .report-category-list button, .comparison-sidebar button, .picker-trigger, .category-list button, .distribution-legend button, .main-navigation button, .header-actions button, .level-chip, .query-tabs button, .pagination button, .btn, .segmented button';

/** Each property has one owner: panels reveal; controls transform; chart series belong to ECharts. */
export function mountDashboardMotion(root:HTMLElement){
 const stopMetrics=mountMetricMotion(root);
 const seen=new WeakSet<Element>();
 const media=gsap.matchMedia();
 media.add({motion:'(prefers-reduced-motion: no-preference)',hover:'(hover: hover) and (pointer: fine)'},context=>{
  if(!context.conditions?.motion)return;
  const canHover=Boolean(context.conditions.hover);
  const tweens=new Set<gsap.core.Tween>(),transformed=new Set<HTMLElement>();
  const active=new Map<HTMLElement,gsap.core.Tween>(),updates=new Map<HTMLElement,gsap.core.Tween>();
  let alive=true,pressed:HTMLElement|null=null;
  const animate=(targets:gsap.TweenTarget,vars:gsap.TweenVars)=>{
   let t:gsap.core.Tween;
   t=gsap.to(targets,{...vars,onComplete:()=>{tweens.delete(t);}});tweens.add(t);return t;
  };
  const reveal=(nodes:HTMLElement[])=>{
   nodes.forEach((el,index)=>{
    if(!alive||!root.contains(el)||seen.has(el))return;
    seen.add(el);
    // Buttons only fade on entrance; their transform remains owned by hover/press.
    const interactive=el.matches(interactiveSelector);
    const movable=!interactive&&!el.classList.contains('highlight-card')&&el.dataset.motionReveal!=='rows';
    gsap.set(el,{opacity:.65,...(movable?{y:14}:{})});
    animate(el,{opacity:1,...(movable?{y:0}:{}),duration:motionTiming.reveal,delay:Math.min(index*.055,.165),ease:'power3.out',clearProps:movable?'opacity,transform':'opacity'});
   });
  };
  const observed=new Set<HTMLElement>();
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
   const ready=entries.filter(e=>e.isIntersecting).map(e=>e.target as HTMLElement);
   ready.forEach(el=>{observer?.unobserve(el);observed.delete(el);});reveal(ready);
  },{threshold:.08,rootMargin:'0px 0px -20px 0px'});
  const scan=(node:HTMLElement)=>{
   const selector='[data-motion-reveal], [data-motion-text], .panel-heading h2, .ratio-label, .ratio-group-heading h3, .query-toggle strong, .period-title h1, .comparison-scope-heading h2';
   const elements=[...(node.matches(selector)?[node]:[]),...node.querySelectorAll<HTMLElement>(selector)];
   elements.forEach(el=>{if(!el.closest('[data-metric-surface]')&&!seen.has(el)&&observer){observer.observe(el);observed.add(el);}});
  };
  const control=(target:EventTarget|null)=>target instanceof Element?target.closest<HTMLElement>(interactiveSelector):null;
  const enabled=(el:HTMLElement|null):el is HTMLElement=>Boolean(el&&root.contains(el)&&!el.matches(':disabled')&&!el.closest('[aria-busy="true"]'));
  const move=(el:HTMLElement,down=false,emphasized=false)=>{
   const previous=active.get(el);if(previous){previous.kill();tweens.delete(previous);}
   transformed.add(el);
   const lift=!el.hasAttribute('data-hover-surface')&&!el.closest('.category-list,.distribution-legend,.query-tabs');
   const t=animate(el,{y:!down&&emphasized&&lift?-1:0,scale:down ? .98 : 1,duration:down?motionTiming.press:motionTiming.hover,ease:'power2.out',overwrite:'auto'});
   active.set(el,t);
  };
  const resting=(el:HTMLElement)=>move(el,false,(canHover&&el.matches(':hover'))||el.matches(':focus-visible'));
  const enter=(e:PointerEvent)=>{if(!canHover||e.pointerType==='touch')return;const el=control(e.target);if(enabled(el)&&!(e.relatedTarget instanceof Node&&el.contains(e.relatedTarget)))move(el,false,true);};
  const leave=(e:PointerEvent)=>{const el=control(e.target);if(enabled(el)&&!(e.relatedTarget instanceof Node&&el.contains(e.relatedTarget))&&el!==pressed)move(el,false,el.matches(':focus-visible'));};
  const focus=(e:FocusEvent)=>{const el=control(e.target);if(enabled(el)&&el!==pressed&&el.matches(':focus-visible'))move(el,false,true);};
  const blur=(e:FocusEvent)=>{const el=control(e.target);if(el&&root.contains(el))move(el);};
  const down=(e:PointerEvent)=>{if(e.button!==0)return;const el=control(e.target);if(enabled(el)){pressed=el;move(el,true);}};
  const release=()=>{if(pressed){const el=pressed;pressed=null;if(root.contains(el)){if(enabled(el))resting(el);else move(el);}}};
  const keydown=(e:KeyboardEvent)=>{if(e.repeat||!['Enter',' '].includes(e.key))return;const el=control(e.target);if(enabled(el)){pressed=el;move(el,true);}};
  const keyup=(e:KeyboardEvent)=>{if(['Enter',' '].includes(e.key))release();};
  root.addEventListener('pointerover',enter);root.addEventListener('pointerout',leave);
  root.addEventListener('pointerdown',down);root.addEventListener('focusin',focus);root.addEventListener('focusout',blur);root.addEventListener('keydown',keydown);
  window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);window.addEventListener('keyup',keyup);window.addEventListener('blur',release);
  const changes=new MutationObserver(records=>{
   const updated=new Set<HTMLElement>();
   for(const record of records){
    record.addedNodes.forEach(n=>{if(n instanceof HTMLElement)scan(n);});
    const parent=record.target instanceof HTMLElement?record.target:record.target.parentElement;
    if(parent?.closest('[data-animated-number]'))continue;
    const metric=parent?.closest<HTMLElement>('[data-motion-update]');
    if(metric&&root.contains(metric))updated.add(metric);
   }
   for(const el of updated){
    const previous=updates.get(el);if(previous){previous.kill();tweens.delete(previous);}
    gsap.set(el,{opacity:.65});updates.set(el,animate(el,{opacity:1,duration:motionTiming.update,ease:'power2.out',clearProps:'opacity',overwrite:'auto'}));
   }
   for(const el of observed)if(!root.contains(el)){observer?.unobserve(el);observed.delete(el);}
   for(const [el,tween] of updates)if(!root.contains(el)){tween.kill();tweens.delete(tween);updates.delete(el);}
   for(const [el,tween] of active)if(!root.contains(el)){tween.kill();tweens.delete(tween);active.delete(el);transformed.delete(el);}
  });
  scan(root);changes.observe(root,{childList:true,subtree:true,characterData:true});
  return()=>{
   alive=false;observer?.disconnect();changes.disconnect();
   root.removeEventListener('pointerover',enter);root.removeEventListener('pointerout',leave);root.removeEventListener('pointerdown',down);root.removeEventListener('focusin',focus);root.removeEventListener('focusout',blur);root.removeEventListener('keydown',keydown);
   window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',release);
   tweens.forEach(t=>t.kill());active.clear();updates.clear();
   transformed.forEach(el=>gsap.set(el,{clearProps:'transform'}));
   root.querySelectorAll<HTMLElement>('.panel-heading h2,.ratio-label,.ratio-group-heading h3,.query-toggle strong,.period-title h1,.comparison-scope-heading h2').forEach(el=>gsap.set(el,{clearProps:'opacity,transform'}));
   root.querySelectorAll<HTMLElement>('[data-motion-reveal], [data-motion-update], [data-motion-text]').forEach(el=>gsap.set(el,{clearProps:el.matches(interactiveSelector)?'opacity':'opacity,transform'}));
  };
 });
 return()=>{media.revert();stopMetrics();};
}
