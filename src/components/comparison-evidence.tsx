import {ArrowRight,Info} from 'lucide-react';
import {comparisonEvidence} from '@/lib/comparison-evidence';
import {number,type RecordRow} from '@/lib/engine';
import {formatDataDate} from '@/lib/dates';
import type {Week} from '@/lib/comparison';
import {StatusBadge} from './query-table';
export default function ComparisonEvidence({older,newer,oldRecord,newRecord}:{older:Week;newer:Week;oldRecord:RecordRow;newRecord:RecordRow}){
 const evidence=comparisonEvidence(oldRecord,newRecord);
 return <section className="comparison-evidence" aria-label="Giải thích thay đổi của query" data-motion-reveal>
  <div className="evidence-periods">{[{period:older,record:oldRecord},{period:newer,record:newRecord}].map(({period,record},i)=><div className="evidence-period" key={period.id}><span>{i?'Ngày sau':'Ngày trước'}</span><div><h3>{formatDataDate(period.week_start)}</h3><StatusBadge status={record.status}/></div><small>{record.status==='no_data'?'Không có dữ liệu ngày này':number(record.impressions)+' impression query'}</small></div>)}</div>
  <div className={`evidence-verdict ${newRecord.status}`}><Info size={18} aria-hidden="true"/><p>{evidence.verdict}{evidence.changedLeader?<span> Top 1 đã đổi URL giữa hai ngày.</span>:null}</p></div>
  <div className="evidence-metrics">{evidence.metrics.map(metric=><article className="evidence-metric" data-trend={metric.delta==null?'missing':Math.abs(metric.delta)<1e-10?'steady':metric.delta>0?'increase':'decrease'} key={metric.key} data-hover-surface><h4>{metric.label}</h4><div className="evidence-values"><span>{metric.before}</span><ArrowRight size={16} aria-label="sang"/><strong>{metric.after}</strong></div><span className={`evidence-change ${metric.delta==null||Math.abs(metric.delta)<1e-10?'steady':metric.delta>0?'increase':'decrease'}`}>{metric.change}</span><p>{metric.note}</p></article>)}</div>
 </section>;
}
