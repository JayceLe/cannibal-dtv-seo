create table public.seo_rankings (
 owner_id uuid not null default auth.uid(), key text not null, domain text not null, engine text not null,
 positions jsonb not null check(jsonb_typeof(positions)='object'), updated_at timestamptz not null default now(),
 primary key(owner_id,key,domain,engine), foreign key(owner_id,key) references public.seo_keywords(owner_id,key) on delete cascade
);
alter table public.seo_rankings enable row level security;
create policy rankings_owner on public.seo_rankings to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
revoke all on public.seo_rankings from anon,authenticated;
grant select,insert,update on public.seo_rankings to authenticated;
create function public.seo_import_rankings(p_rows jsonb) returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='120s' as $$
declare n integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>50000 then raise exception 'Maximum 50000 rows'; end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) r(key text,domain text,engine text,positions jsonb) where coalesce(r.domain,'')='' or coalesce(r.engine,'')='' or r.positions is null or jsonb_typeof(r.positions)<>'object') then raise exception 'Invalid ranking record'; end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) r(positions jsonb) cross join lateral jsonb_each(r.positions) p where p.key !~ '^\d{4}-\d{2}-\d{2}$' or (p.value<>'null'::jsonb and (jsonb_typeof(p.value)<>'number' or p.value::text !~ '^[0-9]+$' or (p.value::text)::numeric not between 1 and 101))) then raise exception 'Invalid position or date'; end if;
 insert into public.seo_rankings(key,domain,engine,positions)
 select r.key,r.domain,r.engine,r.positions from jsonb_to_recordset(p_rows) r(key text,domain text,engine text,positions jsonb)
 join public.seo_keywords k on k.key=r.key and k.owner_id=auth.uid()
 on conflict(owner_id,key,domain,engine) do update set positions=public.seo_rankings.positions||excluded.positions,updated_at=now();
 get diagnostics n=row_count;
 return jsonb_build_object('mapped',n,'unmapped',jsonb_array_length(p_rows)-n);
end $$;
create function public.seo_ranking_report() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('key',r.key,'query',k.query,'categories',k.categories,'domain',r.domain,'engine',r.engine,'positions',r.positions) order by r.key),'[]')
 from public.seo_rankings r join public.seo_keywords k on k.owner_id=r.owner_id and k.key=r.key where r.owner_id=auth.uid()
$$;
revoke all on function public.seo_import_rankings(jsonb),public.seo_ranking_report() from public,anon;
grant execute on function public.seo_import_rankings(jsonb),public.seo_ranking_report() to authenticated;
