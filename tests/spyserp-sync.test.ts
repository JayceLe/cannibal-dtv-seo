import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSpyserpClient,normalizeSnapshot,snapshotDate,type KeywordRow} from '../src/lib/spyserp-sync';
const row=(id:number,query:string,rank:unknown):KeywordRow=>({key_id:id,keyword:query,data:{'17909':[rank,false,false,false,0]}});
test('API ranks preserve unknown vs outside Top 100 and canonical Vietnamese keys',()=>{
 const result=normalizeSnapshot([row(1,'  Thay  pin iPhone ',1),row(2,'Ngoài top',0),row(3,'Chưa đo',-2),row(4,'Rank 120',120)],'17909',4);
 assert.deepEqual(result.records.map(r=>r.position),[1,101,-2,101]);
 assert.equal(result.records[0].key,'thay pin iphone');assert.equal(result.top100,1);assert.equal(result.outsideTop100,2);assert.equal(result.unavailable,1);
});
test('Incomplete, repeated and malformed source pages cannot be committed',()=>{
 assert.throws(()=>normalizeSnapshot([row(1,'a',1)],'17909',2),/Incomplete/);
 assert.throws(()=>normalizeSnapshot([row(1,'a',1),row(1,'b',2)],'17909',2),/Duplicate/);
 assert.throws(()=>normalizeSnapshot([row(1,'A',1),row(2,' a ',2)],'17909',2),/Duplicate/);
 for(const value of [null,'1',-1,-3,1.5])assert.throws(()=>normalizeSnapshot([row(1,'a',value)],'17909',1),/Invalid/);
});
test('History uses Vietnam report completion date matching existing XLSX dates',()=>{
 assert.equal(snapshotDate(1792442351),'2026-10-20');assert.equal(snapshotDate(1793535848),'2026-11-01');
});
test('SpySERP client refuses every mutating method before any network call',async()=>{
 let calls=0;
 const read=makeSpyserpClient('test-token',256829,(async()=>{calls++;return Response.json({items:[],totalCount:0});}) as typeof fetch);
 for(const method of ['projectDelete','projectKeywordsAdd','projectKeywordsDeleteAll','projectSchedulesAdd','projectAutoSchedulesUpdate'])await assert.rejects(()=>read(method),/read-only/);
 assert.equal(calls,0);
 await read('projectKeywords');assert.equal(calls,1);
 assert.throws(()=>makeSpyserpClient('test-token',1),/configuration/);
});
test('Token, method and project cannot be overridden by read parameters',async()=>{
 let body:Record<string,unknown>={};
 const read=makeSpyserpClient('secret',256829,(async(_url,init)=>{body=JSON.parse(String(init?.body));return Response.json({items:[]});}) as typeof fetch);
 await read('projectKeywords',{token:'other',project_id:1,method:'projectDelete'});
 assert.equal(body.token,'secret');assert.equal(body.project_id,256829);assert.equal(body.method,'projectKeywords');
});
