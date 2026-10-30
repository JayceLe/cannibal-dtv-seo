'use client';
import {categoryColor} from '@/lib/categories';
import type {CategoryStat} from '@/lib/overview';
import SearchPicker from './search-picker';
export default function Dmc3Picker({categories,value,onChange}:{categories:CategoryStat[];value:string;onChange:(name:string)=>void}){
 return <SearchPicker label="DMC3" options={[{value:'',label:'Tất cả'},...categories.map(c=>({value:c.name,label:c.name.replaceAll('_',' '),color:categoryColor(c.name)}))]} value={value} onChange={onChange}/>;
}
