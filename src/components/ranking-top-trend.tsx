'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {number} from '@/lib/engine';
import {categoryColor} from '@/lib/categories';
import {tableBands,dayLabel,rankingCategoryTimeline,rankingPercent,rankingSummary,sumRankingBands,type Ranking} from '@/lib/rankings';

type DaySummary=ReturnType<typeof rankingSummary>;
export default function RankingTopTrend({dates,timeline,rows,categories,category}:{dates:string[];timeline:DaySummary[];rows:Ranking[];categories:string[];category:string}){
 const [selected,setSelected]=useState(()=>tableBands.map((_,i)=>i));
 const days=dates;
 const scroll=useRef<HTMLDivElement>(null);
 useEffect(()=>{const el=scroll.current;if(el)el.scrollLeft=el.scrollWidth-el.clientWidth;},[dates]);
 const groups=useMemo(()=>rankingCategoryTimeline(rows,days,category?[category]:categories).filter(group=>group.category!=='Chưa map DMC3'),[rows,days,categories,category]);
 const cell=(counts:number[],total:number)=>{
  const count=sumRankingBands(counts,selected);
  return <><strong>{number(count)}</strong><small>{rankingPercent(total?count/total*100:0)}</small></>;
 };
 return <section className="panel rank-top-trend" aria-labelledby="rank-dmc3-title" data-motion-reveal>
  <div className="rank-card-title"><h2 id="rank-dmc3-title">Thứ hạng theo ngày</h2><span>{category.replaceAll('_',' ')||'Tất cả DMC3'}</span></div>
  <div className="rank-top-filters" role="group" aria-label="Chọn nhóm Top để cộng tổng">
   <button type="button" aria-pressed={selected.length===tableBands.length} onClick={()=>setSelected(current=>current.length===tableBands.length?[]:tableBands.map((_,i)=>i))}>Tất cả</button>
   {tableBands.map((band,i)=><button type="button" key={band.name} aria-pressed={selected.includes(i)} onClick={()=>setSelected(old=>old.includes(i)?old.filter(n=>n!==i):[...old,i])}><i aria-hidden="true" style={{background:band.color}}/>{band.name}</button>)}
  </div>
  <div ref={scroll} className="rank-dmc3-scroll" role="region" aria-label="Thứ hạng theo DMC3, cuộn ngang để xem đủ ngày" tabIndex={0}>
   <table className="rank-dmc3-table" style={{width:`calc(180px + (100% - 180px) * ${Math.max(4,days.length)} / 4)`,minWidth:180+days.length*132}}>
    <caption className="sr-only">Số từ khóa trong các Top đã chọn và tỷ lệ trên tổng từ khóa của từng DMC3, 4 ngày hiển thị trong khung; cuộn ngang để xem các ngày còn lại trong khoảng ngày đã chọn.</caption>
    <colgroup><col style={{width:180}}/>{days.map(date=><col key={date}/>)}</colgroup>
    <thead><tr><th scope="col">DMC3</th>{days.map(date=><th key={date} scope="col"><time dateTime={date} title={dayLabel(date)}>{days.every(d=>d.slice(0,4)===date.slice(0,4))?dayLabel(date).slice(0,5):dayLabel(date)}</time></th>)}</tr></thead>
    <tbody>
     {!category?<tr className="rank-dmc3-total"><th scope="row">Tất cả DMC3</th>{timeline.map((stat,i)=><td key={days[i]}>{cell(stat.tableCounts,rows.length)}</td>)}</tr>:null}
     {groups.map(group=><tr key={group.category}><th scope="row"><span className="rank-dmc3-name"><i aria-hidden="true" style={{background:categoryColor(group.category)}}/>{group.category.replaceAll('_',' ')}</span></th>{group.counts.map((counts,i)=><td key={days[i]}>{cell(counts,group.total)}</td>)}</tr>)}
    </tbody>
   </table>
  </div>
 </section>;
}
