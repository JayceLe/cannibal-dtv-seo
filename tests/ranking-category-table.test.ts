import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {Window} from 'happy-dom';
import RankingTopTrend from '../src/components/ranking-top-trend';
import {rankingCategoryTimeline,rankingSummary,type Ranking} from '../src/lib/rankings';
const dates=['2026-10-01','2026-10-06','2026-10-13','2026-10-20','2026-10-25','2026-11-01'];
const make=(key:string,categories:string[],rank:number|null):Ranking=>({key,query:key,categories,domain:'example.test',engine:'Google',positions:Object.fromEntries(dates.map(d=>[d,rank]))});
const rows=[make('a',['PIN'],1),make('b',['PIN'],4),make('c',['PIN'],null),make('d',['CAMERA'],2),make('e',['PIN','CAMERA','CAMERA'],51)];

test('DMC3 matrix agrees with rank summaries, preserves zero groups and counts shared keys once per group',()=>{
 const matrix=rankingCategoryTimeline(rows,dates,['PIN','CAMERA','EMPTY']);
 for(const group of matrix){
  const source=rows.filter(row=>row.categories.includes(group.category));
  assert.equal(group.total,source.length);
  dates.forEach((date,i)=>assert.deepEqual(group.counts[i],rankingSummary(source,date).tableCounts));
 }
 assert.deepEqual(matrix[2].counts[0],[0,0,0,0,0,0]);
 const edgeRows=[make('unavailable',['PIN'],-2),make('outside',['PIN'],101),{...make('missing',['PIN'],1),positions:{}}];
 assert.deepEqual(rankingCategoryTimeline(edgeRows,dates,['PIN'])[0].counts[0],[0,0,0,0,0,0]);
});

test('ranking table retains all dates for scrolling and smaller percentages; Top filters sum and select-all toggles off',async()=>{
 const win=new Window({url:'https://dashboard.test'});
 for(const key of ['document','HTMLElement','Element','Node'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:win[key]});
 Object.defineProperty(globalThis,'window',{configurable:true,value:win});
 Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{configurable:true,value:true});
 const host=win.document.createElement('div');win.document.body.append(host);
 const root=createRoot(host as unknown as Element);
 const props={rows,dates,timeline:dates.map(d=>rankingSummary(rows,d)),categories:['PIN','CAMERA','EMPTY','Chưa map DMC3'],category:''};
 const pinCell=()=>[...host.querySelectorAll('tbody tr')].find(r=>r.querySelector('th')?.textContent==='PIN')!.querySelector('td')!;
 try{
  await act(async()=>root.render(React.createElement(RankingTopTrend,props)));
  assert.equal(host.querySelectorAll('thead th').length,dates.length+1);
  assert.equal(host.querySelectorAll('tbody tr').length,4);
  assert.equal(host.querySelector('time')?.getAttribute('datetime'),dates[0]);
  assert.equal(pinCell().querySelector('strong')?.textContent,'3');
  assert.equal(pinCell().querySelector('small')?.textContent,'75,0%');
  const buttons=host.querySelectorAll('button');
  await act(async()=>buttons[0].click());
  assert.equal(pinCell().querySelector('strong')?.textContent,'0');
  await act(async()=>buttons[1].click());
  assert.equal(pinCell().querySelector('strong')?.textContent,'1');
  await act(async()=>buttons[2].click());
  assert.equal(pinCell().querySelector('strong')?.textContent,'2');
  assert.equal(pinCell().querySelector('small')?.textContent,'50,0%');
  assert.equal(host.querySelectorAll('button[aria-pressed="true"]').length,2);
  await act(async()=>root.render(React.createElement(RankingTopTrend,{...props,rows:rows.filter(r=>r.categories.includes('PIN')),category:'PIN'})));
  assert.equal(host.querySelectorAll('tbody tr').length,1);
  assert.equal(pinCell().querySelector('strong')?.textContent,'2');
 }finally{await act(async()=>root.unmount());await win.happyDOM.abort();}
});
