import {cannibalImpressions,decimal,labels,number,rankDisplay,roundRank,type RecordRow} from './engine';
import {rankedUrls,topTwoRankGap} from './overview';
export function evidenceSnapshot(record:RecordRow){
 const urls=rankedUrls(record),leader=urls[0],second=urls[1];
 return {affected:cannibalImpressions(record),ratio:leader?.impressions>0?(second?.percent??0):null,rank:leader?.position??null,gap:topTwoRankGap(record),eligible:urls.filter(u=>u.reachesThreshold).length,leader:leader?.url??null,urlCount:urls.length};
}
export function ratioDisplay(value:number|null,eligible?:boolean){
 if(value==null)return '—';if(value>0&&value<.01)return '<0,01%';
 if(value<20&&value>19.995)return eligible?'20%':'<20%';if(value>20&&value<20.005)return '>20%';
 return decimal(value,2)+'%';
}
function change(a:number|null,b:number|null,digits:number,unit=''){
 if(a==null||b==null)return 'Chưa đủ dữ liệu';const difference=b-a;if(Math.abs(difference)<1e-10)return 'Không đổi';
 const threshold=10**-digits,small=Number(Math.abs(difference).toFixed(digits))===0;
 return `${difference>0?'Tăng':'Giảm'} ${small?'<'+decimal(threshold,digits):decimal(Math.abs(difference),digits)}${unit?' '+unit:''}`;
}
function currentRule(record:RecordRow,s:ReturnType<typeof evidenceSnapshot>){
 if(record.status==='data_issue')return 'Có dòng dữ liệu lỗi; chưa đủ cơ sở kết luận mức độ.';
 if(record.status==='unknown')return 'Thiếu rank để xác định mức độ cannibal.';
 if(record.status==='no_data')return 'Chưa có dữ liệu để đối chiếu.';
 if(!record.cannibal){
  if(s.urlCount<2)return 'Chưa có URL phụ cạnh tranh.';
  if(s.ratio==null)return 'Impression Top 1 bằng 0; chưa đủ điều kiện cannibal.';
  return `URL phụ cao nhất chỉ đạt ${ratioDisplay(s.ratio)} impression Top 1, dưới ngưỡng 20%.`;
 }
 if(s.rank!=null&&s.rank>3)return 'Đã đạt ngưỡng cannibal và rank Top 1 lớn hơn 3.';
 if(s.gap==null||s.rank==null)return 'Đã đạt ngưỡng cannibal nhưng thiếu rank để phân mức.';
 const gap=Number(s.gap.toFixed(10));
 return gap>1?'Đã đạt ngưỡng cannibal và gap rank lớn hơn 1.':gap>=.5?'Đã đạt ngưỡng cannibal, rank Top 1 ≤ 3 và gap từ 0,5 đến 1.':'Đã đạt ngưỡng cannibal, rank Top 1 ≤ 3 và gap dưới 0,5.';
}
export function comparisonEvidence(previous:RecordRow,current:RecordRow){
 const old=evidenceSnapshot(previous),next=evidenceSnapshot(current),changedLeader=Boolean(old.leader&&next.leader&&old.leader!==next.leader);
 const thresholdOld=old.eligible>0,thresholdNew=next.eligible>0;
 const thresholdNote=!thresholdOld&&thresholdNew?'Đạt ngưỡng ≥ 20%: phát sinh cannibal.':thresholdOld&&!thresholdNew?'Không còn đạt 20%: hết cannibal.':thresholdNew?'URL phụ vẫn đạt ≥ 20% impression Top 1.':next.ratio==null?'Chưa xác định tỷ lệ URL phụ / Top 1.':'Chưa có URL phụ đạt 20% impression Top 1.';
 const rankNote=current.status==='data_issue'?'Có dữ liệu lỗi; chưa dùng rank để kết luận.':changedLeader?'Top 1 đã đổi URL; rank được lấy theo URL dẫn đầu mỗi ngày.':!current.cannibal?'Chưa đạt cannibal; rank chưa quyết định mức độ.':next.rank==null?'Thiếu rank Top 1 để phân mức.':next.rank>3?'Rank Top 1 > 3: xếp mức Nguy hiểm.':'Rank Top 1 ≤ 3: tiếp tục xét gap rank.';
 let gapNote=current.status==='data_issue'?'Cần kiểm tra dữ liệu trước khi phân mức.':!current.cannibal?'Chưa đạt cannibal; gap lớn cũng không tự tạo cannibal.':next.rank!=null&&next.rank>3?'Rank Top 1 > 3 được ưu tiên xếp Nguy hiểm.':next.gap==null?'Cần rank của cả Top 1 và Top 2.':Number(next.gap.toFixed(10))>1?'Gap > 1: mức Nguy hiểm.':Number(next.gap.toFixed(10))>=.5?'Gap từ 0,5 đến 1: mức Trung bình.':'Gap < 0,5: mức An toàn.';
 if(current.cannibal&&current.status!=='data_issue'&&next.rank!=null&&next.rank<=3&&old.gap!=null&&next.gap!=null){
  const band=(n:number)=>Number(n.toFixed(10))<.5?0:Number(n.toFixed(10))<=1?1:2;
  if(band(old.gap)!==band(next.gap))gapNote=band(next.gap)===2?'Gap vượt 1: thuộc ngưỡng Nguy hiểm.':band(next.gap)===0?'Gap xuống dưới 0,5: thuộc ngưỡng An toàn.':band(old.gap)===0?'Gap tăng qua 0,5: thuộc ngưỡng Trung bình.':'Gap giảm về 0,5–1: thuộc ngưỡng Trung bình.';
 }
 let verdict=previous.status===current.status?`Giữ trạng thái ${labels[current.status].toLocaleLowerCase('vi')}. `:`${labels[previous.status]} → ${labels[current.status]}. `;
 verdict+=currentRule(current,next);
 const result={old,next,changedLeader,verdict,metrics:[
  {key:'impressions',label:'Impression cannibal',before:number(old.affected),after:number(next.affected),delta:next.affected-old.affected,change:change(old.affected,next.affected,0,'impression'),note:old.eligible!==next.eligible?`Số URL phụ đạt 20%: ${old.eligible} → ${next.eligible}.`:next.eligible?`Có ${next.eligible} URL phụ đạt ngưỡng 20%.`:'Chưa có URL phụ đạt ngưỡng 20%.'},
  {key:'ratio',label:'URL phụ cao nhất / Top 1',before:ratioDisplay(old.ratio,thresholdOld),after:ratioDisplay(next.ratio,thresholdNew),delta:old.ratio==null||next.ratio==null?null:next.ratio-old.ratio,change:change(old.ratio,next.ratio,2,'điểm %'),note:thresholdNote},
  {key:'rank',label:'Rank Top 1',before:rankDisplay(old.rank),after:rankDisplay(next.rank),delta:old.rank==null||next.rank==null?null:roundRank(next.rank-old.rank),change:change(old.rank,next.rank,1),note:rankNote},
  {key:'gap',label:'Gap rank',before:rankDisplay(old.gap),after:rankDisplay(next.gap),delta:old.gap==null||next.gap==null?null:roundRank(next.gap-old.gap),change:change(old.gap,next.gap,1),note:gapNote}
 ]};
 if(previous.status==='no_data'||current.status==='no_data'){
  result.verdict=previous.status==='no_data'?'Query mới có dữ liệu ngày sau. '+currentRule(current,next):'Không có dữ liệu ngày sau; chưa thể kết luận query đã hết cannibal.';
  result.metrics=result.metrics.map(m=>({...m,before:previous.status==='no_data'?'—':m.before,after:current.status==='no_data'?'—':m.after,delta:null as number|null,change:'Chưa có mốc đối chiếu'}));
 }
 return result;
}
