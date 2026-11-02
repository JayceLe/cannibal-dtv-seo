alter table public.seo_rankings add column query text;
alter table public.seo_rankings drop constraint seo_rankings_owner_id_key_fkey;
create or replace function public.seo_import_rankings(p_rows jsonb) returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='120s' as $$
declare n integer; mapped_count integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>50000 then raise exception 'Maximum 50000 rows'; end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) r(key text,domain text,engine text,positions jsonb) where coalesce(r.domain,'')='' or coalesce(r.engine,'')='' or r.positions is null or jsonb_typeof(r.positions)<>'object') then raise exception 'Invalid ranking record'; end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) r(positions jsonb) cross join lateral jsonb_each(r.positions) p where p.key !~ '^\d{4}-\d{2}-\d{2}$' or (p.value<>'null'::jsonb and (jsonb_typeof(p.value)<>'number' or (p.value::text <> '-2' and (p.value::text !~ '^[0-9]+$' or (p.value::text)::numeric not between 1 and 101))))) then raise exception 'Invalid position or date'; end if;
 insert into public.seo_rankings(key,query,domain,engine,positions)
 select r.key,coalesce(nullif(r.query,''),r.key),r.domain,r.engine,r.positions from jsonb_to_recordset(p_rows) r(key text,query text,domain text,engine text,positions jsonb)
 on conflict(owner_id,key,domain,engine) do update set positions=public.seo_rankings.positions||excluded.positions,query=excluded.query,updated_at=now();
 get diagnostics n=row_count;
 select count(*) into mapped_count from jsonb_to_recordset(p_rows) r(key text) join public.seo_keywords k on k.key=r.key and k.owner_id=auth.uid();
 return jsonb_build_object('mapped',mapped_count,'unmapped',n-mapped_count,'saved',n);
end $$;
create or replace function public.seo_ranking_report() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('key',r.key,'query',coalesce(k.query,r.query,r.key),'categories',coalesce(k.categories,array['Chưa map DMC3']),'domain',r.domain,'engine',r.engine,'positions',r.positions) order by r.key),'[]')
 from public.seo_rankings r left join public.seo_keywords k on k.owner_id=r.owner_id and k.key=r.key where r.owner_id=auth.uid()
$$;
revoke all on function public.seo_import_rankings(jsonb),public.seo_ranking_report() from public,anon;
grant execute on function public.seo_import_rankings(jsonb),public.seo_ranking_report() to authenticated;
