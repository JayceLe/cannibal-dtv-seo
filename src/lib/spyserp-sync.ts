// SpySERP accepts POST for read operations too. Never add a mutating method here.
const READ_METHODS = new Set(['projectKeywords', 'projectDomains', 'projectSearchEngines', 'projectSchedules', 'statistic']);
const PROJECT = 256829;
const DOMAIN = 'dienthoaivui.com.vn';
const ENGINE = 'G1';
export type KeywordRow = {key_id:number;keyword:string;data:Record<string,unknown[]>};
type Schedule = {id:number;status:number;time_completed:number;data:{keywords_count:number;vis?:Record<string,Record<string,number>>};parseData?:{total:number}};
type DomainData = {domain_id:number;domain:string;data:{data:KeywordRow[]}[]};
const pause = (ms:number) => new Promise(resolve=>setTimeout(resolve,ms));
export function snapshotDate(timestamp:number) {
  if (!Number.isFinite(timestamp) || timestamp<=0) throw new Error('Invalid report completion date');
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp*1000));
}
export function normalizeSnapshot(rows:KeywordRow[],engineId:string,expected:number) {
  if (rows.length!==expected) throw new Error(`Incomplete snapshot: ${rows.length}/${expected} keywords`);
  const keys=new Set<string>(),ids=new Set<number>();
  let top100=0,outsideTop100=0,unavailable=0;
  const records=rows.map(row=>{
    const key=row.keyword.normalize('NFC').replace(/\uFEFF/g,'').replace(/\s+/g,' ').trim().toLowerCase();
    if (!key || keys.has(key) || ids.has(row.key_id)) throw new Error('Duplicate or empty keyword in SpySERP snapshot');
    keys.add(key);ids.add(row.key_id);
    const raw=row.data[engineId]?.[0];
    if (typeof raw!=='number' || !Number.isInteger(raw) || raw < -2 || raw===-1) throw new Error(`Invalid or missing rank: ${key}`);
    if(raw===-2) unavailable++; else if(raw===0 || raw>100) outsideTop100++; else top100++;
    return {key,query:row.keyword.trim(),position:raw===0?101:raw===-2?-2:Math.min(raw,101)};
  });
  return {records,keywords:records.length,top100,outsideTop100,unavailable};
}
export function makeSpyserpClient(token:string,projectId:number,transport:typeof fetch=fetch) {
  if(!token || projectId!==PROJECT) throw new Error('SpySERP project configuration is invalid');
  return async function read<T>(method:string,params:Record<string,unknown>={}):Promise<T> {
    if(!READ_METHODS.has(method)) throw new Error('Only approved read-only SpySERP methods are allowed');
    for(let attempt=0;attempt<3;attempt++) {
      let response:Response;
      try { response=await transport('https://spyserp.com/panel/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...params,token,method,project_id:PROJECT}),cache:'no-store',signal:AbortSignal.timeout(45000)}); } catch {
        if(attempt<2){await pause(3000*(attempt+1));continue;}
        throw new Error(`SpySERP ${method} network timeout`);
      }
      if(response.status===429 || response.status>=500) {if(attempt<2){await pause(3000*(attempt+1));continue;}}
      const text=await response.text();
      let data;
      try {data=JSON.parse(text);} catch {
        if(attempt<2){await pause(3000*(attempt+1));continue;}
        throw new Error(`SpySERP ${method} returned non-JSON (${response.status})`);
      }
      if(!response.ok || data.status_msg) throw new Error(`SpySERP ${method} read failed (${response.status}): ${String(data.status_msg||'Invalid response').replaceAll(token,'[redacted]')}`);
      return data as T;
    }
    throw new Error('SpySERP temporarily unavailable');
  };
}
async function database(action:string,payload:Record<string,unknown>={}) {
  const response=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/seo_spyserp_worker`,{method:'POST',headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,'Content-Type':'application/json'},body:JSON.stringify({p_secret:process.env.CRON_SECRET,p_action:action,p_payload:payload}),cache:'no-store',signal:AbortSignal.timeout(120000)});
  if(!response.ok) throw new Error(`Ranking sync database failed (${response.status})`);
  return response.json();
}
export async function syncSpyserp(verifyOnly=false) {
  const read=makeSpyserpClient(process.env.SPYSERP_API_KEY!,Number(process.env.SPYSERP_PROJECT_ID));
  // Low request volume and fixed batches stay well below SpySERP's 50 / 10s limit.
  const keywordMeta=await read<{totalCount:number}>('projectKeywords',{pageSize:1});
  const domains=await read<{items:{domain_id:number;domain:string}[]}>('projectDomains',{pageSize:100});
  const engines=await read<Record<string,{short:string}>>('projectSearchEngines');
  const domain=domains.items.find(d=>d.domain===DOMAIN);
  const engine=Object.entries(engines).find(([,e])=>e.short===ENGINE);
  if(!domain || !engine) throw new Error('Expected domain / G1 engine not found');
  const schedules:Schedule[]=[];
  for(let page=0;page<100;page++) {
    const data=await read<{items:Schedule[];totalCount:number}>('projectSchedules',{status:4,pageSize:100,page});
    schedules.push(...data.items);
    if(schedules.length>=data.totalCount)break;
    if(!data.items.length || page===99)throw new Error('Incomplete report history');
    await pause(1000);
  }
  const completed=schedules.filter(s=>s.status===4 && s.time_completed>0).sort((a,b)=>a.time_completed-b.time_completed);
  if(!completed.length)throw new Error('No completed SpySERP report');
  let lease:string|undefined;
  const results:Record<string,unknown>[]=[];
  let skipped=0;
  try {
    const state=verifyOnly?{receipts:{},dates:{},lease:undefined}:await database('claim');
    lease=state.lease;
    const latest=completed[completed.length-1];
    for(const schedule of (verifyOnly?[latest]:completed)) {
      const date=snapshotDate(schedule.time_completed);
      // Existing imported history needs no transfer; always reconcile the latest once.
      if(!verifyOnly && (state.receipts[String(schedule.id)] || (schedule.id!==latest.id && state.dates[date]>=(schedule.parseData?.total||schedule.data.keywords_count)))) {skipped++;continue;}
      const expected=schedule.parseData?.total||schedule.data.keywords_count;
      if(!Number.isSafeInteger(expected)||expected<1||expected>100000)throw new Error('Invalid snapshot keyword count');
      const fetchPage=async (page:number)=>{
        const data=await read<Record<string,DomainData[]>>('statistic',{domain:domain.domain_id,se:[Number(engine[0])],schedules:String(schedule.id),show:'all',top:'all',pageSize:30,keyPage:page,withLinks:0,withAnchors:0,withSnippets:0});
        const block=data[String(schedule.id)]?.find(d=>d.domain_id===domain.domain_id);
        if(!block)throw new Error('SpySERP report page missing');
        return block.data.flatMap(category=>category.data);
      };
      const rows=await fetchPage(0);
      // SpySERP currently returns 300 keywords despite pageSize=30. Derive paging
      // from the actual first page and verify identities/counts before writing.
      const actualPageSize=rows.length;
      if(!actualPageSize)throw new Error('Empty SpySERP page');
      const pages=Math.ceil(expected/actualPageSize);
      for(let first=1;first<pages;first+=4) {
        await pause(1500);
        const batch=await Promise.all(Array.from({length:Math.min(4,pages-first)},(_,i)=>fetchPage(first+i)));
        for(const page of batch) rows.push(...page);
      }
      const snapshot=normalizeSnapshot(rows,engine[0],expected);
      const sourceTop100=schedule.data.vis?.[engine[0]]?.[String(domain.domain_id)];
      if(sourceTop100!==undefined && snapshot.top100!==sourceTop100)throw new Error('Top 100 total does not match SpySERP report');
      if(schedule.id===latest.id && snapshot.keywords!==keywordMeta.totalCount)throw new Error('Project keyword list changed during sync; retry with stable data');
      const stored=verifyOnly?{}:await database('commit',{lease,schedule:String(schedule.id),date,expected,rows:snapshot.records});
      results.push({schedule:schedule.id,date,keywords:snapshot.keywords,top100:snapshot.top100,outsideTop100:snapshot.outsideTop100,unavailable:snapshot.unavailable,...stored});
    }
    const summary={ok:true,mode:verifyOnly?'verify':'sync',project:PROJECT,domain:DOMAIN,engine:ENGINE,projectKeywords:keywordMeta.totalCount,reports:results,skipped,latestDate:snapshotDate(latest.time_completed),checkedAt:new Date().toISOString()};
    if(lease)await database('release',{lease,...summary});
    return summary;
  } catch(error) {
    if(lease)await database('release',{lease,ok:false,error:error instanceof Error?error.message:'Sync failed'}).catch(()=>{});
    throw error;
  }
}
