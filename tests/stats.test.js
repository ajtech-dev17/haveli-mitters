import test from "node:test";
import assert from "node:assert/strict";
import {
  overs,
  toBalls,
  aggregate,
  seasonSummary,
} from "../assets/js/stats.js";
const row = (x) => ({
  batted: false,
  runs: 0,
  balls: 0,
  not_out: false,
  fours: 0,
  sixes: 0,
  wickets: 0,
  bowling_balls: 0,
  conceded: 0,
  catches: 0,
  run_outs: 0,
  stumpings: 0,
  ...x,
});
test("cricket overs are legal balls, never decimal arithmetic", () => {
  assert.equal(toBalls("3.4"), 22);
  assert.equal(overs(23), "3.5");
  assert.equal(overs(toBalls("20")), "20.0");
  for (const invalid of ["3.6", "2.8", "1.10", "-1", "NaN", ""])
    assert.throws(() => toBalls(invalid));
});
test("DNB and not-out zero count as appearances but not ducks or dismissals", () => {
  const s = aggregate([
    row({}),
    row({ batted: true, not_out: true }),
    row({ batted: true, runs: 60, balls: 40, not_out: true }),
    row({ batted: true, runs: 30, balls: 25 }),
    row({ batted: true }),
  ]);
  assert.equal(s.matches, 5);
  assert.equal(s.innings, 4);
  assert.equal(s.runs, 90);
  assert.equal(s.outs, 2);
  assert.equal(s.ducks, 1);
  assert.equal(s.average, 45);
  assert.equal(s.fifties, 1);
});
test("all not-out batting average and no bowling denominators remain undefined", () => {
  const s = aggregate([
    row({ batted: true, not_out: true, runs: 20, balls: 10 }),
  ]);
  assert.equal(s.average, null);
  assert.equal(s.strike, 200);
  assert.equal(s.economy, null);
  assert.equal(s.bowling_average, null);
});
test("bowling figures compare wickets first, conceded runs second", () => {
  const s = aggregate([
    row({ wickets: 3, bowling_balls: 22, conceded: 15 }),
    row({ wickets: 3, bowling_balls: 24, conceded: 12 }),
    row({ wickets: 5, bowling_balls: 24, conceded: 30 }),
  ]);
  assert.deepEqual(s.best, { wickets: 5, conceded: 30 });
  assert.equal(s.three, 2);
  assert.equal(s.five, 1);
  assert.equal(s.economy, (57 * 6) / 70);
});
test("century is not double-counted as a fifty", () => {
  const s = aggregate([
    row({ batted: true, runs: 100 }),
    row({ batted: true, runs: 99 }),
  ]);
  assert.equal(s.fifties, 1);
  assert.equal(s.hundreds, 1);
  assert.equal(s.highest, 100);
});
test("team results distinguish ties, no result and future fixtures", () => {
  const s = seasonSummary([
    { status: "completed", result: "won", team_runs: 182 },
    { status: "completed", result: "tied", team_runs: 100 },
    { status: "completed", result: "no_result", team_runs: null },
    { status: "upcoming", result: null, team_runs: null },
  ]);
  assert.deepEqual(s, {
    played: 3,
    won: 1,
    lost: 0,
    tied: 1,
    no_result: 1,
    highest: 182,
    lowest: 100,
  });
});
