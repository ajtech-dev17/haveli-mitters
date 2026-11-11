-- Haveli Mitters Professional Portal v2.
-- Run once as project owner in Supabase SQL Editor. Existing legacy tables are untouched.
begin;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.hm_admins (
 user_id uuid primary key references auth.users(id) on delete restrict,
 role text not null check(role in ('owner','admin')), created_at timestamptz default now() not null
);
create unique index if not exists hm_one_owner on public.hm_admins(role) where role='owner';
create table if not exists public.hm_invites (
 id uuid primary key default gen_random_uuid(), email text not null,
 token_hash text not null unique, expires_at timestamptz not null,
 created_by uuid references auth.users(id), created_at timestamptz default now()
);
create table if not exists public.hm_settings (
 id integer primary key check(id=1), config jsonb not null default '{}',
 revision integer not null default 0, updated_at timestamptz default now()
);
insert into public.hm_settings(id) values(1) on conflict do nothing;
create table if not exists public.hm_settings_drafts (
 id integer primary key check(id=1), config jsonb not null, updated_at timestamptz default now()
);
create table if not exists public.hm_players (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0),
 name_ur text, jersey integer not null check(jersey between 0 and 999),
 role text not null check(role in ('batter','bowler','all_rounder','wicket_keeper')),
 batting_style text, batting_style_ur text, bowling_style text, bowling_style_ur text,
 photo_url text, status text not null default 'active' check(status in ('active','retired','removed')),
 published boolean not null default false, created_at timestamptz default now()
);
create unique index if not exists hm_active_jersey on public.hm_players(jersey) where status='active';
create table if not exists public.hm_matches (
 id uuid primary key default gen_random_uuid(), opponent text not null, opponent_ur text,
 venue text, venue_ur text, starts_at timestamptz not null, toss_at timestamptz,
 season text not null, status text not null check(status in ('upcoming','completed','abandoned')),
 result text check(result in ('won','lost','tied','no_result')), team_runs int check(team_runs>=0),
 team_wickets int check(team_wickets between 0 and 10), team_balls int check(team_balls>=0),
 opponent_runs int check(opponent_runs>=0), opponent_wickets int check(opponent_wickets between 0 and 10),
 opponent_balls int check(opponent_balls>=0), summary text, summary_ur text,
 published boolean not null default false, revision int not null default 1,
 created_at timestamptz default now(),
 check(status<>'upcoming' or result is null),
 check(status<>'completed' or result is not null),
 check(status<>'completed' or result='no_result' or
 (team_runs is not null and team_wickets is not null and opponent_runs is not null and opponent_wickets is not null))
);
create table if not exists public.hm_stats (
 match_id uuid references public.hm_matches(id) on delete cascade,
 player_id uuid references public.hm_players(id) on delete restrict,
 batted boolean not null default false, runs int not null default 0 check(runs>=0),
 balls int not null default 0 check(balls>=0), not_out boolean not null default false,
 fours int not null default 0 check(fours>=0), sixes int not null default 0 check(sixes>=0),
 wickets int not null default 0 check(wickets between 0 and 10),
 bowling_balls int not null default 0 check(bowling_balls>=0),
 conceded int not null default 0 check(conceded>=0), catches int not null default 0 check(catches>=0),
 run_outs int not null default 0 check(run_outs>=0), stumpings int not null default 0 check(stumpings>=0),
 primary key(match_id,player_id), check(fours*4+sixes*6<=runs),
 check(batted or (runs=0 and balls=0 and fours=0 and sixes=0 and not_out=false))
);
create index if not exists hm_stats_player on public.hm_stats(player_id);
create index if not exists hm_matches_date on public.hm_matches(starts_at desc);
create table if not exists public.hm_media (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('moment','audio','video','social')),
 title text not null, title_ur text, description text, description_ur text,
 category text default 'team', url text not null, thumbnail_url text,
 sort_order int not null default 0, published boolean not null default false,
 created_at timestamptz default now()
);
create table if not exists public.hm_location (
 id int primary key check(id=1), latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 label text not null default 'Team location', expires_at timestamptz not null, updated_at timestamptz not null default now()
);
create or replace function public.hm_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hm_admins where user_id=(select auth.uid()));
$$;
create or replace function public.hm_is_owner() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hm_admins where user_id=(select auth.uid()) and role='owner');
$$;
-- Database-level cap protects against two concurrent invitations being redeemed.
create or replace function public.hm_admin_limit() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(817031);
 if (select count(*) from public.hm_admins)>=2 then raise exception 'Maximum two admins. Remove an admin before adding another.'; end if;
 return new;
end $$;
drop trigger if exists hm_limit_admins on public.hm_admins;
create trigger hm_limit_admins before insert on public.hm_admins for each row execute function public.hm_admin_limit();

alter table public.hm_admins enable row level security;
alter table public.hm_invites enable row level security;
alter table public.hm_settings enable row level security;
alter table public.hm_settings_drafts enable row level security;
alter table public.hm_players enable row level security;
alter table public.hm_matches enable row level security;
alter table public.hm_stats enable row level security;
alter table public.hm_media enable row level security;
alter table public.hm_location enable row level security;

-- This file owns only policies prefixed hm_. It is safe to rerun on this v2 schema.
do $$ declare p record; begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename like 'hm\_%' escape '\' loop
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
create policy hm_admins_read on public.hm_admins for select to authenticated using(public.hm_is_admin());
create policy hm_invites_owner on public.hm_invites for select to authenticated using(public.hm_is_owner());
create policy hm_settings_read on public.hm_settings for select to anon,authenticated using(true);
create policy hm_drafts_admin on public.hm_settings_drafts for all to authenticated using(public.hm_is_admin()) with check(public.hm_is_admin());
create policy hm_players_read on public.hm_players for select to anon,authenticated using(published and status<>'removed');
create policy hm_players_admin on public.hm_players for all to authenticated using(public.hm_is_admin()) with check(public.hm_is_admin());
create policy hm_matches_read on public.hm_matches for select to anon,authenticated using(published);
create policy hm_matches_admin on public.hm_matches for all to authenticated using(public.hm_is_admin()) with check(public.hm_is_admin());
create policy hm_stats_read on public.hm_stats for select to anon,authenticated using(
 exists(select 1 from public.hm_matches m where m.id=match_id and m.published) and
 exists(select 1 from public.hm_players p where p.id=player_id and p.published and p.status<>'removed'));
create policy hm_stats_admin on public.hm_stats for all to authenticated using(public.hm_is_admin()) with check(public.hm_is_admin());
create policy hm_media_read on public.hm_media for select to anon,authenticated using(published);
create policy hm_media_admin on public.hm_media for all to authenticated using(public.hm_is_admin()) with check(public.hm_is_admin());
create policy hm_location_read on public.hm_location for select to anon,authenticated using(expires_at>now());
create policy hm_location_admin on public.hm_location for all to authenticated using(public.hm_is_admin()) with check(public.hm_is_admin());

revoke all on public.hm_admins,public.hm_invites,public.hm_settings,public.hm_settings_drafts,public.hm_players,public.hm_matches,public.hm_stats,public.hm_media,public.hm_location from public,anon,authenticated;
grant usage on schema public to anon,authenticated;
grant select on public.hm_settings,public.hm_players,public.hm_matches,public.hm_stats,public.hm_media,public.hm_location to anon,authenticated;
grant select on public.hm_admins,public.hm_invites to authenticated;
grant select,insert,update,delete on public.hm_settings_drafts,public.hm_players,public.hm_matches,public.hm_stats,public.hm_media,public.hm_location to authenticated;

create or replace function public.hm_publish_settings(p_revision integer,p_config jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare v integer;
begin
 if not public.hm_is_admin() then raise exception 'Admin access required'; end if;
 select revision into v from public.hm_settings where id=1 for update;
 if v<>p_revision then raise exception 'Another admin published changes. Reload before publishing.'; end if;
 if p_config is null or jsonb_typeof(p_config)<>'object' then raise exception 'Invalid configuration'; end if;
 update public.hm_settings set config=p_config,revision=v+1,updated_at=now() where id=1;
 return v+1;
end $$;

create or replace function public.hm_create_invite(p_email text) returns text
language plpgsql security definer set search_path='' as $$
declare tok text;
begin
 if not public.hm_is_owner() then raise exception 'Owner access required'; end if;
 if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
 tok:=encode(extensions.gen_random_bytes(32),'hex');
 delete from public.hm_invites where email=lower(trim(p_email)) or expires_at<now();
 insert into public.hm_invites(email,token_hash,expires_at,created_by)
 values(lower(trim(p_email)),encode(extensions.digest(tok,'sha256'),'hex'),now()+interval '48 hours',auth.uid());
 return tok;
end $$;
create or replace function public.hm_redeem_invite(p_token text) returns void
language plpgsql security definer set search_path='' as $$
declare inv public.hm_invites; mail text;
begin
 perform pg_catalog.pg_advisory_xact_lock(817031);
 select lower(email) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if mail is null then raise exception 'Sign in with a confirmed email first'; end if;
 select * into inv from public.hm_invites where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now() for update;
 if inv.id is null or inv.email<>mail then raise exception 'Invitation expired or belongs to a different email'; end if;
 insert into public.hm_admins(user_id,role) values(auth.uid(),'admin');
 delete from public.hm_invites where id=inv.id;
end $$;
create or replace function public.hm_remove_admin(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(817031);
 if not public.hm_is_owner() then raise exception 'Owner access required'; end if;
 if p_user=auth.uid() then raise exception 'Transfer ownership before removing yourself'; end if;
 delete from public.hm_admins where user_id=p_user and role='admin';
end $$;
create or replace function public.hm_transfer_owner(p_user uuid,p_leave boolean default true) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(817031);
 if not public.hm_is_owner() then raise exception 'Owner access required'; end if;
 if p_user=auth.uid() or not exists(select 1 from public.hm_admins where user_id=p_user and role='admin') then raise exception 'Choose the second admin'; end if;
 update public.hm_admins set role='admin' where user_id=auth.uid();
 update public.hm_admins set role='owner' where user_id=p_user;
 if p_leave then delete from public.hm_admins where user_id=auth.uid(); end if;
end $$;
create or replace function public.hm_members() returns table(user_id uuid,role text,email text,display_name text)
language plpgsql security definer set search_path='' as $$
begin
 if not public.hm_is_admin() then raise exception 'Admin access required'; end if;
 return query select a.user_id,a.role,u.email::text,coalesce(u.raw_user_meta_data->>'display_name','') from public.hm_admins a join auth.users u on a.user_id=u.id;
end $$;
create or replace function public.hm_save_match(p_id uuid,p_revision int,p_match jsonb,p_stats jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare mid uuid; oldrev int; v public.hm_matches;
begin
 if not public.hm_is_admin() then raise exception 'Admin access required'; end if;
 v:=jsonb_populate_record(null::public.hm_matches,p_match);
 if p_id is null then
  mid:=gen_random_uuid();
  insert into public.hm_matches(id,opponent,opponent_ur,venue,venue_ur,starts_at,toss_at,season,status,result,team_runs,team_wickets,team_balls,opponent_runs,opponent_wickets,opponent_balls,summary,summary_ur,published)
  values(mid,v.opponent,v.opponent_ur,v.venue,v.venue_ur,v.starts_at,v.toss_at,v.season,v.status,v.result,v.team_runs,v.team_wickets,v.team_balls,v.opponent_runs,v.opponent_wickets,v.opponent_balls,v.summary,v.summary_ur,coalesce(v.published,false));
 else
  select revision into oldrev from public.hm_matches where id=p_id for update;
  if oldrev is null or oldrev<>p_revision then raise exception 'Match changed. Reload before saving.'; end if;
  mid:=p_id;
  update public.hm_matches set opponent=v.opponent,opponent_ur=v.opponent_ur,venue=v.venue,venue_ur=v.venue_ur,starts_at=v.starts_at,toss_at=v.toss_at,season=v.season,status=v.status,result=v.result,
   team_runs=v.team_runs,team_wickets=v.team_wickets,team_balls=v.team_balls,opponent_runs=v.opponent_runs,opponent_wickets=v.opponent_wickets,opponent_balls=v.opponent_balls,summary=v.summary,summary_ur=v.summary_ur,published=coalesce(v.published,false),revision=oldrev+1 where id=mid;
  delete from public.hm_stats where match_id=mid;
 end if;
 if v.status='completed' then
  insert into public.hm_stats(match_id,player_id,batted,runs,balls,not_out,fours,sixes,wickets,bowling_balls,conceded,catches,run_outs,stumpings)
  select mid,x.player_id,coalesce(x.batted,false),coalesce(x.runs,0),coalesce(x.balls,0),coalesce(x.not_out,false),coalesce(x.fours,0),coalesce(x.sixes,0),
   coalesce(x.wickets,0),coalesce(x.bowling_balls,0),coalesce(x.conceded,0),coalesce(x.catches,0),coalesce(x.run_outs,0),coalesce(x.stumpings,0)
  from jsonb_to_recordset(coalesce(p_stats,'[]'::jsonb)) as x(player_id uuid,batted boolean,runs int,balls int,not_out boolean,fours int,sixes int,wickets int,bowling_balls int,conceded int,catches int,run_outs int,stumpings int);
  if (select coalesce(sum(runs),0) from public.hm_stats where match_id=mid)>v.team_runs then raise exception 'Player runs exceed team total'; end if;
  if (select coalesce(sum(wickets),0) from public.hm_stats where match_id=mid)>v.opponent_wickets then raise exception 'Bowling wickets exceed opponent wickets'; end if;
 end if;
 return mid;
end $$;

-- Explicit function grants; no unauthenticated administrative RPC.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.proname like 'hm\_%' escape '\' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hm-media','hm-media',true,41943040,array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/ogg','audio/wav','video/mp4','video/webm'])
on conflict(id) do nothing;
drop policy if exists hm_upload on storage.objects;
drop policy if exists hm_update on storage.objects;
drop policy if exists hm_delete on storage.objects;
drop policy if exists hm_read on storage.objects;
create policy hm_read on storage.objects for select to authenticated using(bucket_id='hm-media' and public.hm_is_admin());
create policy hm_upload on storage.objects for insert to authenticated with check(bucket_id='hm-media' and public.hm_is_admin());
create policy hm_update on storage.objects for update to authenticated using(bucket_id='hm-media' and public.hm_is_admin()) with check(bucket_id='hm-media' and public.hm_is_admin());
create policy hm_delete on storage.objects for delete to authenticated using(bucket_id='hm-media' and public.hm_is_admin());
commit;

-- FIRST OWNER ONLY: create a confirmed Auth user, then run with their email:
-- insert into public.hm_admins(user_id,role)
-- select id,'owner' from auth.users where email='YOUR_EMAIL' and email_confirmed_at is not null;
-- Signup alone NEVER grants admin permissions.
