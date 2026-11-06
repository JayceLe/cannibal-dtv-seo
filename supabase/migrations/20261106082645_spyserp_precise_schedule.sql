-- Vercel Hobby cron has an hourly delivery window. pg_cron invokes the same
-- protected Vercel worker at minute precision: 03:00 UTC = 10:00 Vietnam.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create function private.invoke_spyserp_sync() returns bigint
language plpgsql security invoker set search_path='' as $$
declare token text;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='spyserp_cron_secret';
 if token is null then raise exception 'SpySERP scheduler secret not provisioned'; end if;
 return net.http_get(url:='https://cannibal-query.vercel.app/api/spyserp',headers:=jsonb_build_object('Authorization','Bearer '||token),timeout_milliseconds:=300000);
end $$;
revoke all on function private.invoke_spyserp_sync() from public,anon,authenticated;
select cron.schedule('spyserp-monday-10am-vietnam','0 3 * * 1','select private.invoke_spyserp_sync();');
