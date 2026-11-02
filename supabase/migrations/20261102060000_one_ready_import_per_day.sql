-- Publish replacement atomically: existing daily records stay usable until ready.
create function public.seo_replace_daily_import() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status='ready' and (tg_op='INSERT' or old.status is distinct from 'ready') then
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text||':'||new.week_start::text,0));
  delete from public.seo_imports where owner_id=new.owner_id and week_start=new.week_start and status='ready' and id<>new.id;
 end if;
 return new;
end $$;
revoke all on function public.seo_replace_daily_import() from public,anon;
create trigger seo_import_one_per_day before insert or update of status on public.seo_imports for each row execute function public.seo_replace_daily_import();
-- Keep the newest successfully uploaded snapshot for each existing date.
lock table public.seo_imports in share row exclusive mode;
with ranked as (select id,row_number() over(partition by owner_id,week_start order by created_at desc,id desc) rn from public.seo_imports where status='ready')
delete from public.seo_imports where id in(select id from ranked where rn>1);
create unique index seo_imports_one_ready_day on public.seo_imports(owner_id,week_start) where status='ready';
