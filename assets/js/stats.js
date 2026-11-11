export function overs(balls = 0) {
  return Math.floor(Number(balls) / 6) + "." + (Number(balls) % 6);
}
export function toBalls(value) {
  const m = String(value ?? "")
    .trim()
    .match(/^(\d+)(?:\.([0-5]))?$/);
  if (!m)
    throw Error("Use cricket overs, such as 3.4. The last digit must be 0–5.");
  return Number(m[1]) * 6 + Number(m[2] || 0);
}
export function aggregate(rows) {
  const s = {
    matches: rows.length,
    innings: 0,
    runs: 0,
    balls: 0,
    outs: 0,
    highest: 0,
    highest_not_out: false,
    fifties: 0,
    hundreds: 0,
    fours: 0,
    sixes: 0,
    ducks: 0,
    wickets: 0,
    bowling_balls: 0,
    conceded: 0,
    three: 0,
    five: 0,
    catches: 0,
    run_outs: 0,
    stumpings: 0,
    best: null,
  };
  for (const r of rows) {
    if (r.batted) {
      s.innings++;
      s.runs += r.runs;
      s.balls += r.balls;
      s.outs += r.not_out ? 0 : 1;
      if (r.runs > s.highest || (r.runs === s.highest && r.not_out)) {
        s.highest = r.runs;
        s.highest_not_out = !!r.not_out;
      }
      s.fifties += r.runs >= 50 && r.runs < 100 ? 1 : 0;
      s.hundreds += r.runs >= 100 ? 1 : 0;
      s.ducks += r.runs === 0 && !r.not_out ? 1 : 0;
    }
    for (const k of [
      "fours",
      "sixes",
      "wickets",
      "bowling_balls",
      "conceded",
      "catches",
      "run_outs",
      "stumpings",
    ])
      s[k] += Number(r[k] || 0);
    s.three += r.wickets >= 3 && r.wickets < 5 ? 1 : 0;
    s.five += r.wickets >= 5 ? 1 : 0;
    if (
      (r.bowling_balls || r.wickets) &&
      (!s.best ||
        r.wickets > s.best.wickets ||
        (r.wickets === s.best.wickets && r.conceded < s.best.conceded))
    )
      s.best = { wickets: r.wickets, conceded: r.conceded };
  }
  s.average = s.outs ? s.runs / s.outs : null;
  s.strike = s.balls ? (s.runs * 100) / s.balls : null;
  s.economy = s.bowling_balls ? (s.conceded * 6) / s.bowling_balls : null;
  s.bowling_average = s.wickets ? s.conceded / s.wickets : null;
  return s;
}
export function seasonSummary(matches) {
  const list = matches.filter((m) => m.status === "completed"),
    totals = list.map((m) => m.team_runs).filter((v) => v !== null);
  return {
    played: list.length,
    won: list.filter((m) => m.result === "won").length,
    lost: list.filter((m) => m.result === "lost").length,
    tied: list.filter((m) => m.result === "tied").length,
    no_result: list.filter((m) => m.result === "no_result").length,
    highest: totals.length ? Math.max(...totals) : null,
    lowest: totals.length ? Math.min(...totals) : null,
  };
}
