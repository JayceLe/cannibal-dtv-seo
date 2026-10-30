import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as echarts from 'echarts/core';
import {BarChart,SankeyChart} from 'echarts/charts';
import {GridComponent,TooltipComponent,AriaComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
import {comparisonFromRecords,comparisonFilters,type ComparisonCategory} from '../src/lib/comparison';
import {groupChanges,snapshotValues,rate,pointChange} from '../src/lib/comparison-report';
import {snapshotOption,categoryChangeOption,transitionOption} from '../src/lib/comparison-chart-options';
import {olderRecords,newerRecords} from './comparison-fixtures';
echarts.use([BarChart,SankeyChart,GridComponent,TooltipComponent,AriaComponent,SVGRenderer]);
const category=(name:string,old:number,next:number,total=10,oldAffected=50,newAffected=100):ComparisonCategory=>({name,old,new:next,delta:next-old,old_total:total,new_total:total,old_affected:oldAffected,new_affected:newAffected,affected_delta:newAffected-oldAffected});
test('DMC3 overview includes observed groups, improvement, remaining groups and deterministic largest changes',()=>{
 const stats=groupChanges([category('DROP',9,2),category('RISE',1,6),category('STABLE',1,1),category('ZERO',0,0),category('NO DATA',0,0,0),category('IMPRESSION',1,2,10,1000,0)]);
 assert.equal(stats.total,5);assert.equal(stats.improved,1);assert.equal(stats.worsened,2);assert.equal(stats.unchanged,2);assert.equal(stats.remaining,4);assert.equal(stats.drop!.name,'DROP');assert.equal(stats.rise!.name,'RISE');assert.equal(stats.impression!.name,'IMPRESSION');assert.equal(stats.impression!.affected_delta,-1000);
 assert.equal(groupChanges([]).drop,null);assert.equal(groupChanges([category('B',1,4),category('A',1,4)]).rise!.name,'A');
});
test('report ignores table search/page/transitions and maintains scoped flow conservation',()=>{
 const plain=comparisonFromRecords(olderRecords,newerRecords,'A'),filtered=comparisonFromRecords(olderRecords,newerRecords,'A',{...comparisonFilters,search:'nothing',page:1,transition:'new'});
 assert.deepEqual(filtered.report,plain.report);assert.deepEqual(filtered.categories,plain.categories);assert.equal(filtered.count,0);
 assert.equal(plain.report.flows.reduce((n,f)=>n+f.value,0),plain.report.transitions.changed);assert.ok(plain.report.flows.every(f=>f.from!==f.to));assert.equal(plain.report.category,'A');
 assert.equal(plain.report.site_new.withData,7);assert.equal(plain.new.withData,4);
});
test('query/impression snapshots and impact use precise totals and do not double count overlapping DMC3',()=>{
 const data=comparisonFromRecords(olderRecords,newerRecords,'A'),query=snapshotValues(data,'query'),impression=snapshotValues(data,'impression');
 assert.equal(query.old,4);assert.equal(query.next,4);assert.equal(impression.old,140);assert.equal(impression.next,176);
 assert.equal(data.report.site_new.affectedImpressions,256);assert.ok(data.categories.reduce((n,c)=>n+c.new_affected,0)>data.report.site_new.affectedImpressions);
 assert.equal(rate(0,0),0);assert.equal(snapshotValues(comparisonFromRecords([],[]),'query').newRate,0);
});
test('three chart models render finite SVG at phone, tablet and desktop widths with empty and large values',()=>{
 const data=comparisonFromRecords(olderRecords,newerRecords),groups=[category('DECREASE',10,2),category('INCREASE',1,15),category('ZERO',0,0)];
 for(const width of [280,390,768,1440])for(const option of [snapshotOption(24850,25887,['12/10/2026','19/10/2026']),categoryChangeOption(groups,'query','INCREASE'),categoryChangeOption(groups,'impression',''),transitionOption(data.report.flows),snapshotOption(0,0,['12/10/2026','19/10/2026']),snapshotOption(1e9,1e12,['12/10/2026','19/10/2026'])]){
  const chart=echarts.init(null,undefined,{renderer:'svg',ssr:true,width,height:300});chart.setOption({...option,animation:false});const svg=chart.renderToSVGString();assert.ok(svg.includes('<svg'));assert.ok(!/NaN|Infinity/.test(svg));chart.dispose();
 }
 assert.deepEqual(transitionOption([]).series,[]);
});

test('percentage point changes never display a signed zero for small real changes',()=>{
 assert.equal(pointChange(0),'Kh\u00f4ng \u0111\u1ed5i');assert.equal(pointChange(.002),'T\u0103ng <0,01 \u0111i\u1ec3m %');assert.equal(pointChange(-.002),'Gi\u1ea3m <0,01 \u0111i\u1ec3m %');assert.equal(pointChange(.017),'+0,02 \u0111i\u1ec3m %');
});
