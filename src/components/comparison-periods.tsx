'use client';
import {ArrowRight,Upload} from 'lucide-react';
import {distinctDays,selectComparisonDay,validComparisonDays,type Week} from '@/lib/comparison';
import {formatDataDate} from '@/lib/dates';
import SelectMenu from './select-menu';
export default function ComparisonPeriods({weeks,older,newer,onChange,onImport}:{weeks:Week[];older:string;newer:string;onChange:(pair:{older:string;newer:string})=>void;onImport:()=>void}){
 const days=distinctDays(weeks),valid=validComparisonDays(weeks,older,newer);
 const options=days.map(w=>({value:w.id,label:formatDataDate(w.week_start)}));
 return <section className="panel comparison-periods" aria-label="Chọn hai ngày so sánh" data-motion-reveal><div className="period-title"><h1>So sánh cannibal</h1><span>{valid?'Ngày trước → Ngày sau':`${days.length} ngày dữ liệu`}</span></div><div className="period-selectors"><SelectMenu label="Ngày trước" placeholder="Chọn ngày trước" options={options.filter(o=>o.value!==days[0]?.id)} value={older} onChange={id=>onChange(selectComparisonDay(weeks,{older,newer},'older',id))}/><ArrowRight size={20} aria-hidden="true"/><SelectMenu label="Ngày sau" placeholder="Chọn ngày sau" options={options.filter(o=>days.length<2||o.value!==days.at(-1)?.id)} value={newer} onChange={id=>onChange(selectComparisonDay(weeks,{older,newer},'newer',id))}/></div>{!valid?<div className="comparison-notice"><span>{days.length<2?'Cần ít nhất hai ngày dữ liệu để so sánh.':'Chọn hai ngày khác nhau để xem biến động.'}</span>{days.length<2?<button className="btn secondary" onClick={onImport}><Upload size={16}/>Import ngày khác</button>:null}</div>:null}</section>;
}
