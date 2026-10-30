create function public.seo_base_overview(p_category text default '') returns jsonb language sql stable security invoker set search_path='' as $$
 with x as(select * from public.seo_keywords where p_category='' or p_category=any(categories)),
 cats as(select c name,count(*) total,0 cannibal,0 danger,0 impressions from public.seo_keywords cross join lateral unnest(categories) c group by c)
 select jsonb_build_object('summary',jsonb_build_object('total',count(*),'withData',0,'cannibal',0,'impressions',0,'clicks',0,'affectedImpressions',0,'ctr',0,'counts',jsonb_build_object('no_data',count(*))),'rows','[]'::jsonb,'count',0,'categories',coalesce((select jsonb_agg(to_jsonb(cats) order by total desc) from cats),'[]'),'trend','[]'::jsonb) from x
$$;
revoke execute on function public.seo_base_overview(text) from public,anon;
grant execute on function public.seo_base_overview(text) to authenticated;
