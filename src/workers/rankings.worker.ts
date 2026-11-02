import read from 'read-excel-file/web-worker';
import {parseSpyserp} from '../lib/rankings';
self.onmessage=async(e:MessageEvent<File>)=>{try{const sheets=await read(e.data);const sheet=sheets.find(s=>s.data.some(r=>r.includes('Keywords')));if(!sheet)throw new Error('Không tìm thấy bảng thứ hạng SpySERP.');self.postMessage(parseSpyserp(sheet.data));}catch(e){self.postMessage({error:e instanceof Error?e.message:String(e)});}};
