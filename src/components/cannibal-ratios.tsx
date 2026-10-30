'use client';
import AnimatedNumber from './animated-number';
import {ratioComparisons,type CategoryStat} from '@/lib/overview';
import Dmc3Picker from './dmc3-picker';
import {decimal,type Summary} from '@/lib/engine';
export default function CannibalRatios({scoped,site,category,categories,onSelect,loading=false}:{scoped:Summary;site:Summary;category:string;categories:CategoryStat[];onSelect:(category:string)=>void;loading?:boolean}){
 const groups=ratioComparisons(scoped,site,category);
 return <section id="dmc3-analysis" className="panel cannibal-ratios" aria-labelledby="ratios-title" aria-busy={loading}>
 <div className="ratio-section-heading"><h2 id="ratios-title" data-motion-text>Tỷ lệ cannibal</h2><Dmc3Picker categories={categories} value={category} onChange={onSelect}/></div>
 <div className="ratio-groups" data-scope={category?'category':'site'}>{groups.map(g=><div className="ratio-comparison" data-denominator={g.denominator==='toàn site'?'site':'group'} key={g.title}><div className="ratio-group-heading"><h3>{category?(g.denominator==='toàn site'?'DMC3 so với toàn site':'Trong DMC3'):'Toàn site'}</h3>{g.denominator!=='toàn site'?<span>{category.replaceAll('_',' ')}</span>:null}</div><div className="ratio-pair"><RatioMetric label="Query cannibal" numerator={g.query.numerator} denominator={g.query.denominator} denominatorLabel={`query ${g.denominator==='toàn site'?'toàn site':'trong DMC3'}`} tone="query"/><RatioMetric label="Impression cannibal" numerator={g.impression.numerator} denominator={g.impression.denominator} denominatorLabel={`impression ${g.denominator==='toàn site'?'toàn site':'trong DMC3'}`} tone="impression"/></div></div>)}</div></section>;
}
function RatioMetric({label,numerator,denominator,denominatorLabel,tone}:{label:string;numerator:number;denominator:number;denominatorLabel:string;tone:'query'|'impression'}){
 const percent=denominator>0?numerator/denominator*100:null,angle=Math.max(0,Math.min(percent??0,100));
 return <div className={`ratio-metric ${tone}`} data-motion-reveal data-hover-surface data-metric-surface><div className="ratio-visual" role="img" aria-label={`${label}: ${percent==null?'chưa có dữ liệu':decimal(percent,2)+'%'}`}><svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true"><circle className="ratio-track" cx="56" cy="56" r="45"/><circle className="ratio-progress" data-ratio-progress={angle} cx="56" cy="56" r="45" pathLength="100" strokeDasharray={`${angle} ${100-angle}`} transform="rotate(-90 56 56)"/></svg><strong><AnimatedNumber value={percent} digits={2} suffix="%"/></strong></div><div className="ratio-copy" data-motion-update><span className="ratio-label">{label}</span><div className="ratio-fraction"><strong><AnimatedNumber value={numerator}/></strong><span className="ratio-denominator">/ <AnimatedNumber value={denominator}/></span></div><span className="ratio-denominator-label">{denominator>0?denominatorLabel:'Chưa có dữ liệu'}</span></div></div>;
}
