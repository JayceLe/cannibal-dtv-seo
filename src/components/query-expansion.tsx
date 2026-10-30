'use client';
import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {gsap} from 'gsap';
import {motionTiming} from '@/lib/dashboard-motion';

/** Keep the row mounted until close completes; interruption continues from the current height. */
export default function QueryExpansion({open,id,children}:{open:boolean;id:string;children:ReactNode}){
 const [present,setPresent]=useState(open);
 const ref=useRef<HTMLDivElement>(null),started=useRef(false);
 useLayoutEffect(()=>{if(open)setPresent(true);},[open]);
 useLayoutEffect(()=>{
  const node=ref.current;if(!node)return;
  const mq=window.matchMedia('(prefers-reduced-motion: reduce)');
  let tween:gsap.core.Tween|undefined;
  const settle=()=>{
   tween?.kill();
   gsap.set(node,{clearProps:'height,opacity'});
   if(!open){started.current=false;setPresent(false);}
  };
  if(mq.matches)settle();
  else{
   if(!started.current&&open){gsap.set(node,{height:0,opacity:.7});started.current=true;}
   tween=gsap.to(node,{height:open?'auto':0,opacity:open?1:.7,duration:open?motionTiming.open:motionTiming.close,ease:open?'power3.out':'power2.inOut',overwrite:'auto',onComplete:settle});
  }
  const preference=()=>{if(mq.matches)settle();};
  mq.addEventListener('change',preference);
  return()=>{tween?.kill();mq.removeEventListener('change',preference);};
 },[open,present]);
 if(!present)return null;
 return <tr className="detail-row" id={id} aria-hidden={!open||undefined}><td colSpan={6}><div className="query-expansion" ref={ref} inert={!open||undefined}>{children}</div></td></tr>;
}
