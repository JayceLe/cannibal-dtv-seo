-- Apply the same volume-aware threshold to stored snapshots and future imports.
create or replace function public.seo_cannibal_impressions(p_urls jsonb)
returns bigint language sql immutable parallel safe security invoker set search_path='' as $$
 with ranked as (
  select coalesce((u->>'impressions')::bigint,0) impressions,
   row_number() over(order by coalesce((u->>'impressions')::bigint,0) desc,ordinality) n,
   max(coalesce((u->>'impressions')::bigint,0)) over() leader,
   sum(coalesce((u->>'impressions')::bigint,0)) over() total
  from jsonb_array_elements(coalesce(p_urls,'[]'::jsonb)) with ordinality a(u,ordinality)
 )
 select coalesce(sum(impressions) filter(where n>1 and leader>0 and
  case when total<20 then impressions::numeric*5>leader::numeric*3
       else impressions::numeric*5>=leader::numeric end),0)::bigint from ranked
$$;
revoke execute on function public.seo_cannibal_impressions(jsonb) from public,anon;
grant execute on function public.seo_cannibal_impressions(jsonb) to authenticated;

-- A single write boundary covers every import entry point without duplicating parser/finalizer logic.
create or replace function public.seo_apply_cannibal_rule()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.cannibal := public.seo_cannibal_impressions(new.urls)>0;
 new.status := case when new.invalid_rows>0 then 'data_issue'
  when jsonb_array_length(new.urls)=0 then 'no_data'
  when not new.cannibal then 'none'
  when new.position is null then 'unknown'
  when new.position>3 then 'danger'
  when new.gap is null then 'unknown'
  when round(new.gap::numeric,10)<0.5 then 'safe'
  when round(new.gap::numeric,10)<=1 then 'medium' else 'danger' end;
 return new;
end $$;
revoke execute on function public.seo_apply_cannibal_rule() from public,anon;
create trigger seo_records_cannibal_rule
before insert or update of urls,invalid_rows,position,gap,cannibal,status on public.seo_records
for each row execute function public.seo_apply_cannibal_rule();

-- Recompute both status and the stored generated impression sum, without changing source data.
update public.seo_records set urls=urls;
comment on column public.seo_records.cannibal_impressions is
 'Secondary impressions only: total query impressions <20 requires >60% of Top 1; otherwise >=20% of Top 1. Excludes Top 1.';
