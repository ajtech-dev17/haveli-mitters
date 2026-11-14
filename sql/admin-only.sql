-- Haveli Mitters admin-only mode.
-- Run once in the Supabase SQL Editor as project owner.
-- Existing hm_admins ownership is preserved; no browser signup or invitation can grant access.
begin;

create or replace function public.hm_admin_limit() returns trigger
language plpgsql set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(817031);
  if (select count(*) from public.hm_admins) >= 1 then
    raise exception 'Admin-only mode allows exactly one admin account.';
  end if;
  return new;
end $$;

drop trigger if exists hm_limit_admins on public.hm_admins;
create trigger hm_limit_admins before insert on public.hm_admins
for each row execute function public.hm_admin_limit();

-- Disable all invitation, handover, and second-admin entry points.
revoke execute on function public.hm_create_invite(text) from authenticated;
revoke execute on function public.hm_redeem_invite(text) from authenticated;
revoke execute on function public.hm_remove_admin(uuid) from authenticated;
revoke execute on function public.hm_transfer_owner(uuid,boolean) from authenticated;
revoke execute on function public.hm_player_invite(uuid,text) from authenticated;
revoke execute on function public.hm_accept_player(text) from authenticated;
revoke execute on function public.hm_revoke_player(uuid,boolean) from authenticated;
revoke execute on function public.hm_player_access() from authenticated;

-- Live scoring remains protected by hm_is_admin() and all existing RLS policies.
comment on table public.hm_admins is 'Single authorized admin identity for admin-only mode. Do not grant through invitations.';
commit;
