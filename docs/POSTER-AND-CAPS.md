# Orange/Purple Cap cards and match summary poster

- **Home → Season leaders** now shows Orange Cap (runs) and Purple Cap (wickets) cards with the top three players.
  It still obeys the existing `leaders` page switch and only lists players whose statistics the visitor may read.
- **Matches → Scorecard** (completed matches) now has *Download poster* (1080×1350 PNG) and *Share on WhatsApp*.
  Poster uses team totals plus only player figures already visible in that scorecard. No database changes.
- Code: `assets/js/poster.js` (pure model + canvas), wiring in `assets/js/public.js`, styles at the end of `portal.css`,
  Urdu strings in `i18n.js`, tests in `tests/poster.test.js`.
- If a custom logo is served from a host without CORS headers the poster falls back to a text "HM" emblem, and the PNG
  export will report "Poster could not be created" only if the browser blocks canvas export.
