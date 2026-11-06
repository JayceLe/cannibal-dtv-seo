-- The worker is limited to this SpySERP project/domain and one existing workspace.
-- The shared server secret is provisioned separately; it never enters source control.
create schema if not exists private;
create table private.spyserp_sync (
 project_id bigint primary key,
 owner_id uuid not null references auth.users(id),
 domain text not null,
 engine text not null,
 secret_hash text,
 lease_id uuid,
 lease_until timestamptz,
 receipts jsonb not null default '{}',
 last_result jsonb,
 updated_at timestamptz not null default now()
);
alter table private.spyserp_sync enable row level security;
revoke all on private.spyserp_sync from public,anon,authenticated;
insert into private.spyserp_sync(project_id,owner_id,domain,engine)
 select 256829,min(owner_id::text)::uuid,'dienthoaivui.com.vn','G1'
 from public.seo_rankings where domain='dienthoaivui.com.vn' and engine='G1'
 having count(distinct owner_id)=1;

create function private.spyserp_worker(p_secret text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='120s' as $$
declare c private.spyserp_sync; n integer; changed integer; snapshot_date text; lease uuid;
begin
 select * into c from private.spyserp_sync where project_id=256829 for update;
 if c.secret_hash is null or p_secret is null or length(p_secret)<32 or encode(sha256(convert_to(p_secret,'UTF8')),'hex')<>c.secret_hash then
  raise exception 'Unauthorized' using errcode='42501';
 end if;
 if p_action='claim' then
  if c.lease_until>now() then raise exception 'Sync already running'; end if;
  lease:=gen_random_uuid();
  update private.spyserp_sync set lease_id=lease,lease_until=now()+interval '6 minutes' where project_id=c.project_id;
  return jsonb_build_object('lease',lease,'receipts',c.receipts,'dates',(
   select coalesce(jsonb_object_agg(d,n),'{}') from (
    select d,count(*) n from public.seo_rankings r cross join lateral jsonb_object_keys(r.positions) d
    where r.owner_id=c.owner_id and r.domain=c.domain and r.engine=c.engine group by d
   ) x));
 end if;
 if c.lease_id is null or c.lease_until<now() or (p_payload->>'lease')::uuid is distinct from c.lease_id then raise exception 'Invalid worker lease'; end if;
 if p_action='release' then
  update private.spyserp_sync set lease_id=null,lease_until=null,last_result=p_payload-'lease',updated_at=now() where project_id=c.project_id;
  return jsonb_build_object('released',true);
 end if;
 if p_action<>'commit' then raise exception 'Unknown action'; end if;
 snapshot_date:=p_payload->>'date';
 if snapshot_date is null or snapshot_date!~'^\d{4}-\d{2}-\d{2}$' or snapshot_date::date>current_date+1 then raise exception 'Invalid date'; end if;
 if jsonb_typeof(p_payload->'rows') is distinct from 'array' then raise exception 'Invalid rows'; end if;
 n:=jsonb_array_length(p_payload->'rows');
 if n<1 or n>100000 or n<>(p_payload->>'expected')::integer then raise exception 'Incomplete snapshot'; end if;
 if exists(select 1 from jsonb_to_recordset(p_payload->'rows') r(key text,query text,position integer)
  where coalesce(r.key,'')='' or coalesce(r.query,'')='' or length(r.key)>1000 or (r.position is not null and r.position<>-2 and r.position not between 1 and 101)) then raise exception 'Invalid keyword/position'; end if;
 if n<>(select count(distinct r.key) from jsonb_to_recordset(p_payload->'rows') r(key text)) then raise exception 'Duplicate keywords'; end if;
 -- Merge only the measured day. Other dates, owners, domains and engines are untouched.
 insert into public.seo_rankings(owner_id,key,query,domain,engine,positions)
 select c.owner_id,r.key,r.query,c.domain,c.engine,jsonb_build_object(snapshot_date,r.position)
 from jsonb_to_recordset(p_payload->'rows') r(key text,query text,position integer)
 on conflict(owner_id,key,domain,engine) do update
 set query=excluded.query,positions=public.seo_rankings.positions||excluded.positions,updated_at=now()
 where public.seo_rankings.query is distinct from excluded.query
 or public.seo_rankings.positions->snapshot_date is distinct from excluded.positions->snapshot_date;
 get diagnostics changed=row_count;
 update private.spyserp_sync set receipts=receipts||jsonb_build_object(p_payload->>'schedule',jsonb_build_object('date',snapshot_date,'keywords',n,'changed',changed,'at',now())),updated_at=now() where project_id=c.project_id;
 return jsonb_build_object('date',snapshot_date,'keywords',n,'changed',changed);
end $$;
revoke all on function private.spyserp_worker(text,text,jsonb) from public,anon,authenticated;
-- Explicit secret authorization replaces a user session for this scheduled worker.
-- No service-role credential or general-purpose database write access is exposed.
grant usage on schema private to anon;
grant execute on function private.spyserp_worker(text,text,jsonb) to anon;
create function public.seo_spyserp_worker(p_secret text,p_action text,p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$
 select private.spyserp_worker(p_secret,p_action,p_payload)
$$;
revoke all on function public.seo_spyserp_worker(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.seo_spyserp_worker(text,text,jsonb) to anon;
