'use client';
import AnimatedNumber from './animated-number';
import{useCallback,useEffect,useRef,useState}from'react';
import dynamic from'next/dynamic';
import{ArrowRight,BookOpen,Check,Download,GitCompareArrows,LayoutDashboard,LockKeyhole,LogOut,Upload,X}from'lucide-react';
import type{User}from'@supabase/supabase-js';
import{cannibalImpressions,labels,number,queryKey,type RecordRow}from'@/lib/engine';
import{initialFilters,matchesQuery,overviewFromRecords,topTwoRankGap,type OverviewData,type QueryFilters}from'@/lib/overview';
import{configured,db}from'@/lib/supabase';
import{CategoryDistributions}from'./overview-charts';
import CannibalRatios from './cannibal-ratios';
import OverviewSummary from'./overview-summary';
import CategorySidebar from'./category-sidebar';
import QueryTable from'./query-table';
import Comparison from './comparison';
import {comparisonFilters,comparisonFromRecords,distinctDays,validComparisonDays,type Week,type ComparisonData,type ComparisonFilters} from '@/lib/comparison';
import HeaderDateSelect from'./header-date-select';
import DashboardMotion from './dashboard-motion';
import HeaderScene from './header-scene';
import CannibalRules from './cannibal-rules';
import {gsap} from 'gsap';
const Importer=dynamic(()=>import('./importer'),{loading:()=> <p className="muted">Đang nạp trình import…</p>});
function Dialog({title,wide=false,onClose,children}:{title:string;wide?:boolean;onClose:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),animation=useRef<gsap.core.Tween|null>(null),closing=useRef(false),closeCallback=useRef(onClose);closeCallback.current=onClose;
 useEffect(()=>{
  const node=ref.current!;node.showModal();
  const mq=matchMedia('(prefers-reduced-motion: reduce)');
  if(!mq.matches)animation.current=gsap.fromTo(node,{opacity:.75,y:12},{opacity:1,y:0,duration:.34,ease:'power3.out',clearProps:'opacity,transform'});
  const stop=()=>{if(mq.matches){animation.current?.kill();gsap.set(node,{clearProps:'opacity,transform'});if(closing.current)closeCallback.current();}};
  mq.addEventListener('change',stop);
  return()=>{animation.current?.kill();mq.removeEventListener('change',stop);if(node.open)node.close();};
 },[]);
 function close(){
  if(closing.current)return;closing.current=true;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){closeCallback.current();return;}
  animation.current?.kill();animation.current=gsap.to(ref.current,{opacity:0,y:8,duration:.2,ease:'power2.in',onComplete:()=>closeCallback.current()});
 }
 return <dialog ref={ref} className={`modal ${wide?'wide-modal':''}`} aria-label={title} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===ref.current){const r=ref.current!.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}}><button aria-label="Đóng" className="icon-button modal-close" onClick={close}><X size={20}/></button>{children}</dialog>;
}
const defaultData=overviewFromRecords([],initialFilters);
function csvCell(value:unknown){let v=String(value??'');if(/^[\s]*[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';}
export default function Dashboard(){
 const [showRules,setShowRules]=useState(false);
 const [comparisonRefresh,setComparisonRefresh]=useState(0);
 const motionRoot=useRef<HTMLDivElement>(null);
 const[view,setView]=useState<'overview'|'compare'>('overview'),[user,setUser]=useState<User|null>(null),[authReady,setAuthReady]=useState(false),[weeks,setWeeks]=useState<Week[]>([]),[selected,setSelected]=useState(''),[filters,setFilters]=useState<QueryFilters>(initialFilters),[data,setData]=useState<OverviewData>(defaultData),[loading,setLoading]=useState(false),[error,setError]=useState(''),[searchTerm,setSearchTerm]=useState(''),[password,setPassword]=useState(''),[authBusy,setAuthBusy]=useState(false),[authNote,setAuthNote]=useState(''),[showImport,setShowImport]=useState(false),[refresh,setRefresh]=useState(0),[older,setOlder]=useState(''),[newer,setNewer]=useState(''),[comparison,setComparison]=useState<ComparisonData|null>(null),[compareBusy,setCompareBusy]=useState(false),[toast,setToast]=useState('');
 const [compareFilters,setCompareFilters]=useState<ComparisonFilters>(comparisonFilters),[compareSearch,setCompareSearch]=useState('');
 useEffect(()=>{if(view!=='compare')return;const reload=()=>{if(document.visibilityState==='visible')setComparisonRefresh(n=>n+1);};window.addEventListener('focus',reload);return()=>window.removeEventListener('focus',reload);},[view]);
 const changeComparisonFilter=useCallback((part:Partial<ComparisonFilters>)=>setCompareFilters(f=>({...f,...part,page:part.page??0})),[]);
 useEffect(()=>{const t=setTimeout(()=>setCompareSearch(queryKey(compareFilters.search)),220);return()=>clearTimeout(t);},[compareFilters.search]);
 const requestId=useRef(0),identity=useRef<string|undefined>(undefined);
 const updateFilters=useCallback((part:Partial<QueryFilters>)=>{setFilters(f=>({...f,...part,page:part.page??0}));},[]);
 useEffect(()=>{const timer=setTimeout(()=>setSearchTerm(queryKey(filters.search)),220);return()=>clearTimeout(timer);},[filters.search]);
 useEffect(()=>{if(!configured){setAuthReady(true);return;}let active=true;
 const apply=(u:User|null)=>{if(!active)return;setAuthReady(true);if(identity.current===(u?.id||''))return;identity.current=u?.id||'';setUser(u);setFilters(initialFilters);setError('');setData(defaultData);setComparison(null);setSelected('');setWeeks([]);setOlder('');setNewer('');if(!u)setShowImport(false);};
 db().auth.getUser().then(({data})=>apply(data.user)).catch(()=>{if(active){setAuthReady(true);setAuthNote('Chưa kết nối được workspace. Vui lòng thử lại.');}});
 const{data:{subscription}}=db().auth.onAuthStateChange((_event,s)=>apply(s?.user??null));return()=>{active=false;subscription.unsubscribe();};},[]);
 useEffect(()=>{if(!user)return;let active=true;db().from('seo_imports').select('id,week_start,file_name,status,created_at').eq('status','ready').order('week_start',{ascending:false}).order('created_at',{ascending:false}).then(({data,error})=>{if(!active)return;if(error){setError(error.message);return;}const w=data as Week[],days=distinctDays(w);setWeeks(w);setSelected(current=>w.some(x=>x.id===current)?current:w[0]?.id||'');setNewer(current=>days.some(x=>x.id===current)?current:days[0]?.id||'');setOlder(current=>days.some(x=>x.id===current)?current:days[1]?.id||'');});return()=>{active=false;};},[user,refresh]);
 const openCategory=useCallback((name:string)=>{updateFilters({category:name});document.getElementById('dmc3-analysis')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});},[updateFilters]);
 useEffect(()=>{const seq=++requestId.current;if(!user)return;
  setLoading(true);setError('');db().rpc('seo_overview',{p_import:selected||null,p_category:filters.category,p_tab:filters.tab,p_status:filters.status,p_search:searchTerm,p_exact:filters.exact,p_page:filters.page,p_sort:filters.sort}).then(({data,error})=>{if(seq!==requestId.current)return;if(error)setError(error.message);else setData(data as OverviewData);setLoading(false);});
 },[user,selected,filters.category,filters.tab,filters.status,filters.exact,filters.page,filters.sort,searchTerm,refresh]);
 useEffect(()=>{
  if(!user||view!=='compare'||!validComparisonDays(weeks,older,newer)){setComparison(null);setCompareBusy(false);return;}
  let active=true;setCompareBusy(true);setError('');
  db().rpc('seo_comparison_overview',{p_older:older,p_newer:newer,p_category:filters.category,p_search:compareSearch,p_transition:compareFilters.transition,p_page:compareFilters.page,p_sort:compareFilters.sort}).then(({data,error})=>{if(!active)return;if(error){setError(error.message);setComparison(null);}else setComparison(data as ComparisonData);setCompareBusy(false);});
  return()=>{active=false;};
 },[user,view,older,newer,weeks,filters.category,compareSearch,compareFilters.transition,compareFilters.page,compareFilters.sort,comparisonRefresh]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(t);},[toast]);
 async function signIn(e:React.FormEvent){e.preventDefault();if(!configured)return;setAuthBusy(true);setAuthNote('');try{const{error}=await db().auth.signInWithPassword({email:'workspace@cannibal.invalid',password});if(error){setAuthNote('Mật khẩu chưa đúng hoặc chưa kết nối được.');return;}setPassword('');setToast('Đã mở workspace.');}catch{setAuthNote('Chưa kết nối được. Vui lòng thử lại.');}finally{setAuthBusy(false);}}
 async function exportCsv(){try{setToast('Đang chuẩn bị báo cáo…');
  if(view==='compare'){
   if(!validComparisonDays(weeks,older,newer))throw new Error('Cần chọn hai ngày dữ liệu khác nhau để xuất so sánh.');
   const read=async(id:string)=>{const rows:RecordRow[]=[];for(let offset=0;;offset+=1000){const {data,error}=await db().from('seo_records').select('key,query,categories,urls,impressions,clicks,position,gap,cannibal,status,invalid_rows').eq('import_id',id).neq('status','no_data').order('key').range(offset,offset+999);if(error)throw error;rows.push(...data as RecordRow[]);if(data.length<1000)return rows;}};
   const [a,b]=await Promise.all([read(older),read(newer)]),result=comparisonFromRecords(a,b,filters.category,{...compareFilters,search:compareSearch,page:0},[],Number.MAX_SAFE_INTEGER);
   const csv='\uFEFF'+[['Query','DMC3','Mức độ ngày trước','Mức độ ngày sau','Impression ngày trước','Impression ngày sau','Biến động impression'],...result.rows.map(r=>[r.query,r.categories.join(' | '),labels[r.old_status],labels[r.new_status],r.old_status==='no_data'?'':r.old_impressions,r.new_status==='no_data'?'':r.new_impressions,r.old_status==='no_data'||r.new_status==='no_data'?'':r.delta])].map(r=>r.map(csvCell).join(',')).join('\r\n');
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),anchor=document.createElement('a');anchor.href=url;anchor.download=`cannibal-compare-${weeks.find(w=>w.id===older)!.week_start}-${weeks.find(w=>w.id===newer)!.week_start}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setToast(`Đã xuất ${number(result.count)} query so sánh.`);return;
  }
  let rows:RecordRow[]=[];{if(!selected)throw new Error('Import dữ liệu Query–URL trước khi xuất báo cáo.');let offset=0;while(true){let q=db().from('seo_records').select('key,query,categories,urls,impressions,clicks,position,gap,cannibal,status,invalid_rows').eq('import_id',selected).neq('status','no_data').order('key').range(offset,offset+999);if(filters.category)q=q.contains('categories',[filters.category]);const{data,error}=await q;if(error)throw error;const batch=(data||[])as RecordRow[];rows.push(...batch.filter(r=>matchesQuery(r,{...filters,search:searchTerm})));if(batch.length<1000)break;offset+=1000;}}
  const csv='\uFEFF'+[['Query','DMC3','Mức độ','Có cannibal','URL','Impression query','Impression cannibal','Rank #1','Gap rank'],...rows.map(r=>[r.query,r.categories.join(' | '),labels[r.status],r.cannibal?'Có':'Không',r.urls.length,r.impressions,cannibalImpressions(r),r.position,topTwoRankGap(r)])].map(r=>r.map(csvCell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`cannibal-${weeks.find(w=>w.id===selected)?.week_start||'export'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setToast(`Đã xuất ${number(rows.length)} query đã map.`);
 }catch(e){setError(e instanceof Error?e.message:(e as {message?:string}).message||'Không xuất được báo cáo.');}}
 if(!authReady||!user)return <main className="workspace-entry"><a className="brand" href="/"><span className="brand-mark">CQ</span><span>Cannibal Query<small>SEO Intelligence</small></span></a><section className="panel workspace-entry-card"><span className="entry-icon"><LockKeyhole size={27}/></span><h1>Mở workspace</h1><p className="muted">Phân tích dữ liệu cannibal, theo dõi DMC3 và so sánh các ngày đã lưu.</p>{authReady?<form className="login-form" onSubmit={signIn}><label>Mật khẩu workspace<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nhập mật khẩu workspace"/></label><button className="btn primary" disabled={authBusy||!configured}>{authBusy?'Đang mở…':'Mở workspace'}<ArrowRight size={16}/></button></form>:<div className="entry-loading" role="status">Đang mở workspace…</div>}{authNote?<p role="alert" className="error-message">{authNote}</p>:null}{!configured?<p className="error-message">Website chưa kết nối được dữ liệu.</p>:null}</section><p className="entry-footer">Cannibal Query · Asia/Ho_Chi_Minh</p></main>;
 const s=data.summary,site=data.siteSummary;
 const memberships=data.categories.reduce((n,c)=>n+c.cannibal,0),membershipImpressions=data.categories.reduce((n,c)=>n+c.cannibalImpressions,0),overlap=memberships!==site.cannibal||membershipImpressions!==site.affectedImpressions;
 return <div className="app-shell" ref={motionRoot}><DashboardMotion root={motionRoot}/><header className="app-header"><HeaderScene/><a className="brand" href="/"><span className="brand-mark">CQ</span><span>Cannibal Query<small>SEO Intelligence</small></span></a><nav className="main-navigation" role="tablist" aria-label="Phân tích" onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'overview':e.key==='End'?'compare':view==='overview'?'compare':'overview';setView(next);document.getElementById(next==='overview'?'overview-tab':'compare-tab')?.focus();}}}><button id="overview-tab" role="tab" tabIndex={view==='overview'?0:-1} aria-selected={view==='overview'} aria-controls="analysis-content" onClick={()=>setView('overview')}><LayoutDashboard size={17}/>Tổng quan</button><button id="compare-tab" role="tab" tabIndex={view==='compare'?0:-1} aria-selected={view==='compare'} aria-controls="analysis-content" onClick={()=>{setView('compare');setComparisonRefresh(n=>n+1);}}><GitCompareArrows size={17}/>So sánh</button></nav><button className="btn secondary header-rules-button" aria-label="Quy tắc tính cannibal" title="Quy tắc tính cannibal" aria-haspopup="dialog" onClick={()=>setShowRules(true)}><BookOpen size={17}/><span>Quy tắc</span></button>{view==='overview'?<HeaderDateSelect periods={weeks} value={selected} onChange={id=>{setSelected(id);updateFilters({page:0});}}/>:null}<div className="header-actions"><button className="btn secondary" aria-label="Xuất CSV" title="Xuất CSV" onClick={exportCsv}><Download size={16}/><span>Xuất CSV</span></button><button className="btn primary" aria-label="Import dữ liệu" title="Import dữ liệu" onClick={()=>setShowImport(true)}><Upload size={16}/><span>Import dữ liệu</span></button><button className="icon-button account-button" aria-label="Đăng xuất workspace" title="Đăng xuất workspace" onClick={()=>void db().auth.signOut()}><LogOut size={18}/></button></div></header>
 <main role="tabpanel" id="analysis-content" aria-labelledby={view==='overview'?'overview-tab':'compare-tab'}>

 {error?<div role="alert" className="error-message">{error}<button className="text-link" onClick={()=>setRefresh(r=>r+1)}>Thử lại</button></div>:null}
 {view==='overview'?<>
 <CannibalRatios scoped={s} site={site} category={filters.category} categories={data.categories} loading={loading} onSelect={name=>updateFilters({category:name})}/>
 <section className="overview-section" aria-label="Tổng quan toàn site" aria-busy={loading}>
  <div className="section-title" data-motion-reveal><h1>Tổng quan toàn site</h1><span><AnimatedNumber value={site.withData}/> query đã map trong kỳ</span></div>
  <OverviewSummary categories={data.categories} siteCannibal={data.siteSummary.cannibal} onSelect={openCategory}/>
  <CategoryDistributions categories={data.categories} selected={filters.category} onSelect={openCategory}/>
  {overlap?<p className="distribution-note">Query thuộc nhiều DMC3 được tính ở từng nhóm; tỷ trọng biểu đồ tính trên tổng các nhóm.</p>:null}
 </section>
 <section id="query-analysis" className="analysis-section" aria-label="Phân tích theo DMC3"><div className="section-title" data-motion-reveal><h2>Query và URL cạnh tranh</h2></div>
 <div className="analysis-layout"><CategorySidebar categories={data.categories} selected={filters.category} total={site.cannibal} onSelect={name=>updateFilters({category:name})}/><div className="query-workspace"><QueryTable key={`${selected}:${filters.category}`} data={data} filters={filters} onFilter={updateFilters} loading={loading}/></div></div></section>
 </>:<Comparison weeks={weeks} older={older} newer={newer} onDates={pair=>{setOlder(pair.older);setNewer(pair.newer);changeComparisonFilter({page:0});setComparison(null);}} category={filters.category} onCategory={name=>{updateFilters({category:name});changeComparisonFilter({page:0});}} filters={compareFilters} onFilter={changeComparisonFilter} data={comparison} loading={compareBusy} onImport={()=>setShowImport(true)} onOpen={id=>{setSelected(id);setView('overview');updateFilters({page:0});}}/>}
 </main>

 {showRules?<CannibalRules onClose={()=>setShowRules(false)}/>:null}
 {showImport?<Dialog wide title="Import dữ liệu" onClose={()=>setShowImport(false)}><Importer demo={false} onDone={id=>{if(id)setSelected(id);setRefresh(r=>r+1);setToast('Đã lưu dữ liệu vào Supabase.');}} onLogin={()=>void db().auth.signOut()}/></Dialog>:null}
 {toast?<div className="toast" role="status" data-motion-reveal><Check size={16}/>{toast}</div>:null}
 </div>;
}
