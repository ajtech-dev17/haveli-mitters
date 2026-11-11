# v3.1 HM validation record · 11 November 2026

## Implemented

| Area               | Behavior                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Branding and pages | Supplied Haveli Mitters logo, default bronze/gold, orbit rings, independent HTML pages, active menu                   |
| Squad              | Captain hierarchy, full squad >11, search/filters/sort, detailed player statistics                                    |
| Privacy            | Public defaults, global/per-player controls, force-private, own-profile links, RLS on data/photos/live projection     |
| Live scoring       | Two innings, toss/lineups, extras, strike, dismissals/fielding, free-hit, quota, targets, undo/rewind, audited events |
| Data integrity     | Server authority, single-scorer lease, revision checks, idempotent command IDs, atomic finalization/replacement       |
| Admin              | Content CRUD, drafts, sticky save controls, page switches, appearance/font preview/reset, player/admin invites        |
| Handover           | One owner plus optional second admin, transfer/removal, no developer backdoor, separate infrastructure ownership      |
| Existing content   | Gallery, audio/video/social, office/expiring shared location, dark/light, Urdu/English, back-to-top                   |
| Developer credit   | Fixed AJTech.dev modal and direct fallback link; no admin setting                                                     |
| Deployment         | GitHub Pages Actions workflow, build excludes SQL/tests, local pinned SDK, fresh and v2 upgrade SQL                   |
| Backup             | v3 JSON export includes live state/lineups/events; portable SQL restore converter                                     |

## Automated checks run

`npm run check`: JavaScript syntax and relative HTML asset paths.

`npm test`: 8 unit tests plus three PostgreSQL-compatible integration suites using PGlite with local Auth/Storage schema stubs. Assertions cover:

- Legal-ball overs, batting average/not-outs/ducks/50s/100s, bowling averages/economy/best figures, season results and highest-score not-out display.
- Default palette contrast and invalid font/color rejection.
- Fresh HM schema rerun, HM v2→v3 upgrade, and original HH v2/v3 → HM migration with preserved data and permissions.
- Prefix migration conflict guards, Storage preparation guard, existing live events/owner/player links, invitation continuity, private portrait/stat isolation and removal of old database object names.
- Anonymous/authenticated/unapproved/admin row access and unauthorized writes.
- Player A versus player B, public/private defaults, per-player overrides, force-private, hidden drafts and protected portrait access.
- Email-bound, single-use and expired invitations, player unlink and admin two-slot/ownership transfer.
- Transactional scorecard edits, stale revisions, rollback after invalid totals.
- No-ball plus leg-byes, wide, free-hit persistence/dismissal rejection, boundary versus all-run four, ends changes, caught sixth ball, run-out crossing/fielding, consecutive-over rejection.
- Duplicate request retries, stale live revisions, undo/rewind restoration, official target change, finalization/reopen/re-finalization without duplicated stats.
- Public/team/admin/draft live audiences, filtered private player figures, raw-event denial and scorer takeover.
- v2 and v3 content export→SQL restore, live event history, cleared scorer lease and preserved privacy settings.

These tests use PostgreSQL-compatible local storage and simulated Supabase Auth tables. They do **not** claim hosted GoTrue/Auth, SMTP, Storage HTTP or multi-device network behavior has been verified against your project.

## Browser checks

Real source empty states and isolated synthetic fixtures were used to inspect homepage/logo, admin dashboard/scoring/appearance, captain + 13-player squad, mobile navigation, private player profile UI, appearance font/reset, Urdu RTL and the live external AJTech.dev iframe. Squad layouts were measured at 360/768/1440/1920 px and live/scoring at 390 px; a mobile admin overflow issue was corrected. The synthetic fixture files are excluded from the release and deployment artifact. Browser testing validates presentation; it does not replace database permission tests or live-provider checks.

## Required checks on the client's actual services

- [ ] Fresh or correct upgrade SQL succeeds in the intended project.
- [ ] Only public URL/publishable key in frontend; owner bootstrap resolves exactly the intended confirmed account.
- [ ] GitHub Actions passes and actual Pages URLs load/refresh with repository path.
- [ ] Owner/admin signup, confirmation, password recovery, email change and client invitation reach actual inboxes via SMTP.
- [ ] Two real player accounts: each sees own private stats; copied URLs/direct queries cannot retrieve another private player's data.
- [ ] Protected photo upload/download follows public/private changes. Test anonymous/incognito and signed-in accounts.
- [ ] Two admin devices: takeover, stale revision, reconnect/retry and scorecard finalization work as expected.
- [ ] Public/Team/Admin live audiences and emergency private switch tested in independent browser sessions.
- [ ] Actual phone/tablet/laptop: scoring touch controls, menus, focus/keyboard, light/dark and Urdu.
- [ ] Real gallery/audio/video uploads and playback work within the actual plan's quotas.
- [ ] Location permission denied/allowed, expiry and stop-sharing verified with the correct device/location.
- [ ] Developer iframe/fallback works with the deployed origin and user's browser.
- [ ] Client owner transfer, former developer admin removal, repository/Supabase/domain recovery and backup ownership confirmed.

## Defined boundaries

Not a multi-team platform. No automated external score feed; an authorized scorer records deliveries. No automatic DLS, super over, Test/multi-innings scoring, offline scoring queue, mid-over injury substitution or every rare cricket penalty. See LIVE-SCORING.md for supported inputs and correction workflow.

Published match/team totals may remain visible when individual statistics are private. Use match audience controls when the whole match is confidential. Independently published gallery/media/captions are not automatically redacted by a player privacy switch. Public files already downloaded cannot be recalled.

Free provider quotas, inactivity behavior, SMTP recipient/rate limits and future plan changes remain provider responsibilities. No paid subscription has been created by this project.
