create function public.seo_comparison_overview(p_older uuid,p_newer uuid,p_category text default '',p_search text default '',p_transition text default '',p_page integer default 0,p_sort text default 'impressions')
returns jsonb language sql stable security invoker set search_path='' as $$
with valid_pair as (
 select exists(select 1 from public.seo_imports a join public.seo_imports b on b.id=p_newer where a.id=p_older and a.status='ready' and b.status='ready' and a.week_start<b.week_start) ok
), a as materialized(select * from public.seo_records where import_id=p_older and status<>'no_data' and (select ok from valid_pair)),
b as materialized(select * from public.seo_records where import_id=p_newer and status<>'no_data' and (select ok from valid_pair)),
paired as (select b.key,b.query,array(select distinct unnest(a.categories||b.categories) order by 1) categories,a.status old_status,b.status new_status,a.cannibal old_cannibal,b.cannibal new_cannibal,a.impressions old_impressions,b.impressions new_impressions,b.impressions-a.impressions delta from a join b using(key)),
searched as(select * from paired where (p_category='' or p_category=any(categories)) and (p_search='' or strpos(key,p_search)>0)),
marked as(select *,not old_cannibal and new_cannibal is_new,old_cannibal and not new_cannibal is_resolved,old_status='safe' and new_status='medium' is_safe_medium,old_status='medium' and new_status='danger' is_medium_danger,old_status<>new_status is_changed from searched),
filtered as(select * from marked where p_transition='' or p_transition='new' and is_new or p_transition='resolved' and is_resolved or p_transition='safe_medium' and is_safe_medium or p_transition='medium_danger' and is_medium_danger or p_transition='changed' and is_changed),
paged as(select key,query,categories,old_status,new_status,old_cannibal,new_cannibal,old_impressions,new_impressions,delta from filtered order by case when p_sort='delta' then abs(delta) end desc nulls last,greatest(old_impressions,new_impressions) desc,key limit 25 offset greatest(p_page,0)*25),
old_categories as(select c name,count(*) filter(where cannibal) n from a cross join lateral unnest(categories)c group by c),
new_categories as(select c name,count(*) filter(where cannibal) n from b cross join lateral unnest(categories)c group by c),
taxonomy as(select distinct unnest(categories) name from public.seo_keywords union select name from old_categories union select name from new_categories),
categories as(select t.name,coalesce(o.n,0) old,coalesce(n.n,0) new,coalesce(n.n,0)-coalesce(o.n,0) delta from taxonomy t left join old_categories o using(name) left join new_categories n using(name))
select jsonb_build_object('valid',(select ok from valid_pair),'old',public.seo_summary(p_older,p_category),'new',public.seo_summary(p_newer,p_category),'matched',(select count(*) from searched),'count',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'::jsonb),'categories',coalesce((select jsonb_agg(to_jsonb(categories) order by abs(delta) desc,name) from categories),'[]'::jsonb),'transitions',(select jsonb_build_object('all',count(*),'new',count(*) filter(where is_new),'resolved',count(*) filter(where is_resolved),'safe_medium',count(*) filter(where is_safe_medium),'medium_danger',count(*) filter(where is_medium_danger),'changed',count(*) filter(where is_changed)) from marked));
$$;
revoke execute on function public.seo_comparison_overview(uuid,uuid,text,text,text,integer,text) from public,anon;
grant execute on function public.seo_comparison_overview(uuid,uuid,text,text,text,integer,text) to authenticated;
