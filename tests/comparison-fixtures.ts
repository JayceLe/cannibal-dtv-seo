import {classify,type RecordRow,type Status} from '../src/lib/engine';
export function comparisonRecord(key:string,status:Status,categories=['A'],leader=100):RecordRow {
 const rank=status==='danger'?4:2;
 const urls=status==='no_data'?[]:[{url:`https://example.test/${key}/main`,impressions:leader,clicks:0,position:rank,ratio:1},{url:`https://example.test/${key}/other`,impressions:leader*(status==='none'?.1:.4),clicks:0,position:rank+(status==='medium'?.75:.2),ratio:status==='none'?.1:.4}];
 return{key,query:key,categories,urls,impressions:urls.reduce((n,u)=>n+u.impressions,0),clicks:0,position:urls[0]?.position??null,invalid_rows:0,...classify(urls)};
}
export const olderRecords=[comparisonRecord('new','none'),comparisonRecord('resolved','danger',['B']),comparisonRecord('safe-medium','safe'),comparisonRecord('medium-danger','medium'),comparisonRecord('unchanged','none',['B'],400),comparisonRecord('only-old','safe',['A'],50),comparisonRecord('multiple','safe',['A','B']),comparisonRecord('unmapped','no_data')];
export const newerRecords=[comparisonRecord('new','safe',['A'],120),comparisonRecord('resolved','none',['B'],110),comparisonRecord('safe-medium','medium',['A'],90),comparisonRecord('medium-danger','danger',['A'],130),comparisonRecord('unchanged','none',['B'],500),comparisonRecord('only-new','danger',['B'],200),comparisonRecord('multiple','safe',['A','B']),comparisonRecord('unmapped','no_data')];
