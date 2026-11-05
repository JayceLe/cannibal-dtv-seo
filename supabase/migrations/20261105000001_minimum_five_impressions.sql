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
 select coalesce(sum(impressions) filter(where n>1 and leader>0 and total>=5 and
  case when total<20 then impressions::numeric*5>leader::numeric*4
       else impressions::numeric*5>=leader::numeric end),0)::bigint from ranked
$$;
revoke execute on function public.seo_cannibal_impressions(jsonb) from public,anon;
grant execute on function public.seo_cannibal_impressions(jsonb) to authenticated;

update public.seo_records set urls=urls;
comment on column public.seo_records.cannibal_impressions is 'Secondary impressions only: total query impressions <5 are excluded; 5–19 requires >80% of Top 1; otherwise >=20% of Top 1. Excludes Top 1.';
