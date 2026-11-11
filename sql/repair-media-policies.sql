-- 06 - Haveli Mitters - HM Media Upload Permissions
-- Restore only this portal's four media policies. Does not delete files,
-- change accounts, disable RLS, or make private portraits public.
begin;
do $$ begin
 if to_regprocedure('public.hm_is_admin()') is null then
  raise exception 'HM schema missing. Complete the HM setup/migration first.';
 end if;
 if not exists(select 1 from storage.buckets where id='hm-media') then
  raise exception 'hm-media bucket missing. Complete the HM migration first.';
 end if;
end $$;
drop policy if exists hm_read on storage.objects;
drop policy if exists hm_upload on storage.objects;
drop policy if exists hm_update on storage.objects;
drop policy if exists hm_delete on storage.objects;

create policy hm_read on storage.objects for select to authenticated
 using (bucket_id='hm-media' and public.hm_is_admin());
create policy hm_upload on storage.objects for insert to authenticated
 with check (bucket_id='hm-media' and public.hm_is_admin());
create policy hm_update on storage.objects for update to authenticated
 using (bucket_id='hm-media' and public.hm_is_admin())
 with check (bucket_id='hm-media' and public.hm_is_admin());
create policy hm_delete on storage.objects for delete to authenticated
 using (bucket_id='hm-media' and public.hm_is_admin());
commit;
