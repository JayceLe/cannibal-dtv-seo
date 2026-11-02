import {queryKey} from './engine';
export type Ranking={key:string;query:string;categories:string[];domain:string;engine:string;positions:Record<string,number|null>};
export type RankingInput=Pick<Ranking,'key'|'domain'|'engine'|'positions'>;
export const bands=[{name:'Top 1–3',min:1,max:3,color:'#65a7ff'},{name:'Top 4–5',min:4,max:5,color:'#3986e8'},{name:'Top 6–10',min:6,max:10,color:'#2eb6e8'},{name:'Top 11–30',min:11,max:30,color:'#49c9b4'},{name:'Top 31–100',min:31,max:100,color:'#b6a0ef'},{name:'Ngoài Top 100',min:101,max:Infinity,color:'#81858c'}];
export const tableBands=[{name:'1–3',min:1,max:3,color:'#3978d5'},{name:'4–5',min:4,max:5,color:'#258cce'},{name:'6–10',min:6,max:10,color:'#20a3dd'},{name:'11–20',min:11,max:20,color:'#41b8e7'},{name:'21–50',min:21,max:50,color:'#71cbef'},{name:'51–100',min:51,max:100,color:'#a2def5'}];
export function parseSpyserp(rows:unknown[][]){
 const h=rows.findIndex(r=>r.some(v=>queryKey(v)==='keywords')&&r.some(v=>queryKey(v)==='search engines'));
 if(h<0)throw new Error('Không tìm thấy tiêu đề Keywords / Search engines trong file SpySERP.');
 const header=rows[h],col=(name:string)=>header.findIndex(v=>queryKey(v)===name);
 const dates=header.flatMap((v,index)=>{const m=String(v??'').match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s|$)/);if(!m)return [];const date=`${m[3]}-${m[2]}-${m[1]}`;if(new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Ngày không hợp lệ.');return [{index,date}];});
 if(new Set(dates.map(d=>d.date)).size!==dates.length)throw new Error('File có nhiều lần đo trong cùng ngày. Hãy xuất một lần đo mỗi ngày.');
 if(!dates.length)throw new Error('File chưa có cột ngày thứ hạng.');
 const result=new Map<string,RankingInput>();let duplicates=0,invalid=0;
 for(const row of rows.slice(h+1)){
  const key=queryKey(row[col('keywords')]);if(!key)continue;
  const domain=String(row[col('domains')]??'').trim(),engine=String(row[col('search engines')]??'').trim();if(!domain||!engine)throw new Error(`Thiếu domain hoặc công cụ tìm kiếm: ${key}`);
  const positions:Record<string,number|null>={};
  for(const {index,date} of dates){const v=row[index];if(v==null||['na','n/a'].includes(queryKey(v))||v==='')positions[date]=null;else if(typeof v==='number'&&v<=0){positions[date]=null;invalid++;}else if(/^>\s*100$/.test(String(v)))positions[date]=101;else if(typeof v==='number'&&Number.isInteger(v)&&v>0)positions[date]=Math.min(101,v);else throw new Error(`Thứ hạng không hợp lệ: ${key}, ${date}, ${String(v)}`);}
  const id=JSON.stringify([key,domain,engine]);const old=result.get(id);if(old){duplicates++;if(JSON.stringify(old.positions)!==JSON.stringify(positions))throw new Error(`Từ khóa trùng nhưng khác thứ hạng: ${key}`);}else result.set(id,{key,domain,engine,positions});
 }
 return {rows:[...result.values()],dates:dates.map(d=>d.date).sort(),duplicates,invalid};
}
export function rankingSummary(rows:Ranking[],date:string){
 const values=rows.map(r=>r.positions[date]).filter((p):p is number=>typeof p==='number');const ranked=values.filter(p=>p<=100);
 return {total:values.length,missing:rows.length-values.length,ranked:ranked.length,coverage:rows.length?ranked.length/rows.length*100:0,average:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,counts:bands.map(b=>values.filter(p=>p>=b.min&&p<=b.max).length),tableCounts:tableBands.map(b=>values.filter(p=>p>=b.min&&p<=b.max).length)};
}
export type Movement='up'|'down'|'new'|'lost';
export function rankingMovement(row:Ranking,from:string,to:string):Movement|null{
 const a=row.positions[from],b=row.positions[to];if(a==null||b==null||from===to)return null;
 if(a>100&&b<=100)return 'new';if(a<=100&&b>100)return 'lost';if(a<=100&&b<=100)return b<a?'up':b>a?'down':null;return null;
}
export const rankLabel=(p:number|null|undefined)=>p==null?'N/A':p>100?'100+':String(p);
export const dayLabel=(date:string)=>date.split('-').reverse().join('/');
