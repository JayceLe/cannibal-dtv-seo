'use client';
import {CalendarDays} from 'lucide-react';
import {formatDataDate} from '@/lib/dates';
import SelectMenu from './select-menu';
type Period={id:string;week_start:string};
export default function HeaderDateSelect({periods,value,onChange}:{periods:Period[];value:string;onChange:(id:string)=>void}){
 return <SelectMenu className="header-date-menu" label="Chọn ngày dữ liệu" hideLabel value={value} onChange={onChange} placeholder="Chọn ngày" icon={<CalendarDays size={18}/>} options={periods.map(p=>({value:p.id,label:formatDataDate(p.week_start)}))}/>;
}
