import{test}from'node:test';import assert from'node:assert/strict';
import{overviewFromRecords,categoryShares,initialFilters,reviewCount,rankedUrls,queryCategoryImpact}from'../src/lib/overview';
import{summary,type RecordRow}from'../src/lib/engine';
const r=(key:string,categories:string[],cannibal:boolean,impressions:number,status:RecordRow['status']):RecordRow=>({key,query:key,categories,cannibal,impressions,clicks:2,status,position:2,gap:.5,urls:cannibal?[{url:`https://x.test/${key}/main`,impressions:impressions*.8,clicks:0,position:2,ratio:1},{url:`https://x.test/${key}/second`,impressions:impressions*.2,clicks:0,position:2.5,ratio:.25}]:[],invalid_rows:0});
const records=[r('máy ảnh',['CAMERA'],true,100,'danger'),r('pin',['PIN','CAMERA'],true,50,'medium'),r('khác',['PIN'],false,500,'none'),r('chưa map',['CAMERA'],false,0,'no_data')];
test('DMC3 badges count cannibal queries and pie weights count cannibal impressions',()=>{const d=overviewFromRecords(records,initialFilters);assert.equal(d.siteSummary.cannibal,2);assert.deepEqual(d.categories.find(c=>c.name==='CAMERA'),{name:'CAMERA',total:2,cannibal:2,danger:1,impressions:150,cannibalImpressions:30});assert.equal(d.categories.find(c=>c.name==='PIN')!.cannibalImpressions,10);});
test('pie shares include all DMC3, sum to 100 and handle overlapping membership and zero',()=>{const d=overviewFromRecords(records,{...initialFilters,category:'PIN'});for(const metric of['cannibal','cannibalImpressions']as const){const shares=categoryShares(d.categories,metric);assert.equal(shares.length,2);assert.ok(Math.abs(shares.reduce((s,c)=>s+c.percent,0)-100)<1e-10);}assert.deepEqual(categoryShares([], 'cannibal'),[]);assert.equal(categoryShares([{name:'X',total:1,cannibal:0,danger:0,impressions:0,cannibalImpressions:0}],'cannibal')[0].percent,0);});
test('scope KPIs ignore table filters, global pies ignore selected group',()=>{const d=overviewFromRecords(records,{...initialFilters,category:'CAMERA',tab:'review'});assert.equal(d.summary.total,2);assert.equal(d.summary.cannibal,2);assert.equal(d.siteSummary.total,3);assert.equal(d.count,0);assert.equal(d.rows.length,0);assert.equal(d.categories.length,2);assert.equal(reviewCount(d.summary),0);});
test('exact search preserves accents and combines tab and severity',()=>{assert.equal(overviewFromRecords(records,{...initialFilters,search:'MÁY ẢNH',exact:true}).count,1);assert.equal(overviewFromRecords(records,{...initialFilters,search:'máy',exact:true}).count,0);assert.equal(overviewFromRecords(records,{...initialFilters,tab:'cannibal',status:'medium'}).count,1);assert.equal(overviewFromRecords(records,{...initialFilters,tab:'none'}).count,1);assert.equal(reviewCount(summary([])),0);});

test('unmapped queries never appear in counts, categories or any table filter',()=>{for(const tab of ['all','cannibal','none','review']as const){const d=overviewFromRecords(records,{...initialFilters,tab});assert.ok(d.rows.every(r=>r.status!=='no_data'));assert.equal(d.siteSummary.total,3);}const empty=overviewFromRecords([records[3]],initialFilters);assert.equal(empty.count,0);assert.equal(empty.summary.total,0);assert.equal(empty.categories.length,0);});
test('Top 1 and Top 2 use actual impression order and precise percentages',()=>{const record={...records[0],impressions:7826,urls:[{url:'https://x.test/b',impressions:1638,clicks:0,position:3.4,ratio:null},{url:'https://x.test/a',impressions:5542,clicks:0,position:2.1,ratio:null}]};const urls=rankedUrls(record);assert.equal(urls[0].url,'https://x.test/a');assert.equal(urls[0].percent,100);assert.equal(urls[1].order,2);assert.equal(urls[1].percent!.toFixed(2),'29.56');assert.equal(urls[1].reachesThreshold,true);const impact=queryCategoryImpact(record,[{name:'CAMERA',total:10,cannibal:2,danger:1,impressions:184722,cannibalImpressions:10000}]);assert.equal(impact[0].percent!.toFixed(2),'4.24');const zero=rankedUrls({...record,urls:record.urls.map(u=>({...u,impressions:0}))});assert.equal(zero[0].percent,null);assert.equal(zero[1].reachesThreshold,false);});

test('complete taxonomy remains visible without counting unmapped keywords',()=>{const d=overviewFromRecords(records,initialFilters,['CAMERA','PIN','LAPTOP_RAM']);assert.equal(d.categories.length,3);assert.equal(d.categories.find(c=>c.name==='LAPTOP_RAM')!.total,0);assert.equal(d.categories.find(c=>c.name==='LAPTOP_RAM')!.cannibal,0);assert.equal(d.siteSummary.total,3);assert.equal(d.siteSummary.affectedImpressions,30);assert.equal(d.summary.affectedImpressions,30);const pin=overviewFromRecords(records,{...initialFilters,category:'PIN'},['CAMERA','PIN','LAPTOP_RAM']);assert.equal(pin.summary.affectedImpressions,10);assert.equal(pin.siteSummary.affectedImpressions,30);});

test('overview rankings use group cannibal / site cannibal, exclude unobserved groups and handle ties',async()=>{
 const {overviewHighlights}=await import('../src/lib/overview');
 const categories=[{name:'A',total:4,cannibal:3,danger:0,impressions:10000,cannibalImpressions:400},{name:'B',total:20,cannibal:5,danger:0,impressions:20000,cannibalImpressions:900},{name:'C',total:10,cannibal:0,danger:0,impressions:1000,cannibalImpressions:0},{name:'No data',total:0,cannibal:0,danger:0,impressions:0,cannibalImpressions:0}];
 const h=overviewHighlights(categories,8);assert.equal(h.affected,2);assert.equal(h.highest?.name,'B');assert.equal(h.highest?.percent,62.5);assert.equal(h.lowest?.name,'C');assert.equal(h.lowest?.percent,0);assert.equal(h.topImpressions?.name,'B');assert.equal(h.mappedGroups,3);assert.equal(overviewHighlights([],0).highest,null);
 assert.equal(overviewHighlights([...categories,{...categories[1],name:'B2',total:8,cannibal:5}],13).highest?.ties,2);
});
test('overview share denominator counts each site query once across overlapping groups',async()=>{
 const {overviewHighlights}=await import('../src/lib/overview');
 const d=overviewFromRecords(records,initialFilters);
 const h=overviewHighlights(d.categories,d.siteSummary.cannibal);
 assert.equal(h.highest?.name,'CAMERA');assert.equal(h.highest?.percent,100);assert.equal(h.lowest?.percent,50);
 assert.equal(overviewHighlights(d.categories,0).highest,null);
});
test('site and within-DMC3 rates use all matched queries and their impressions',async()=>{
 const {ratioComparisons}=await import('../src/lib/overview');
 const d=overviewFromRecords(records,{...initialFilters,category:'CAMERA'});
 const both=ratioComparisons(d.summary,d.siteSummary,'CAMERA');assert.equal(both.length,2);
 assert.deepEqual(both[0].query,{numerator:2,denominator:3});assert.deepEqual(both[1].query,{numerator:2,denominator:2});
 assert.deepEqual(both[0].impression,{numerator:30,denominator:650});assert.deepEqual(both[1].impression,{numerator:30,denominator:150});
 assert.equal(ratioComparisons(d.siteSummary,d.siteSummary,'').length,1);
});
test('level counts follow DMC3, tab and search while ignoring selected severity',()=>{
 const d=overviewFromRecords(records,{...initialFilters,category:'CAMERA',status:'danger'});assert.deepEqual(d.levelCounts,{all:2,safe:0,medium:1,danger:1});assert.equal(d.count,1);
 const searched=overviewFromRecords(records,{...initialFilters,tab:'cannibal',search:'pin'});assert.deepEqual(searched.levelCounts,{all:1,safe:0,medium:1,danger:0});
 const noCannibal=overviewFromRecords(records,{...initialFilters,tab:'none'});assert.deepEqual(noCannibal.levelCounts,{all:1,safe:0,medium:0,danger:0});
});

test('rank gap subtracts the displayed one-decimal ranks of impression Top 1 and Top 2',async()=>{
 const {topTwoRankGap}=await import('../src/lib/overview');const {rankDisplay}=await import('../src/lib/engine');
 const record={...records[0],gap:99,urls:[{url:'https://x/third',impressions:1495,position:2.0809364548495,clicks:0,ratio:null},{url:'https://x/second',impressions:1502,position:2.65379494007989,clicks:0,ratio:null},{url:'https://x/first',impressions:1573,position:3.33121424030515,clicks:0,ratio:null}]};
 assert.equal(topTwoRankGap(record),.6);assert.equal(rankDisplay(topTwoRankGap(record)),'0,6');assert.equal(rankDisplay(record.urls[2].position),'3,3');assert.equal(rankDisplay(record.urls[1].position),'2,7');assert.equal(rankDisplay(2),'2,0');
 assert.equal(topTwoRankGap({...record,urls:record.urls.slice(0,1)}),null);assert.equal(topTwoRankGap({...record,urls:record.urls.map(u=>({...u,position:null}))}),null);
 assert.equal(rankDisplay(topTwoRankGap({...record,urls:record.urls.slice(1).map(u=>({...u,position:3}))})),'0,0');
});

test('multiple severity selection uses OR, supports toggle/reset and keeps counts independent',async()=>{
 const {toggleLevel,selectedLevels}=await import('../src/lib/overview');
 let status=toggleLevel('','medium');status=toggleLevel(status,'danger');assert.deepEqual(selectedLevels(status),['medium','danger']);
 const d=overviewFromRecords(records,{...initialFilters,status});assert.equal(d.count,2);assert.ok(d.rows.every(r=>r.status==='medium'||r.status==='danger'));assert.deepEqual(d.levelCounts,{all:3,safe:0,medium:1,danger:1});
 status=toggleLevel(status,'medium');assert.equal(status,'danger');assert.equal(overviewFromRecords(records,{...initialFilters,status}).count,1);
 assert.equal(toggleLevel(status,'danger'),'');assert.equal(toggleLevel('medium,danger',''),'');assert.equal(overviewFromRecords(records,{...initialFilters,status:'medium,danger',tab:'none'}).count,0);
});
