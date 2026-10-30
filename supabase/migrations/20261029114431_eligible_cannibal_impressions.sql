-- Persist eligible secondary impression sums once per snapshot, rather than recomputing
-- every URL for each dashboard filter. RLS and caller permissions remain in force.
create or replace function public.seo_cannibal_impressions(p_urls jsonb)
returns bigint language sql immutable parallel safe security invoker set search_path='' as $$
 with ranked as (
  select coalesce((u->>'impressions')::bigint,0) impressions,
   row_number() over(order by coalesce((u->>'impressions')::bigint,0) desc,ordinality) n,
   max(coalesce((u->>'impressions')::bigint,0)) over() leader
  from jsonb_array_elements(coalesce(p_urls,'[]'::jsonb)) with ordinality a(u,ordinality)
 )
 select coalesce(sum(impressions) filter(where n>1 and leader>0 and impressions::numeric>=leader::numeric*0.2),0)::bigint from ranked
$$;
revoke execute on function public.seo_cannibal_impressions(jsonb) from public,anon;
grant execute on function public.seo_cannibal_impressions(jsonb) to authenticated;
alter table public.seo_records add column cannibal_impressions bigint
 generated always as (public.seo_cannibal_impressions(urls)) stored;
comment on column public.seo_records.cannibal_impressions is 'Sum of secondary URLs with >=20% of Top 1 impressions; excludes Top 1 and all below-threshold URLs.';

create or replace function public.seo_overview(p_import uuid default null,p_category text default '',p_tab text default 'all',p_status text default '',p_search text default '',p_exact boolean default false,p_page integer default 0,p_sort text default 'impressions') returns jsonb language sql stable security invoker set search_path='' as $$
 with all_rows as materialized (
 select key,query,categories,urls,impressions,clicks,position,gap,cannibal,status,invalid_rows,cannibal_impressions from public.seo_records where import_id=p_import and status<>'no_data'
 ), scope as (select * from all_rows where p_category='' or p_category=any(categories)),
 filtered as (select * from scope where
 (p_tab='all' or (p_tab='cannibal' and cannibal) or (p_tab='none' and status='none') or (p_tab='review' and status in ('unknown','data_issue')))
 and (p_status='' or status=p_status or (p_status='unclassified' and status in ('unknown','data_issue')))
 and (p_search='' or (p_exact and key=p_search) or (not p_exact and strpos(key,p_search)>0))),
 paged as (select * from filtered order by
 case when p_sort='position' then position end asc nulls last,
 case when p_sort='gap' then gap end desc nulls last,
 impressions desc,key limit 25 offset greatest(p_page,0)*25),
 cat_values as (select c name,count(*) total,count(*) filter(where cannibal) cannibal,count(*) filter(where status='danger') danger,coalesce(sum(impressions),0) impressions,coalesce(sum(cannibal_impressions) filter(where cannibal),0) "cannibalImpressions" from all_rows cross join lateral unnest(categories) c group by c),
 taxonomy as (select distinct c name from public.seo_keywords cross join lateral unnest(categories) c union select name from cat_values),
 cats as (select t.name,coalesce(v.total,0) total,coalesce(v.cannibal,0) cannibal,coalesce(v.danger,0) danger,coalesce(v.impressions,0) impressions,coalesce(v."cannibalImpressions",0) "cannibalImpressions" from taxonomy t left join cat_values v using(name)),
 scoped_summary as(select jsonb_build_object('total',count(*),'withData',count(*) filter(where status<>'no_data'),'cannibal',count(*) filter(where cannibal),'impressions',coalesce(sum(impressions),0),'clicks',coalesce(sum(clicks),0),'affectedImpressions',coalesce(sum(cannibal_impressions) filter(where cannibal),0),'ctr',case when sum(impressions)>0 then sum(clicks)*100.0/sum(impressions) else 0 end,'counts',jsonb_build_object('safe',count(*) filter(where status='safe'),'medium',count(*) filter(where status='medium'),'danger',count(*) filter(where status='danger'),'none',count(*) filter(where status='none'),'unknown',count(*) filter(where status='unknown'),'data_issue',count(*) filter(where status='data_issue'),'no_data',count(*) filter(where status='no_data'))) value from scope),
 site_summary as(select jsonb_build_object('total',count(*),'withData',count(*) filter(where status<>'no_data'),'cannibal',count(*) filter(where cannibal),'impressions',coalesce(sum(impressions),0),'clicks',coalesce(sum(clicks),0),'affectedImpressions',coalesce(sum(cannibal_impressions) filter(where cannibal),0),'ctr',case when sum(impressions)>0 then sum(clicks)*100.0/sum(impressions) else 0 end,'counts',jsonb_build_object('safe',count(*) filter(where status='safe'),'medium',count(*) filter(where status='medium'),'danger',count(*) filter(where status='danger'),'none',count(*) filter(where status='none'),'unknown',count(*) filter(where status='unknown'),'data_issue',count(*) filter(where status='data_issue'),'no_data',count(*) filter(where status='no_data'))) value from all_rows)
 select jsonb_build_object('summary',(select value from scoped_summary),'siteSummary',(select value from site_summary),'rows',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'),'count',(select count(*) from filtered),'categories',coalesce((select jsonb_agg(to_jsonb(cats) order by name) from cats),'[]'),'quality',(select quality from public.seo_imports where id=p_import));
$$;
revoke execute on function public.seo_overview(uuid,text,text,text,text,boolean,integer,text) from public,anon;
grant execute on function public.seo_overview(uuid,text,text,text,text,boolean,integer,text) to authenticated;

create or replace function public.seo_compare(p_older uuid,p_newer uuid,p_category text default '') returns jsonb language sql stable security invoker set search_path='' as $$
 with a as(select * from public.seo_records where import_id=p_older and status<>'no_data' and (p_category='' or p_category=any(categories))),
 b as(select * from public.seo_records where import_id=p_newer and status<>'no_data' and (p_category='' or p_category=any(categories))),
 diff as(select coalesce(b.query,a.query) query,coalesce(a.status,'no_data') old_status,coalesce(b.status,'no_data') new_status,coalesce(b.impressions,0)-coalesce(a.impressions,0) delta from a inner join b using(key) where a.status is distinct from b.status),
 page as(select * from diff order by abs(delta) desc,query limit 25)
 select jsonb_build_object('old',public.seo_summary(p_older,p_category),'new',public.seo_summary(p_newer,p_category),'count',(select count(*) from diff),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'))
$$;
revoke execute on function public.seo_compare(uuid,uuid,text) from public,anon;
grant execute on function public.seo_compare(uuid,uuid,text) to authenticated;
create or replace function public.seo_summary(p_import uuid,p_category text default '') returns jsonb language sql stable security invoker set search_path='' as $$
 with x as(select * from public.seo_records where import_id=p_import and status<>'no_data' and (p_category='' or p_category=any(categories))),
 c as(select status,count(*) n from x group by status)
 select jsonb_build_object('total',count(*),'withData',count(*) filter(where status<>'no_data'),'cannibal',count(*) filter(where cannibal),'impressions',coalesce(sum(impressions),0),'clicks',coalesce(sum(clicks),0),'affectedImpressions',coalesce(sum(cannibal_impressions) filter(where cannibal),0),'ctr',case when sum(impressions)>0 then sum(clicks)*100.0/sum(impressions) else 0 end,'counts',coalesce((select jsonb_object_agg(status,n) from c),'{}')) from x
$$;


revoke execute on function public.seo_summary(uuid,text) from public,anon;
grant execute on function public.seo_summary(uuid,text) to authenticated;
