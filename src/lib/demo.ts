import { buildRecords, summary, type Keyword, type Metric } from './engine';
import {knownCategories} from './categories';
export const demoCategories=knownCategories;
const queries=['sửa camera iphone','điện thoại cũ','ép kính samsung','ép kính iphone','iphone cũ','thay màn hình macbook','thay pin macbook','thay bàn phím laptop','sửa loa laptop','sửa main laptop','thay màn hình laptop','thay ổ cứng laptop','thay pin laptop','nâng cấp ram laptop','thay sạc laptop','sửa loa iphone','sửa main iphone','thay màn hình samsung','thay màn hình iphone','oppo cũ','thay pin samsung','thay pin iphone','redmi cũ','thay chân sạc iphone','samsung cũ','thay vỏ iphone','xiaomi cũ'];
export const demoBase: Keyword[] = Array.from({length:480},(_,i)=>{const group=i%demoCategories.length;const query=`${queries[group]} ${8+Math.floor(i/demoCategories.length)}`;return {key:query.toLowerCase(),query,categories:[demoCategories[group]]};});
export function demoRecords(week=7) {
 const metrics: Metric[]=[];
 demoBase.forEach((k,i)=>{
  if(i%19===0)return;
  const imp = 350+(i*379+week*137)%9000;
  const competition = (i+week)%5<2;
  const pos=competition ? ((i%3===0)?2.1:4.2+i%12) : 1.3+i%7;
  const secondRatio = competition ? .27+(i%5)*.12 : .08;
  for(let j=0;j<(i%7===0?3:2);j++) {
   const impressions = Math.round(imp*(j?secondRatio/j:1)); const p=pos+(j?(.3+(i%4)*.6):0);
   metrics.push({key:k.key,url:`https://example.com/${j?'dich-vu/':''}${k.key.replaceAll(' ','-')}${j===2?'-chinh-hang':''}`,impressions,clicks:Math.round(impressions*(.015+(i%7)/120)),weighted_position:impressions*p,position_weight:impressions,missing_rank:0,invalid_rows:0});
  }
 });
 return buildRecords(demoBase,metrics);
}
export const demoWeeks = Array.from({length:8},(_,i)=>({id:`demo-${i}`,week_start:`2026-${i<4?'09':'10'}-${String(i<4?7+i*7:5+(i-4)*7).padStart(2,'0')}`,file_name:'Dữ liệu minh họa',status:'ready',summary:summary(demoRecords(i)),created_at:''}));
