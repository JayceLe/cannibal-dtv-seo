create function public.seo_compare(p_older uuid,p_newer uuid,p_category text default '') returns jsonb language sql stable security invoker set search_path='' as $$
 with a as(select * from public.seo_records where import_id=p_older and (p_category='' or p_category=any(categories))),
 b as(select * from public.seo_records where import_id=p_newer and (p_category='' or p_category=any(categories))),
 diff as(select coalesce(b.query,a.query) query,coalesce(a.status,'no_data') old_status,coalesce(b.status,'no_data') new_status,coalesce(b.impressions,0)-coalesce(a.impressions,0) delta from a full join b using(key) where a.status is distinct from b.status),
 page as(select * from diff order by abs(delta) desc,query limit 25)
 select jsonb_build_object('old',public.seo_summary(p_older,p_category),'new',public.seo_summary(p_newer,p_category),'count',(select count(*) from diff),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'))
$$;
revoke execute on function public.seo_compare(uuid,uuid,text) from public,anon;
grant execute on function public.seo_compare(uuid,uuid,text) to authenticated;
