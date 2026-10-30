-- Keep the existing RPC signature and invoker/RLS behavior; support multiple statuses.
do $migration$
declare
 definition text;
 old_predicate text := 'p_status='''' or status=p_status or (p_status=''unclassified'' and status in (''unknown'',''data_issue''))';
 new_predicate text := 'p_status='''' or status=any(pg_catalog.string_to_array(p_status,'','')) or (p_status=''unclassified'' and status in (''unknown'',''data_issue''))';
begin
 select pg_get_functiondef('public.seo_overview(uuid,text,text,text,text,boolean,integer,text)'::regprocedure) into definition;
 if position(old_predicate in definition)=0 then raise exception 'Expected single-status predicate missing; inspect live RPC before applying.'; end if;
 execute replace(definition,old_predicate,new_predicate);
end;
$migration$;
