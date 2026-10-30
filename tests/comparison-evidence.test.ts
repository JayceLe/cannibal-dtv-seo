import {test} from 'node:test';import assert from 'node:assert/strict';
import {classify,type RecordRow} from '../src/lib/engine';
import {comparisonEvidence,ratioDisplay} from '../src/lib/comparison-evidence';
const record=(impressions=10,rank:number|null=2,gap=.3,invalid=0):RecordRow=>{const urls=[{url:'https://example.test/main',impressions:100,position:rank,clicks:0,ratio:1},{url:'https://example.test/second',impressions,position:rank==null?null:rank+gap,clicks:0,ratio:impressions/100}];return {key:'pin',query:'pin',categories:['PIN'],urls,impressions:100+impressions,clicks:0,position:rank,invalid_rows:invalid,...classify(urls,invalid)};};
test('more total impressions cannot create cannibal without the 20% secondary threshold',()=>{
 const a=record(10,2,28.6),b=record(15,2,28.6);b.impressions=12000;
 const result=comparisonEvidence(a,b);assert.equal(result.metrics.length,4);assert.equal(result.next.affected,0);assert.match(result.verdict,/dưới ngưỡng 20%/);assert.match(result.metrics[3].note,/không tự tạo cannibal/);assert.equal(result.metrics[0].change,'Không đổi');
});
test('the impression ratio threshold is inclusive, and resolved cannibal is explained separately',()=>{
 const a=record(19.99),b=record(20);const start=comparisonEvidence(a,b);assert.equal(start.next.eligible,1);assert.match(start.metrics[1].note,/Đạt ngưỡng/);assert.equal(start.metrics[1].after,'20%');
 assert.match(comparisonEvidence(b,a).metrics[1].note,/hết cannibal/);assert.equal(ratioDisplay(19.9999),'<20%');assert.equal(ratioDisplay(.0001),'<0,01%');
});
test('gap crossings and rank priority use the rounded ranks shown to the user',()=>{
 const safe=record(40,2,.44),medium=record(40,2,.5),danger=record(40,2,1.06);
 assert.match(comparisonEvidence(safe,medium).verdict,/An toàn → Trung bình/);assert.match(comparisonEvidence(safe,medium).metrics[3].note,/Gap tăng qua 0,5/);assert.match(comparisonEvidence(medium,danger).verdict,/gap rank lớn hơn 1/);
 const highRank=record(40,3.06,.2),result=comparisonEvidence(safe,highRank);assert.equal(result.metrics[2].after,'3,1');assert.match(result.verdict,/rank Top 1 lớn hơn 3/);assert.match(result.metrics[2].change,/<0,1|Tăng/);assert.match(result.metrics[3].note,/ưu tiên/);
 const legacy={...danger,gap:99};assert.equal(comparisonEvidence(safe,legacy).next.gap,1.1);
});
test('missing ranks, invalid records and leader replacement do not produce false severity claims',()=>{
 const old=record(40),missing=record(40,null),invalid=record(40,4,.2,1);
 assert.equal(comparisonEvidence(old,missing).metrics[2].after,'—');assert.match(comparisonEvidence(old,missing).verdict,/Thiếu rank/);
 const result=comparisonEvidence(old,invalid);assert.match(result.verdict,/dữ liệu lỗi/);assert.doesNotMatch(result.metrics[2].note,/xếp mức Nguy hiểm/);
 const swapped={...old,urls:old.urls.map((u,i)=>({...u,impressions:i?150:100}))};assert.equal(comparisonEvidence(old,swapped).changedLeader,true);assert.match(comparisonEvidence(old,swapped).metrics[2].note,/đổi URL/);
});

test('one-day query detail shows missing values without claiming zero or a measured transition',()=>{
 const current=record(40,4);
 const missing={...current,urls:[],impressions:0,clicks:0,position:null,gap:null,cannibal:false,status:'no_data' as const};
 const joined=comparisonEvidence(missing,current);
 assert.ok(joined.verdict.includes('mới có dữ liệu'));assert.ok(joined.metrics.every(m=>m.before==='—'&&m.delta===null));
 const disappeared=comparisonEvidence(current,missing);
 assert.ok(disappeared.verdict.includes('chưa thể kết luận'));assert.ok(disappeared.metrics.every(m=>m.after==='—'));
});

test('equal displayed ranks have zero gap and no comparison increase/decrease',()=>{
 const before=record(40,2.34,0),after=record(40,2.26,.08);
 const result=comparisonEvidence(before,after);
 assert.equal(result.metrics[2].before,'2,3');assert.equal(result.metrics[2].after,'2,3');assert.equal(result.metrics[2].delta,0);assert.equal(result.metrics[2].change,'Không đổi');
 assert.equal(result.next.gap,0);assert.equal(result.metrics[3].after,'0,0');assert.equal(result.metrics[3].delta,0);assert.equal(result.metrics[3].change,'Không đổi');
});
