import type {ComparisonCategory,ComparisonData} from './comparison';
import {decimal} from './engine';
export type ComparisonMetric='query'|'impression';
export const signed=(value:number,format:(n:number)=>string)=>`${value>0?'+':value<0?'−':''}${format(Math.abs(value))}`;
export const rate=(part:number,total:number)=>total>0?part/total*100:0;
export function pointChange(value:number){
 if(Math.abs(value)<1e-10)return 'Không đổi';
 return Math.abs(value)<.01?`${value>0?'Tăng':'Giảm'} <0,01 điểm %`:`${signed(value,n=>decimal(n,2))} điểm %`;
}
export function groupChanges(categories:ComparisonCategory[]){
 const observed=categories.filter(c=>c.old_total>0||c.new_total>0);
 const improved=observed.filter(c=>c.delta<0),worsened=observed.filter(c=>c.delta>0);
 const drop=improved.slice().sort((a,b)=>a.delta-b.delta||a.name.localeCompare(b.name,'vi'))[0]??null;
 const rise=worsened.slice().sort((a,b)=>b.delta-a.delta||a.name.localeCompare(b.name,'vi'))[0]??null;
 const impression=observed.filter(c=>c.affected_delta!==0).sort((a,b)=>Math.abs(b.affected_delta)-Math.abs(a.affected_delta)||a.name.localeCompare(b.name,'vi'))[0]??null;
 return {total:observed.length,improved:improved.length,worsened:worsened.length,unchanged:observed.length-improved.length-worsened.length,remaining:observed.filter(c=>c.new>0).length,drop,rise,dropTies:drop?improved.filter(c=>c.delta===drop.delta).length:0,riseTies:rise?worsened.filter(c=>c.delta===rise.delta).length:0,impression};
}
export function snapshotValues(data:ComparisonData,metric:ComparisonMetric){
 const query=metric==='query';
 const old=query?data.old.cannibal:data.old.affectedImpressions,next=query?data.new.cannibal:data.new.affectedImpressions;
 return {old,next,delta:next-old,oldRate:rate(old,query?data.old.withData:data.old.impressions),newRate:rate(next,query?data.new.withData:data.new.impressions)};
}
