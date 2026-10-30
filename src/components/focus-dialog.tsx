'use client';
import {useEffect,useId,useRef,type ReactNode} from 'react';
import {gsap} from 'gsap';
import {X} from 'lucide-react';
export default function FocusDialog({title:heading,status,onClose,children,className='',closeLabel='Đóng chi tiết từ khóa'}:{title:string;status?:ReactNode;onClose:()=>void;children:ReactNode;className?:string;closeLabel?:string}){
 const ref=useRef<HTMLDialogElement>(null),title=useId();
 useEffect(()=>{
  const dialog=ref.current!,overflow=document.documentElement.style.overflow;
  document.documentElement.style.overflow='hidden';dialog.showModal();
  const mq=matchMedia('(prefers-reduced-motion: reduce)');
  const tween=mq.matches?null:gsap.fromTo(dialog,{opacity:.8,y:10},{opacity:1,y:0,duration:.28,ease:'power3.out',clearProps:'opacity,transform'});
  const stop=()=>{if(mq.matches){tween?.kill();gsap.set(dialog,{clearProps:'opacity,transform'});}};mq.addEventListener('change',stop);
  return()=>{tween?.kill();mq.removeEventListener('change',stop);dialog.close();document.documentElement.style.overflow=overflow;};
 },[]);
 return <dialog ref={ref} className={`query-detail-dialog ${className}`} aria-labelledby={title} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current){const r=ref.current!.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}><header className="query-dialog-heading"><div><h2 id={title}>{heading}</h2>{status}</div><button type="button" className="icon-button" aria-label={closeLabel} onClick={onClose} autoFocus><X size={22}/></button></header>{children}</dialog>;
}
