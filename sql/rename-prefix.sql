-- SOURCE PART: generated into migrate-prefix.sql. Do not run this part alone.
-- Rename this portal's existing v2/v3 database without replacing its rows.
-- Storage files must first be copied through Storage, not renamed with SQL.
begin;
do $migration$
declare r record; target_name text; definition text; expected text[] := array[
 'admins','invites','settings','settings_drafts','players','matches','stats','media','location',
 'player_accounts','player_invites','audit','policy_epoch','live_matches','lineups','live_events'];
begin
 perform pg_catalog.pg_advisory_xact_lock(817032);
 if to_regclass('public.hh_players') is null then
  if to_regclass('public.hm_players') is null then
   raise exception 'No existing portal found. Use sql/setup.sql for a fresh HM installation.';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and left(c.relname,3)='hh_')
   or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,3)='hh_') then
   raise exception 'Mixed or incomplete HH/HM schema. Nothing was merged; restore/check the backup first.';
  end if;
 else
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and left(c.relname,3)='hm_')
   or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,3)='hm_') then
   raise exception 'Both HH and HM objects exist. Nothing was merged; resolve the duplicate installation first.';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
   and left(c.relname,3)='hh_' and c.relkind='r' and substring(c.relname from 4)<>all(expected)) then
   raise exception 'Unrecognized HH tables. This migration supports the Haveli Mitters v2/v3 portal only.';
  end if;
  if to_regclass('public.hh_admins') is null or to_regclass('public.hh_stats') is null then
   raise exception 'Incomplete original portal schema. Restore/check it before migration.';
  end if;
 end if;
 -- Fail before any rename. Never UPDATE/DELETE Storage metadata to move files.
 if exists(select 1 from storage.buckets where id in ('hh-media','hh-portraits'))
  or exists(select 1 from storage.objects where bucket_id in ('hh-media','hh-portraits')) then
  raise exception 'Storage preparation needed. Read docs/HM-MIGRATION.md: copy and verify existing files in HM buckets, then remove old buckets through Storage. Empty old buckets can be deleted directly in Storage. No database changes were committed.';
 end if;
 if to_regclass('public.hh_players') is null then return; end if;

 -- Hold table locks until COMMIT so writers cannot use half-renamed objects.
 for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and left(c.relname,3)='hh_' and c.relkind='r' order by c.relname loop
  execute format('lock table public.%I in access exclusive mode',r.relname);
 end loop;
 for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and left(c.relname,3)='hh_' and c.relkind='r' loop
  execute format('alter table public.%I rename to %I',r.relname,'hm_'||substring(r.relname from 4));
 end loop;

 -- Rename constraints first; their backing indexes follow automatically.
 for r in select c.conname,t.relname from pg_constraint c join pg_class t on t.oid=c.conrelid
  join pg_namespace n on n.oid=t.relnamespace where n.nspname='public'
  and left(t.relname,3)='hm_' and left(c.conname,3)='hh_' loop
  execute format('alter table public.%I rename constraint %I to %I',r.relname,r.conname,'hm_'||substring(r.conname from 4));
 end loop;
 for r in select c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and left(c.relname,3)='hh_' and c.relkind in ('i','S') loop
  execute format('alter %s public.%I rename to %I',case when r.relkind='S' then 'sequence' else 'index' end,r.relname,'hm_'||substring(r.relname from 4));
 end loop;
 for r in select t.tgname,c.relname from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal
  and left(c.relname,3)='hm_' and left(t.tgname,3)='hh_' loop
  execute format('alter trigger %I on public.%I rename to %I',r.tgname,r.relname,'hm_'||substring(r.tgname from 4));
 end loop;

 -- Renames preserve OIDs, table links, ownership, grants and policy dependencies.
 for r in select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,3)='hh_' loop
  execute format('alter function public.%I(%s) rename to %I',r.proname,r.args,'hm_'||substring(r.proname from 4));
 end loop;
 -- PostgreSQL does not rewrite text stored inside SQL/PLpgSQL function bodies.
 -- Rebuild each body under the SAME OID so ACLs and bound dependencies survive.
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and left(p.proname,3)='hm_' loop
  definition:=replace(replace(pg_get_functiondef(r.oid),'hh_','hm_'),'hh-','hm-');
  execute definition;
 end loop;
 for r in select schemaname,tablename,policyname,qual,with_check from pg_policies
  where left(policyname,3)='hh_' and ((schemaname='public' and left(tablename,3)='hm_') or (schemaname='storage' and tablename='objects')) loop
  target_name:='hm_'||substring(r.policyname from 4);
  execute format('alter policy %I on %I.%I rename to %I',r.policyname,r.schemaname,r.tablename,target_name);
  if r.qual is not null then
   execute format('alter policy %I on %I.%I using (%s)',target_name,r.schemaname,r.tablename,replace(replace(r.qual,'hh_','hm_'),'hh-','hm-'));
  end if;
  if r.with_check is not null then
   execute format('alter policy %I on %I.%I with check (%s)',target_name,r.schemaname,r.tablename,replace(replace(r.with_check,'hh_','hm_'),'hh-','hm-'));
  end if;
 end loop;

 -- Rewrite only known Storage URL path segments, never names/free-form content.
 -- The storage preflight requires file copying to finish before this point.
 update public.hm_players set photo_url=replace(replace(photo_url,'/object/public/hh-media/','/object/public/hm-media/'),'/render/image/public/hh-media/','/render/image/public/hm-media/')
  where photo_url like '%/public/hh-media/%';
 update public.hm_media set url=replace(replace(url,'/object/public/hh-media/','/object/public/hm-media/'),'/render/image/public/hh-media/','/render/image/public/hm-media/'),
  thumbnail_url=replace(replace(thumbnail_url,'/object/public/hh-media/','/object/public/hm-media/'),'/render/image/public/hh-media/','/render/image/public/hm-media/')
  where url like '%/public/hh-media/%' or thumbnail_url like '%/public/hh-media/%';
 update public.hm_settings set config=replace(replace(config::text,'/object/public/hh-media/','/object/public/hm-media/'),'/render/image/public/hh-media/','/render/image/public/hm-media/')::jsonb
  where config::text like '%/public/hh-media/%';
 update public.hm_settings_drafts set config=replace(replace(config::text,'/object/public/hh-media/','/object/public/hm-media/'),'/render/image/public/hh-media/','/render/image/public/hm-media/')::jsonb
  where config::text like '%/public/hh-media/%';
end $migration$;

-- Empty target bucket initialization, consistent with the fresh schema.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hm-media','hm-media',true,41943040,array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/ogg','audio/wav','video/mp4','video/webm'])
on conflict(id) do nothing;
commit;
