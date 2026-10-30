'use client';
import AnimatedNumber from './animated-number';
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import dynamic from 'next/dynamic';
import {donutOption,revealLegendItem} from '@/lib/chart-interactions';
import {categoryShares,type CategoryStat} from '@/lib/overview';
import {categoryColor} from '@/lib/categories';
import {decimal,number} from '@/lib/engine';
const Chart=dynamic(()=>import('./chart'),{ssr:false,loading:()=> <div className="chart-loading" aria-label="Đang nạp biểu đồ"/>});
export function CategoryDistributions({categories,selected,onSelect}:{categories:CategoryStat[];selected:string;onSelect:(name:string)=>void}){
 const [hovered,setHovered]=useState<string|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const hover=useCallback((name:string|null)=>{
  if(timer.current)clearTimeout(timer.current);
  if(name)setHovered(name);else timer.current=setTimeout(()=>setHovered(null),90);
 },[]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 return <div className="distribution-grid"><CategoryDonut categories={categories} metric="cannibal" selected={selected} onSelect={onSelect} hoveredName={hovered} onHover={hover}/><CategoryDonut categories={categories} metric="cannibalImpressions" selected={selected} onSelect={onSelect} hoveredName={hovered} onHover={hover}/></div>;
}
export function CategoryDonut({categories,metric,selected,onSelect,hoveredName,onHover}:{categories:CategoryStat[];metric:'cannibal'|'cannibalImpressions';selected:string;onSelect:(name:string)=>void;hoveredName?:string|null;onHover?:(name:string|null)=>void}){
 const [localHover,setLocalHover]=useState<string|null>(null);
 const legend=useRef<HTMLDivElement>(null),items=useRef(new Map<string,HTMLButtonElement>()),focused=useRef<string|null>(null);
 const shares=useMemo(()=>categoryShares(categories,metric).map(c=>({...c,color:categoryColor(c.name)})).filter(c=>c.value>0).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,'vi')),[categories,metric]);
 const total=shares.reduce((n,c)=>n+c.value,0),isQuery=metric==='cannibal',unit=isQuery?'query':'impression';
 const active=shares.find(c=>c.name===(hoveredName===undefined?localHover:hoveredName))??null;
 const hover=(name:string|null)=>{const next=name??focused.current;if(onHover)onHover(next);else setLocalHover(next);};
 const option=useMemo(()=>donutOption(shares),[shares]);
 useEffect(()=>{
  const row=active?items.current.get(active.name):null;
  return legend.current&&row?revealLegendItem(legend.current,row):undefined;
 },[active?.name,shares]);
 return <section className={`panel distribution-card ${active?'has-highlight':''}`} data-motion-reveal data-hover-surface onPointerLeave={()=>hover(null)}>
  <div className="panel-heading"><h2>{isQuery?'Tỷ trọng query cannibal theo DMC3':'Tỷ trọng impression cannibal theo DMC3'}</h2></div>
  <div className="distribution-body"><div className="distribution-ring"><Chart option={option} label={`${unit} cannibal theo DMC3: ${shares.map(c=>`${c.name}: ${decimal(c.percent,2)}%`).join(', ')}`} height={244} onPick={onSelect} onHover={hover} highlightedName={active?.name??null}/><div className="donut-center" aria-hidden="true"><strong><AnimatedNumber value={active?active.percent:total} digits={active?2:0} suffix={active?'%':''} instant={Boolean(active)}/></strong><span>{active?'tỷ trọng DMC3':unit+' cannibal'}</span></div></div>
  <div className="legend-area"><div className="legend-heading"><span>{shares.length} nhóm có cannibal</span><span>Tỷ trọng</span></div><div ref={legend} className={`distribution-legend ${active?'is-exploring':''}`} aria-label={`Tỷ trọng ${unit} cannibal theo DMC3`}>{shares.length?shares.map(c=><button key={c.name} ref={el=>{if(el)items.current.set(c.name,el);else items.current.delete(c.name);}} style={{'--category-color':c.color} as CSSProperties} className={`${selected===c.name?'selected':''} ${active?.name===c.name?'is-highlighted':active?'is-dimmed':''}`} aria-label={`${c.name}: ${decimal(c.percent,2)}%, ${number(c.value)} ${unit} cannibal`} onPointerEnter={()=>hover(c.name)} onFocus={e=>{focused.current=e.currentTarget.matches(':focus-visible')?c.name:null;hover(c.name);}} onBlur={()=>{focused.current=null;hover(null);}} onClick={()=>onSelect(c.name)}><i style={{background:c.color}}/><span>{c.name.replaceAll('_',' ')}</span><strong><AnimatedNumber value={c.percent} digits={2} suffix="%"/></strong></button>):<p className="chart-no-data">Chưa có cannibal trong kỳ này.</p>}</div></div></div>
  <div className={`distribution-detail ${active?'is-active':''}`} style={active?{'--category-color':active.color} as CSSProperties:undefined}><div><i style={{background:active?.color??'var(--accent)'}}/><strong>{active?.name.replaceAll('_',' ')||'Tất cả DMC3'}</strong></div><strong className="distribution-value"><AnimatedNumber value={active?.value??total} instant={Boolean(active)}/><span>{unit} cannibal</span></strong></div>
 </section>;
}
