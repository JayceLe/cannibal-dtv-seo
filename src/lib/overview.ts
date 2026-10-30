import {cannibalImpressions,queryKey,summary,roundRank,rankGap,type RecordRow,type Summary} from './engine';
export type CategoryStat={name:string;total:number;cannibal:number;danger:number;impressions:number;cannibalImpressions:number};
export type QueryTab='all'|'cannibal'|'none'|'review';
export type QueryFilters={category:string;tab:QueryTab;status:string;search:string;exact:boolean;sort:string;page:number};
export type OverviewData={summary:Summary;siteSummary:Summary;rows:RecordRow[];count:number;categories:CategoryStat[];levelCounts:{all:number;safe:number;medium:number;danger:number};quality?:Record<string,number>};
export const initialFilters:QueryFilters={category:'',tab:'all',status:'',search:'',exact:false,sort:'impressions',page:0};
export const reviewCount=(s:Summary)=>(s.counts.unknown||0)+(s.counts.data_issue||0);
export function selectedLevels(status:string){return status.split(',').filter(Boolean);}
export function toggleLevel(status:string,level:string){
 if(!level)return '';
 const selected=new Set(selectedLevels(status));if(selected.has(level))selected.delete(level);else selected.add(level);
 return ['safe','medium','danger'].filter(s=>selected.has(s)).join(',');
}
export function matchesQuery(r:RecordRow,f:QueryFilters){
 const key=queryKey(f.search);
 return r.status!=='no_data'&&(!f.category||r.categories.includes(f.category))&&
  (f.tab==='all'||(f.tab==='cannibal'&&r.cannibal)||(f.tab==='none'&&r.status==='none')||(f.tab==='review'&&['unknown','data_issue'].includes(r.status)))&&
  (!f.status||selectedLevels(f.status).includes(r.status)||(f.status==='unclassified'&&['unknown','data_issue'].includes(r.status)))&&
  (!key||(f.exact?r.key===key:r.key.includes(key)));
}
export function overviewFromRecords(records:RecordRow[],f:QueryFilters,taxonomy:string[]=[]):OverviewData{
 records=records.filter(r=>r.status!=='no_data');
 const groups=new Map<string,CategoryStat>(taxonomy.map(name=>[name,{name,total:0,cannibal:0,danger:0,impressions:0,cannibalImpressions:0}]));
 for(const r of records){const affected=r.cannibal?cannibalImpressions(r):0;for(const name of r.categories){const c=groups.get(name)||{name,total:0,cannibal:0,danger:0,impressions:0,cannibalImpressions:0};c.total++;c.cannibal+=Number(r.cannibal);c.danger+=Number(r.status==='danger');c.impressions+=r.impressions;c.cannibalImpressions+=affected;groups.set(name,c);}}
 const scoped=records.filter(r=>!f.category||r.categories.includes(f.category));
 const levelRows=records.filter(r=>matchesQuery(r,{...f,status:''}));
 const levelCounts={all:levelRows.length,safe:0,medium:0,danger:0};
 for(const r of levelRows)if(r.status==='safe'||r.status==='medium'||r.status==='danger')levelCounts[r.status]++;
 const rows=levelRows.filter(r=>matchesQuery(r,f)).sort((a,b)=>{
  if(f.sort==='position')return (a.position??Infinity)-(b.position??Infinity)||b.impressions-a.impressions||a.key.localeCompare(b.key);
  if(f.sort==='gap')return (b.gap??-Infinity)-(a.gap??-Infinity)||b.impressions-a.impressions||a.key.localeCompare(b.key);
  return b.impressions-a.impressions||a.key.localeCompare(b.key);
 });
 return {levelCounts,summary:summary(scoped),siteSummary:summary(records),rows:rows.slice(f.page*25,f.page*25+25),count:rows.length,categories:Array.from(groups.values()).sort((a,b)=>a.name.localeCompare(b.name,'vi'))};
}
export function categoryShares(categories:CategoryStat[],metric:'cannibal'|'cannibalImpressions'){
 const total=categories.reduce((n,c)=>n+c[metric],0);
 return categories.map(c=>({name:c.name,value:c[metric],percent:total?c[metric]/total*100:0}));
}

export function rankedUrls(record:RecordRow){
 const urls=record.urls.slice().sort((a,b)=>b.impressions-a.impressions);
 const leader=urls[0]?.impressions||0;
 return urls.map((url,index)=>({...url,position:roundRank(url.position),order:index+1,percent:leader>0?url.impressions/leader*100:null,reachesThreshold:index>0&&leader>0&&url.impressions>=leader*.2}));
}
export function queryCategoryImpact(record:RecordRow,categories:CategoryStat[]){
 return record.categories.map(name=>{const total=categories.find(c=>c.name===name)?.impressions||0;return{name,impressions:record.impressions,total,percent:total>0?record.impressions/total*100:null};});
}

export function overviewHighlights(categories:CategoryStat[],siteCannibal:number){
 const mapped=categories.filter(c=>c.total>0);
 const ranked=mapped.slice().sort((a,b)=>b.cannibal-a.cannibal||a.name.localeCompare(b.name,'vi'));
 const high=siteCannibal>0?ranked[0]??null:null;
 const lowest=mapped.slice().sort((a,b)=>a.cannibal-b.cannibal||a.name.localeCompare(b.name,'vi'));
 const low=siteCannibal>0?lowest[0]??null:null;
 const topImpressions=mapped.filter(c=>c.cannibalImpressions>0).sort((a,b)=>b.cannibalImpressions-a.cannibalImpressions||a.name.localeCompare(b.name,'vi'))[0]??null;
 const rate=(c:CategoryStat|null)=>c?{...c,percent:c.cannibal/siteCannibal*100,ties:mapped.filter(x=>x.cannibal===c.cannibal).length}:null;
 return {affected:mapped.filter(c=>c.cannibal>0).length,mappedGroups:mapped.length,totalGroups:categories.length,highest:rate(high),lowest:rate(low),topImpressions};
}
export function ratioComparisons(scoped:Summary,site:Summary,category:string){
 const siteRates={title:category?'DMC3 so với toàn site':'Tỷ lệ cannibal toàn site',denominator:'toàn site',query:{numerator:scoped.cannibal,denominator:site.withData},impression:{numerator:scoped.affectedImpressions,denominator:site.impressions}};
 return category?[siteRates,{title:'Tỷ lệ cannibal trong DMC3',denominator:category,query:{numerator:scoped.cannibal,denominator:scoped.withData},impression:{numerator:scoped.affectedImpressions,denominator:scoped.impressions}}]:[siteRates];
}

/** Subtract the displayed one-decimal ranks of the two impression-leading URLs. */
export function topTwoRankGap(record:RecordRow){
 const [first,second]=rankedUrls(record);
 return rankGap(first?.position??null,second?.position??null);
}
