# Live scoring — match-day guide

Ye one-team, two-innings limited-overs scoring desk hai. Opponent ki lineup har match ke liye enter hoti hai; doosri club management system nahi banta.

## Start

1. Matches → Upcoming fixture create/publish (opponent/date/venue/season/audience).
2. Live scoring → fixture select.
3. Overs limit, per-bowler overs limit, toss winner/decision aur free-hit rule set karein.
4. Equal lineups: 2–11 players per side. Home players squad se select; opposition names one per line. Full registered squad 11 se zyada ho sakta hai.
5. Start match. First two batters aur bowler choose karein.

A match with live event history must be corrected through Live scoring, not the manual match editor.

## Every delivery

Quick 0/1/2/3/4/6 buttons form fill karte hain; **Save delivery** server par bhejta hai. Four/six quick button boundary mark karta hai. All-run four ke liye Runs 4 aur Not a boundary choose karein.

| Umpire signal             | Form example                            | Server result                                            |
| ------------------------- | --------------------------------------- | -------------------------------------------------------- |
| Normal single             | legal, runs 1                           | Batter +1, legal ball +1; ends swap                      |
| Wide only                 | wide, runs 0                            | Team/bowler +1; no legal ball or batter ball             |
| Wide plus two runs        | wide, runs 2                            | Total 3 wides; completed runs decide ends                |
| No-ball only              | noball, runs 0                          | +1 penalty; legal balls unchanged, batter balls faced +1 |
| No-ball hit for four      | noball, nb_kind bat, runs 4, boundary 4 | Batter +4; team/bowler +5                                |
| No-ball plus two leg-byes | noball, nb_kind legbye, runs 2          | Team +3; bowler conceded +1; legal balls unchanged       |
| Byes / leg-byes           | bye/legbye, runs number                 | Team extras only; legal ball +1                          |
| Run-out                   | dismissal run_out, out batter + fielder | Team wicket +1, bowler wicket unchanged                  |

Runs input **automatic one-run wide/no-ball penalty exclude** karta hai. Runs field allowed 0–20 hai. Boundary explicitly mark karein. Dismissal select karte waqt right batter/fielder choose karein. Run-out ke unfinished run par crossing ke liye checkbox hai. Completed runs already automatic ends change karte hain; unfinished crossing separately mark karein.

Every six legal balls ends swap; new over bowler choose karein. Same bowler consecutive overs nahi kar sakta aur configured quota enforce hota hai. Bowler injury mid-over replacement is not supported in this version.

No-ball/free hit aur wide dismissal restrictions server validate karta hai. Free hit (when enabled) next legal delivery tak rehti hai, intervening wide/no-ball se expire nahi hoti. Caught dismissal par completed crossing strike ko change nahi karti; end-of-over switch phir bhi hota hai.

## Corrections and reliable saving

- Ek scorer control rakhta hai; doosra admin explicitly Take over kar sakta hai. Lease 2 minutes, active scorer tab heartbeat 30 seconds.
- Server row lock + revision check stale submission reject karta hai.
- Har command ka unique ID hai. Connection response uncertain ho to **Retry same submission** wahi ID use karta hai: duplicate delivery add nahi hoti. Pending request resolve/discard kiye baghair new entry blocked hai.
- Offline scoring queue nahi hai. Offline par Save rok diya jata hai; page close/reload na karein jab pending save uncertain ho. Reload ke baad current score/event history inspect karke continuation karein.
- Undo last action restores previous state. Reason required.
- Correct earlier entry rewinds to BEFORE the chosen entry; later scoring must be re-entered. Audit retains voided events. This is deliberate, because later striker/wickets may depend on the corrected delivery.
- Retired hurt/out supported. Retired hurt batter may return by selecting them in an empty batting slot; out cannot return.

## Finish

Overs complete, target reached or all-out par innings stops. Admin may End innings with a reason. Start second innings creates target = first total +1.

Official revised target/ball limit can be entered with a reason. **Automatic DLS, super overs, Test/multi-innings scoring, timed-out/rare non-delivery penalties and imported external live feeds are not implemented.** For unusual match conditions, record officials' final score through the manual workflow from a separate non-live fixture, or commission the specific rule extension; do not invent deliveries to force a result.

After second innings → Approve final scorecard. Home batting, bowling and fielding records are written atomically, one row per participating player/match. Season/career records recalculate from completed scorecards. Approving twice via network retry cannot double totals. Reopen for correction removes the previous generated stats until re-approved; source events remain.

Abandon / no result ends the live match and keeps its audit/summary. Partial abandoned innings do not contribute player career totals in this implementation. Manual completed matches can use No result when official stats should count.

## Live audience and refresh

Public, Team or Admin audience plus Published switch can be changed from the scoring desk. Individual player privacy is applied independently. Public viewer fetches authorized snapshots approximately every 5 seconds (not a WebSocket stream); hidden/background tabs pause polling. This keeps privacy enforcement in one database read function. Visible viewers generate approximately 12 RPC requests/minute, plus settings checks, so monitor free-tier usage.

Rules references used for the implemented subset:

- ICC T20I playing conditions: https://images.icc-cricket.com/image/upload/prd/bsxcho7ufe2pjban0wjp.pdf
- MCC Laws: https://www.lords.org/mcc/the-laws-of-cricket
- Scorers manual: https://nswcusa.cricketnsw.com.au/app/uploads/2020/05/Scorers-Manual-130922-w-sheets.pdf

Local club rules may differ. Agree format/free-hit/bowler quotas with both captains before starting. This application records scorer/umpire decisions; it does not detect match events automatically.
