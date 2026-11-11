# Public page loading / blinking fix — 12 November 2026

Fixed a public-page reload loop caused by treating every Supabase SIGNED_IN event as a new login. The bundled SDK also emits this event when restoring an existing saved session. The viewer now establishes the initial identity without reloading, ignores repeated notifications for the same account, and still clears displayed player data and reloads when the signed-in account actually changes or signs out. Database policy-change polling remains active.

## Apply to your existing Git checkout

Copy these files from this updated ZIP to the same paths inside your existing repository folder:

- `assets/js/public.js`
- `assets/js/session-refresh.js` (new file; required)
- `tests/session-refresh.test.js` (new regression tests)
- `docs/LOADING-FIX.md`

Commit and push these files. GitHub Actions builds/deploys the update. No SQL, account reset or database migration is required. After deployment, hard-refresh the affected browser once and test Home, Players and Matches while signed in, switch tabs, then sign out and open the public site again.

Validation: JavaScript/static asset checks, unit regression tests for saved-session restore in both event orders, duplicate SIGNED_IN/focus events, token refresh, account switches, sign-out, and an expired-session startup. Live browser verification on the user's affected Chrome profile is still required after deployment.

## Logo control

Admin → Site controls → Brand & homepage → Upload file (Logo URL) → choose PNG/JPEG/WebP → Publish. Logo URL can also be entered manually. This controls rendered site branding and the browser icon. Initial loading uses a neutral indicator until published settings resolve; see LOGO-FIX.md.
