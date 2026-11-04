import {queryKey} from './engine';
import {rankingColors} from './design';
export type Ranking={key:string;query:string;categories:string[];domain:string;engine:string;positions:Record<string,number|null>};
export type RankingInput=Pick<Ranking,'key'|'query'|'domain'|'engine'|'positions'>;
export const bands=[{name:'Top 1–3',min:1,max:3,color:rankingColors.top3},{name:'Top 4–5',min:4,max:5,color:rankingColors.top5},{name:'Top 6–10',min:6,max:10,color:rankingColors.top10},{name:'Top 11–30',min:11,max:30,color:rankingColors.top20},{name:'Top 31–100',min:31,max:100,color:rankingColors.top50},{name:'Ngoài Top 100',min:101,max:Infinity,color:rankingColors.top100}];
export const tableBands=[{name:'1–3',min:1,max:3,color:rankingColors.top3},{name:'4–5',min:4,max:5,color:rankingColors.top5},{name:'6–10',min:6,max:10,color:rankingColors.top10},{name:'11–20',min:11,max:20,color:rankingColors.top20},{name:'21–50',min:21,max:50,color:rankingColors.top50},{name:'51–100',min:51,max:100,color:rankingColors.top100}];
export function parseSpyserp(rows:unknown[][]){
 const h=rows.findIndex(r=>r.some(v=>queryKey(v)==='keywords')&&r.some(v=>queryKey(v)==='search engines'));
 if(h<0)throw new Error('Không tìm thấy tiêu đề Keywords / Search engines trong file SpySERP.');
 const header=rows[h],col=(name:string)=>header.findIndex(v=>queryKey(v)===name);
 const keywordColumn=col('keywords'),domainColumn=col('domains'),engineColumn=col('search engines');
 const dates=header.flatMap((v,index)=>{const m=String(v??'').match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s|$)/);if(!m)return [];const date=`${m[3]}-${m[2]}-${m[1]}`;if(new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Ngày không hợp lệ.');return [{index,date}];});
 if(new Set(dates.map(d=>d.date)).size!==dates.length)throw new Error('File có nhiều lần đo trong cùng ngày. Hãy xuất một lần đo mỗi ngày.');
 if(!dates.length)throw new Error('File chưa có cột ngày thứ hạng.');
 const result=new Map<string,RankingInput>();let duplicates=0,invalid=0;
 for(const row of rows.slice(h+1)){
  const key=queryKey(row[keywordColumn]);if(!key)continue;
  const domain=String(row[domainColumn]??'').trim(),engine=String(row[engineColumn]??'').trim();if(!domain||!engine)throw new Error(`Thiếu domain hoặc công cụ tìm kiếm: ${key}`);
  const positions:Record<string,number|null>={};
  for(const {index,date} of dates){const v=row[index];if(v==null||['na','n/a'].includes(queryKey(v))||v==='')positions[date]=null;else if(v===-2){positions[date]=-2;invalid++;}else if(/^>\s*100$/.test(String(v)))positions[date]=101;else if(typeof v==='number'&&Number.isInteger(v)&&v>0)positions[date]=Math.min(101,v);else throw new Error(`Thứ hạng không hợp lệ: ${key}, ${date}, ${String(v)}`);}
  const id=JSON.stringify([key,domain,engine]);const old=result.get(id);if(old){duplicates++;if(JSON.stringify(old.positions)!==JSON.stringify(positions))throw new Error(`Từ khóa trùng nhưng khác thứ hạng: ${key}`);}else result.set(id,{key,query:String(row[keywordColumn]).trim(),domain,engine,positions});
 }
 return {rows:[...result.values()],dates:dates.map(d=>d.date).sort(),duplicates,invalid};
}
export function rankingSummary(rows:Ranking[],date:string){
 let total=0,ranked=0,sum=0;
 const counts=bands.map(()=>0),tableCounts=tableBands.map(()=>0);
 for(const row of rows){
  const value=row.positions[date];if(typeof value!=='number'||!(value>0))continue;
  total++;sum+=value;if(value<=100)ranked++;
  const band=bands.findIndex(b=>value>=b.min&&value<=b.max);
  const tableBand=tableBands.findIndex(b=>value>=b.min&&value<=b.max);
  if(band>=0)counts[band]++;if(tableBand>=0)tableCounts[tableBand]++;
 }
 return {total,missing:rows.length-total,ranked,coverage:rows.length?ranked/rows.length*100:0,average:total?sum/total:null,counts,tableCounts};
}
export type Movement='up'|'down'|'new'|'lost';
export function rankingMovement(row:Ranking,from:string,to:string):Movement|null{
 if(!(from in row.positions)||!(to in row.positions)||from===to)return null;
 const a=row.positions[from]??101,b=row.positions[to]??101;if(a===-2||b===-2)return null;
 if(a>100&&b<=100)return 'new';if(a<=100&&b>100)return 'lost';if(a<=100&&b<=100)return b<a?'up':b>a?'down':null;return null;
}
export const rankLabel=(p:number|null|undefined)=>p==null||p===-2?'N/A':p>100?'100+':String(p);
export const dayLabel=(date:string)=>date.split('-').reverse().join('/');

// SpySERP treats literal NA as outside Top 100 for transitions; -2 is an unavailable measurement.
export function rankingBandChanges(rows:Ranking[],from:string,to:string,min:number,max:number){
 let entered=0,left=0;
 for(const row of rows){
  if(!(from in row.positions)||!(to in row.positions))continue;
  const a=row.positions[from]??101,b=row.positions[to]??101;
  if(a===-2||b===-2)continue;
  const old=a>=min&&a<=max,now=b>=min&&b<=max;
  if(!old&&now)entered++;if(old&&!now)left++;
 }
 return {entered,left};
}
export function rankingDelta(a:number|null|undefined,b:number|null|undefined){
 if(a===undefined||b===undefined||a===-2||b===-2)return null;
 return (a??101)-(b??101);
}

const percentFormat=new Intl.NumberFormat('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:1});
export const rankingPercent=(value:number)=>`${percentFormat.format(value)}%`;

/** Rank bands do not overlap; sum each selected band once. */
export function sumRankingBands(counts:number[],selected:number[]){
 return [...new Set(selected)].reduce((sum,index)=>sum+(counts[index]??0),0);
}
