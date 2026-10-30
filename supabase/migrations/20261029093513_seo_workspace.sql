create table public.seo_keywords (
 owner_id uuid not null default auth.uid() references auth.users on delete cascade,
 key text not null, query text not null, categories text[] not null,
 updated_at timestamptz not null default now(), primary key(owner_id,key),
 check(length(key)>0),check(cardinality(categories)>0)
);
create table public.seo_imports (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users on delete cascade,
 week_start date not null, file_name text not null, fingerprint text not null,
 status text not null default 'staging' check(status in ('staging','ready')),
 expected_batches integer not null check(expected_batches>0), quality jsonb not null default '{}',
 created_at timestamptz not null default now(), unique(owner_id,week_start,fingerprint),
 check(extract(isodow from week_start)=1)
);
create index seo_imports_owner_week on public.seo_imports(owner_id,week_start desc);
create table public.seo_batches (
 import_id uuid not null references public.seo_imports on delete cascade,
 owner_id uuid not null default auth.uid() references auth.users on delete cascade,
 batch_no integer not null check(batch_no>=0), payload jsonb not null,
 primary key(import_id,batch_no), check(jsonb_typeof(payload)='array' and jsonb_array_length(payload)<=1000)
);
create table public.seo_records (
 import_id uuid not null references public.seo_imports on delete cascade,
 owner_id uuid not null default auth.uid() references auth.users on delete cascade,
 key text not null,query text not null,categories text[] not null,urls jsonb not null,
 impressions bigint not null,clicks bigint not null,position double precision,gap double precision,
 cannibal boolean not null,status text not null check(status in ('danger','medium','safe','none','unknown','data_issue','no_data')),
 invalid_rows integer not null default 0, primary key(import_id,key)
);
create index seo_records_owner_import_status on public.seo_records(owner_id,import_id,status,impressions desc);
create index seo_records_categories on public.seo_records using gin(categories);
create extension if not exists pg_trgm with schema extensions;
create index seo_records_query_search on public.seo_records using gin(query extensions.gin_trgm_ops);

alter table public.seo_keywords enable row level security;
alter table public.seo_imports enable row level security;
alter table public.seo_batches enable row level security;
alter table public.seo_records enable row level security;
create policy keywords_owner on public.seo_keywords to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy imports_owner on public.seo_imports to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy batches_owner on public.seo_batches to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()) and exists(select 1 from public.seo_imports i where i.id=import_id and i.owner_id=(select auth.uid()) and i.status='staging'));
create policy records_owner on public.seo_records to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
revoke all on public.seo_keywords,public.seo_imports,public.seo_batches,public.seo_records from anon;
grant select,insert,update,delete on public.seo_keywords,public.seo_imports,public.seo_batches,public.seo_records to authenticated;

create function public.seo_import_base(p_rows jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if jsonb_array_length(p_rows)>1000 then raise exception 'Maximum 1000 rows per batch';end if;
 insert into public.seo_keywords(key,query,categories)
 select key,query,categories from jsonb_to_recordset(p_rows) as x(key text,query text,categories text[])
 on conflict(owner_id,key) do update set query=excluded.query,categories=excluded.categories,updated_at=now();
 get diagnostics n=row_count;return n;
end $$;

create function public.seo_finalize_import(p_import uuid) returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='120s' as $$
declare job public.seo_imports; n integer; mapped integer; excluded integer;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into job from public.seo_imports where id=p_import and owner_id=auth.uid() for update;
 if not found then raise exception 'Import not found';end if;
 if job.status='ready' then return job.quality;end if;
 select count(*) into n from public.seo_batches where import_id=p_import;
 if n<>job.expected_batches or exists(select 1 from generate_series(0,job.expected_batches-1) b where not exists(select 1 from public.seo_batches s where s.import_id=p_import and s.batch_no=b)) then raise exception 'Upload incomplete';end if;
 if not exists(select 1 from public.seo_keywords where owner_id=auth.uid()) then raise exception 'Import base keywords first';end if;
 with raw as (
 select r.* from public.seo_batches b cross join lateral jsonb_to_recordset(b.payload) r(key text,url text,impressions bigint,clicks bigint,weighted_position double precision,position_weight bigint,missing_rank bigint,invalid_rows integer) where b.import_id=p_import
 ), agg as (
 select key,url,sum(impressions)::bigint impressions,sum(clicks)::bigint clicks,
 case when sum(position_weight)>0 and sum(missing_rank)=0 then sum(weighted_position)/sum(position_weight) end position,
 sum(invalid_rows)::integer invalid_rows from raw group by key,url
 ), grouped as (
 select key,coalesce(jsonb_agg(jsonb_build_object('url',url,'impressions',impressions,'clicks',clicks,'position',position) order by impressions desc,clicks desc,url collate "C") filter(where url<>''),'[]') urls,sum(impressions)::bigint impressions,sum(clicks)::bigint clicks,sum(invalid_rows)::integer invalid_rows from agg group by key
 ), joined as (
 select k.*,coalesce(g.urls,'[]') urls,coalesce(g.impressions,0) impressions,coalesce(g.clicks,0) clicks,coalesce(g.invalid_rows,0) invalid_rows from public.seo_keywords k left join grouped g using(key) where k.owner_id=auth.uid()
 ), measured as (
 select j.*, (urls->0->>'position')::double precision leader_position,
 abs((urls->0->>'position')::double precision-(urls->1->>'position')::double precision) gap,
 coalesce((urls->0->>'impressions')::bigint>0 and exists(select 1 from jsonb_array_elements(urls) with ordinality u(v,ord) where ord>1 and (v->>'impressions')::bigint >= (urls->0->>'impressions')::bigint*0.2),false) cannibal from joined j
 )
 insert into public.seo_records(import_id,key,query,categories,urls,impressions,clicks,position,gap,cannibal,status,invalid_rows)
 select p_import,key,query,categories,urls,impressions,clicks,leader_position,gap,cannibal,
 case when invalid_rows>0 then 'data_issue' when jsonb_array_length(urls)=0 then 'no_data' when not cannibal then 'none' when leader_position is null then 'unknown' when leader_position>3 then 'danger' when gap is null then 'unknown' when round(gap::numeric,10)<0.5 then 'safe' when round(gap::numeric,10)<=1 then 'medium' else 'danger' end,invalid_rows from measured;
 select count(*) into mapped from public.seo_records where import_id=p_import and status<>'no_data';
 select count(distinct r.key) into excluded from public.seo_batches b cross join lateral jsonb_to_recordset(b.payload) r(key text) where b.import_id=p_import and not exists(select 1 from public.seo_keywords k where k.owner_id=auth.uid() and k.key=r.key);
 update public.seo_imports set status='ready',quality=quality||jsonb_build_object('mappedKeywords',mapped,'excludedKeywords',excluded) where id=p_import returning quality into job.quality;
 delete from public.seo_batches where import_id=p_import;
 return job.quality;
end $$;

create function public.seo_summary(p_import uuid,p_category text default '') returns jsonb language sql stable security invoker set search_path='' as $$
 with x as(select * from public.seo_records where import_id=p_import and (p_category='' or p_category=any(categories))),
 c as(select status,count(*) n from x group by status)
 select jsonb_build_object('total',count(*),'withData',count(*) filter(where status<>'no_data'),'cannibal',count(*) filter(where cannibal),'impressions',coalesce(sum(impressions),0),'clicks',coalesce(sum(clicks),0),'affectedImpressions',coalesce(sum(impressions) filter(where cannibal),0),'ctr',case when sum(impressions)>0 then sum(clicks)*100.0/sum(impressions) else 0 end,'counts',coalesce((select jsonb_object_agg(status,n) from c),'{}')) from x
$$;

create function public.seo_dashboard(p_import uuid,p_category text default '',p_status text default '',p_search text default '',p_page integer default 0,p_sort text default 'impressions') returns jsonb language sql stable security invoker set search_path='' as $$
 with x as(select * from public.seo_records where import_id=p_import and (p_category='' or p_category=any(categories)) and (p_search='' or strpos(lower(query),lower(p_search))>0) and (p_status='' or status=p_status or (p_status='cannibal' and cannibal))),
 paged as(select * from x order by case when p_sort='clicks' then clicks else impressions end desc,key limit 25 offset greatest(p_page,0)*25),
 cats as(select c name,count(*) total,count(*) filter(where cannibal) cannibal,count(*) filter(where status='danger') danger,coalesce(sum(impressions),0) impressions from public.seo_records cross join lateral unnest(categories) c where import_id=p_import group by c),
 weeks as(select distinct on(week_start) * from public.seo_imports where status='ready' order by week_start,created_at desc),
 trend as(select id,week_start,public.seo_summary(id,p_category) summary from weeks order by week_start desc limit 12)
 select jsonb_build_object('summary',public.seo_summary(p_import,p_category),'rows',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'),'count',(select count(*) from x),'categories',coalesce((select jsonb_agg(to_jsonb(cats) order by danger desc,total desc) from cats),'[]'),'trend',coalesce((select jsonb_agg(to_jsonb(trend) order by week_start) from trend),'[]'),'quality',(select quality from public.seo_imports where id=p_import));
$$;

revoke execute on function public.seo_import_base(jsonb),public.seo_finalize_import(uuid),public.seo_summary(uuid,text),public.seo_dashboard(uuid,text,text,text,integer,text) from public,anon;
grant execute on function public.seo_import_base(jsonb),public.seo_finalize_import(uuid),public.seo_summary(uuid,text),public.seo_dashboard(uuid,text,text,text,integer,text) to authenticated;
