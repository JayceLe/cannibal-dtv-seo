-- AIO checkpoints are separate from all existing cannibal and ranking data.
create table public.seo_aio_runs (
 id uuid primary key,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 state jsonb not null,
 lease_until timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.seo_aio_runs enable row level security;
grant select,insert,update,delete on public.seo_aio_runs to authenticated;
create policy aio_owner_select on public.seo_aio_runs for select to authenticated using(owner_id=(select auth.uid()));
create policy aio_owner_insert on public.seo_aio_runs for insert to authenticated with check(owner_id=(select auth.uid()));
create policy aio_owner_update on public.seo_aio_runs for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy aio_owner_delete on public.seo_aio_runs for delete to authenticated using(owner_id=(select auth.uid()));
create function public.seo_aio_claim(p_id uuid) returns setof public.seo_aio_runs
language sql security invoker set search_path='' as $$
 update public.seo_aio_runs set lease_until=now()+interval '330 seconds',updated_at=now()
 where id=p_id and owner_id=(select auth.uid()) and lease_until<=now() returning *
$$;
revoke execute on function public.seo_aio_claim(uuid) from public,anon;
grant execute on function public.seo_aio_claim(uuid) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('seo-aio','seo-aio',false,52428800,array['application/gzip']);
create policy aio_artifact_read on storage.objects for select to authenticated
 using(bucket_id='seo-aio' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy aio_artifact_create on storage.objects for insert to authenticated
 with check(bucket_id='seo-aio' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy aio_artifact_update on storage.objects for update to authenticated
 using(bucket_id='seo-aio' and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check(bucket_id='seo-aio' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy aio_artifact_delete on storage.objects for delete to authenticated
 using(bucket_id='seo-aio' and (storage.foldername(name))[1]=(select auth.uid())::text);
