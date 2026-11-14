-- EXISTING HM V2 UPGRADE ONLY. For old-prefix v2/v3 use migrate-prefix.sql.
begin;
-- Haveli Mitters v3: apply AFTER v2 only. Fresh installs use setup.sql instead.
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

-- Included by setup.sql / upgrade-v3-complete.sql. Server-authoritative scoring.
create table if not exists public.hm_live_matches (
 match_id uuid primary key references public.hm_matches(id) on delete cascade,
 config jsonb not null, state jsonb not null, revision int not null default 0,
 scorer uuid references auth.users(id) on delete set null, lease_until timestamptz,
 updated_at timestamptz not null default now()
);
create table if not exists public.hm_lineups (
 id uuid primary key default gen_random_uuid(), match_id uuid not null references public.hm_live_matches(match_id) on delete cascade,
 side text not null check(side in ('home','away')), player_id uuid references public.hm_players(id) on delete restrict,
 name text not null, batting_order int not null,
 check((side='home' and player_id is not null) or (side='away' and player_id is null)),
 unique(match_id,player_id),unique(match_id,side,batting_order)
);
create table if not exists public.hm_live_events (
 id uuid primary key, match_id uuid not null references public.hm_live_matches(match_id) on delete cascade,
 revision int not null, action text not null, payload jsonb not null,
 before_state jsonb not null, after_state jsonb not null, actor uuid references auth.users(id) on delete set null,
 voided boolean not null default false, created_at timestamptz not null default now(),unique(match_id,revision)
);
create index if not exists hm_live_updated on public.hm_live_matches(updated_at desc);
create index if not exists hm_lineup_match on public.hm_lineups(match_id);
alter table public.hm_live_matches enable row level security;
alter table public.hm_lineups enable row level security;
alter table public.hm_live_events enable row level security;
drop policy if exists hm_live_admin on public.hm_live_matches;
create policy hm_live_admin on public.hm_live_matches for select to authenticated using(public.hm_is_admin());
drop policy if exists hm_lineups_admin on public.hm_lineups;
create policy hm_lineups_admin on public.hm_lineups for select to authenticated using(public.hm_is_admin());
drop policy if exists hm_events_admin on public.hm_live_events;
create policy hm_events_admin on public.hm_live_events for select to authenticated using(public.hm_is_admin());
revoke all on public.hm_live_matches,public.hm_lineups,public.hm_live_events from public,anon,authenticated;
grant select on public.hm_live_matches,public.hm_lineups,public.hm_live_events to authenticated;

create or replace function public.hm_inc(j jsonb,k text,v int) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_set(coalesce(j,'{}'),array[k],to_jsonb(coalesce((j->>k)::int,0)+v));
$$;
create or replace function public.hm_innings(side text,balls int,target int default 0) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('side',side,'limit',balls,'target',target,'runs',0,'wickets',0,'balls',0,'striker','','non_striker','','bowler','','last_bowler','','free_hit',false,
 'batters','{}'::jsonb,'bowlers','{}'::jsonb,'fielding','{}'::jsonb,'extras',jsonb_build_object('wide',0,'noball',0,'bye',0,'legbye',0),'recent','[]'::jsonb);
$$;

create or replace function public.hm_reduce(st jsonb,act text,p jsonb,lu jsonb,cfg jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare i jsonb; idx int; phase text; side text; bat text; nonbat text; bow text; tmp text; outid text; fielder text;
 kind text; dismiss text; nbkind text; nr int; boundary int; total int; batruns int; charged int; legal int; faced int;
 bats jsonb; bowls jsonb; fields jsonb; b jsonb; bw jsonb; fi jsonb; extra jsonb; recent jsonb;
 crossed boolean; maxw int; limitbow int; r record;
begin
 if jsonb_typeof(p)<>'object' then raise exception 'Invalid scoring input'; end if;
 phase:=st->>'phase'; idx:=jsonb_array_length(st->'innings')-1; i:=st->'innings'->idx;
 side:=i->>'side'; bats:=i->'batters'; bowls:=i->'bowlers'; fields:=i->'fielding';
 bat:=i->>'striker'; nonbat:=i->>'non_striker'; bow:=i->>'bowler';
 if act='second_innings' then
  if phase<>'break' or idx<>0 then raise exception 'Finish the first innings before starting the chase'; end if;
  return jsonb_set(jsonb_set(st,'{innings}',(st->'innings')||jsonb_build_array(public.hm_innings(case when side='home' then 'away' else 'home' end,(cfg->>'overs')::int*6,(i->>'runs')::int+1))),'{phase}','"live"');
 end if;
 if act='reopen' then
  if phase not in ('completed','abandoned') or length(trim(coalesce(p->>'reason','')))<3 then raise exception 'A completed match and correction reason are required'; end if;
  return jsonb_set(st,'{phase}','"review"')-'result';
 end if;
 if act='abandon' then
  if phase in ('completed','abandoned') then raise exception 'Reopen before changing a finalized match'; end if;
  if length(trim(coalesce(p->>'reason','')))<3 then raise exception 'Enter the reason'; end if;
  return jsonb_set(jsonb_set(st,'{phase}','"abandoned"'),'{result}','"no_result"');
 end if;
 if act='finalize' then
  if phase<>'review' or idx<>1 then raise exception 'Complete both innings and review the scorecard first'; end if;
  st:=jsonb_set(st,'{phase}','"completed"');
  if (i->>'runs')::int >= (i->>'target')::int then tmp:=case when side='home' then 'won' else 'lost' end;
  elsif (i->>'runs')::int=(i->>'target')::int-1 then tmp:='tied';
  else tmp:=case when side='home' then 'lost' else 'won' end; end if;
  return jsonb_set(st,'{result}',to_jsonb(tmp));
 end if;
 if act='target' then
  if idx<>1 or phase not in ('live','review') then raise exception 'Revised target applies only to the chase'; end if;
  if coalesce((p->>'target')::int,0)<1 or length(trim(coalesce(p->>'reason','')))<3 then raise exception 'Enter the official revised target and reason'; end if;
  nr:=coalesce((p->>'limit')::int,(i->>'limit')::int);
  if nr<(i->>'balls')::int or nr>600 or nr<1 then raise exception 'Invalid revised ball limit'; end if;
  i:=jsonb_set(jsonb_set(i,'{target}',p->'target'),'{limit}',to_jsonb(nr));
  i:=jsonb_set(i,'{target_note}',to_jsonb(p->>'reason'));
  if (i->>'runs')::int >= (i->>'target')::int or (i->>'balls')::int >= nr then st:=jsonb_set(st,'{phase}','"review"'); end if;
  return jsonb_set(st,array['innings',idx::text],i);
 end if;
 if phase<>'live' then raise exception 'This innings is not accepting deliveries'; end if;
 select count(*)::int-1 into maxw from jsonb_array_elements(lu) x where x->>'side'=side;
 if act='batters' then
  tmp:=coalesce(nullif(p->>'striker',''),bat); outid:=coalesce(nullif(p->>'non_striker',''),nonbat);
  if tmp='' or outid='' or tmp=outid then raise exception 'Select two different batters'; end if;
  if bat<>'' and tmp<>bat or nonbat<>'' and outid<>nonbat then raise exception 'Use Swap ends with a reason to correct the strike'; end if;
  for r in select value from jsonb_array_elements_text(jsonb_build_array(tmp,outid)) loop
   if not exists(select 1 from jsonb_array_elements(lu) x where x->>'id'=r.value and x->>'side'=side) then raise exception 'Batter is not in this innings lineup'; end if;
   if coalesce((bats->r.value->>'out')::boolean,false) then raise exception 'Dismissed batter cannot return'; end if;
   b:=coalesce(bats->r.value,jsonb_build_object('runs',0,'balls',0,'fours',0,'sixes',0,'out',false,'batted',true));
   b:=b-'retired'; bats:=jsonb_set(bats,array[r.value],b);
  end loop;
  i:=jsonb_set(jsonb_set(jsonb_set(i,'{striker}',to_jsonb(tmp)),'{non_striker}',to_jsonb(outid)),'{batters}',bats);
 elsif act='bowler' then
  tmp:=coalesce(nullif(p->>'id',''),nullif(p->>'player_id',''));
  if bow<>'' then raise exception 'A bowler is already selected for this over'; end if;
  -- Prefer the immutable lineup-row UUID. For older clients or migrated data,
  -- reconcile by player_id/name, but always retain the opposite-side guard.
  if not exists(select 1 from jsonb_array_elements(lu) x where x->>'id'=tmp and x->>'side'<>side) then
   select x->>'id' into tmp
   from jsonb_array_elements(lu) x
   where x->>'side'<>side
     and ((nullif(p->>'player_id','') is not null and x->>'player_id'=p->>'player_id')
       or (nullif(p->>'name','') is not null and lower(trim(x->>'name'))=lower(trim(p->>'name'))))
   limit 1;
  end if;
  if tmp is null or not exists(select 1 from jsonb_array_elements(lu) x where x->>'id'=tmp and x->>'side'<>side) then raise exception 'Choose a bowler from the fielding side'; end if;
  if tmp=i->>'last_bowler' then raise exception 'A bowler cannot bowl consecutive overs'; end if;
  limitbow:=(cfg->>'max_bowler_overs')::int*6;
  if coalesce((bowls->tmp->>'balls')::int,0)>=limitbow then raise exception 'Bowler has reached the configured overs limit'; end if;
  i:=jsonb_set(i,'{bowler}',to_jsonb(tmp));
 elsif act='swap' then
  if bat='' or nonbat='' or length(trim(coalesce(p->>'reason','')))<3 then raise exception 'Select both batters and enter a correction reason'; end if;
  i:=jsonb_set(jsonb_set(i,'{striker}',to_jsonb(nonbat)),'{non_striker}',to_jsonb(bat));
 elsif act='retire' then
  outid:=p->>'id';
  if outid not in (bat,nonbat) or outid='' or coalesce(p->>'kind','') not in ('hurt','out') then raise exception 'Choose a current batter and retirement type'; end if;
  if length(trim(coalesce(p->>'reason','')))<3 then raise exception 'Enter the retirement reason'; end if;
  b:=jsonb_set(bats->outid,'{retired}',to_jsonb(p->>'kind'));
  if p->>'kind'='out' then b:=jsonb_set(b,'{out}','true');i:=public.hm_inc(i,'wickets',1); end if;
  bats:=jsonb_set(bats,array[outid],b);
  i:=jsonb_set(i,case when outid=bat then array['striker'] else array['non_striker'] end,'""');
  i:=jsonb_set(i,'{batters}',bats);
 elsif act='end_innings' then
  if length(trim(coalesce(p->>'reason','')))<3 then raise exception 'Enter the innings-end reason'; end if;
  i:=jsonb_set(i,'{end_note}',to_jsonb(p->>'reason'));
  st:=jsonb_set(st,'{phase}',to_jsonb(case when idx=0 then 'break' else 'review' end));
 elsif act='delivery' then
  if bat='' or nonbat='' or bow='' then raise exception 'Select striker, non-striker and bowler first'; end if;
  kind:=coalesce(p->>'kind','legal');nbkind:=coalesce(p->>'nb_kind','bat');dismiss:=coalesce(p->>'wicket','none');
  nr:=coalesce((p->>'runs')::int,0);boundary:=coalesce((p->>'boundary')::int,0);
  if nr<0 or nr>20 or kind not in ('legal','wide','noball','bye','legbye') or nbkind not in ('bat','bye','legbye') then raise exception 'Invalid runs or extras'; end if;
  if boundary not in (0,4,6) or (boundary<>0 and (nr<>boundary or (kind<>'legal' and not(kind='noball' and nbkind='bat')))) then raise exception 'Boundary must be a four or six off the bat'; end if;
  if dismiss not in ('none','bowled','caught','lbw','stumped','hit_wicket','run_out','obstructing_field','hit_ball_twice') then raise exception 'Unsupported dismissal'; end if;
  if (kind='noball' or coalesce((i->>'free_hit')::boolean,false)) and dismiss not in ('none','run_out','obstructing_field','hit_ball_twice') then raise exception 'This dismissal is not allowed on a no-ball/free hit'; end if;
  if kind='wide' and dismiss not in ('none','run_out','obstructing_field','stumped','hit_wicket') then raise exception 'This dismissal is not allowed on a wide'; end if;
  if dismiss in ('bowled','caught','lbw','stumped','hit_wicket','hit_ball_twice') and nr<>0 then raise exception 'This dismissal cannot include completed runs'; end if;
  if dismiss<>'none' and boundary<>0 then raise exception 'Do not combine a boundary with a dismissal'; end if;
  total:=nr+case when kind in ('wide','noball') then 1 else 0 end;
  batruns:=case when kind='legal' or (kind='noball' and nbkind='bat') then nr else 0 end;
  legal:=case when kind in ('wide','noball') then 0 else 1 end;
  faced:=case when kind='wide' then 0 else 1 end;
  charged:=case when kind='wide' then total when kind='noball' then 1+batruns else batruns end;
  extra:=i->'extras';
  if kind='wide' then extra:=public.hm_inc(extra,'wide',total);
  elsif kind='noball' then extra:=public.hm_inc(extra,'noball',1);if nbkind<>'bat' then extra:=public.hm_inc(extra,nbkind,nr);end if;
  elsif kind in ('bye','legbye') then extra:=public.hm_inc(extra,kind,nr);end if;
  b:=public.hm_inc(public.hm_inc(bats->bat,'runs',batruns),'balls',faced);
  if boundary=4 then b:=public.hm_inc(b,'fours',1);elsif boundary=6 then b:=public.hm_inc(b,'sixes',1);end if;
  bats:=jsonb_set(bats,array[bat],b);
  bw:=coalesce(bowls->bow,jsonb_build_object('balls',0,'conceded',0,'wickets',0));
  bw:=public.hm_inc(public.hm_inc(bw,'balls',legal),'conceded',charged);
  if dismiss<>'none' then
   outid:=coalesce(nullif(p->>'out_id',''),bat);
   if outid not in (bat,nonbat) or (dismiss not in ('run_out','obstructing_field') and outid<>bat) then raise exception 'Invalid dismissed batter'; end if;
   fielder:=coalesce(p->>'fielder','');
   if dismiss in ('caught','run_out','stumped') then
    if not exists(select 1 from jsonb_array_elements(lu) x where x->>'id'=fielder and x->>'side'<>side) then raise exception 'Select the responsible fielder'; end if;
    fi:=coalesce(fields->fielder,'{}');
    fi:=public.hm_inc(fi,case dismiss when 'caught' then 'catches' when 'stumped' then 'stumpings' else 'run_outs' end,1);
    fields:=jsonb_set(fields,array[fielder],fi);
   end if;
   if dismiss in ('bowled','caught','lbw','stumped','hit_wicket') then bw:=public.hm_inc(bw,'wickets',1);end if;
   bats:=jsonb_set(bats,array[outid,'out'],'true');
   bats:=jsonb_set(bats,array[outid,'dismissal'],to_jsonb(dismiss));
   i:=public.hm_inc(i,'wickets',1);
  end if;
  -- Completed runs change ends. Run-out crossing of an unfinished run is an explicit scorer decision.
  if boundary=0 and nr%2=1 then tmp:=bat;bat:=nonbat;nonbat:=tmp;end if;
  if dismiss in ('run_out','obstructing_field') and coalesce((p->>'crossed')::boolean,false) then tmp:=bat;bat:=nonbat;nonbat:=tmp;end if;
  if dismiss<>'none' then if bat=outid then bat:='';else nonbat:='';end if;end if;
  i:=public.hm_inc(public.hm_inc(i,'runs',total),'balls',legal);
  if legal=1 and (i->>'balls')::int%6=0 then tmp:=bat;bat:=nonbat;nonbat:=tmp;i:=jsonb_set(i,'{last_bowler}',to_jsonb(bow));end if;
  bowls:=jsonb_set(bowls,array[bow],bw);
  i:=jsonb_set(jsonb_set(jsonb_set(i,'{batters}',bats),'{bowlers}',bowls),'{fielding}',fields);
  i:=jsonb_set(jsonb_set(i,'{striker}',to_jsonb(bat)),'{non_striker}',to_jsonb(nonbat));
  if legal=1 and (i->>'balls')::int%6=0 then i:=jsonb_set(i,'{bowler}','""');end if;
  if kind='noball' then i:=jsonb_set(i,'{free_hit}',to_jsonb(coalesce((cfg->>'free_hit')::boolean,true)));
  elsif legal=1 then i:=jsonb_set(i,'{free_hit}','false');end if;
  recent:=(i->'recent')||jsonb_build_array(jsonb_build_object('runs',total,'kind',kind,'wicket',dismiss<>'none'));
  if jsonb_array_length(recent)>12 then recent:=recent-0;end if;
  i:=jsonb_set(jsonb_set(i,'{extras}',extra),'{recent}',recent);
 else raise exception 'Unknown scoring command'; end if;
 if (i->>'wickets')::int>=maxw or (i->>'balls')::int>=(i->>'limit')::int or ((i->>'target')::int>0 and (i->>'runs')::int>=(i->>'target')::int) then
  st:=jsonb_set(st,'{phase}',to_jsonb(case when idx=0 then 'break' else 'review' end));
 end if;
 return jsonb_set(st,array['innings',idx::text],i);
end $$;

create or replace function public.hm_start_live(p_match uuid,p_revision int,p_config jsonb,p_home uuid[],p_away text[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.hm_matches; k int:=0; pid uuid; nm text; side text; ovs int; cap int;
begin
 if not public.hm_is_admin() then raise exception 'Admin access required'; end if;
 if coalesce((select (config->'flags'->>'live')::boolean from public.hm_settings where id=1),true)=false then raise exception 'Enable Live scoring in Site controls first';end if;
 select * into m from public.hm_matches where id=p_match for update;
 if m.id is null or m.revision<>p_revision then raise exception 'Match changed. Reload before starting.';end if;
 if m.status<>'upcoming' or exists(select 1 from public.hm_stats where match_id=p_match) then raise exception 'Start live scoring from an upcoming fixture without a completed scorecard';end if;
 if p_home is null or p_away is null or cardinality(p_home) not between 2 and 11 or cardinality(p_away)<>cardinality(p_home) then raise exception 'Select equal lineups, 2–11 players per side';end if;
 if (select count(distinct x) from unnest(p_home) x)<>cardinality(p_home) then raise exception 'Duplicate home player';end if;
 if exists(select 1 from unnest(p_home) x where not exists(select 1 from public.hm_players where id=x and status='active')) then raise exception 'Choose active team players';end if;
 ovs:=(p_config->>'overs')::int;cap:=(p_config->>'max_bowler_overs')::int;side:=p_config->>'first_batting';
 if ovs is null or cap is null or side is null or ovs not between 1 and 100 or cap not between 1 and ovs or side not in ('home','away') then raise exception 'Invalid overs or batting side';end if;
 if coalesce(p_config->>'toss_winner','') not in ('home','away') or coalesce(p_config->>'toss_decision','') not in ('bat','bowl') then raise exception 'Enter toss winner and decision';end if;
 if side<>(case when p_config->>'toss_decision'='bat' then p_config->>'toss_winner' else case when p_config->>'toss_winner'='home' then 'away' else 'home' end end) then raise exception 'Batting side does not match the toss decision';end if;
 if p_config ? 'free_hit' and jsonb_typeof(p_config->'free_hit')<>'boolean' then raise exception 'Invalid free-hit rule';end if;
 p_config:=jsonb_build_object('overs',ovs,'max_bowler_overs',cap,'first_batting',side,'toss_winner',p_config->>'toss_winner','toss_decision',p_config->>'toss_decision','free_hit',coalesce((p_config->>'free_hit')::boolean,true));
 insert into public.hm_live_matches(match_id,config,state,scorer,lease_until) values(p_match,p_config,jsonb_build_object('phase','live','innings',jsonb_build_array(public.hm_innings(side,ovs*6))),auth.uid(),now()+interval '2 minutes');
 foreach pid in array p_home loop
  k:=k+1;insert into public.hm_lineups(match_id,side,player_id,name,batting_order) select p_match,'home',id,name,k from public.hm_players where id=pid;
 end loop;
 k:=0;
 foreach nm in array p_away loop
  if nm is null or length(trim(nm)) not between 1 and 100 then raise exception 'Enter opponent player names (1–100 characters)';end if;
  k:=k+1;insert into public.hm_lineups(match_id,side,name,batting_order) values(p_match,'away',trim(nm),k);
 end loop;
 update public.hm_matches set revision=revision+1 where id=p_match;
 insert into public.hm_audit(actor,action,entity) values(auth.uid(),'live_started',p_match);
 return p_match;
end $$;

create or replace function public.hm_live_claim(p_match uuid,p_takeover boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare l public.hm_live_matches;
begin
 if not public.hm_is_admin() then raise exception 'Admin access required';end if;
 select * into l from public.hm_live_matches where match_id=p_match for update;
 if l.match_id is null then raise exception 'Live match not found';end if;
 if l.scorer is distinct from auth.uid() and l.lease_until>now() and not p_takeover then raise exception 'Another admin is scoring. Use Take over to continue.';end if;
 if l.scorer is distinct from auth.uid() then insert into public.hm_audit(actor,action,entity) values(auth.uid(),'scorer_takeover',p_match);end if;
 update public.hm_live_matches set scorer=auth.uid(),lease_until=now()+interval '2 minutes' where match_id=p_match;
end $$;

create or replace function public.hm_live_command(p_match uuid,p_revision int,p_request uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l public.hm_live_matches; st jsonb; ev public.hm_live_events; lu jsonb; r record; i jsonb; b jsonb; bw jsonb; fi jsonb;
 rr int; bf int; fours int; sixes int; wk int; bb int; con int; ca int; ro int; su int; did boolean; nt boolean;
begin
 if not public.hm_is_admin() then raise exception 'Admin access required';end if;
 select * into l from public.hm_live_matches where match_id=p_match for update;
 if l.match_id is null then raise exception 'Live match not found';end if;
 select * into ev from public.hm_live_events where id=p_request;
 if ev.id is not null then
  if ev.match_id<>p_match or ev.action<>p_action or ev.payload<>p_payload then raise exception 'Request ID already used for a different command';end if;
  return jsonb_build_object('revision',l.revision,'state',l.state,'duplicate',true);
 end if;
 if p_request is null or p_revision is null or p_action is null or p_payload is null then raise exception 'Missing scoring request fields';end if;
 if p_revision<>l.revision then raise exception 'Score changed. Reload before submitting.';end if;
 if l.scorer is distinct from auth.uid() or l.lease_until<now() then raise exception 'Claim scoring control before submitting';end if;
 if p_action not in ('audience','reopen','abandon') and coalesce((select (config->'flags'->>'live')::boolean from public.hm_settings where id=1),true)=false then raise exception 'Live scoring is disabled in Site controls';end if;
 select jsonb_agg(to_jsonb(x) order by side,batting_order) into lu from public.hm_lineups x where match_id=p_match;
 if p_action='audience' then
  if p_payload->>'audience' not in ('public','team','admin') then raise exception 'Invalid audience';end if;
  update public.hm_matches set audience=p_payload->>'audience',published=coalesce((p_payload->>'published')::boolean,published),revision=revision+1 where id=p_match;
  st:=l.state;
 elsif p_action in ('undo','rewind') then
  if l.state->>'phase' in ('completed','abandoned') then raise exception 'Reopen the match before correcting it';end if;
  if length(trim(coalesce(p_payload->>'reason','')))<3 then raise exception 'Enter a correction reason';end if;
  select * into ev from public.hm_live_events where match_id=p_match and not voided and action not in ('undo','rewind','audience','reopen','finalize','abandon')
   and (p_action='undo' or revision=(p_payload->>'revision')::int) order by revision desc limit 1;
  if ev.id is null then raise exception 'No scoring event to undo';end if;
  st:=ev.before_state;
  update public.hm_live_events set voided=true where match_id=p_match and revision>=ev.revision and action not in ('audience','undo','rewind','reopen');
 else st:=public.hm_reduce(l.state,p_action,p_payload,lu,l.config);end if;
 if p_action in ('reopen','undo','rewind') then
  delete from public.hm_stats where match_id=p_match;
  update public.hm_matches set status='upcoming',result=null,team_runs=null,team_wickets=null,team_balls=null,opponent_runs=null,opponent_wickets=null,opponent_balls=null,revision=revision+1 where id=p_match;
 end if;
 if p_action in ('finalize','abandon') then
  delete from public.hm_stats where match_id=p_match;
  for r in select * from public.hm_lineups where match_id=p_match and side='home' loop
   rr:=0;bf:=0;fours:=0;sixes:=0;wk:=0;bb:=0;con:=0;ca:=0;ro:=0;su:=0;did:=false;nt:=false;
   for i in select value from jsonb_array_elements(st->'innings') loop
    b:=i->'batters'->r.id::text;bw:=i->'bowlers'->r.id::text;fi:=i->'fielding'->r.id::text;
    if b is not null then did:=true;nt:=not coalesce((b->>'out')::boolean,false);end if;
    rr:=rr+coalesce((b->>'runs')::int,0);bf:=bf+coalesce((b->>'balls')::int,0);fours:=fours+coalesce((b->>'fours')::int,0);sixes:=sixes+coalesce((b->>'sixes')::int,0);
    wk:=wk+coalesce((bw->>'wickets')::int,0);bb:=bb+coalesce((bw->>'balls')::int,0);con:=con+coalesce((bw->>'conceded')::int,0);
    ca:=ca+coalesce((fi->>'catches')::int,0);ro:=ro+coalesce((fi->>'run_outs')::int,0);su:=su+coalesce((fi->>'stumpings')::int,0);
   end loop;
   if p_action='finalize' then insert into public.hm_stats(match_id,player_id,batted,runs,balls,not_out,fours,sixes,wickets,bowling_balls,conceded,catches,run_outs,stumpings)
    values(p_match,r.player_id,did,rr,bf,nt,fours,sixes,wk,bb,con,ca,ro,su);end if;
  end loop;
  for i in select value from jsonb_array_elements(st->'innings') loop
   if i->>'side'='home' then update public.hm_matches set team_runs=(i->>'runs')::int,team_wickets=(i->>'wickets')::int,team_balls=(i->>'balls')::int where id=p_match;
   else update public.hm_matches set opponent_runs=(i->>'runs')::int,opponent_wickets=(i->>'wickets')::int,opponent_balls=(i->>'balls')::int where id=p_match;end if;
  end loop;
  update public.hm_matches set status=case when p_action='abandon' then 'abandoned' else 'completed' end,result=st->>'result',revision=revision+1 where id=p_match;
 end if;
 insert into public.hm_live_events(id,match_id,revision,action,payload,before_state,after_state,actor) values(p_request,p_match,l.revision+1,p_action,p_payload,l.state,st,auth.uid());
 update public.hm_live_matches set state=st,revision=revision+1,updated_at=now(),lease_until=now()+interval '2 minutes' where match_id=p_match;
 return jsonb_build_object('revision',l.revision+1,'state',st,'duplicate',false);
end $$;

-- Read only the authorized projection. Raw events and raw score state stay admin-only.
create or replace function public.hm_live_view(p_match uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare l public.hm_live_matches; m public.hm_matches; st jsonb; i jsonb; idx int:=0; row record; roster jsonb:='[]'; allowed text[]:='{}'; hide_any boolean:=false; k text;
begin
 if not public.hm_is_admin() and coalesce((select (config->'flags'->>'live')::boolean from public.hm_settings where id=1),true)=false then return null;end if;
 select x.* into l from public.hm_live_matches x where (p_match is null or x.match_id=p_match) and public.hm_can_match(x.match_id)
 order by (x.state->>'phase' not in ('completed','abandoned')) desc,x.updated_at desc limit 1;
 if l.match_id is null then return null;end if;
 select * into m from public.hm_matches where id=l.match_id;
 st:=l.state;
 for row in select * from public.hm_lineups where match_id=l.match_id order by side,batting_order loop
  if row.side='away' or public.hm_can_stats(row.player_id) then
   allowed:=array_append(allowed,row.id::text);
   roster:=roster||jsonb_build_array(jsonb_build_object('id',row.id,'side',row.side,'name',case when row.side='home' then (select name from public.hm_players where id=row.player_id) else row.name end,'order',row.batting_order));
  else hide_any:=true;end if;
 end loop;
 if not public.hm_is_admin() then
  for i in select value from jsonb_array_elements(st->'innings') loop
   for k in select jsonb_object_keys(i->'batters') loop if not(k=any(allowed)) then i:=jsonb_set(i,'{batters}',(i->'batters')-k);end if;end loop;
   for k in select jsonb_object_keys(i->'bowlers') loop if not(k=any(allowed)) then i:=jsonb_set(i,'{bowlers}',(i->'bowlers')-k);end if;end loop;
   for k in select jsonb_object_keys(i->'fielding') loop if not(k=any(allowed)) then i:=jsonb_set(i,'{fielding}',(i->'fielding')-k);end if;end loop;
   foreach k in array array['striker','non_striker','bowler','last_bowler'] loop if not(coalesce(i->>k,'')=any(allowed)) then i:=jsonb_set(i,array[k],'""');end if;end loop;
   i:=i-array['target_note','end_note'];
   if hide_any then i:=jsonb_set(i,'{recent}','[]');end if;
   st:=jsonb_set(st,array['innings',idx::text],i);idx:=idx+1;
  end loop;
 end if;
 return jsonb_build_object('match_id',m.id,'opponent',m.opponent,'venue',m.venue,'starts_at',m.starts_at,'audience',m.audience,'published',m.published,'revision',l.revision,'updated_at',l.updated_at,'config',l.config,'state',st,'lineup',roster,'restricted',hide_any,
  'scorer',case when public.hm_is_admin() then l.scorer else null end,'lease_until',case when public.hm_is_admin() then l.lease_until else null end);
end $$;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('hm_inc','hm_innings','hm_reduce','hm_start_live','hm_live_claim','hm_live_command','hm_live_view') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
grant execute on function public.hm_start_live(uuid,int,jsonb,uuid[],text[]),public.hm_live_claim(uuid,boolean),public.hm_live_command(uuid,int,uuid,text,jsonb) to authenticated;
grant execute on function public.hm_live_view(uuid) to anon,authenticated;
create or replace function public.hm_export_content() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hm_is_admin() then raise exception 'Admin access required';end if;
 return jsonb_build_object('version',3,'exported_at',now(),'settings',(select config from public.hm_settings where id=1),
 'players',coalesce((select jsonb_agg(to_jsonb(x)) from public.hm_players x),'[]'),
 'matches',coalesce((select jsonb_agg(to_jsonb(x)) from public.hm_matches x),'[]'),
 'stats',coalesce((select jsonb_agg(to_jsonb(x)) from public.hm_stats x),'[]'),
 'media',coalesce((select jsonb_agg(to_jsonb(x)) from public.hm_media x),'[]'),
 'live_matches',coalesce((select jsonb_agg(to_jsonb(x)) from public.hm_live_matches x),'[]'),
 'lineups',coalesce((select jsonb_agg(to_jsonb(x)) from public.hm_lineups x),'[]'),
 'live_events',coalesce((select jsonb_agg(to_jsonb(x)) from public.hm_live_events x),'[]'));
end $$;
revoke all on function public.hm_export_content() from public,anon,authenticated;
grant execute on function public.hm_export_content() to authenticated;

commit;
