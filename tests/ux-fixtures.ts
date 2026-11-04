import { comparisonRecord } from './comparison-fixtures';
import { knownCategories } from '../src/lib/categories';
import type { Week } from '../src/lib/comparison';

export const uxWeeks: Week[] = [
  {id:'ux-new',week_start:'2026-10-19',file_name:'fixture-new.csv',status:'ready',created_at:'2026-10-19T12:00:00Z'},
  {id:'ux-old',week_start:'2026-10-12',file_name:'fixture-old.csv',status:'ready',created_at:'2026-10-12T12:00:00Z'},
];
const names=['thay pin iphone 13','thay màn hình Samsung Galaxy S24 Ultra','sửa camera điện thoại','thay bàn phím laptop Dell Latitude','ép kính iPhone 16 Pro Max'];
export const uxOldRecords=Array.from({length:32},(_,i)=>comparisonRecord(`${names[i%names.length]} ${i+1}`,(['none','safe','medium','danger'] as const)[i%4],[knownCategories[i%knownCategories.length]],(i+1)*129));
export const uxNewRecords=uxOldRecords.slice(0,31).map((r,i)=>comparisonRecord(r.key,(['safe','medium','danger','none'] as const)[i%4],r.categories,(i+2)*147));
uxNewRecords.push(comparisonRecord('query mới có dữ liệu','danger',['PIN APPLE'],5300));
