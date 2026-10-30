import {type Summary,type Status,type RecordRow,queryKey,summary} from './engine';
export type Week={id:string;week_start:string;file_name:string;status:string;created_at:string;summary?:Summary};
export type ComparisonFilter=''|'new'|'resolved'|'safe_medium'|'medium_danger'|'changed';
export type ComparisonFilters={search:string;transition:ComparisonFilter;page:number;sort:'impressions'|'delta'};
export const comparisonFilters:ComparisonFilters={search:'',transition:'',page:0,sort:'impressions'};
export type ComparisonRow={key:string;query:string;categories:string[];old_status:Status;new_status:Status;old_cannibal:boolean;new_cannibal:boolean;old_impressions:number;new_impressions:number;delta:number};
export type ComparisonCategory={name:string;old:number;new:number;delta:number;old_total:number;new_total:number;old_affected:number;new_affected:number;affected_delta:number};
export type ComparisonFlow={from:Status;to:Status;value:number};
export type ComparisonReport={coverage?:{new_common:number;new_only:number;resolved_common:number;old_only:number};category:string;transitions:ComparisonData['transitions'];flows:ComparisonFlow[];site_old:Summary;site_new:Summary};
export type ComparisonData={old:Summary;new:Summary;rows:ComparisonRow[];count:number;matched:number;categories:ComparisonCategory[];transitions:Record<Exclude<ComparisonFilter,''> | 'all',number>;valid:boolean;report:ComparisonReport};
export function distinctDays(weeks:Week[]){
 const sorted=weeks.slice().sort((a,b)=>b.week_start.localeCompare(a.week_start)||b.created_at.localeCompare(a.created_at));
 return sorted.filter((w,index)=>sorted.findIndex(x=>x.week_start===w.week_start)===index);
}
export function selectComparisonDay(weeks:Week[],pair:{older:string;newer:string},side:'older'|'newer',id:string){
 const days=distinctDays(weeks),chosen=days.find(w=>w.id===id);if(!chosen)return pair;
 if(side==='older'){
  const current=days.find(w=>w.id===pair.newer);
  return {older:id,newer:current&&current.week_start>chosen.week_start?current.id:days.filter(w=>w.week_start>chosen.week_start).at(-1)?.id||''};
 }
 const current=days.find(w=>w.id===pair.older);
 return {newer:id,older:current&&current.week_start<chosen.week_start?current.id:days.find(w=>w.week_start<chosen.week_start)?.id||''};
}
export function validComparisonDays(weeks:Week[],older:string,newer:string){const a=weeks.find(w=>w.id===older),b=weeks.find(w=>w.id===newer);return Boolean(a&&b&&a.week_start<b.week_start);}
export function matchesTransition(row:ComparisonRow,type:ComparisonFilter){
 return type===''||type==='new'&&!row.old_cannibal&&row.new_cannibal||type==='resolved'&&row.old_cannibal&&!row.new_cannibal||type==='safe_medium'&&row.old_status==='safe'&&row.new_status==='medium'||type==='medium_danger'&&row.old_status==='medium'&&row.new_status==='danger'||type==='changed'&&row.old_status!=='no_data'&&row.new_status!=='no_data'&&row.old_status!==row.new_status;
}
/** Independent comparison model also used to verify the SQL against controlled records. */
export function comparisonFromRecords(older:RecordRow[],newer:RecordRow[],category='',filters:ComparisonFilters=comparisonFilters,taxonomy:string[]=[],pageSize=25):ComparisonData{
 const a=older.filter(r=>r.status!=='no_data'),b=newer.filter(r=>r.status!=='no_data'),oldMap=new Map(a.map(r=>[r.key,r])),newMap=new Map(b.map(r=>[r.key,r]));
 const groupNames=new Set([...taxonomy,...a.flatMap(r=>r.categories),...b.flatMap(r=>r.categories)]);
 const categories=[...groupNames].map(name=>{const previous=a.filter(r=>r.categories.includes(name)),current=b.filter(r=>r.categories.includes(name)),old=summary(previous),next=summary(current);return{name,old:old.cannibal,new:next.cannibal,delta:next.cannibal-old.cannibal,old_total:old.withData,new_total:next.withData,old_affected:old.affectedImpressions,new_affected:next.affectedImpressions,affected_delta:next.affectedImpressions-old.affectedImpressions};}).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)||a.name.localeCompare(b.name,'vi'));
 const scope=(records:RecordRow[])=>records.filter(r=>!category||r.categories.includes(category));
 const scopedPairs:ComparisonRow[]=[...new Set([...oldMap.keys(),...newMap.keys()])].map(key=>{const old=oldMap.get(key),next=newMap.get(key);return {key,query:next?.query??old!.query,categories:[...new Set([...(old?.categories??[]),...(next?.categories??[])])],old_status:old?.status??'no_data',new_status:next?.status??'no_data',old_cannibal:old?.cannibal??false,new_cannibal:next?.cannibal??false,old_impressions:old?.impressions??0,new_impressions:next?.impressions??0,delta:(next?.impressions??0)-(old?.impressions??0)} as ComparisonRow;}).filter(r=>!category||r.categories.includes(category));
 const matched=scopedPairs.filter(r=>!filters.search||r.key.includes(queryKey(filters.search)));
 const reportTransitions={all:scopedPairs.length,new:0,resolved:0,safe_medium:0,medium_danger:0,changed:0};
 for(const key of ['new','resolved','safe_medium','medium_danger','changed']as const)reportTransitions[key]=scopedPairs.filter(r=>matchesTransition(r,key)).length;
 const flowMap=new Map<string,ComparisonFlow>();for(const r of scopedPairs){if(r.old_status===r.new_status||r.old_status==='no_data'||r.new_status==='no_data')continue;const key=r.old_status+':'+r.new_status,flow=flowMap.get(key)||{from:r.old_status,to:r.new_status,value:0};flow.value++;flowMap.set(key,flow);}
 const coverage={new_common:scopedPairs.filter(r=>matchesTransition(r,'new')&&r.old_status!=='no_data').length,new_only:scopedPairs.filter(r=>r.new_cannibal&&r.old_status==='no_data').length,resolved_common:scopedPairs.filter(r=>matchesTransition(r,'resolved')&&r.new_status!=='no_data').length,old_only:scopedPairs.filter(r=>r.old_cannibal&&r.new_status==='no_data').length};
 const report={category,coverage,transitions:reportTransitions,flows:[...flowMap.values()].sort((a,b)=>a.from.localeCompare(b.from)||a.to.localeCompare(b.to)),site_old:summary(a),site_new:summary(b)};
 const transitions={all:matched.length,new:0,resolved:0,safe_medium:0,medium_danger:0,changed:0};
 for(const key of ['new','resolved','safe_medium','medium_danger','changed']as const)transitions[key]=matched.filter(r=>matchesTransition(r,key)).length;
 const rows=matched.filter(r=>matchesTransition(r,filters.transition)).sort((a,b)=>(filters.sort==='delta'?Math.abs(b.delta)-Math.abs(a.delta):0)||Math.max(b.old_impressions,b.new_impressions)-Math.max(a.old_impressions,a.new_impressions)||a.key.localeCompare(b.key));
 return{old:summary(scope(a)),new:summary(scope(b)),rows:rows.slice(filters.page*pageSize,filters.page*pageSize+pageSize),count:rows.length,matched:matched.length,categories,transitions,valid:true,report};
}

export function pairComparisonUrls(older:RecordRow,newer:RecordRow){
 const ranked=(r:RecordRow)=>r.urls.slice().sort((a,b)=>b.impressions-a.impressions).map((url,index,all)=>({...url,order:index+1,percent:all[0].impressions>0?url.impressions/all[0].impressions*100:null,eligible:index>0&&all[0].impressions>0&&url.impressions>=all[0].impressions*.2}));
 const a=new Map(ranked(older).map(u=>[u.url,u])),b=new Map(ranked(newer).map(u=>[u.url,u]));
 return [...new Set([...a.keys(),...b.keys()])].map(url=>({url,old:a.get(url)??null,new:b.get(url)??null})).sort((a,b)=>Math.max(b.old?.impressions??0,b.new?.impressions??0)-Math.max(a.old?.impressions??0,a.new?.impressions??0)||a.url.localeCompare(b.url));
}

/** A missing day is explicit, never presented as a measured zero. */
export function missingComparisonRecord(row:ComparisonRow):RecordRow{return {key:row.key,query:row.query,categories:row.categories,urls:[],impressions:0,clicks:0,position:null,gap:null,cannibal:false,status:'no_data',invalid_rows:0};}
