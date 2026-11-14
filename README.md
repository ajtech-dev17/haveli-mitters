# Haveli Mitters · Professional Portal v3.1 (HM)

A single-team cricket portal for **GitHub Pages + Supabase**. The supplied bronze/gold logo, dark default theme and rotating hero rings are preserved. Pages are real HTML files with independent URLs, active navigation and responsive layouts.

**Start with [docs/SETUP.md](docs/SETUP.md).** The private admin address is `your-site/admin.html`. Player sign-in is `your-site/player.html`; player.html is not the live scorer.

All active application identifiers now use **HM**: `window.HM_CONFIG`, `hm_` tables/RPCs, `hm-media`, `hm-portraits`, and `hm-` browser preference keys. Existing old-prefix databases use [HM-MIGRATION.md](docs/HM-MIGRATION.md) and `sql/migrate-prefix.sql`. Do not create parallel tables or delete existing player data.

## Pages

| File            | Purpose                                                                             |
| --------------- | ----------------------------------------------------------------------------------- |
| `index.html`    | Logo/hero, next fixture countdown, season highlights                                |
| `team.html`     | Larger captain portrait, full squad with jersey/role, more than 11 supported        |
| `squad.html`    | Live name/jersey search, role filters, runs/wickets/jersey sorting, profile dialogs |
| `live.html`     | Authorized live score, innings, chase and scorecard; 5-second polling               |
| `matches.html`  | Fixtures, results and permitted scorecard rows                                      |
| `stats.html`    | Career/season leaders and team records                                              |
| `moments.html`  | Searchable winning/special-moments gallery                                          |
| `social.html`   | Audio playlist, video and social links                                              |
| `location.html` | Haveli office and expiring, admin-shared location                                   |
| `player.html`   | Redirect-only legacy entrypoint; player login is disabled                         |
| `admin.html`    | Protected single-admin captain's dashboard; no public admin button                    |
| `account.html`  | Password recovery and legacy account entry; admin invitations are disabled in admin-only mode |

## Architecture

HTML5, modular ES JavaScript and static CSS keep this multi-page site lightweight. There is no browser-time Tailwind compiler, React runtime or paid live-score API. Supabase JS **2.119.0** is bundled locally with its license. PostgreSQL RLS and transactional RPCs enforce permissions and scoring. GitHub Actions tests/builds/deploys a static `dist/`; no Node backend runs in production.

- `assets/js/core.js`: shared configuration, database client, branding, localization, dialogs and protected portrait loading.
- `public.js`, `auth.js`: public and admin account flows; the legacy player login entrypoint only redirects to `admin.html`.
- `admin.js`, `admin-v3.js`: CRUD, invitations, privacy settings, appearance and ownership.
- `scoring.js`, `live.js`, `live-view.js`: scorer commands and authorized viewer.
- `stats.js`, `appearance.js`, `i18n.js`: calculations, readable palettes/fonts and Urdu/English text.
- `sql/setup.sql`: complete fresh schema.
- `sql/upgrade-v3-complete.sql`: v2→v3 upgrade within the HM namespace.
- `sql/migrate-prefix.sql`: guarded, transactional old-prefix v2/v3 → HM migration; prepare Storage first.
- `sql/check-setup.sql`: read-only table/RLS and old-name verification.
- `sql/first-owner.sql`: one-time confirmed owner bootstrap.

Public player profiles/stats are the default. Global/per-player privacy is implemented now, along with email-bound player accounts, protected photos, match audiences and admin-only raw scoring history. AJTech.dev's footer popup uses the supplied developer-card URL and has no team-admin override.

## Developer commands

```sh
npm ci
npm run check
npm test
npm run build
```

Node.js 22+ for checks/build only. SQL parts changed? Run `npm run build:sql` before tests. Local website: `python -m http.server 8000`, then `http://localhost:8000/` (not `file://`).

## Configuration still required

`assets/js/config.js` contains the supplied public Project URL and publishable key. No production records, fake passwords or admin bypass are shipped. For admin-only live scoring, run `sql/admin-only.sql` as the Supabase project owner after ensuring the intended admin row exists in `hm_admins`; this disables admin invitations, ownership handover and second-admin grants while preserving RLS. Complete and verify the Supabase SQL, Auth URLs/SMTP and GitHub Pages before launch. Local tests do not establish that the project's database connection, email delivery, real Storage upload or hosting is working. For a different Supabase project, replace the two public configuration values.

Live scoring supports a defined limited-overs subset, with manual official revised targets; automatic DLS, super overs, offline queuing and injury substitutions mid-over are outside this release. See the exact boundaries in [LIVE-SCORING.md](docs/LIVE-SCORING.md).

## Guides

- [Setup and deployment](docs/SETUP.md)
- [Captain's daily workflow](docs/ADMIN-GUIDE.md)
- [Live scoring and corrections](docs/LIVE-SCORING.md)
- [Privacy and player invitations](docs/PRIVACY.md)
- [Client ownership and ongoing maintenance](docs/HANDOVER.md)
- [Validation and launch checklist](docs/FEATURES-AND-VALIDATION.md)
