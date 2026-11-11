# Haveli Mitters v3.1 — Supabase + GitHub Pages

Project ka naam **Haveli Mitters** hai. Supabase ka project name `AJTECH-DEV` reh sakta hai: woh website ka public naam nahi hai. Existing region ko is release ke liye change karna zaroori nahi.

## 1. Sahi SQL file choose karein

Pehle Supabase → Table Editor mein dekhein:

| Database ki halat | SQL Editor mein chalane wali file |
| --- | --- |
| Bilkul naya project; portal ki tables nahi bani | `sql/setup.sql` |
| Purani `hh_` tables maujood hain (v2 ya v3) | Pehle `docs/HM-MIGRATION.md`, phir `sql/migrate-prefix.sql` |
| Sirf HM namespace ka v2 database hai | Backup ke baad `sql/upgrade-v3-complete.sql` |
| Sirf kisi aur prototype ki `players`/`matches` tables hain | `sql/setup.sql` nayi `hm_` tables banata hai; us prototype ka data automatically import nahi hota |

Saved query names:

1. **01 - Haveli Mitters - HM Database Setup v3.1** — `sql/setup.sql` (fresh only).
2. **02 - Haveli Mitters - HM Database Check** — `sql/check-setup.sql` (read-only).
3. **03 - Haveli Mitters - HM Prefix Migration v3.1** — `sql/migrate-prefix.sql` (existing old-prefix database only).
4. **04 - Haveli Mitters - HM First Owner** — `sql/first-owner.sql` (confirmed account ke baad).

Poora generated script ek query mein run karein. `base-v2.sql`, `upgrade-v3.sql`, `live-v3.sql`, `rename-prefix.sql` source parts hain: inhein separately run nahi karna. Purana data delete na karein. Existing old-prefix schema ho to fresh setup guard ke saath ruk jayegi, taake accidentally parallel empty tables na banen.

`hm_players`, `hm_matches`, `hm_stats`, `hm_player_accounts`, `hm_live_matches`, `hm_lineups`, `hm_live_events`, settings, admin/access aur media mila kar **16 tables** banengi. RLS/policies/functions included hain. Storage buckets `hm-media` (public gallery/media) aur `hm-portraits` (authorized player photos) hongi. `sql/check-setup.sql` ke pehle result mein sab RLS Enabled aur doosra result empty hona chahiye.

## 2. Sirf public Supabase config lagayein

Project → Connect / Settings → API se **Project URL** aur **publishable key** lein. Legacy public `anon` key bhi supported hai. `assets/js/config.js`:

```js
window.HM_CONFIG = Object.freeze({
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  publishableKey: "YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY",
});
```

Service-role/secret key, database password, SMTP password ya personal login password frontend/repository mein na rakhein. Public key ka visible hona expected hai; actual authority database RLS enforce karti hai.

## 3. GitHub repository upload

ZIP extract karke **andar wali files** repository root par rakhein: `index.html`, `assets/`, `sql/`, `docs/`, `package.json` aur `.github/workflows/pages.yml`. Windows Explorer hidden files ko bhi include karein. `node_modules`, `dist`, backups aur `.env` upload nahi karne.

```sh
git init
git add .
git commit -m "Build Haveli Mitters v3.1 HM"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Existing repository ho to dobara `git init`/remote add ki zaroorat nahi; changes commit/push karein.

## 4. GitHub Pages ON karein

Recommended: Repository → Settings → Pages → Source **GitHub Actions**. Included workflow tests run karta hai aur sirf built static site deploy karta hai. Actions tab mein workflow success hone ka intezar karein; Pages screen ka actual URL kholein.

Typical base URL: `https://YOUR-ACCOUNT.github.io/YOUR-REPOSITORY/`.

- Public home: base URL
- Admin: base URL + `admin.html` (privately bookmark karein)
- Player login: base URL + `player.html`
- Live match: base URL + `live.html`
- Team presentation: base URL + `team.html`

URLs `.html` wali independent files hain; direct link/reload GitHub Pages par chalta hai. No SPA rewrite required.

Alternative simple deployment: Source → Deploy from a branch → main → root. Is mode mein repo root serve hota hai aur automatic tests/build nahi chalte. Recommended workflow SQL/tests ko public website artifact se exclude karta hai, lekin public GitHub repository ka source phir bhi public hota hai.

Vercel optional: import same repo, preset Other, build `npm run build`, output `dist`.

## 5. Supabase Auth redirect URLs

Authentication → URL Configuration:

- Site URL: aapka **actual deployed base URL**, repository path ke saath.
- Redirect URLs mein actual URLs add karein:
  - `https://YOUR-ACCOUNT.github.io/YOUR-REPOSITORY/account.html**`
  - `https://YOUR-ACCOUNT.github.io/YOUR-REPOSITORY/player.html**`
- Email provider aur email confirmation enabled rakhein.
- Testing ke liye apna local `http://localhost:8000/account.html**` aur `player.html**` add kar sakte hain; launch par unused entries remove karein.

Client/player confirmation, recovery aur email-change flows ke liye **custom SMTP** setup aur actual inbox test karein. Supabase default sender production delivery ke liye suitable nahi; recipient/rate restrictions hain. SMTP provider ki apni free allowance/domain requirements ho sakti hain. Application kisi paid scoring API ko require nahi karti, lekin provider quotas aur mail delivery aapko configure karni hai.

Reference: https://supabase.com/docs/guides/auth/auth-smtp

## 6. First owner / dashboard kholna

1. Deployed `admin.html` → Create account → apni email/password; email confirm karein.
2. Supabase SQL Editor mein `sql/first-owner.sql` open karein, `YOUR_EMAIL_HERE` apni **confirmed email** se replace karke run karein.
3. `admin.html` reload/sign in karein: Captain's desk khul jayega.
4. Public site par admin login link intentionally nahi hai. URL jaan lena admin permission nahi deta.

SMTP abhi ready na ho to Supabase project owner Auth dashboard se initial confirmed test user create kar sakta hai. Client handover se pehle recovery aur actual email delivery test honi chahiye. Normal signup se automatically admin privilege nahi milti.

## 7. First configuration

- Site controls → name/logo, Urdu/English text, season, timezone `Asia/Karachi`, actual Haveli address/Maps link.
- Privacy defaults **Public/Public**, Force private **OFF** rehne dein: launch public hai.
- Players → real squad add karein; ek Captain aur optional Vice captain. Captain ki photo team page par bari hogi. Squad 11 se zyada ho sakta hai.
- Player photos **Upload file** se protected bucket mein upload karein.
- Matches → next fixture publish karein; purane results manual scorecards se add karein.
- Live scoring → fixture select, lineup/toss/rules set, score karein. Guide: `docs/LIVE-SCORING.md`.
- Player access → future private profiles ke liye invitation links. Guide: `docs/PRIVACY.md`.
- Appearance → colors/font preview → Publish. Restore Haveli Default available.
- Gallery, media, songs, social links aur location add karein.

AJTech.dev footer popup fixed hai; team admin usay edit/hide nahi kar sakta. Developer source/repository control ko technical taur par lock nahi kiya ja sakta.

## 8. Local preview and developer checks

Double-click se `file://` par modules nahi chalte. VS Code Live Server ya:

```sh
python -m http.server 8000
```

Open `http://localhost:8000/`. Node.js 22+ ke saath:

```sh
npm ci
npm run check
npm test
npm run build
```

Node sirf checks/build ke liye hai; hosted website static hai. SQL source parts edit hon to pehle `npm run build:sql` chalayein.

## 9. Launch verification

`docs/FEATURES-AND-VALIDATION.md` ki live checklist complete karein. Release locally tested hai; aapke actual Supabase/Auth/SMTP/Storage aur GitHub deployment ko credentials/config connect hone ke baad verify karna baqi hai.
