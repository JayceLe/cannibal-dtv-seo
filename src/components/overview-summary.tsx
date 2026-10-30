'use client';
import AnimatedNumber from './animated-number';
import {Layers3,TrendingDown,TrendingUp,Eye} from 'lucide-react';
import {decimal,number} from '@/lib/engine';
import {overviewHighlights,type CategoryStat} from '@/lib/overview';
import {categoryColor} from '@/lib/categories';
export default function OverviewSummary({categories,siteCannibal,onSelect}:{categories:CategoryStat[];siteCannibal:number;onSelect:(name:string)=>void}){
 const h=overviewHighlights(categories,siteCannibal);
 const cards=[
  {label:'Số DMC3 bị cannibal',value:h.totalGroups?h.affected:null,denominator:h.totalGroups?number(h.totalGroups):'',group:'',name:'',tone:'overview-total',icon:Layers3},
  {label:'Nhóm cannibal cao nhất',value:h.highest?.percent??null,denominator:'',group:h.highest?.name.replaceAll('_',' ')||'Chưa có dữ liệu',name:h.highest?.name||'',tone:'overview-high',icon:TrendingUp},
  {label:'Nhóm cannibal thấp nhất',value:h.lowest?.percent??null,denominator:'',group:h.lowest?.name.replaceAll('_',' ')||'Chưa có dữ liệu',name:h.lowest?.name||'',tone:'overview-low',icon:TrendingDown},
  {label:'Impression cannibal lớn nhất',value:h.topImpressions?.cannibalImpressions??null,denominator:'',group:h.topImpressions?.name.replaceAll('_',' ')||'Chưa có dữ liệu',name:h.topImpressions?.name||'',tone:'overview-impression',icon:Eye}
 ];
 return <div className="overview-highlights">{cards.map(c=>{const Icon=c.icon;const isTotal=c.tone==='overview-total';return <button type="button" key={c.label} data-motion-reveal data-hover-surface data-metric-surface className={`highlight-card ${c.tone}`} onClick={()=>onSelect(c.name)}><span className="highlight-label" data-motion-text>{c.label}<Icon size={16} aria-hidden="true"/></span><strong className="highlight-main" data-motion-text>{!isTotal&&c.name?<i style={{background:categoryColor(c.name)}}/>:null}<span title={isTotal?String(c.value??'—'):c.group}>{isTotal?<AnimatedNumber value={c.value}/>:c.group}</span></strong><span className="highlight-footer" data-motion-update>{isTotal?(c.denominator?`Trên tổng ${c.denominator} DMC3`:'Chưa có danh mục DMC3'):<><AnimatedNumber value={c.value} digits={c.tone==='overview-impression'?0:2} suffix={c.tone==='overview-impression'?'':'%'}/>{c.tone==='overview-impression'?' impression':''}</>}</span></button>;})}</div>;
}
