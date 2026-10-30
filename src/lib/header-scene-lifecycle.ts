type SceneFactory={createHeaderScene:(host:HTMLElement,header:HTMLElement)=>()=>void};
/** Discards asynchronous loads after unmount, preference changes, visibility or viewport changes. */
export function mountHeaderScene(host:HTMLElement,header:HTMLElement,load:()=>Promise<SceneFactory>=()=>import('./header-scene')){
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),desktop=matchMedia('(min-width: 768px)');
 let alive=true,generation=0,inView=true,dispose:(()=>void)|undefined;
 const reconcile=()=>{
  const version=++generation;dispose?.();dispose=undefined;
  if(!alive||motion.matches||!desktop.matches||!inView||document.hidden)return;
  void load().then(({createHeaderScene})=>{
   if(alive&&version===generation)dispose=createHeaderScene(host,header);
  }).catch(()=>{/* Static header remains usable if WebGL cannot initialize. */});
 };
 const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{const next=entries[0]?.isIntersecting??false;if(next!==inView){inView=next;reconcile();}});
 observer?.observe(header);
 motion.addEventListener('change',reconcile);desktop.addEventListener('change',reconcile);document.addEventListener('visibilitychange',reconcile);
 reconcile();
 return()=>{alive=false;++generation;dispose?.();observer?.disconnect();motion.removeEventListener('change',reconcile);desktop.removeEventListener('change',reconcile);document.removeEventListener('visibilitychange',reconcile);};
}
