-- 02 - Haveli Mitters - HM Database Check
-- Read-only: expected 16 HM tables, all RLS Enabled.
select tablename as table_name,
 case when rowsecurity then 'Enabled' else 'Disabled' end as row_level_security
from pg_catalog.pg_tables
where schemaname='public' and left(tablename,3)='hm_'
order by tablename;

-- Expected: no rows. These checks include old functions, indexes, constraints,
-- policies, triggers, sequences, and Storage bucket identifiers.
select 'relation' as object_type,c.relname as old_name from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and left(c.relname,3)='hh_'
union all select 'function',p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and left(p.proname,3)='hh_'
union all select 'constraint',c.conname from pg_constraint c join pg_namespace n on n.oid=c.connamespace
 where n.nspname='public' and left(c.conname,3)='hh_'
union all select 'policy',policyname from pg_policies where schemaname in ('public','storage') and left(policyname,3)='hh_'
union all select 'trigger',t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and not t.tgisinternal and left(t.tgname,3)='hh_'
union all select 'bucket',id from storage.buckets where id in ('hh-media','hh-portraits');
