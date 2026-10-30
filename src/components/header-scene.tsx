'use client';
import {useEffect,useRef} from 'react';
import {mountHeaderScene} from '@/lib/header-scene-lifecycle';
export default function HeaderScene(){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const host=ref.current,header=host?.closest('header');
  return host&&header?mountHeaderScene(host,header):undefined;
 },[]);
 return <div ref={ref} className="header-scene" aria-hidden="true"/>;
}
