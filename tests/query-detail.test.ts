import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryDetails} from '../src/components/query-table';
import {buildRecords} from '../src/lib/engine';

const record=buildRecords([{key:'pin',query:'thay pin',categories:['PIN APPLE']}],[1000,500,200,199].map((impressions,i)=>({key:'pin',url:`https://site.test/url-${i+1}`,impressions,clicks:0,weighted_position:(2+i)*impressions,position_weight:impressions,missing_rank:0,invalid_rows:0})))[0];
test('query detail removes redundant copy, renders DMC3 ring and distinguishes eligible secondary URLs',()=>{
 const html=renderToStaticMarkup(React.createElement(QueryDetails,{record,categories:[{name:'PIN APPLE',total:10,cannibal:1,danger:1,impressions:10000,cannibalImpressions:700}]}));
 assert.doesNotMatch(html,/URL cạnh tranh|Xếp theo impression|URL đạt ngưỡng · đã loại Top 1|Impression cannibal =/);
 assert.match(html,/class="detail-impact-ring" role="img" aria-label="PIN APPLE: 7%"/);
 assert.match(html,/leader-url eligible-url|leader-url /);
 const rows=html.match(/<div role="row"[^>]*class="url-metric-row[^>]*>/g)!;
 assert.equal(rows.length,4);assert.match(rows[0],/leader-url/);assert.match(rows[1],/runner-url eligible-url/);assert.match(rows[2],/other-url eligible-url/);assert.doesNotMatch(rows[3],/eligible-url/);
});
