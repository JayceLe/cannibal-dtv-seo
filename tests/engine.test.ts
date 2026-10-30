import {test} from 'node:test';import assert from 'node:assert/strict';
import {classify,parseNumber,queryKey,summary,buildRecords,roundRank,rankGap,type UrlMetric} from '../src/lib/engine';
const urls=(a:number|null,b:number|null,imp=200):UrlMetric[]=>[{url:'https://a.test/a',impressions:1000,clicks:10,position:a,ratio:1},{url:'https://a.test/b',impressions:imp,clicks:2,position:b,ratio:imp/1000}];
test('20% threshold stays exact while rank and severity use one-decimal inputs',()=>{assert.equal(classify(urls(2,2.44)).status,'safe');assert.equal(classify(urls(2,2.49)).status,'medium');assert.equal(classify(urls(2,2.5)).status,'medium');assert.equal(classify(urls(2,3)).status,'medium');assert.equal(classify(urls(2,3.06)).status,'danger');assert.equal(classify(urls(3.06,3.1)).status,'danger');assert.equal(classify(urls(2,2.5,199)).cannibal,false);assert.equal(classify(urls(2,2.5,200)).cannibal,true);});
test('missing ranks and malformed mapped rows cannot become safe',()=>{assert.equal(classify(urls(null,2)).status,'unknown');assert.equal(classify(urls(2,null)).status,'unknown');assert.equal(classify(urls(4,null)).status,'danger');assert.equal(classify(urls(2,2.1),1).status,'data_issue');assert.equal(classify([]).status,'no_data');assert.equal(classify(urls(2,2.1).map(u=>({...u,impressions:0}))).status,'none');});
test('mapping preserves Vietnamese diacritics and canonical equivalence',()=>{assert.equal(queryKey('  THAY  PIN\n iPhone '),'thay pin iphone');assert.equal(queryKey('SỬA'.normalize('NFD')),queryKey('SỬA'));assert.notEqual(queryKey('sửa'),queryKey('sua'));});
test('locale numbers, grouping and invalid counts',()=>{assert.equal(parseNumber('1.234,5','position','vi-VN'),1234.5);assert.equal(parseNumber('1,234.5','position','en-US'),1234.5);assert.equal(parseNumber('1.234','count','vi-VN'),1234);assert.equal(parseNumber('2,75','position','vi-VN'),2.75);assert.equal(parseNumber('n/a','count'),null);assert.equal(parseNumber('','count'),null);assert.equal(parseNumber(Infinity,'count'),null);});
test('partial rank stays null and percentages derive from sums',()=>{const rows=buildRecords([{key:'a',query:'A',categories:['X','Y']},{key:'b',query:'B',categories:['X']}],[{key:'a',url:'https://a.test',impressions:1000,clicks:25,weighted_position:400,position_weight:200,missing_rank:800,invalid_rows:0}]);assert.equal(rows[0].position,null);assert.equal(rows[1].status,'no_data');assert.equal(summary(rows).ctr,2.5);assert.equal(summary(rows).total,2);assert.equal(summary([]).ctr,0);});

test('cannibal impressions exclude Top 1 and every below-threshold secondary URL',async()=>{
 const {cannibalImpressions}=await import('../src/lib/engine');
 const make=(impressions:number)=>({url:`https://a.test/${impressions}`,impressions,clicks:0,position:2,ratio:null});
 const urls=[make(1000),make(750),make(200),make(199),make(1)];
 assert.equal(cannibalImpressions({urls}),950);
 assert.equal(cannibalImpressions({urls:[...urls].reverse()}),950);
 assert.equal(cannibalImpressions({urls:[]}),0);
 assert.equal(cannibalImpressions({urls:[make(1000)]}),0);
 assert.equal(cannibalImpressions({urls:[make(0),make(0)]}),0);
 assert.equal(cannibalImpressions({urls:[make(1000),make(1000),make(200)]}),1200);
 const record={key:'a',query:'A',categories:['PIN'],urls,impressions:2150,clicks:0,position:2,gap:.5,cannibal:true,status:'medium' as const,invalid_rows:0};
 assert.equal(summary([record]).affectedImpressions,950);
 assert.equal(summary([record]).impressions,2150);
});

 test('rank calculations agree with displayed inputs, keep raw source ranks and handle ties',()=>{
 assert.equal(roundRank(2.25),2.3);assert.equal(roundRank(2.55),2.6);assert.equal(roundRank(null),null);assert.equal(roundRank(NaN),null);
 assert.equal(rankGap(2.26,2.34),0);assert.equal(rankGap(3.331214,2.653794),.6);assert.equal(rankGap(2,null),null);
 assert.equal(classify(urls(2.26,2.34)).gap,0);assert.equal(classify(urls(3.04,3.14)).status,'safe');assert.equal(classify(urls(3.05,3.14)).status,'danger');
 const [record]=buildRecords([{key:'a',query:'A',categories:['PIN']}],[{key:'a',url:'https://example.test',impressions:100,clicks:0,weighted_position:225,position_weight:100,missing_rank:0,invalid_rows:0}]);
 assert.equal(record.position,2.3);assert.equal(record.urls[0].position,2.25,'Keep the raw source rank available');
 });
