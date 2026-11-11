-- 04 - Haveli Mitters - HM First Owner
-- Run ONLY after creating and confirming your own Supabase Auth account.
-- Replace YOUR_EMAIL_HERE with your exact account email, then run in SQL Editor.
-- Signup or the account's display name does not grant administrative privileges.
insert into public.hm_admins(user_id,role)
select id,'owner'
from auth.users
where lower(email)=lower('YOUR_EMAIL_HERE')
and email_confirmed_at is not null;
-- Expected: 1 row inserted. If 0, check the email and confirmation.
-- If an owner already exists, use their Team access screen instead.
