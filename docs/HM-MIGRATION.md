# Haveli Mitters v3.1 — HM identifiers

Team ka naam **Haveli Mitters** hai. Website code, config `HM_CONFIG`, SQL tables/functions/policies, Storage bucket names aur browser preferences ab `hm` use karte hain. Purana prefix sirf conversion/verification scripts, migration tests aur is guide mein source ko pehchanne ke liye aata hai. Third-party SDK ko edit nahi kiya gaya.

## Naya Supabase project

Agar purani setup query run nahi ki, seedha `sql/setup.sql` run karein. Query name:

**01 - Haveli Mitters - HM Database Setup v3.1**

Phir `sql/check-setup.sql` run karein. Query name:

**02 - Haveli Mitters - HM Database Check**

Pehla result 16 `hm_` tables, sab ka RLS `Enabled`; doosra result empty hona chahiye. Supabase organization/project ka name badalna zaroori nahi.

## Purani setup query pehle run ho chuki hai

`hh_players` maujood ho to fresh setup na chalayein. Pehle database backup/export rakhein aur is portal ke admin edits/live scoring temporarily rok dein. Deploy ki hui purani app ko maintenance mein rakhein: database rename ke baad uske old API names kaam nahi karenge. Neeche Storage preparation ke baad poori `sql/migrate-prefix.sql` ek query mein run karein. Query name:

**03 - Haveli Mitters - HM Prefix Migration v3.1**

Yeh isi portal ke purane v2/v3 tables ko rename karta hai, IDs, data, foreign keys, owner/player links, invitations aur live history preserve karta hai. v2 ho to v3 privacy/live tables bhi add hoti hain. SQL error par database transaction rollback hoti hai. Storage preparation alag operation hai; SQL rollback usay reverse nahi karta.

Already `hm_players` ho aur old objects na hon to migration safely rerun ho sakti hai. Dono prefixes ke tables hon to script merge nahi karti: error ke saath rukti hai.

### Storage preparation

Supabase Storage ki actual files SQL mein bucket IDs rename karne se move nahi hoti. Is liye migration purane buckets maujood hon to **kisi database rename se pehle ruk jati hai**.

1. Supabase → Storage mein `hh-media` aur `hh-portraits` dekhein.
2. Agar dono empty hain, **sirf in empty old buckets** ko Storage dashboard se delete karein. Migration naye `hm-media` / `hm-portraits` initialize karegi. Agar buckets bani hi nahi, yeh step skip hai.
3. Agar files hain, pehle unki local backup copy download karein. Storage dashboard/API se `hm-media` **Public** aur `hm-portraits` **Private** create karein. Har object ko same folder/path aur filename par copy/upload karein. Portrait path `PLAYER_UUID/filename.webp` bilkul same rakhein.
4. Nayi copies ki file count, paths aur downloads verify karein. Sirf verified copies aur backup ke baad old files/buckets ko Storage dashboard/API se remove karein. SQL se `storage.objects` ya old bucket IDs update/delete na karein.
5. Ab `sql/migrate-prefix.sql` run karein. Existing gallery, logo and public-photo Storage URLs ke standard `/object/public/hh-media/` aur `/render/image/public/hh-media/` paths `hm-media` par update honge. Custom CDN URLs, external links aur pehle share kiye URLs alag se update karne honge; woh automatically redirect nahi honge.

Reference: [Supabase Storage schema](https://supabase.com/docs/guides/storage/schema/design) and [copying objects](https://supabase.com/docs/guides/storage/management/copy-move-objects).

### Migration ke baad

1. `sql/check-setup.sql` run karein: 16 HM tables / RLS Enabled; old-name check empty.
2. Is v3.1 ZIP ka frontend deploy karein. Apni existing public Project URL/key `assets/js/config.js` mein **`window.HM_CONFIG`** ke andar rakhein. Auth users/passwords aur site URLs change nahi hote.
3. Admin sign-in, player private account, portrait, gallery aur live scorer ka ek test karein; phir maintenance khatam karein.
4. Browser theme/language preferences ab `hm-` keys use karti hain. Old local preferences automatically copy nahi hoti; pehli visit par default bronze theme apply hogi.
5. Supabase SQL Editor ki pehle saved query titles manually HM wale names kar dein. Query titles browser/app code ka hissa nahi hain; is ZIP se unke saved titles automatically change nahi honge.

`sql/base-v2.sql`, `sql/upgrade-v3.sql`, `sql/live-v3.sql`, `sql/rename-prefix.sql` source parts hain. Normal setup/migration mein complete generated file hi run karein.

## Logo/media upload permission repair (12 November 2026)

Earlier migration assumed that the old media Storage policies still existed after bucket cleanup. If cleanup also removed those policies, the new media bucket could reject admin uploads with `new row violates row-level security policy`. The generated migration now explicitly restores all four HM media policies.

Already migrated? Run only `sql/repair-media-policies.sql`, saved as **06 - Haveli Mitters - HM Media Upload Permissions**. It recreates the four named policies, restricted to `hm-media` and approved admins. It does not delete files, change login credentials or roles, disable RLS, or alter portrait privacy. Refresh admin, select the logo again and Publish. No frontend deployment is required for this SQL-only repair. If the error continues, inspect the failing Storage/REST request to distinguish upload permissions from settings-draft permissions.
