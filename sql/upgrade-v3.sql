-- Haveli Mitters v3: apply AFTER v2 only. Fresh installs use setup.sql instead.
begin;
alter table public.hm_players add column if not exists profile_visibility text not null default 'inherit' check(profile_visibility in ('inherit','public','private'));
alter table public.hm_players add column if not exists stats_visibility text not null default 'inherit' check(stats_visibility in ('inherit','public','private'));
alter table public.hm_players add column if not exists leadership text not null default 'player' check(leadership in ('player','captain','vice_captain'));
alter table public.hm_players add column if not exists display_order int not null default 0;
alter table public.hm_players add column if not exists photo_path text;
create unique index if not exists hm_active_captain on public.hm_players(leadership) where leadership='captain' and status='active';
create unique index if not exists hm_active_vice on public.hm_players(leadership) where leadership='vice_captain' and status='active';
alter table public.hm_matches add column if not exists audience text not null default 'public' check(audience in ('public','team','admin'));

create table if not exists public.hm_player_accounts (
 player_id uuid primary key references public.hm_players(id) on delete cascade,
 user_id uuid not null unique references auth.users(id) on delete cascade,
 linked_at timestamptz not null default now()
);
create table if not exists public.hm_player_invites (
 id uuid primary key default gen_random_uuid(), player_id uuid not null unique references public.hm_players(id) on delete cascade,
 email text not null, token_hash text not null unique, expires_at timestamptz not null,
 created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);
create table if not exists public.hm_audit (
 id bigint generated always as identity primary key, actor uuid references auth.users(id) on delete set null,
 action text not null, entity uuid, detail jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.hm_player_accounts enable row level security;
alter table public.hm_player_invites enable row level security;
alter table public.hm_audit enable row level security;
drop policy if exists hm_links_read on public.hm_player_accounts;
create policy hm_links_read on public.hm_player_accounts for select to authenticated using(user_id=(select auth.uid()) or public.hm_is_admin());
drop policy if exists hm_player_invites_admin on public.hm_player_invites;
create policy hm_player_invites_admin on public.hm_player_invites for select to authenticated using(public.hm_is_admin());
drop policy if exists hm_audit_admin on public.hm_audit;
create policy hm_audit_admin on public.hm_audit for select to authenticated using(public.hm_is_admin());
revoke all on public.hm_player_accounts,public.hm_player_invites,public.hm_audit from public,anon,authenticated;
grant select on public.hm_player_accounts,public.hm_player_invites,public.hm_audit to authenticated;

create or replace function public.hm_owns_player(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hm_player_accounts where player_id=p_id and user_id=(select auth.uid()));
$$;
create or replace function public.hm_team_member() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hm_player_accounts a join public.hm_players p on p.id=a.player_id where a.user_id=(select auth.uid()) and p.status='active' and p.published);
$$;
create or replace function public.hm_can_profile(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.hm_is_admin() or exists(
  select 1 from public.hm_players p cross join public.hm_settings s where p.id=p_id and p.published and p.status<>'removed' and
  (public.hm_owns_player(p.id) or (coalesce((s.config->>'force_private')::boolean,false)=false and
   coalesce(nullif(p.profile_visibility,'inherit'),s.config->>'profile_default','public')='public')));
$$;
create or replace function public.hm_can_stats(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.hm_is_admin() or (public.hm_can_profile(p_id) and exists(
  select 1 from public.hm_players p cross join public.hm_settings s where p.id=p_id and
  (public.hm_owns_player(p.id) or (coalesce((s.config->>'force_private')::boolean,false)=false and
   coalesce(nullif(p.stats_visibility,'inherit'),s.config->>'stats_default','public')='public'))));
$$;
create or replace function public.hm_can_match(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.hm_is_admin() or exists(select 1 from public.hm_matches where id=p_id and published and
  (audience='public' or (audience='team' and public.hm_team_member())));
$$;
drop policy if exists hm_players_read on public.hm_players;
create policy hm_players_read on public.hm_players for select to anon,authenticated using(public.hm_can_profile(id));
drop policy if exists hm_matches_read on public.hm_matches;
create policy hm_matches_read on public.hm_matches for select to anon,authenticated using(public.hm_can_match(id));
drop policy if exists hm_stats_read on public.hm_stats;
create policy hm_stats_read on public.hm_stats for select to anon,authenticated using(public.hm_can_stats(player_id) and public.hm_can_match(match_id));
create or replace function public.hm_readable_stats() returns setof uuid language sql stable security definer set search_path='' as $$
 select id from public.hm_players where public.hm_can_profile(id) and public.hm_can_stats(id);
$$;

create or replace function public.hm_player_invite(p_player uuid,p_email text) returns text language plpgsql security definer set search_path='' as $$
declare token text;
begin
 if not public.hm_is_admin() then raise exception 'Admin access required'; end if;
 perform 1 from public.hm_players where id=p_player for update;
 if not found then raise exception 'Player not found'; end if;
 if exists(select 1 from public.hm_player_accounts where player_id=p_player) then raise exception 'Remove the old player access before inviting a replacement'; end if;
 if trim(p_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.hm_player_invites(player_id,email,token_hash,expires_at,created_by)
 values(p_player,lower(trim(p_email)),encode(extensions.digest(token,'sha256'),'hex'),now()+interval '48 hours',auth.uid())
 on conflict(player_id) do update set email=excluded.email,token_hash=excluded.token_hash,expires_at=excluded.expires_at,created_at=now(),created_by=excluded.created_by;
 insert into public.hm_audit(actor,action,entity) values(auth.uid(),'player_invited',p_player);
 return token;
end $$;
create or replace function public.hm_accept_player(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.hm_player_invites; mail text;
begin
 select lower(email) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if mail is null then raise exception 'Sign in with a confirmed email first'; end if;
 select * into inv from public.hm_player_invites where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now() for update;
 if inv.id is null or inv.email<>mail then raise exception 'Invitation expired or belongs to a different email'; end if;
 insert into public.hm_player_accounts(player_id,user_id) values(inv.player_id,auth.uid());
 delete from public.hm_player_invites where id=inv.id;
 insert into public.hm_audit(actor,action,entity) values(auth.uid(),'player_linked',inv.player_id);
 return inv.player_id;
end $$;
create or replace function public.hm_revoke_player(p_player uuid,p_unlink boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.hm_is_admin() then raise exception 'Admin access required'; end if;
 perform 1 from public.hm_players where id=p_player for update;
 delete from public.hm_player_invites where player_id=p_player;
 if p_unlink then delete from public.hm_player_accounts where player_id=p_player; end if;
 insert into public.hm_audit(actor,action,entity,detail) values(auth.uid(),'player_access_revoked',p_player,jsonb_build_object('unlinked',p_unlink));
end $$;
create or replace function public.hm_player_access() returns table(player_id uuid,user_id uuid,email text,expires_at timestamptz,linked boolean)
language plpgsql security definer set search_path='' as $$
begin
 if not public.hm_is_admin() then raise exception 'Admin access required'; end if;
 return query select a.player_id,a.user_id,u.email::text,null::timestamptz,true from public.hm_player_accounts a join auth.users u on u.id=a.user_id
 union all select i.player_id,null::uuid,i.email,i.expires_at,false from public.hm_player_invites i;
end $$;

create or replace function public.hm_color_contrast(a text,b text) returns double precision language sql immutable set search_path='' as $$
 with rgb as (select c,substring(v from 2+2*n for 2) h,n from (values(0,a),(1,b)) x(c,v) cross join generate_series(0,2) n),
 channel as (select c,n,(('x'||h)::bit(8)::int)/255.0 v from rgb),
 lum as (select c,sum((case when v<=0.04045 then v/12.92 else power((v+0.055)/1.055,2.4) end)*(case n when 0 then 0.2126 when 1 then 0.7152 else 0.0722 end)) l from channel group by c)
 select (max(l)+0.05)/(min(l)+0.05) from lum;
$$;
-- Validate and strip legacy developer overrides in both draft and published settings.
create or replace function public.hm_config_guard() returns trigger language plpgsql set search_path='' as $$
declare k text; v jsonb; c jsonb; p record; bg text; tx text; pan text; accent text;
begin
 c:=new.config - array['developer_brand','developer_url','developer_email','developer_whatsapp'];
 if jsonb_typeof(c)<>'object' then raise exception 'Settings must be an object'; end if;
 c:=jsonb_set(c,'{flags}',coalesce(c->'flags','{}'::jsonb)-'developer_card');
 for k,v in select * from jsonb_each(c->'flags') loop
  if jsonb_typeof(v)<>'boolean' then raise exception 'Feature switches must be true or false'; end if;
 end loop;
 if coalesce(c->>'profile_default','public') not in ('public','private') or coalesce(c->>'stats_default','public') not in ('public','private') then raise exception 'Invalid visibility default'; end if;
 if c ? 'force_private' and jsonb_typeof(c->'force_private')<>'boolean' then raise exception 'Invalid force-private setting'; end if;
 if c ? 'appearance' then
  for k,v in select * from jsonb_each(c->'appearance') loop
   if k in ('font_body','font_heading') then
    if v#>>'{}' not in ('dm','manrope','system','georgia') then raise exception 'Choose a supported font'; end if;
   elsif k='font_urdu' then
    if v#>>'{}' not in ('noto','system') then raise exception 'Choose a supported Urdu font'; end if;
   elsif k ~ '^(dark|light)_(bg|panel|text|gold)$' then
    if v#>>'{}' !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Invalid appearance color'; end if;
   else raise exception 'Unknown appearance setting'; end if;
  end loop;
  foreach k in array array['dark','light'] loop
   bg:=coalesce(c->'appearance'->>(k||'_bg'),case when k='dark' then '#171310' else '#f5f0e7' end);
   tx:=coalesce(c->'appearance'->>(k||'_text'),case when k='dark' then '#f5ebda' else '#30231b' end);
   pan:=coalesce(c->'appearance'->>(k||'_panel'),case when k='dark' then '#211b17' else '#fffdf8' end);
   accent:=coalesce(c->'appearance'->>(k||'_gold'),case when k='dark' then '#d8b574' else '#896229' end);
   if public.hm_color_contrast(tx,bg)<4.5 or public.hm_color_contrast(tx,pan)<4.5 or public.hm_color_contrast(accent,bg)<3 then raise exception 'Choose readable colors: text contrast 4.5:1 and accent 3:1 minimum';end if;
  end loop;
 end if;
 -- Uploaded portraits use an authorized private bucket. External legacy URLs cannot be made private.
 if coalesce((c->>'force_private')::boolean,false) or coalesce(c->>'profile_default','public')='private' then
  if exists(select 1 from public.hm_players where published and status<>'removed' and coalesce(photo_url,'')<>'' and photo_path is null and
   (coalesce((c->>'force_private')::boolean,false) or profile_visibility<>'public')) then
   raise exception 'Upload player portraits to protected storage or clear external Photo URLs before making profiles private';
  end if;
 end if;
 new.config:=c;
 return new;
end $$;
drop trigger if exists hm_settings_guard on public.hm_settings;
create trigger hm_settings_guard before insert or update on public.hm_settings for each row execute function public.hm_config_guard();
drop trigger if exists hm_draft_guard on public.hm_settings_drafts;
create trigger hm_draft_guard before insert or update on public.hm_settings_drafts for each row execute function public.hm_config_guard();
update public.hm_settings set config=config;
update public.hm_settings_drafts set config=config;

create or replace function public.hm_portrait_guard() returns trigger language plpgsql set search_path='' as $$
declare c jsonb;
begin
 select config into c from public.hm_settings where id=1;
 if new.photo_path is not null then
  if new.photo_path not like new.id::text||'/%' then raise exception 'Portrait path must belong to this player'; end if;
  new.photo_url:=null;
 end if;
 if coalesce(new.photo_url,'')<>'' and new.photo_path is null and
  (coalesce((c->>'force_private')::boolean,false) or coalesce(nullif(new.profile_visibility,'inherit'),c->>'profile_default','public')='private') then
  raise exception 'Use a protected portrait upload or clear Photo URL for a private profile';
 end if;
 return new;
end $$;
drop trigger if exists hm_portrait_guard on public.hm_players;
create trigger hm_portrait_guard before insert or update on public.hm_players for each row execute function public.hm_portrait_guard();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hm-portraits','hm-portraits',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false;
drop policy if exists hm_portrait_read on storage.objects;
create policy hm_portrait_read on storage.objects for select to anon,authenticated using(bucket_id='hm-portraits' and exists(
 select 1 from public.hm_players p where p.photo_path=storage.objects.name and public.hm_can_profile(p.id)));
drop policy if exists hm_portrait_write on storage.objects;
create policy hm_portrait_write on storage.objects for all to authenticated using(bucket_id='hm-portraits' and public.hm_is_admin()) with check(bucket_id='hm-portraits' and public.hm_is_admin());

-- An admin-only wrapper preserves the old match editor while keeping the new audience value.
do $$ begin
 if to_regprocedure('public.hm_save_match_v2(uuid,integer,jsonb,jsonb)') is null then
  alter function public.hm_save_match(uuid,integer,jsonb,jsonb) rename to hm_save_match_v2;
 end if;
end $$;
create or replace function public.hm_save_match(p_id uuid,p_revision int,p_match jsonb,p_stats jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare mid uuid;
begin
 if not public.hm_is_admin() then raise exception 'Admin access required'; end if;
 if to_regclass('public.hm_live_matches') is not null and p_id is not null then
  if exists(select 1 from public.hm_live_matches where match_id=p_id) then raise exception 'Use Live scoring to correct this live match'; end if;
 end if;
 mid:=public.hm_save_match_v2(p_id,p_revision,p_match,p_stats);
 update public.hm_matches set audience=coalesce(p_match->>'audience','public') where id=mid;
 return mid;
end $$;

create table if not exists public.hm_policy_epoch(id int primary key check(id=1),version bigint not null default 1);
insert into public.hm_policy_epoch(id) values(1) on conflict do nothing;
alter table public.hm_policy_epoch enable row level security;
revoke all on public.hm_policy_epoch from public,anon,authenticated;
create or replace function public.hm_bump_policy() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.hm_policy_epoch set version=version+1 where id=1;return null;end $$;
do $$ declare tab text;begin
 foreach tab in array array['hm_players','hm_settings','hm_player_accounts','hm_matches','hm_stats'] loop
  execute format('drop trigger if exists hm_policy_change on public.%I',tab);
  execute format('create trigger hm_policy_change after insert or update or delete on public.%I for each statement execute function public.hm_bump_policy()',tab);
 end loop;
end $$;
create or replace function public.hm_policy_stamp() returns text language sql stable security definer set search_path='' as $$
 select version::text||':'||coalesce(auth.uid()::text,'anon') from public.hm_policy_epoch where id=1;
$$;
-- Revoke implicit PUBLIC access. Only named read helpers are available to visitors.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'hm\_%' escape '\' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
revoke all on function public.hm_save_match_v2(uuid,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.hm_is_admin(),public.hm_owns_player(uuid),public.hm_team_member(),public.hm_can_profile(uuid),public.hm_can_stats(uuid),public.hm_can_match(uuid),public.hm_readable_stats(),public.hm_policy_stamp() to anon;
commit;
