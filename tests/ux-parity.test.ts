import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import OverviewWorkspace from '../src/components/overview-workspace';
import Comparison from '../src/components/comparison';
import FilterSummary from '../src/components/filter-summary';
import { overviewFromRecords, initialFilters } from '../src/lib/overview';
import { comparisonFromRecords, comparisonFilters } from '../src/lib/comparison';
import { knownCategories } from '../src/lib/categories';
import { uxOldRecords, uxNewRecords, uxWeeks } from './ux-fixtures';
const noop=()=>{};

test('overview keeps taxonomy, ratios, distributions and query controls in the new reading order',()=>{
 const data=overviewFromRecords(uxNewRecords,initialFilters,knownCategories);
 const html=render(React.createElement(OverviewWorkspace,{data,filters:initialFilters,loading:false,onFilter:noop,onSelect:noop,periodId:'ux-new'}));
 assert.ok(html.indexOf('id="overview-title"') < html.indexOf('id="dmc3-analysis"'));
 assert.ok(html.indexOf('Lọc theo DMC3') < html.indexOf('Tỷ lệ cannibal'));
 for(const label of ['Số DMC3 bị cannibal','Nhóm cannibal cao nhất','Nhóm cannibal thấp nhất','Impression cannibal lớn nhất','Query đã map','Có cannibal','Không cannibal','Khớp chính xác','An toàn','Trung bình','Nguy hiểm','Sắp xếp query','Gap rank','Trang sau','Tỷ trọng query cannibal theo DMC3','Tỷ trọng impression cannibal theo DMC3','nhóm đồng hạng']) assert.ok(html.includes(label),label);
 for(const name of knownCategories) assert.ok(html.includes(name.replaceAll('_',' ')),name);
 assert.match(html,/aria-label="Bảng query, cuộn để xem đầy đủ"/);
});

test('selected overview retains both denominators and removable OR filter state',()=>{
 const filters={...initialFilters,category:'CAMERA',status:'medium,danger',search:'pin',exact:true,tab:'cannibal' as const};
 const data=overviewFromRecords(uxNewRecords,filters,knownCategories);
 const html=render(React.createElement(OverviewWorkspace,{data,filters,loading:false,onFilter:noop,onSelect:noop,periodId:'ux-new'}));
 for(const label of ['DMC3 so với toàn site','Trong DMC3','Bỏ lọc CAMERA','Bỏ lọc Trung bình','Bỏ lọc Nguy hiểm','Bỏ lọc Từ khóa: pin','Bỏ lọc Khớp chính xác','Xóa tất cả']) assert.ok(html.includes(label),label);
 assert.equal((html.match(/class="ratio-visual"/g)||[]).length,4);
});

test('comparison preserves reports, union rows, transitions, full taxonomy and chart alternatives',()=>{
 const data=comparisonFromRecords(uxOldRecords,uxNewRecords,'',comparisonFilters,knownCategories);
 const html=render(React.createElement(Comparison,{weeks:uxWeeks,older:'ux-old',newer:'ux-new',onDates:noop,category:'',onCategory:noop,data,loading:false,filters:comparisonFilters,onFilter:noop,onImport:noop}));
 for(const label of ['Ngày trước','Ngày sau','Biến động DMC3','Nhóm cải thiện','Nhóm tăng cannibal','Nhóm không đổi','Giảm nhiều nhất','Tăng nhiều nhất','Nhóm còn cannibal','Mới bị cannibal','Đã hết cannibal','Cannibal giữa hai ngày','Query đổi mức độ','Biến động theo DMC3','An toàn → Trung bình','Trung bình → Nguy hiểm','Đổi mức độ','Mới có dữ liệu ngày sau','query mới có dữ liệu','Trang so sánh sau']) assert.ok(html.includes(label),label);
 for(const name of knownCategories) assert.ok(html.includes(name.replaceAll('_',' ')),name);
 assert.match(html,/Query có dữ liệu ở ít nhất một ngày/);
});

test('filter state is absent when empty and uses labelled controls for every removable chip',()=>{
 assert.equal(render(React.createElement(FilterSummary,{chips:[],onClear:noop})), '');
 const html=render(React.createElement(FilterSummary,{chips:[{key:'a',label:'Nhóm có tên rất dài',clear:noop}],onClear:noop}));
 assert.match(html,/aria-label="Bỏ lọc Nhóm có tên rất dài"/);
 assert.match(html,/<ul>/);assert.match(html,/Xóa tất cả/);
});
