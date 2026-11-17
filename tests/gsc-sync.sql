-- Run with a privileged test connection. ALL fixture writes are rolled back.
begin;
do $$
declare token text; owner uuid; state jsonb; result jsonb; period date; source_end date; source_start date;
 import_id uuid; fixture_key text; before_count bigint; after_count bigint;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='spyserp_cron_secret';
 select owner_id into owner from private.gsc_sync where id;
 if exists(select 1 from private.gsc_sync where credential_id is not null) then
  raise exception 'Run this fixture only before provisioning a real GSC credential';
 end if;
 select count(*) into before_count from public.seo_records;
 begin
  perform public.seo_gsc_worker('invalid','status',jsonb_build_object('owner',owner));
  raise exception 'Accepted an invalid secret';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.seo_gsc_worker(token,'status',jsonb_build_object('owner',gen_random_uuid()));
  raise exception 'Accepted the wrong owner';
 exception when insufficient_privilege then null;
 end;
 if private.invoke_gsc_sync() is not null then raise exception 'Unconfigured schedule attempted a network request'; end if;
 period:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
 period:=period-(extract(isodow from period)::integer-1);
 source_end:=period-3; source_start:=source_end-28;
 perform public.seo_gsc_worker(token,'configure',jsonb_build_object('owner',owner,
  'credentials',jsonb_build_object('type','service_account','client_email','fixture@example.test','private_key','fixture-only-rolled-back')));
 state:=public.seo_gsc_worker(token,'claim',jsonb_build_object('reportDate',period));
 begin
  perform public.seo_gsc_worker(token,'begin',jsonb_build_object('lease',state->>'lease','rows',1,'baseVersion',state->>'baseVersion',
   'quality',jsonb_build_object('reportDate',period,'startDate',source_start+1,'endDate',source_end)));
  raise exception 'Accepted a shifted source period';
 exception when raise_exception then
  if sqlerrm<>'Incorrect GSC reporting period' then raise; end if;
 end;
 result:=public.seo_gsc_worker(token,'begin',jsonb_build_object('lease',state->>'lease','rows',1,'baseVersion',state->>'baseVersion',
  'quality',jsonb_build_object('reportDate',period,'startDate',source_start,'endDate',source_end,'sourceImpressions',1,'apiRequests',1,'mapped',true,'source','gsc-api')));
 import_id:=(result->>'importId')::uuid;
 begin
  perform public.seo_gsc_worker(token,'commit',jsonb_build_object('lease',state->>'lease'));
  raise exception 'Published an incomplete snapshot';
 exception when raise_exception then
  if sqlerrm<>'Incomplete GSC snapshot' then raise; end if;
 end;
 fixture_key:=state->'keys'->>0;
 perform public.seo_gsc_worker(token,'batch',jsonb_build_object('lease',state->>'lease','batch',0,'rows',jsonb_build_array(
  jsonb_build_object('key',fixture_key,'url','https://example.test/fixture','impressions',1,'clicks',0,
   'weighted_position',2.5,'position_weight',1,'missing_rank',0,'invalid_rows',0))));
 result:=public.seo_gsc_worker(token,'commit',jsonb_build_object('lease',state->>'lease'));
 if result->>'ok'<>'true' or result->>'reportDate'<>period::text or result->>'startDate'<>source_start::text
  or result->>'endDate'<>source_end::text or (result->>'mappedKeywords')::integer<>1 then raise exception 'Wrong publication metadata'; end if;
 if not exists(select 1 from public.seo_records r where r.import_id=(result->>'importId')::uuid and r.owner_id=owner and r.position=2.5 and not r.cannibal) then raise exception 'Existing scorer/owner was not preserved'; end if;
 perform public.seo_gsc_worker(token,'release',jsonb_build_object('lease',state->>'lease'));
 result:=public.seo_gsc_worker(token,'claim',jsonb_build_object('reportDate',period));
 if result->>'skipped'<>'true' then raise exception 'Repeated schedule did not skip published data'; end if;
 select count(*) into after_count from public.seo_records;
 if after_count<1 then raise exception 'Publication fixture is empty'; end if;
end $$;
rollback;
