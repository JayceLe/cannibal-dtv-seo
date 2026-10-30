'use client';
import {useEffect,useRef} from 'react';
import * as echarts from 'echarts/core';
import {LineChart,PieChart,BarChart,SankeyChart} from 'echarts/charts';
import {GridComponent,TooltipComponent,LegendComponent,AriaComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
import type {EChartsOption} from 'echarts';
import {highlightDonut} from '@/lib/chart-interactions';
echarts.use([LineChart,PieChart,BarChart,SankeyChart,GridComponent,TooltipComponent,LegendComponent,AriaComponent,SVGRenderer]);
export default function Chart({option,label,height=250,onPick,onHover,highlightedName}:{option:EChartsOption;label:string;height?:number;onPick?:(name:string)=>void;onHover?:(name:string|null)=>void;highlightedName?:string|null}){
 const el=useRef<HTMLDivElement>(null),instance=useRef<echarts.EChartsType|null>(null),callback=useRef({onPick,onHover});callback.current={onPick,onHover};
 useEffect(()=>{
  const chart=echarts.init(el.current!,undefined,{renderer:'svg'});instance.current=chart;
  const mq=matchMedia('(prefers-reduced-motion: reduce)');
  const motion=()=>{chart.setOption({animation:!mq.matches,animationDuration:480,animationDurationUpdate:320,animationEasing:'cubicOut',animationEasingUpdate:'cubicOut',stateAnimation:{duration:mq.matches?0:240,easing:'cubicOut'}});if(mq.matches)chart.getZr().animation.clear();};
  motion();mq.addEventListener('change',motion);
  chart.on('click',p=>{if(typeof p.name==='string')callback.current.onPick?.(p.name);});
  chart.on('mouseover',p=>{if(p.componentType==='series'&&typeof p.name==='string')callback.current.onHover?.(p.name);});
  chart.on('globalout',()=>callback.current.onHover?.(null));
  const resize=new ResizeObserver(()=>chart.resize());resize.observe(el.current!);
  return()=>{resize.disconnect();mq.removeEventListener('change',motion);chart.dispose();instance.current=null;};
 },[]);
 useEffect(()=>{
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  instance.current?.setOption({...option,animation:!reduced,animationDuration:480,animationDurationUpdate:320,animationEasing:'cubicOut',animationEasingUpdate:'cubicOut',stateAnimation:{duration:reduced?0:240,easing:'cubicOut'}},{notMerge:true});
 },[option]);
 useEffect(()=>{if(instance.current&&highlightedName!==undefined)highlightDonut(instance.current,highlightedName);},[highlightedName,option]);
 return <div role="img" aria-label={label} ref={el} style={{height,width:'100%',minWidth:0}}/>;
}
