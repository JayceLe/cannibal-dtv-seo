'use client';
import {useState} from 'react';
import {Search} from 'lucide-react';
import {number,queryKey} from '@/lib/engine';
import {categoryColor} from '@/lib/categories';
import type {CategoryStat} from '@/lib/overview';
export default function CategorySidebar({categories,selected,total,onSelect}:{categories:CategoryStat[];selected:string;total:number;onSelect:(name:string)=>void}){
 const [search,setSearch]=useState('');
 return <><label className="mobile-category-select">Chọn DMC3<select value={selected} onChange={e=>onSelect(e.target.value)}><option value="">Tất cả DMC3 ({number(total)})</option>{categories.map(c=><option value={c.name} key={c.name}>{c.name.replaceAll('_',' ')} ({number(c.cannibal)})</option>)}</select></label><aside className="panel category-sidebar" data-motion-reveal data-hover-surface aria-label="Chọn DMC3"><header><h3>Lọc theo DMC3</h3><span>{categories.length} nhóm</span></header><label className="search-field"><Search size={17}/><input aria-label="Tìm nhóm DMC3" placeholder="Tìm nhóm DMC3…" value={search} onChange={e=>setSearch(e.target.value)}/></label><p className="sidebar-caption">Số query cannibal trong nhóm</p><div className="category-list" role="group" aria-label="Lọc theo DMC3"><button className={!selected?'active':''} aria-pressed={!selected} onClick={()=>onSelect('')}><span><i className="all-category-dot"/>Tất cả DMC3</span><b>{number(total)}</b></button>{categories.filter(c=>queryKey(c.name).includes(queryKey(search))).map(c=><button key={c.name} style={{'--category-color':categoryColor(c.name)} as React.CSSProperties} className={selected===c.name?'active':''} aria-pressed={selected===c.name} title={`${c.name}: ${number(c.cannibal)} cannibal / ${number(c.total)} query đã map`} onClick={()=>onSelect(c.name)}><span><i style={{background:categoryColor(c.name)}}/>{c.name.replaceAll('_',' ')}</span><b>{number(c.cannibal)}</b></button>)}</div></aside></>;
}
