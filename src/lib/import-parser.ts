import {headerKey,queryKey,parseNumber,type Keyword,type Metric} from './engine';
const aliases: Record<string,string[]>={query:['query','queries','top queries','search query','keyword','keywords','kw','key','tu khoa','tu khoa chinh','truy van','search term','gsc query'],categories:['dmc3','dmc 3','danh muc cap 3','danh muc 3','category 3','category level 3'],url:['url','urls','page','pages','top pages','landing page','link','trang dich','page url','gsc url'],impressions:['impressions','impression','impr','imp','hien thi','luot hien thi','so lan hien thi','gsc impressions'],clicks:['click','clicks','luot nhap','so lan nhap','luot click','gsc clicks'],position:['position','positions','average position','avg position','avg pos','rank','ranking','vi tri','vi tri trung binh','thu hang','gsc position']};
export function parseImportRows(rows:unknown[][],kind:'base'|'weekly',locale='vi-VN',baseKeys?:string[],onProgress?:(progress:number)=>void){
 const known=baseKeys?new Set(baseKeys):null,unmappedKeys=new Set<string>();
  const required=kind==='base'?['query','categories']:['query','url','impressions','position'];
  let cols:Record<string,number>={},header=-1;
  for(let i=0;i<Math.min(40,rows.length);i++){
   const map:Record<string,number>={};let duplicate=false;
   rows[i].forEach((v,c)=>{for(const key of required)if(aliases[key].includes(headerKey(v))){if(map[key]!=null)duplicate=true;map[key]=c;}});
   if(required.every(k=>map[k]!=null)){if(duplicate)throw new Error('Có cột tiêu đề trùng nhau. Hãy giữ một cột cho mỗi chỉ số.');cols=map;header=i;break;}
  }
  if(header<0){
   const isBase=kind==='weekly'&&rows.slice(0,40).some(row=>row.some(v=>aliases.query.includes(headerKey(v)))&&row.some(v=>aliases.categories.includes(headerKey(v))));
   if(isBase)throw new Error('Đây là file từ khóa gốc (Keywords + DMC3). Dữ liệu theo ngày cần Query, URL, Impression và Position.');
   throw new Error(`Không tìm thấy đủ cột: ${required.join(', ')} trong 40 dòng đầu.`);
  }
  const base=new Map<string,Keyword>(),metrics=new Map<string,Metric>();
  const quality={rows:0,invalid:0,missingRank:0,anchors:0,duplicates:0,blank:0,unmappedRows:0,unmappedQueries:0,mapped:known!=null,samples:[] as {row:number;reason:string}[]};
  for(let i=header+1;i<rows.length;i++){
   const r=rows[i];if(r.every(x=>x==null||x==='')){quality.blank++;continue;}quality.rows++;
   if(kind==='weekly'&&String(r[cols.url]??'').includes('#')){quality.anchors++;continue;}
   const key=queryKey(r[cols.query]);
   if(!key){quality.invalid++;if(quality.samples.length<10)quality.samples.push({row:i+1,reason:'Query trống'});continue;}
   if(kind==='weekly'&&known&&!known.has(key)){quality.unmappedRows++;unmappedKeys.add(key);continue;}
   if(kind==='base'){
    const category=String(r[cols.categories]??'').trim()||'Chưa có DMC3';
    const prev=base.get(key);if(prev){quality.duplicates++;if(!prev.categories.includes(category))prev.categories.push(category);}else base.set(key,{key,query:String(r[cols.query]).normalize('NFC').trim(),categories:[category]});
   }else{
    const url=String(r[cols.url]??'').trim();
    const impressions=parseNumber(r[cols.impressions],'count',locale),clicks=0,position=parseNumber(r[cols.position],'position',locale);
    let validUrl=false;try{const u=new URL(url);validUrl=['https:','http:'].includes(u.protocol)&&!!u.hostname;}catch{}
    const valid=validUrl && impressions!=null && Number.isSafeInteger(impressions) && impressions>=0;
    const id=JSON.stringify([key,valid?url:'']);
    const m=metrics.get(id)||{key,url:valid?url:'',impressions:0,clicks:0,weighted_position:0,position_weight:0,missing_rank:0,invalid_rows:0};
    if(!valid){quality.invalid++;m.invalid_rows++;if(quality.samples.length<10)quality.samples.push({row:i+1,reason:'URL hoặc impression không hợp lệ.'});}
    else {m.impressions+=impressions!;m.clicks+=clicks!;if(metrics.has(id))quality.duplicates++;if(position!=null&&position>=1){m.weighted_position+=position*impressions!;m.position_weight+=impressions!;}else if(impressions!>0){m.missing_rank+=impressions!;quality.missingRank++;}}
    if(!Number.isSafeInteger(m.impressions)||!Number.isSafeInteger(m.clicks)||!Number.isFinite(m.weighted_position))throw new Error('Tổng dữ liệu vượt giới hạn số an toàn; hãy chia nhỏ file.');
    metrics.set(id,m);
   }
   if(i%10000===0)onProgress?.(Math.round(i/rows.length*100));
  }
  for(const b of base.values())if(b.categories.length>1)b.categories=b.categories.filter(c=>c!=='Chưa có DMC3');
  quality.unmappedQueries=unmappedKeys.size;
  return {done:true as const,kind,data:kind==='base'?Array.from(base.values()):Array.from(metrics.values()),quality};
}
