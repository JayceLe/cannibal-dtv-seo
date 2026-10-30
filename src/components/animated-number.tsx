'use client';
import {useEffect,useRef} from 'react';
import {gsap} from 'gsap';

export default function AnimatedNumber({value,digits=0,suffix='',instant=false}:{value:number|null;digits?:number;suffix?:string;instant?:boolean}){
 const formatter=new Intl.NumberFormat('vi-VN',{maximumFractionDigits:digits});
 const label=value==null||!Number.isFinite(value)?'—':formatter.format(value)+suffix;
 const node=useRef<HTMLSpanElement>(null),current=useRef<number|null>(null),shown=useRef(false);
 useEffect(()=>{
  const el=node.current!;const mq=matchMedia('(prefers-reduced-motion: reduce)');let tween:gsap.core.Tween|undefined,observer:IntersectionObserver|undefined,alive=true;
  const finish=()=>{tween?.kill();el.textContent=label;current.current=value;};
  const play=()=>{
   if(!alive)return;observer?.disconnect();
   const first=!shown.current;shown.current=true;
   if(value==null||!Number.isFinite(value)||instant||mq.matches){finish();return;}
   const from=first?0:current.current??0;
   const state={value:from};
   tween=gsap.to(state,{value,duration:.72,ease:'power2.out',onUpdate:()=>{current.current=state.value;el.textContent=formatter.format(digits===0?Math.round(state.value):state.value)+suffix;},onComplete:finish});
  };
  const preference=()=>{if(mq.matches){observer?.disconnect();finish();}};
  mq.addEventListener('change',preference);
  if(shown.current||mq.matches||instant||typeof IntersectionObserver==='undefined')play();
  else{observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))play();},{threshold:.1});observer.observe(el);}
  return()=>{alive=false;tween?.kill();observer?.disconnect();mq.removeEventListener('change',preference);};
 // The formatter is derived only from digits; do not restart for parent-only rerenders.
 },[value,digits,suffix,instant,label]);
 return <span className="animated-number" data-animated-number aria-label={label}><span className="number-reserve" aria-hidden="true">{label}</span><span className="number-display" aria-hidden="true" ref={node}>{label}</span></span>;
}
