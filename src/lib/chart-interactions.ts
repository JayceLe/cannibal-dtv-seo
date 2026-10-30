import {gsap} from 'gsap';
import {uiColors} from './design';
import type {EChartsOption} from 'echarts';
export type DonutShare={name:string;value:number;percent:number;color:string};
export function donutOption(shares:DonutShare[]):EChartsOption{
 return {textStyle:{fontFamily:'Be Vietnam Pro',fontWeight:600},tooltip:{show:false},series:[{
  id:'dmc3-share',type:'pie',radius:['73%','92%'],center:['50%','50%'],
  label:{show:false},labelLine:{show:false},emptyCircleStyle:{color:uiColors.line},
  itemStyle:{borderWidth:2,borderColor:uiColors.surface,borderRadius:2},
  emphasis:{focus:'self',blurScope:'series',scale:true,scaleSize:5,itemStyle:{opacity:1,borderColor:uiColors.focus,borderWidth:2}},
  blur:{itemStyle:{opacity:.22}},
  data:shares.map(c=>({name:c.name,value:c.value,itemStyle:{color:c.color}}))
 }]};
}
export function highlightDonut(chart:{dispatchAction:(action:{type:string;seriesIndex:number;name?:string})=>void},name:string|null){
 chart.dispatchAction({type:'downplay',seriesIndex:0});
 if(name)chart.dispatchAction({type:'highlight',seriesIndex:0,name});
}
/** Scroll only the legend viewport, never the page or another enclosing scroll area. */
export function revealLegendItem(container:HTMLElement,item:HTMLElement){
 const viewport=container.getBoundingClientRect(),row=item.getBoundingClientRect();
 if(row.top>=viewport.top+4&&row.bottom<=viewport.bottom-4)return()=>{};
 const top=Math.max(0,Math.min(container.scrollHeight-container.clientHeight,container.scrollTop+row.top-viewport.top-(container.clientHeight-row.height)/2));
 const mq=matchMedia('(prefers-reduced-motion: reduce)');
 let tween:gsap.core.Tween|undefined;
 const stop=()=>tween?.kill();
 const settle=()=>{stop();container.scrollTop=top;};
 if(mq.matches)settle();else tween=gsap.to(container,{scrollTop:top,duration:.36,ease:'power2.out',overwrite:'auto'});
 const preference=()=>{if(mq.matches)settle();};
 mq.addEventListener('change',preference);
 // Direct scrolling has priority over programmatic tracking.
 container.addEventListener('wheel',stop,{passive:true});container.addEventListener('touchstart',stop,{passive:true});container.addEventListener('pointerdown',stop);
 return()=>{stop();mq.removeEventListener('change',preference);container.removeEventListener('wheel',stop);container.removeEventListener('touchstart',stop);container.removeEventListener('pointerdown',stop);};
}
