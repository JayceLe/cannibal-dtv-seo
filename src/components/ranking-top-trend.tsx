'use client';
import {useMemo,useState} from 'react';
import dynamic from 'next/dynamic';
import type {EChartsOption} from 'echarts';
import {number} from '@/lib/engine';
import {uiColors} from '@/lib/design';
import {tableBands,dayLabel,rankingSummary,sumRankingBands} from '@/lib/rankings';
const Chart=dynamic(()=>import('./chart'),{ssr:false});
type DaySummary=ReturnType<typeof rankingSummary>;
export default function RankingTopTrend({dates,timeline,category}:{dates:string[];timeline:DaySummary[];category:string}){
 const [selected,setSelected]=useState(()=>tableBands.map((_,i)=>i));
 const days=dates.slice(-5),stats=timeline.slice(-5);
 const option=useMemo<EChartsOption>(()=>({
  textStyle:{fontFamily:'Be Vietnam Pro',color:uiColors.muted},
  grid:{left:56,right:16,top:28,bottom:36},
  xAxis:{type:'category',data:days.map(dayLabel),axisLabel:{color:uiColors.muted,fontSize:11,formatter:(value:string)=>value.slice(0,5)},axisTick:{show:false},axisLine:{lineStyle:{color:uiColors.line}}},
  yAxis:{type:'value',minInterval:1,axisLabel:{color:uiColors.muted,formatter:(value:number)=>number(value)},splitLine:{lineStyle:{color:uiColors.line,type:'dashed'}}},
  tooltip:{trigger:'axis',confine:true,backgroundColor:'#ffffff',borderColor:uiColors.line,textStyle:{color:uiColors.text},extraCssText:'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border-radius: 8px;',valueFormatter:value=>number(Number(value))+' từ khóa'},
  series:[{name:'Tổng Top đã chọn',type:'bar',barMaxWidth:64,data:stats.map(s=>sumRankingBands(s.tableCounts,selected)),label:{show:true,position:'top',color:uiColors.text,fontWeight:600,formatter:p=>number(Number(p.value))},itemStyle:{color:selected.length===1?tableBands[selected[0]].color:uiColors.query,borderRadius:[3,3,0,0]},emphasis:{focus:'self'}}],
  aria:{enabled:true}
 }),[dates,timeline,selected]);
 return <section className="panel rank-top-trend" data-motion-reveal>
  <div className="rank-card-title"><h2>Thứ hạng theo ngày</h2><span>{category.replaceAll('_',' ')||'Tất cả DMC3'}</span></div>
  <div className="rank-top-filters" role="group" aria-label="Chọn nhóm Top để cộng tổng">
   <button type="button" aria-pressed={selected.length===tableBands.length} onClick={()=>setSelected(current=>current.length===tableBands.length?[]:tableBands.map((_,i)=>i))}>Tất cả</button>
   {tableBands.map((band,i)=><button type="button" key={band.name} aria-pressed={selected.includes(i)} onClick={()=>setSelected(old=>old.includes(i)?old.filter(n=>n!==i):[...old,i])}><i style={{background:band.color}}/>{band.name}</button>)}
  </div>
  <div className="rank-top-chart"><Chart label="Tổng số từ khóa của các nhóm Top đã chọn theo 5 ngày gần nhất trong khoảng ngày" option={option} height={280}/></div>
  {!selected.length?<p className="rank-top-hint" role="status">Chọn ít nhất một nhóm Top để xem số liệu.</p>:null}
 </section>;
}
