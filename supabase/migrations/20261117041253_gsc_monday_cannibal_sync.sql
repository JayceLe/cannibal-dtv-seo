-- Scheduled GSC reads are scoped to the existing cannibal workspace and URL property.
-- Credentials are provisioned later through the authenticated connection endpoint.
create table private.gsc_sync (
 id boolean primary key default true check(id),
 owner_id uuid not null references auth.users(id),
 site text not null default 'https://dienthoaivui.com.vn/' check(site='https://dienthoaivui.com.vn/'),
 credential_id uuid,
 client_email text,
 active boolean not null default false,
 lease_id uuid,
 lease_until timestamptz,
 pending_import uuid references public.seo_imports(id) on delete set null,
 last_result jsonb,
 updated_at timestamptz not null default now()
);
alter table private.gsc_sync enable row level security;
revoke all on private.gsc_sync from public,anon,authenticated;
insert into private.gsc_sync(owner_id)
 select min(owner_id::text)::uuid from public.seo_keywords having count(distinct owner_id)=1;

create function private.gsc_worker(p_secret text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='120s' as $$
declare c private.gsc_sync; expected_hash text; credentials text; job public.seo_imports;
 report_day date; end_day date; start_day date; latest_monday date; lease uuid;
 base_version text; row_total integer; batch_total integer; quality jsonb; outcome jsonb;
begin
 select secret_hash into expected_hash from private.spyserp_sync where project_id=256829;
 if expected_hash is null or p_secret is null or length(p_secret)<32
  or encode(sha256(convert_to(p_secret,'UTF8')),'hex')<>expected_hash then
  raise exception 'Unauthorized' using errcode='42501';
 end if;
 select * into c from private.gsc_sync where id for update;
 if not found then raise exception 'GSC workspace is not configured'; end if;
 if p_action in ('status','configure') and (p_payload->>'owner')::uuid is distinct from c.owner_id then
  raise exception 'Workspace access denied' using errcode='42501';
 end if;
 if p_action='status' then
  return jsonb_build_object('site',c.site,'configured',c.credential_id is not null,'active',c.active,
   'email',c.client_email,'lastResult',c.last_result,'running',coalesce(c.lease_until>now(),false));
 end if;
 if p_action='configure' then
  if c.lease_until>now() then raise exception 'GSC sync already running'; end if;
  if p_payload->'credentials'->>'type' is distinct from 'service_account'
   or coalesce(p_payload->'credentials'->>'private_key','')='' then raise exception 'Invalid GSC credentials'; end if;
  if c.credential_id is null then
   select vault.create_secret((p_payload->'credentials')::text,'gsc_service_account','Read-only GSC automation') into lease;
  else
   lease:=c.credential_id;
   perform vault.update_secret(lease,(p_payload->'credentials')::text);
  end if;
  update private.gsc_sync set credential_id=lease,client_email=p_payload->'credentials'->>'client_email',
   active=false,updated_at=now() where id;
  return jsonb_build_object('configured',true,'active',false);
 end if;
 if p_action='config' then
  if c.credential_id is null then raise exception 'GSC connection required'; end if;
  select decrypted_secret into credentials from vault.decrypted_secrets where id=c.credential_id;
  if credentials is null then raise exception 'GSC credentials unavailable'; end if;
  return jsonb_build_object('site',c.site,'credentials',credentials::jsonb);
 end if;
 if p_action='claim' then
  if c.credential_id is null then raise exception 'GSC connection required'; end if;
  if c.lease_until>now() then raise exception 'GSC sync already running'; end if;
  latest_monday:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
  latest_monday:=latest_monday-(extract(isodow from latest_monday)::integer-1);
  report_day:=(p_payload->>'reportDate')::date;
  if report_day is distinct from latest_monday then raise exception 'Only the current Monday can be published'; end if;
  select md5(string_agg(k.key||':'||k.updated_at::text,'|' order by k.key)) into base_version
   from public.seo_keywords k where k.owner_id=c.owner_id;
  if base_version is null then raise exception 'Import base keywords first'; end if;
  if c.active and c.last_result->>'ok'='true' and c.last_result->>'reportDate'=report_day::text
   and c.last_result->>'baseVersion'=base_version
   and exists(select 1 from public.seo_imports i where i.id=(c.last_result->>'importId')::uuid
    and i.owner_id=c.owner_id and i.week_start=report_day and i.status='ready') then
   return jsonb_build_object('skipped',true,'result',c.last_result);
  end if;
  if c.active and c.last_result->>'ok'='true' and c.last_result->>'reportDate'=report_day::text
   and c.last_result->>'baseVersion'=base_version and exists(
    select 1 from public.seo_imports where id=(c.last_result->>'importId')::uuid and status='ready' and owner_id=c.owner_id
   ) then return jsonb_build_object('skipped',true,'result',c.last_result); end if;
  -- An expired, unpublished attempt never replaces the last ready snapshot.
  delete from public.seo_imports where id=c.pending_import and status='staging' and owner_id=c.owner_id;
  lease:=gen_random_uuid();
  update private.gsc_sync set lease_id=lease,lease_until=now()+interval '7 minutes',pending_import=null where id;
  return jsonb_build_object('lease',lease,'baseVersion',base_version,'keys',(
   select jsonb_agg(k.key order by k.key) from public.seo_keywords k where k.owner_id=c.owner_id));
 end if;
 if c.lease_id is null or (p_payload->>'lease')::uuid is distinct from c.lease_id then raise exception 'Invalid GSC worker lease'; end if;
 if p_action='release' then
  update private.gsc_sync set lease_id=null,lease_until=null,last_result=coalesce(p_payload->'result',last_result),updated_at=now() where id;
  return jsonb_build_object('released',true);
 end if;
 if c.lease_until<now() then raise exception 'GSC worker lease expired'; end if;
 if p_action='begin' then
  report_day:=(p_payload->'quality'->>'reportDate')::date;
  end_day:=(p_payload->'quality'->>'endDate')::date;
  start_day:=(p_payload->'quality'->>'startDate')::date;
  latest_monday:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
  latest_monday:=latest_monday-(extract(isodow from latest_monday)::integer-1);
  if report_day is distinct from latest_monday or end_day is distinct from report_day-3
   or start_day is distinct from end_day-28 then raise exception 'Incorrect GSC reporting period'; end if;
  row_total:=(p_payload->>'rows')::integer;
  if row_total is null or row_total not between 1 and 1000000 or c.pending_import is not null then raise exception 'Invalid GSC snapshot size/state'; end if;
  batch_total:=(row_total+999)/1000;
  quality:=p_payload->'quality'||jsonb_build_object('expectedRows',row_total,'baseVersion',p_payload->>'baseVersion');
  insert into public.seo_imports(owner_id,week_start,file_name,fingerprint,expected_batches,quality)
   values(c.owner_id,report_day,'GSC · '||start_day||' → '||end_day,'gsc:'||c.lease_id,batch_total,quality) returning * into job;
  update private.gsc_sync set pending_import=job.id where id;
  return jsonb_build_object('importId',job.id,'batches',batch_total);
 end if;
 select * into job from public.seo_imports where id=c.pending_import and owner_id=c.owner_id and status='staging' for update;
 if not found then raise exception 'GSC staging import not found'; end if;
 if p_action='batch' then
  if jsonb_typeof(p_payload->'rows') is distinct from 'array' or jsonb_array_length(p_payload->'rows') not between 1 and 1000
   or (p_payload->>'batch')::integer not between 0 and job.expected_batches-1 then raise exception 'Invalid GSC batch'; end if;
  if exists(select 1 from jsonb_to_recordset(p_payload->'rows') r(key text,url text,impressions bigint,clicks bigint,weighted_position double precision,position_weight bigint,missing_rank bigint,invalid_rows integer)
   where coalesce(r.url,'')!~'^https?://' or strpos(r.url,'#')>0 or coalesce(r.impressions,0)<1
   or r.clicks is distinct from 0 or r.missing_rank is distinct from 0 or r.invalid_rows is distinct from 0
   or r.position_weight is distinct from r.impressions or r.weighted_position is null
   or r.weighted_position<r.impressions or r.weighted_position='Infinity'::float8 or r.weighted_position='NaN'::float8
   or not exists(select 1 from public.seo_keywords k where k.owner_id=c.owner_id and k.key=r.key)) then raise exception 'Invalid GSC metric'; end if;
  insert into public.seo_batches(import_id,owner_id,batch_no,payload)
   values(job.id,c.owner_id,(p_payload->>'batch')::integer,p_payload->'rows')
   on conflict(import_id,batch_no) do update set payload=excluded.payload;
  return jsonb_build_object('stored',jsonb_array_length(p_payload->'rows'));
 end if;
 if p_action<>'commit' then raise exception 'Unknown GSC action'; end if;
 select md5(string_agg(k.key||':'||k.updated_at::text,'|' order by k.key)) into base_version
  from public.seo_keywords k where k.owner_id=c.owner_id;
 if base_version is distinct from job.quality->>'baseVersion' then raise exception 'Base mapping changed during sync'; end if;
 select sum(jsonb_array_length(payload)) into row_total from public.seo_batches where import_id=job.id;
 if row_total is distinct from (job.quality->>'expectedRows')::integer then raise exception 'Incomplete GSC snapshot'; end if;
 if (select count(distinct (r->>'key',r->>'url')) from public.seo_batches b cross join lateral jsonb_array_elements(b.payload) r where import_id=job.id)<>row_total then raise exception 'Repeated GSC query/URL rows'; end if;
 if (select sum((r->>'impressions')::bigint) from public.seo_batches b cross join lateral jsonb_array_elements(b.payload) r where import_id=job.id)
  is distinct from (job.quality->>'sourceImpressions')::bigint then raise exception 'GSC impression totals do not match'; end if;
 -- Reuse the existing mapping, rank rounding, cannibal thresholds and atomic daily replacement.
 perform set_config('request.jwt.claim.sub',c.owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c.owner_id,'role','authenticated')::text,true);
 quality:=public.seo_finalize_import(job.id);
 outcome:=jsonb_build_object('ok',true,'importId',job.id,'reportDate',job.week_start,
  'startDate',quality->>'startDate','endDate',quality->>'endDate','baseVersion',base_version,
  'mappedKeywords',quality->'mappedKeywords','queryUrls',row_total,'impressions',quality->'sourceImpressions',
  'apiRequests',quality->'apiRequests','checkedAt',now());
 update private.gsc_sync set active=true,pending_import=null,last_result=outcome,updated_at=now() where id;
 return outcome;
end $$;
revoke all on function private.gsc_worker(text,text,jsonb) from public,anon,authenticated;
grant usage on schema private to anon;
grant execute on function private.gsc_worker(text,text,jsonb) to anon;
create function public.seo_gsc_worker(p_secret text,p_action text,p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$ select private.gsc_worker(p_secret,p_action,p_payload) $$;
revoke all on function public.seo_gsc_worker(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.seo_gsc_worker(text,text,jsonb) to anon;

create function private.invoke_gsc_sync() returns bigint language plpgsql security invoker set search_path='' as $$
declare token text;
begin
 if not exists(select 1 from private.gsc_sync where id and active) then return null; end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='spyserp_cron_secret';
 if token is null then raise exception 'Scheduler secret not provisioned'; end if;
 return net.http_get(url:='https://cannibal-query.vercel.app/api/gsc',
  headers:=jsonb_build_object('Authorization','Bearer '||token),timeout_milliseconds:=300000);
end $$;
revoke all on function private.invoke_gsc_sync() from public,anon,authenticated;
-- 03:00 UTC = 10:00 Vietnam. Later attempts skip an already published period.
select cron.schedule('gsc-cannibal-monday-10am-vietnam','0,15,30 3 * * 1','select private.invoke_gsc_sync();');
