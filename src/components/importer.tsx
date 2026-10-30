'use client';
import { useEffect, useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, Check, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { db } from '@/lib/supabase';
import { number, type Keyword, type Metric } from '@/lib/engine';
type Preview={kind:'base'|'weekly';data:(Keyword|Metric)[];quality:{rows:number;invalid:number;anchors:number;duplicates:number;missingRank:number;unmappedRows:number;unmappedQueries:number;mapped:boolean;samples:{row:number;reason:string}[]}};
export default function Importer({demo,onDone,onLogin}:{demo:boolean;onDone:(importId?:string)=>void;onLogin:()=>void}){
 const [kind,setKind]=useState<'base'|'weekly'>('weekly'),[file,setFile]=useState<File|null>(null),[week,setWeek]=useState('2026-10-19'),[locale,setLocale]=useState('vi-VN'),[preview,setPreview]=useState<Preview|null>(null),[progress,setProgress]=useState(0),[phase,setPhase]=useState(''),[error,setError]=useState(''),[sheets,setSheets]=useState<string[]>([]),[sheet,setSheet]=useState<number>(),[done,setDone]=useState(false);
 const sequence=useRef(0),baseKeys=useRef<string[]|null>(null);
 const worker=useRef<Worker|null>(null),active=useRef(true),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{active.current=true;const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));setWeek(`${parts.year}-${parts.month}-${parts.day}`);return()=>{active.current=false;worker.current?.terminate();};},[]);
 async function analyze(f:File,index?:number){
  const seq=++sequence.current;
  setFile(f);setPreview(null);setError('');setDone(false);setSheets([]);setSheet(index);
  if(f.size>150*1024*1024){setError('File vượt 150 MB. Hãy chia theo tuần hoặc xuất CSV nhỏ hơn.');return;}
  setPhase('Đang đọc và kiểm tra file…');setProgress(0);worker.current?.terminate();
  let keys:string[]|undefined;
  if(kind==='weekly'&&!demo){
   setPhase('Đang lấy bộ từ khóa gốc để map…');
   try{
    if(!baseKeys.current){const {data,error}=await db().rpc('seo_base_keys');if(error)throw error;baseKeys.current=data as string[];}
    if(seq!==sequence.current||!active.current)return;
    keys=baseKeys.current||[];
    if(!keys.length)throw new Error('Chưa có từ khóa gốc. Nạp bộ Keywords + DMC3 trước.');
   }catch(e){if(active.current&&seq===sequence.current){setError(e instanceof Error?e.message:(e as {message?:string}).message||'Không tải được bộ từ khóa gốc.');setPhase('');}return;}
  }
  if(seq!==sequence.current||!active.current)return;
  setPhase('Đang loại URL chứa # và map từ khóa…');
  const w=new Worker(new URL('../workers/import.worker.ts',import.meta.url));worker.current=w;
  w.onerror=()=>{setError('Không đọc được file. Hãy thử xuất lại dưới dạng CSV UTF-8.');setPhase('');w.terminate();};
  w.onmessage=e=>{if(seq!==sequence.current||!active.current)return;if(e.data.error){setError(e.data.error);setPhase('');w.terminate();}else if(e.data.sheets){setSheets(e.data.sheets);setPhase('');w.terminate();}else if(e.data.done){setPreview(e.data);setPhase('');setProgress(100);w.terminate();}else setProgress(e.data.progress);};
  w.postMessage({file:f,kind,locale,sheet:index,baseKeys:keys});
 }
 async function save(){
  if(demo){onLogin();return;}if(!preview||!file)return;
  if(!preview.data.length){setError(kind==='weekly'&&preview.quality.mapped?'Không có query khớp bộ từ khóa gốc để lưu. Kiểm tra lại file hoặc bộ từ khóa.':'File không có dòng hợp lệ để lưu.');return;}
  if(kind==='weekly' && (!/^\d{4}-\d{2}-\d{2}$/.test(week)||Number.isNaN(Date.parse(week+'T12:00:00Z')))){setError('Chọn ngày dữ liệu hợp lệ.');return;}
  setError('');setPhase('Đang lưu dữ liệu…');setProgress(0);
  try{
   const client=db();const size=1000,total=Math.ceil(preview.data.length/size);let id='';
   if(kind==='weekly'){
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join('')+`:${locale}:${sheet??0}`;
    const {data:existing,error:ee}=await client.from('seo_imports').select('id,status').eq('week_start',week).eq('fingerprint',hash).maybeSingle();if(ee)throw ee;
    if(existing?.status==='ready')throw new Error('File này đã được lưu cho ngày đã chọn. Xem lại trong tab So sánh.');
    if(existing)id=existing.id;else{const {data,error}=await client.from('seo_imports').insert({week_start:week,file_name:file.name,fingerprint:hash,expected_batches:total,quality:preview.quality}).select('id').single();if(error)throw error;id=data.id;}
   }
   for(let i=0;i<total;i++){
    const part=preview.data.slice(i*size,(i+1)*size);
    const result=kind==='base'?await client.rpc('seo_import_base',{p_rows:part}):await client.from('seo_batches').upsert({import_id:id,batch_no:i,payload:part},{onConflict:'import_id,batch_no'});
    if(result.error)throw result.error;if(active.current)setProgress(Math.round((i+1)/total*90));
   }
   if(kind==='weekly'){setPhase('Đang map từ khóa và phân tích cannibal…');const {error}=await client.rpc('seo_finalize_import',{p_import:id});if(error)throw error;}
   if(kind==='base')baseKeys.current=null;
   if(active.current){setProgress(100);setPhase('');setDone(true);onDone(id||undefined);}
  }catch(e){if(active.current){setError(e instanceof Error?e.message:(e as {message?:string}).message||'Không lưu được dữ liệu. Chọn lại cùng file để tiếp tục các lô chưa hoàn tất.');setPhase('');}}
 }
 return <div className="import-layout"><section className="panel import-main"><div className="section-heading"><div><h2>Đưa dữ liệu vào hệ thống</h2><p>Kiểm tra trước khi lưu. Chọn ngày dữ liệu. Hệ thống chỉ lưu query khớp bộ từ khóa gốc.</p></div><FileSpreadsheet size={28}/></div>
  <div className="segmented"><button className={kind==='weekly'?'active':''} disabled={!!phase} onClick={()=>{setKind('weekly');setPreview(null);setFile(null);setError('');}}>Import Query–URL</button><button className={kind==='base'?'active':''} disabled={!!phase} onClick={()=>{setKind('base');setPreview(null);setFile(null);setError('');}}>Danh sách từ khóa gốc</button></div>
  <div className="form-grid">{kind==='weekly'?<label>Ngày dữ liệu<input type="date" value={week} disabled={!!phase} onChange={e=>{setWeek(e.target.value);setDone(false);}}/></label>:<p className="muted">Gộp theo từ khóa chuẩn hóa; cập nhật DMC3. Từ khóa cũ và lịch sử dữ liệu được giữ lại.</p>}<label>Định dạng số trong file<select disabled={!!phase} value={locale} onChange={e=>{setLocale(e.target.value);setPreview(null);}}><option value="vi-VN">Việt Nam · 1.234,5</option><option value="en-US">Quốc tế · 1,234.5</option></select></label></div>
  <input ref={input} type="file" hidden accept=".xlsx,.csv,.tsv" onChange={e=>{if(e.target.files?.[0])analyze(e.target.files[0]);e.target.value='';}}/>
  <button className="dropzone" disabled={!!phase} onClick={()=>input.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!phase&&e.dataTransfer.files[0])analyze(e.dataTransfer.files[0]);}}><span className="upload-symbol"><UploadCloud size={28}/></span><strong>{file?.name||'Kéo thả file vào đây'}</strong><span>hoặc <b>chọn file từ máy</b></span><small>XLSX, CSV, TSV · Tối đa 150 MB</small></button>
  {sheets.length>0?<label>Chọn đúng tab dữ liệu<select value="" onChange={e=>analyze(file!,Number(e.target.value))}><option value="" disabled>Chọn tab…</option>{sheets.map((s,i)=><option key={s} value={i}>{s}</option>)}</select></label>:null}
  {phase?<div role="status" className="progress-block"><p><Loader2 className="spin" size={16}/>{phase}<span>{progress}%</span></p><progress max={100} value={progress}/></div>:null}
  {error?<p role="alert" className="error-message"><AlertCircle size={16}/>{error}</p>:null}
  {preview?<div className="preview"><h3>Đã kiểm tra file</h3><div className="preview-stats"><div><strong>{number(preview.quality.rows)}</strong><span>Dòng đã đọc</span></div><div><strong>{number(preview.data.length)}</strong><span>{kind==='base'?'Từ khóa duy nhất':preview.quality.mapped?'Cặp Query–URL đã map':'Cặp Query–URL đã gộp'}</span></div><div><strong>{number(preview.quality.invalid)}</strong><span>Dòng cần kiểm tra</span></div></div><p className="muted">{preview.quality.duplicates} dòng trùng đã gộp · {preview.quality.anchors} dòng URL chứa # đã loại · {preview.quality.missingRank} dòng thiếu vị trí.{preview.quality.mapped?` ${number(preview.quality.unmappedRows)} dòng không khớp bộ gốc đã loại (${number(preview.quality.unmappedQueries)} query).`:kind==='weekly'?' Mở workspace để map với từ khóa gốc.':''}</p>{preview.quality.samples.map(s=><p className="muted" key={s.row}>Dòng {s.row}: {s.reason}</p>)}<div className="sample-scroll"><table><thead><tr><th>Query</th><th>{kind==='base'?'DMC3':'URL / Trạng thái'}</th></tr></thead><tbody>{preview.data.slice(0,5).map((r,i)=><tr key={i}><td>{'query' in r?r.query:r.key}</td><td>{'categories' in r?r.categories.join(' · '):r.url||'Dòng không hợp lệ'}</td></tr>)}</tbody></table></div><button className="btn primary" disabled={!!phase||done} onClick={save}>{done?<Check size={16}/>:<ArrowRight size={16}/>} {done?'Đã lưu thành công':demo?'Đăng nhập để lưu vào Supabase':`Xác nhận import ${kind==='base'?'từ khóa gốc':'ngày '+week.split('-').reverse().join('/')}`}</button></div>:null}
 </section><aside><section className="panel import-guide"><h2>Một nguồn gốc.<br/>Nhiều ngày đối chiếu.</h2>{[['01','Nạp bộ từ khóa gốc','Keywords + DMC3. Mỗi từ khóa có thể thuộc nhiều danh mục.'],['02','Import Query–URL','Query, URL, Impression và Position. Hệ thống tự nhận tiêu đề.'],['03','Map & phân tích','Loại URL chứa #, map bộ gốc; chỉ lưu các query khớp và URL của chúng.'],['04','Theo dõi thay đổi','So sánh hiệu suất và mức độ cannibal giữa các ngày đã lưu.']].map(([n,t,d])=><div className="guide-step" key={n}><span>{n}</span><div><h3>{t}</h3><p>{d}</p></div></div>)}<a className="text-link" download href="/templates/query-url.csv">Tải file CSV mẫu <ArrowRight size={14}/></a></section><p className="footnote">Các URL có fragment (#) được loại trước khi tổng hợp. Vị trí được tính theo trọng số impression; thiếu một phần vị trí sẽ được đánh dấu để kiểm tra.</p></aside></div>;
}
