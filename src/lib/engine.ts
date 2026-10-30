import {uiColors,semanticColors} from './design';
export type Status = 'danger' | 'medium' | 'safe' | 'none' | 'unknown' | 'data_issue' | 'no_data';
export type Keyword = { key: string; query: string; categories: string[] };
export type Metric = { key: string; url: string; impressions: number; clicks: number; weighted_position: number; position_weight: number; missing_rank: number; invalid_rows: number };
export type UrlMetric = { url: string; impressions: number; clicks: number; position: number | null; ratio: number | null };
export type RecordRow = { key: string; query: string; categories: string[]; urls: UrlMetric[]; impressions: number; clicks: number; position: number | null; gap: number | null; cannibal: boolean; status: Status; invalid_rows: number };
export const labels: Record<Status, string> = { danger: 'Nguy hiểm', medium: 'Trung bình', safe: 'An toàn', none: 'Không cannibal', unknown: 'Thiếu vị trí', data_issue: 'Lỗi dữ liệu', no_data: 'Chưa có dữ liệu' };
export const colors: Record<Status, string> = {danger:semanticColors.danger,medium:semanticColors.medium,safe:semanticColors.safe,none:uiColors.muted,unknown:semanticColors.review,data_issue:semanticColors.review,no_data:uiColors.soft};
export const queryKey = (x: unknown) => String(x ?? '').normalize('NFC').replace(/\uFEFF/g,'').replace(/\s+/g, ' ').trim().toLowerCase();
export const headerKey = (x: unknown) => queryKey(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[\r\n\t_./():–-]+/g, ' ').replace(/\s+/g,' ').trim();
export function parseNumber(value: unknown, kind: 'count' | 'position', locale = 'vi-VN'): number | null {
 if (typeof value === 'number') return Number.isFinite(value) ? value : null;
 let text = String(value ?? '').trim().replace(/[\s\u00a0\u202f]/g,'');
 if (!/^[+\-]?\d[\d.,]*$/.test(text)) return null;
 const comma = text.includes(','), dot = text.includes('.');
 if (comma && dot) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g,'').replace(',','.') : text.replace(/,/g,'');
 else if (comma || dot) {
  const parts = text.split(comma ? ',' : '.'); const grouped = /^[+\-]?\d{1,3}(?:[.,]\d{3})+$/.test(text);
  const decimal = comma ? /^(vi|de|fr)/.test(locale) : !/^(vi|de|fr)/.test(locale);
  if (parts.length > 2) { if (!grouped) return null; text = parts.join(''); }
  else text = grouped && (kind === 'count' || !decimal) ? parts.join('') : parts.join('.');
 }
 const n = Number(text); return Number.isFinite(n) ? n : null;
}
const rankPrecision=new Intl.NumberFormat('en-US',{useGrouping:false,minimumFractionDigits:1,maximumFractionDigits:1});
/** Use the same one-decimal rank for display, severity, gap and period deltas. */
export const roundRank=(value:number|null):number|null=>value==null||!Number.isFinite(value)?null:Number(rankPrecision.format(value))||0;
export function rankGap(first:number|null,second:number|null):number|null{
 const a=roundRank(first),b=roundRank(second);
 return a==null||b==null?null:Math.abs(Math.round(a*10)-Math.round(b*10))/10;
}
export function classify(urls: UrlMetric[], invalid = 0): Pick<RecordRow,'status'|'gap'|'cannibal'> {
 const a = urls[0], b = urls[1];
 const cannibal = !!a && a.impressions > 0 && urls.slice(1).some(u => u.impressions >= a.impressions * .2);
 const rank=roundRank(a?.position??null),gap=rankGap(a?.position??null,b?.position??null);
 let status: Status = 'none';
 if (invalid) status = 'data_issue'; else if (!a) status = 'no_data'; else if (cannibal) {
  if (rank == null) status = 'unknown'; else if (rank > 3) status = 'danger';
  else if (gap == null) status = 'unknown'; else status = Number(gap.toFixed(10)) < .5 ? 'safe' : Number(gap.toFixed(10)) <= 1 ? 'medium' : 'danger';
 }
 return {status,gap,cannibal};
}
export function buildRecords(base: Keyword[], metrics: Metric[]): RecordRow[] {
 const groups = new Map<string, Metric[]>();
 for(const m of metrics) { const a = groups.get(m.key) || []; a.push(m); groups.set(m.key,a); }
 return base.map(k => {
  const group=groups.get(k.key)||[]; const invalid_rows = group.reduce((s,r)=>s+r.invalid_rows,0);
  const urls: UrlMetric[] = group.filter(m=>m.url && !m.invalid_rows).map(m=>({url:m.url,impressions:m.impressions,clicks:m.clicks,position: m.position_weight>0 && m.missing_rank===0 ? m.weighted_position/m.position_weight : null,ratio:null}));
  urls.sort((a,b)=>b.impressions-a.impressions || b.clicks-a.clicks || (a.url<b.url?-1:a.url>b.url?1:0));
  urls.forEach(u=>u.ratio=urls[0].impressions>0?u.impressions/urls[0].impressions:null);
  return {...k,urls,invalid_rows,...classify(urls,invalid_rows),impressions:urls.reduce((s,u)=>s+u.impressions,0),clicks:urls.reduce((s,u)=>s+u.clicks,0),position:roundRank(urls[0]?.position??null)};
 });
}
// Only secondary URLs at or above 20% of the leading URL count as cannibal impressions.
// Sorting a copy also keeps legacy snapshots and imported URL order consistent.
export function cannibalImpressions(record: Pick<RecordRow,'urls'>): number {
 const urls=record.urls.slice().sort((a,b)=>b.impressions-a.impressions);
 const leader=urls[0]?.impressions||0;
 return leader>0?urls.slice(1).reduce((sum,u)=>sum+(u.impressions>=leader*.2?u.impressions:0),0):0;
}
export function summary(records: RecordRow[]) {
 const counts = Object.fromEntries(Object.keys(labels).map(k=>[k,0])) as Record<Status,number>;
 let impressions=0,clicks=0,cannibal=0,withData=0,affectedImpressions=0;
 for(const r of records){counts[r.status]++; impressions+=r.impressions; clicks+=r.clicks; if(r.status!=='no_data')withData++;if(r.cannibal){cannibal++;affectedImpressions+=cannibalImpressions(r);}}
 return {total:records.length,counts,impressions,clicks,cannibal,withData,affectedImpressions,ctr:impressions?clicks/impressions*100:0};
}
export type Summary = ReturnType<typeof summary>;
export const number = (v: number) => new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(v);
export const decimal = (v: number | null, digits=1) => v==null?'—':new Intl.NumberFormat('vi-VN',{maximumFractionDigits:digits}).format(v);

export const rankDisplay = (v:number|null) => {const rank=roundRank(v);return rank==null?'—':new Intl.NumberFormat('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:1}).format(rank);};
