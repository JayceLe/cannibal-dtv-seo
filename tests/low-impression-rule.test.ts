import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRecords,cannibalImpressions,cannibalThresholdLabel,qualifiesCannibal} from '../src/lib/engine';
import {rankedUrls,overviewFromRecords,initialFilters} from '../src/lib/overview';
import {pairComparisonUrls,comparisonFromRecords,comparisonFilters} from '../src/lib/comparison';
import {comparisonEvidence} from '../src/lib/comparison-evidence';
const make=(counts:number[])=>buildRecords([{key:'pin',query:'Thay pin',categories:['PIN']}],counts.map((impressions,i)=>({key:'pin',url:`https://example.test/${i}`,impressions,clicks:0,weighted_position:impressions*2,position_weight:impressions,missing_rank:0,invalid_rows:0})))[0];
test('low impression rule uses total query volume and strictly greater than 80%',()=>{
 for(const [counts,expected] of [[[10,6,3],false],[[10,8,1],false],[[10,9],true],[[10,6,4],true],[[5,3],false],[[5,4],false],[[6,5],true],[[19],false],[[0,0],false]] as [number[],boolean][]){
  const record=make(counts);assert.equal(record.cannibal,expected,counts.join('/'));
 }
 assert.equal(qualifiesCannibal(6,10,19),false);
 assert.equal(qualifiesCannibal(8,10,19),false);
 assert.equal(qualifiesCannibal(9,10,19),true);
 assert.equal(qualifiesCannibal(2,10,20),true);
 assert.equal(cannibalThresholdLabel(make([10,6,3])),'> 80%');
 assert.equal(cannibalThresholdLabel(make([10,6,4])),'≥ 20%');
});
test('URL eligibility, affected impressions and overview counts use the same threshold',()=>{
 const record=make([10,9]);assert.equal(cannibalImpressions(record),9);
 assert.deepEqual(rankedUrls(record).map(u=>u.reachesThreshold),[false,true]);
 const rejected=make([10,6,3]);assert.equal(cannibalImpressions(rejected),0);
 const data=overviewFromRecords([record],initialFilters,['PIN']);
 assert.equal(data.siteSummary.cannibal,1);assert.equal(data.siteSummary.affectedImpressions,9);
 assert.equal(data.categories[0].cannibalImpressions,9);
});
test('comparison reuses the new rule, including crossing the 20-impression boundary',()=>{
 const old=make([10,6,3]),next=make([10,6,4]);
 const pairs=pairComparisonUrls(old,next);
 assert.equal(pairs.find(p=>p.url.endsWith('/1'))?.old?.eligible,false);
 assert.equal(pairs.find(p=>p.url.endsWith('/1'))?.new?.eligible,true);
 const result=comparisonFromRecords([old],[next],'',comparisonFilters,['PIN']);
 assert.equal(result.transitions.new,1);
 const reverse=comparisonEvidence(next,old);
 assert.match(reverse.metrics[1].note,/> 80%/);assert.equal(reverse.next.affected,0);
});
