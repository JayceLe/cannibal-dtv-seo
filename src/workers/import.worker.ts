import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file/web-worker';
import {parseImportRows} from '../lib/import-parser';
self.onmessage=async(e:MessageEvent<{file:File;kind:'base'|'weekly';locale:string;sheet?:number;baseKeys?:string[]}>)=>{
 try{
  const {file,kind,locale,sheet,baseKeys}=e.data;
  let rows:unknown[][];
  if(/\.xlsx$/i.test(file.name)){
   const sheets=await readXlsxFile(file);
   if(sheets.length>1 && sheet==null){self.postMessage({sheets:sheets.map(s=>s.sheet)});return;}
   if(!sheets[sheet??0])throw new Error('Tab không tồn tại.');
   rows=sheets[sheet??0].data;
  }else if(/\.(csv|tsv)$/i.test(file.name)){
   const parsed=Papa.parse<unknown[]>(await file.text(),{skipEmptyLines:'greedy'});
   if(parsed.errors.length)throw new Error(`CSV không hợp lệ: ${parsed.errors[0].message}`);
   rows=parsed.data;
  }else throw new Error('Chỉ hỗ trợ .xlsx, .csv và .tsv.');
  self.postMessage(parseImportRows(rows,kind,locale,baseKeys,progress=>self.postMessage({progress})));
 }catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
