-- week_start is the existing reporting-date column; it now accepts any calendar date.
alter table public.seo_imports drop constraint seo_imports_week_start_check;
comment on column public.seo_imports.week_start is 'User-selected data date (legacy column name); not restricted to Mondays.';
create index seo_batches_owner on public.seo_batches(owner_id);

create or replace function public.seo_base_keys() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(key order by key),'[]'::jsonb) from public.seo_keywords
$$;
revoke execute on function public.seo_base_keys() from public,anon;
grant execute on function public.seo_base_keys() to authenticated;

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
 update public.seo_imports set status='ready',quality=quality||jsonb_build_object('mappedKeywords',mapped,'excludedKeywords',excluded) where id=p_import returning quality into job.quality;
 delete from public.seo_batches where import_id=p_import;
 return job.quality;
end $$;

create or replace function public.seo_overview(p_import uuid default null,p_category text default '',p_tab text default 'all',p_status text default '',p_search text default '',p_exact boolean default false,p_page integer default 0,p_sort text default 'impressions') returns jsonb language sql stable security invoker set search_path='' as $$
 with all_rows as materialized (
 select key,query,categories,urls,impressions,clicks,position,gap,cannibal,status,invalid_rows,cannibal_impressions from public.seo_records where import_id=p_import and status<>'no_data'
 ), scope as (select * from all_rows where p_category='' or p_category=any(categories)),
 tabbed as (select * from scope where
 (p_tab='all' or (p_tab='cannibal' and cannibal) or (p_tab='none' and status='none') or (p_tab='review' and status in ('unknown','data_issue')))
 and (p_search='' or (p_exact and key=p_search) or (not p_exact and strpos(key,p_search)>0))),
 filtered as (select * from tabbed where p_status='' or status=p_status or (p_status='unclassified' and status in ('unknown','data_issue'))),
 level_counts as (select jsonb_build_object('all',count(*),'safe',count(*) filter(where status='safe'),'medium',count(*) filter(where status='medium'),'danger',count(*) filter(where status='danger')) value from tabbed),
 paged as (select * from filtered order by
 case when p_sort='position' then position end asc nulls last,
 case when p_sort='gap' then gap end desc nulls last,
 impressions desc,key limit 25 offset greatest(p_page,0)*25),
 cat_values as (select c name,count(*) total,count(*) filter(where cannibal) cannibal,count(*) filter(where status='danger') danger,coalesce(sum(impressions),0) impressions,coalesce(sum(cannibal_impressions) filter(where cannibal),0) "cannibalImpressions" from all_rows cross join lateral unnest(categories) c group by c),
 taxonomy as (select distinct c name from public.seo_keywords cross join lateral unnest(categories) c union select name from cat_values),
 cats as (select t.name,coalesce(v.total,0) total,coalesce(v.cannibal,0) cannibal,coalesce(v.danger,0) danger,coalesce(v.impressions,0) impressions,coalesce(v."cannibalImpressions",0) "cannibalImpressions" from taxonomy t left join cat_values v using(name)),
 scoped_summary as(select jsonb_build_object('total',count(*),'withData',count(*) filter(where status<>'no_data'),'cannibal',count(*) filter(where cannibal),'impressions',coalesce(sum(impressions),0),'clicks',coalesce(sum(clicks),0),'affectedImpressions',coalesce(sum(cannibal_impressions) filter(where cannibal),0),'ctr',case when sum(impressions)>0 then sum(clicks)*100.0/sum(impressions) else 0 end,'counts',jsonb_build_object('safe',count(*) filter(where status='safe'),'medium',count(*) filter(where status='medium'),'danger',count(*) filter(where status='danger'),'none',count(*) filter(where status='none'),'unknown',count(*) filter(where status='unknown'),'data_issue',count(*) filter(where status='data_issue'),'no_data',count(*) filter(where status='no_data'))) value from scope),
 site_summary as(select jsonb_build_object('total',count(*),'withData',count(*) filter(where status<>'no_data'),'cannibal',count(*) filter(where cannibal),'impressions',coalesce(sum(impressions),0),'clicks',coalesce(sum(clicks),0),'affectedImpressions',coalesce(sum(cannibal_impressions) filter(where cannibal),0),'ctr',case when sum(impressions)>0 then sum(clicks)*100.0/sum(impressions) else 0 end,'counts',jsonb_build_object('safe',count(*) filter(where status='safe'),'medium',count(*) filter(where status='medium'),'danger',count(*) filter(where status='danger'),'none',count(*) filter(where status='none'),'unknown',count(*) filter(where status='unknown'),'data_issue',count(*) filter(where status='data_issue'),'no_data',count(*) filter(where status='no_data'))) value from all_rows)
 select jsonb_build_object('levelCounts',(select value from level_counts),'summary',(select value from scoped_summary),'siteSummary',(select value from site_summary),'rows',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'),'count',(select count(*) from filtered),'categories',coalesce((select jsonb_agg(to_jsonb(cats) order by name) from cats),'[]'),'quality',(select quality from public.seo_imports where id=p_import));
$$;
revoke execute on function public.seo_overview(uuid,text,text,text,text,boolean,integer,text) from public,anon;
grant execute on function public.seo_overview(uuid,text,text,text,text,boolean,integer,text) to authenticated;

