import{test}from'node:test';import assert from'node:assert/strict';
type Result={done?:boolean;error?:string;quality?:{invalid:number;anchors:number;unmappedRows:number;unmappedQueries:number;mapped:boolean};data?:{clicks:number;key:string;url:string;impressions:number}[]};
const scope={postMessage:(_r:Result)=>{},onmessage:undefined as undefined|((e:{data:{file:File;kind:string;locale:string;baseKeys?:string[]}})=>Promise<void>)};
Object.assign(globalThis,{self:scope});const ready=import('../src/workers/import.worker');
async function parse(csv:string,baseKeys?:string[]){await ready;let result:Result={};scope.postMessage=r=>{result=r;};await scope.onmessage!({data:{file:new File([csv],'data.csv'),kind:'weekly',locale:'en-US',baseKeys}});return result;}
test('weekly CSV requires only Query, URL, Impression, Position and ignores click data',async()=>{
 for(const csv of ['Query,URL,Impression,Position\nquery,https://x.test/a,1000,2.2','Query,URL,Impression,Position,Clicks\nquery,https://x.test/a,1000,2.2,not-a-number']){
  const result=await parse(csv);assert.equal(result.error,undefined);assert.equal(result.done,true);assert.equal(result.quality?.invalid,0);assert.equal(result.data?.[0].clicks,0);assert.equal(result.data?.[0].impressions,1000);
 }
});
test('import removes every anchor row before mapping and uploads matched query data only',async()=>{
 const result=await parse('Query,URL,Impression,Position\nTHAY PIN,https://x.test/main,1000,2\nthay pin,https://x.test/second,300,2.5\nthay pin,https://x.test/main#review,5000,1\nkhông khớp,https://x.test/unknown,9000,1\nkhông khớp,https://x.test/unknown#anchor,10000,1',['thay pin']);
 assert.equal(result.error,undefined);assert.equal(result.data?.length,2);assert.ok(result.data?.every(r=>r.key==='thay pin'&&!r.url.includes('#')));assert.equal(result.data?.reduce((s,r)=>s+r.impressions,0),1300);
 assert.equal(result.quality?.anchors,2);assert.equal(result.quality?.unmappedRows,1);assert.equal(result.quality?.unmappedQueries,1);assert.equal(result.quality?.mapped,true);
});
test('a base keyword list cannot be silently imported as dated Query–URL metrics',async()=>{
 const r=await parse('Keywords,DMC3\nthay pin,PIN APPLE',['thay pin']);assert.match(r.error||'',/file từ khóa gốc/);assert.equal(r.done,undefined);
});

test('Landing Page export preserves typed Excel positions with Vietnamese number settings',async()=>{
 const {parseImportRows}=await import('../src/lib/import-parser');
 const result=parseImportRows([['Landing Page','Query','Url Clicks','Average Position','Impressions','URL CTR'],['https://x.test/main','query',900,2.125,20,.5],['https://x.test/second','query',123,2.5,5,.3]],'weekly','vi-VN',['query']);
 assert.equal(result.data.length,2);const row=result.data[0];assert.ok('weighted_position' in row);assert.equal(row.weighted_position,42.5);assert.equal(row.impressions,20);assert.equal(row.clicks,0);assert.equal(result.quality.invalid,0);
});
