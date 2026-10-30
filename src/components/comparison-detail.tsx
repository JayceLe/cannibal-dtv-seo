'use client';
import {useEffect,useState} from 'react';
import {ExternalLink} from 'lucide-react';
import FocusDialog from './focus-dialog';
import ComparisonEvidence from './comparison-evidence';
import {db} from '@/lib/supabase';
import {number,rankDisplay,decimal,type RecordRow} from '@/lib/engine';
import {pairComparisonUrls,missingComparisonRecord,type ComparisonRow,type Week} from '@/lib/comparison';
import {formatDataDate} from '@/lib/dates';
export function ComparisonDetailView({older,newer,oldRecord,newRecord}:{older:Week;newer:Week;oldRecord:RecordRow;newRecord:RecordRow}){
 const pairs=pairComparisonUrls(oldRecord,newRecord);
 return <div className="comparison-detail-body"><ComparisonEvidence older={older} newer={newer} oldRecord={oldRecord} newRecord={newRecord}/><div className="comparison-url-table" data-motion-reveal role="table" aria-label="Đối chiếu URL giữa hai ngày"><div className="comparison-url-head" role="row">{[older,newer].map(period=><div className="period-url-head" role="presentation" key={period.id}><span role="columnheader">URL · {formatDataDate(period.week_start)}</span><span role="columnheader">Impression</span><span role="columnheader">Rank</span></div>)}</div>{pairs.map(pair=><div className="comparison-url-pair" role="row" key={pair.url}>{(['old','new']as const).map((side,i)=>{const url=pair[side];return <div key={side} role="presentation" className={`period-url-row ${url?.order===1?'leader-url':url?.order===2?'runner-url':url?.eligible?'other-url eligible-url':'other-url'} ${!url?'missing-url':''}`}><div className="period-url-identity" role="cell"><span className="mobile-period-label">{formatDataDate((i?newer:older).week_start)}</span><a href={pair.url} target="_blank" rel="noopener noreferrer">{pair.url.replace(/^https?:\/\//,'')}<ExternalLink size={12}/></a><div>{url?<><span className={`url-rank-mark top-${url.order>2?'other':url.order}`}>{url.order<=2?`TOP ${url.order}`:`URL ${url.order}`}</span>{url.eligible?<span className="period-eligible">Đạt ngưỡng ≥ 20%</span>:null}</>:<span className="period-missing">Không có dữ liệu ngày này</span>}</div></div><div className="period-url-impressions" role="cell"><small>Impression</small><strong>{url?number(url.impressions):'—'}</strong>{url?<div className="url-share-track"><i style={{width:`${Math.min(url.percent??0,100)}%`}}/></div>:null}<span className="period-url-percent">{url?.percent==null?'—':decimal(url.percent,2)+'% Top 1'}</span></div><div className="period-url-rank" role="cell"><small>Rank</small>{url?rankDisplay(url.position):'—'}</div></div>;})}</div>)}{!pairs.length?<div className="table-empty">Chưa có URL để đối chiếu.</div>:null}</div></div>;
}
export default function ComparisonDetail({row,older,newer,onClose}:{row:ComparisonRow;older:Week;newer:Week;onClose:()=>void}){
 const [result,setResult]=useState<{old:RecordRow;new:RecordRow}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;setResult(null);setError('');
  void Promise.all([older,newer].map(period=>db().from('seo_records').select('key,query,categories,urls,impressions,clicks,position,gap,cannibal,status,invalid_rows').eq('import_id',period.id).eq('key',row.key).maybeSingle())).then(([a,b])=>{if(!active)return;if(a.error||b.error){setError('Chưa tải được chi tiết hai ngày. Vui lòng thử lại.');return;}setResult({old:(a.data as RecordRow|null)??missingComparisonRecord(row),new:(b.data as RecordRow|null)??missingComparisonRecord(row)});}).catch(()=>{if(active)setError('Chưa kết nối được dữ liệu.');});
  return()=>{active=false;};
 },[row.key,older.id,newer.id,retry]);
 return <FocusDialog title={row.query} className="comparison-detail-dialog" onClose={onClose}>{error?<div className="comparison-detail-error" role="alert">{error}<button className="btn secondary" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></div>:result?<ComparisonDetailView older={older} newer={newer} oldRecord={result.old} newRecord={result.new}/>:<div className="table-empty" role="status">Đang tải chi tiết hai ngày…</div>}</FocusDialog>;
}
