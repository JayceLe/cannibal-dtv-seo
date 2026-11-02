import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSpyserp,rankingSummary,rankingMovement,rankingBandChanges,type Ranking} from '../src/lib/rankings';
const header=['Keywords','Category','Domains','Search engines','01.11.2026 19:24','25.10.2026 20:50'];
test('SpySERP reads dated columns and ignores Main; NA differs from >100',()=>{
 const p=parseSpyserp([['Project'],header,[' Pin  iPhone ','Main','dtv.vn','G1',2,'>100'],['camera','Main','dtv.vn','G1','NA',3]]);
 assert.deepEqual(p.dates,['2026-10-25','2026-11-01']);assert.equal(p.rows[0].key,'pin iphone');assert.equal(p.rows[0].positions['2026-10-25'],101);assert.equal(p.rows[1].positions['2026-11-01'],null);assert.equal('categories' in p.rows[0],false);
});
const row=(a:number|null,b:number|null):Ranking=>({key:'x',query:'x',categories:['PIN APPLE'],domain:'dtv.vn',engine:'G1',positions:{a,b}});
test('NA baseline enters Top 100 while unavailable -2 is excluded',()=>{
 assert.equal(rankingMovement(row(101,3),'a','b'),'new');assert.equal(rankingMovement(row(3,101),'a','b'),'lost');assert.equal(rankingMovement(row(null,3),'a','b'),'new');assert.equal(rankingMovement(row(3,-2),'a','b'),null);assert.equal(rankingMovement(row(8,2),'a','b'),'up');assert.equal(rankingMovement(row(2,8),'a','b'),'down');
});
test('rank summaries keep all tracked keywords in coverage and cap out-of-range at 101',()=>{
 const s=rankingSummary([row(1,1),row(1,3),row(1,101),row(1,null)],'b');assert.equal(s.total,3);assert.equal(s.ranked,2);assert.equal(s.missing,1);assert.equal(s.average,35);assert.equal(s.coverage,50);assert.equal(s.counts.reduce((a,b)=>a+b),3);
});
test('conflicting duplicate keyword rejects import instead of overwriting arbitrarily',()=>{
 assert.throws(()=>parseSpyserp([header,['pin','Main','dtv.vn','G1',2,3],['pin','Main','dtv.vn','G1',4,3]]),/trùng/);
});

test('-2 is N/A and is not a lost position',()=>{
 const p=parseSpyserp([header,['a53 5g cũ','Main','dtv.vn','G1',-2,15]]);
 assert.equal(p.rows[0].positions['2026-11-01'],-2);assert.equal(p.invalid,1);
 assert.equal(rankingMovement({...p.rows[0],query:'a53 5g cũ',categories:[]},'2026-10-25','2026-11-01'),null);
});

test('band changes reconcile NA entry without counting -2 as a lost rank',()=>{
 const data=[row(null,2),row(101,2),row(3,-2),row(1,5)];
 assert.deepEqual(rankingBandChanges(data,'a','b',1,3),{entered:2,left:1});
 assert.deepEqual(rankingBandChanges(data,'a','b',101,Infinity),{entered:0,left:2});
 assert.equal(rankingSummary(data,'b').missing,1);
});
