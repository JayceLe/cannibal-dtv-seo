import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {comparisonFilters,comparisonFromRecords,distinctDays,pairComparisonUrls,selectComparisonDay,validComparisonDays,type Week} from '../src/lib/comparison';
import {olderRecords,newerRecords,comparisonRecord} from './comparison-fixtures';
import Comparison from '../src/components/comparison';
import {ComparisonDetailView} from '../src/components/comparison-detail';
const weeks:Week[]=[{id:'29',week_start:'2026-10-29',file_name:'a.xlsx',status:'ready',created_at:'2026-10-29T10:00:00Z'},{id:'19',week_start:'2026-10-19',file_name:'b.xlsx',status:'ready',created_at:'2026-10-19T10:00:00Z'},{id:'20',week_start:'2026-10-20',file_name:'c.xlsx',status:'ready',created_at:'2026-10-20T10:00:00Z'}];
test('date selection uses distinct dates, keeps chronology and chooses the nearest valid alternative',()=>{
 const duplicate={...weeks[0],id:'29-latest',created_at:'2026-10-29T11:00:00Z'};
 assert.deepEqual(distinctDays([...weeks,duplicate]).map(w=>w.id),['29-latest','20','19']);
 assert.equal(validComparisonDays(weeks,'19','29'),true);assert.equal(validComparisonDays(weeks,'29','19'),false);assert.equal(validComparisonDays(weeks,'19','19'),false);
 assert.deepEqual(selectComparisonDay(weeks,{older:'19',newer:'20'},'older','20'),{older:'20',newer:'29'});
 assert.deepEqual(selectComparisonDay(weeks,{older:'20',newer:'29'},'newer','20'),{older:'19',newer:'20'});
 assert.deepEqual(selectComparisonDay(weeks,{older:'19',newer:'29'},'newer','20'),{older:'19',newer:'20'});
});
test('comparison includes common and one-day queries and computes scoped transitions independently',()=>{
 const d=comparisonFromRecords(olderRecords,newerRecords,'',comparisonFilters,['EMPTY']);
 assert.equal(d.matched,8);assert.equal(d.count,8);assert.deepEqual(d.transitions,{all:8,new:2,resolved:2,safe_medium:1,medium_danger:1,changed:4});
 assert.equal(d.old.withData,7);assert.equal(d.new.withData,7);assert.equal(d.old.affectedImpressions,180);assert.equal(d.new.affectedImpressions,256);
 assert.ok(d.rows.some(r=>r.key==='only-new'&&r.old_status==='no_data'));assert.ok(d.rows.some(r=>r.key==='only-old'&&r.new_status==='no_data'));assert.ok(!d.rows.some(r=>r.key==='unmapped'));assert.deepEqual(d.report.coverage,{new_common:1,new_only:1,resolved_common:1,old_only:1});assert.equal(d.old.cannibal+d.transitions.new-d.transitions.resolved,d.new.cannibal);assert.ok(d.rows.some(r=>r.key==='unchanged'));
 const filtered=comparisonFromRecords(olderRecords,newerRecords,'A',{...comparisonFilters,transition:'new'});
 assert.equal(filtered.count,1);assert.equal(filtered.matched,5);assert.equal(filtered.rows[0].key,'new');assert.equal(filtered.transitions.changed,3);
 assert.equal(d.categories.find(c=>c.name==='A')!.delta,0);assert.equal(d.categories.find(c=>c.name==='B')!.delta,0);assert.equal(d.categories.find(c=>c.name==='EMPTY')!.delta,0);
 assert.equal(comparisonFromRecords([],[]).new.withData,0);
});
test('search, transitions and sorting apply before pagination and export can include all matching queries',()=>{
 const stable=Array.from({length:35},(_,i)=>comparisonRecord(`query-${String(i).padStart(2,'0')}`,'none',['C'],100+i*10));
 const first=comparisonFromRecords(stable,stable,'',comparisonFilters),second=comparisonFromRecords(stable,stable,'',{...comparisonFilters,page:1});
 assert.equal(first.count,35);assert.equal(first.rows.length,25);assert.equal(second.rows.length,10);assert.equal(new Set([...first.rows,...second.rows].map(r=>r.key)).size,35);
 assert.equal(comparisonFromRecords(stable,stable,'',{...comparisonFilters,search:'QUERY-0'}).count,10);
 assert.equal(comparisonFromRecords(stable,stable,'',comparisonFilters,[],Number.MAX_SAFE_INTEGER).rows.length,35);
 const changed=comparisonFromRecords(olderRecords,newerRecords,'',{...comparisonFilters,transition:'changed',sort:'delta'});assert.equal(changed.count,4);assert.equal(changed.rows[0].key,'new');
});
test('URL pairs align the same address, retain missing days, and rank each day independently',()=>{
 const a=comparisonRecord('pin','safe'),b={...a,urls:[{...a.urls[1],impressions:200},{...a.urls[0],impressions:100},{...a.urls[1],url:'https://example.test/new',impressions:39}]};
 const pairs=pairComparisonUrls(a,b),formerLeader=pairs.find(p=>p.url===a.urls[0].url)!,newLeader=pairs.find(p=>p.url===a.urls[1].url)!;
 assert.equal(formerLeader.old!.order,1);assert.equal(formerLeader.new!.order,2);assert.equal(formerLeader.new!.eligible,true);assert.equal(formerLeader.new!.percent,50);
 assert.equal(newLeader.old!.order,2);assert.equal(newLeader.new!.order,1);assert.equal(newLeader.new!.eligible,false);
 assert.equal(pairs.find(p=>p.url==='https://example.test/new')!.old,null);assert.equal(pairs.find(p=>p.url==='https://example.test/new')!.new!.eligible,false);
});
test('comparison renders compact periods, overview report, counted filters and an aligned two-day URL detail',()=>{
 const data=comparisonFromRecords(olderRecords,newerRecords);
 const html=renderToStaticMarkup(React.createElement(Comparison,{weeks,older:'19',newer:'29',onDates:()=>{},category:'',onCategory:()=>{},data,loading:false,filters:comparisonFilters,onFilter:()=>{},onOpen:()=>{},onImport:()=>{}}));
 assert.equal((html.match(/class="comparison-report-card /g)||[]).length,10);assert.equal((html.match(/class="panel report-chart-card/g)||[]).length,3);assert.ok(html.includes('19/10/2026'));assert.ok(html.includes('Mới bị cannibal'));assert.ok(html.includes('Ngày trước'));assert.ok(html.includes('comparison-sidebar'));assert.ok(html.includes('Mới có dữ liệu ngày sau'));assert.ok(html.includes('Chưa có dữ liệu'));assert.ok(!html.includes('comparison-balance'));
 const empty=renderToStaticMarkup(React.createElement(Comparison,{weeks:[weeks[1]],older:'',newer:'19',onDates:()=>{},category:'',onCategory:()=>{},data:null,loading:false,filters:comparisonFilters,onFilter:()=>{},onOpen:()=>{},onImport:()=>{}}));
 assert.ok(empty.includes('Cần ít nhất hai ngày'));assert.ok(!empty.includes('comparison-query-table'));
 const detail=renderToStaticMarkup(React.createElement(ComparisonDetailView,{older:weeks[1],newer:weeks[0],oldRecord:olderRecords[0],newRecord:newerRecords[0]}));
 assert.equal((detail.match(/class="comparison-url-pair"/g)||[]).length,2);assert.equal((detail.match(/leader-url/g)||[]).length,2);assert.equal((detail.match(/runner-url/g)||[]).length,2);assert.equal((detail.match(/class="evidence-metric"/g)||[]).length,4);assert.ok(!detail.includes('period-metrics'));assert.ok(!detail.includes('number-display'));assert.ok(!detail.includes('Click'));
});
