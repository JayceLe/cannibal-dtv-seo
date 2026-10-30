create or replace function public.seo_finalize_import(p_import uuid) returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='120s' as $$
declare job public.seo_imports; n integer; mapped integer; excluded integer;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into job from public.seo_imports where id=p_import and owner_id=auth.uid() for update;
 if not found then raise exception 'Import not found';end if;
 if job.status='ready' then return job.quality;end if;
 select count(*) into n from public.seo_batches where import_id=p_import;
 if n<>job.expected_batches or exists(select 1 from generate_series(0,job.expected_batches-1) b where not exists(select 1 from public.seo_batches s where s.import_id=p_import and s.batch_no=b)) then raise exception 'Upload incomplete';end if;
 if not exists(select 1 from public.seo_keywords where owner_id=auth.uid()) then raise exception 'Import base keywords first';end if;
 with raw as (
 select r.* from public.seo_batches b cross join lateral jsonb_to_recordset(b.payload) r(key text,url text,impressions bigint,clicks bigint,weighted_position double precision,position_weight bigint,missing_rank bigint,invalid_rows integer) where b.import_id=p_import and strpos(coalesce(r.url,''),'#')=0
 ), agg as (
 select key,url,sum(impressions)::bigint impressions,sum(clicks)::bigint clicks,
 case when sum(position_weight)>0 and sum(missing_rank)=0 then sum(weighted_position)/sum(position_weight) end position,
 sum(invalid_rows)::integer invalid_rows from raw group by key,url
 ), grouped as (
 select key,coalesce(jsonb_agg(jsonb_build_object('url',url,'impressions',impressions,'clicks',clicks,'position',position) order by impressions desc,clicks desc,url collate "C") filter(where url<>''),'[]') urls,sum(impressions)::bigint impressions,sum(clicks)::bigint clicks,sum(invalid_rows)::integer invalid_rows from agg group by key
 ), joined as (
 select k.*,coalesce(g.urls,'[]') urls,coalesce(g.impressions,0) impressions,coalesce(g.clicks,0) clicks,coalesce(g.invalid_rows,0) invalid_rows from public.seo_keywords k inner join grouped g using(key) where k.owner_id=auth.uid()
 ), measured as (
 select j.*, (urls->0->>'position')::double precision leader_position,
 abs((urls->0->>'position')::double precision-(urls->1->>'position')::double precision) gap,
 coalesce((urls->0->>'impressions')::bigint>0 and exists(select 1 from jsonb_array_elements(urls) with ordinality u(v,ord) where ord>1 and (v->>'impressions')::bigint >= (urls->0->>'impressions')::bigint*0.2),false) cannibal from joined j
 )
 insert into public.seo_records(import_id,key,query,categories,urls,impressions,clicks,position,gap,cannibal,status,invalid_rows)
 select p_import,key,query,categories,urls,impressions,clicks,leader_position,gap,cannibal,
 case when invalid_rows>0 then 'data_issue' when jsonb_array_length(urls)=0 then 'no_data' when not cannibal then 'none' when leader_position is null then 'unknown' when leader_position>3 then 'danger' when gap is null then 'unknown' when round(gap::numeric,10)<0.5 then 'safe' when round(gap::numeric,10)<=1 then 'medium' else 'danger' end,invalid_rows from measured;
 select count(*) into mapped from public.seo_records where import_id=p_import and status<>'no_data';
 select count(distinct r.key) into excluded from public.seo_batches b cross join lateral jsonb_to_recordset(b.payload) r(key text) where b.import_id=p_import and not exists(select 1 from public.seo_keywords k where k.owner_id=auth.uid() and k.key=r.key);
 update public.seo_imports set status='ready',quality=quality||jsonb_build_object('mappedKeywords',mapped,'excludedKeywords',excluded+greatest(coalesce((job.quality->>'unmappedQueries')::integer,0),0),'exclusionAccountingVersion',1) where id=p_import returning quality into job.quality;
 delete from public.seo_batches where import_id=p_import;
 return job.quality;
end $$;


-- Previous finalization counted only server-side exclusions. Include the unique
-- queries already removed by the browser before upload, without retaining them.
update public.seo_imports set quality=quality||jsonb_build_object(
 'excludedKeywords',coalesce((quality->>'excludedKeywords')::integer,0)+greatest(coalesce((quality->>'unmappedQueries')::integer,0),0),
 'exclusionAccountingVersion',1)
where status='ready' and quality->>'mapped'='true' and quality ? 'unmappedQueries'
 and not (quality ? 'exclusionAccountingVersion');
