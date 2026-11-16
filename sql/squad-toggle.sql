-- Haveli Mitters: lightweight Our Team squad toggle.
alter table public.hm_players
  add column if not exists in_squad boolean not null default true;
