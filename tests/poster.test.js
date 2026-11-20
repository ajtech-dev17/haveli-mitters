import test from "node:test";
import assert from "node:assert/strict";
import { buildPosterModel, shareText } from "../assets/js/poster.js";

const match = {
  id: "m1",
  opponent: "Lions",
  season: "2026",
  result: "won",
  team_runs: 168,
  team_wickets: 6,
  team_balls: 120,
  opponent_runs: 151,
  opponent_wickets: 9,
  opponent_balls: 117,
  summary: "Won by 17 runs",
};
const players = ["a", "b", "c", "d", "e"].map((id) => ({ id, name: "P" + id }));
const r = (player_id, x) => ({
  match_id: "m1",
  player_id,
  batted: false,
  runs: 0,
  balls: 0,
  not_out: false,
  wickets: 0,
  bowling_balls: 0,
  conceded: 0,
  ...x,
});
const stats = [
  r("a", { batted: true, runs: 62, balls: 41 }),
  r("b", { batted: true, runs: 62, balls: 30, not_out: true }),
  r("c", { batted: true, runs: 12, balls: 9, wickets: 3, bowling_balls: 24, conceded: 28 }),
  r("d", { wickets: 3, bowling_balls: 24, conceded: 22 }),
  r("e", { batted: true, runs: 99, balls: 50 }),
  { ...r("a", { batted: true, runs: 500 }), match_id: "other" },
];

test("poster ranks performers, handles ties and not-out marker", () => {
  const m = buildPosterModel({ match, stats, players });
  assert.deepEqual(m.batters.map((x) => x.name), ["Pe", "Pb", "Pa"]);
  assert.equal(m.batters[1].value, "62*");
  assert.deepEqual(m.bowlers.map((x) => x.name), ["Pd", "Pc"]);
  assert.equal(m.bowlers[0].value, "3/22");
  assert.equal(m.bowlers[0].detail, "(4.0)");
  assert.equal(m.ours.text, "168/6");
  assert.equal(m.theirs.overs, "19.3");
  assert.equal(m.resultLabel, "VICTORY");
});

test("poster never exposes players whose statistics are private", () => {
  const m = buildPosterModel({ match, stats, players, canSee: (id) => id !== "e" && id !== "d" });
  assert.ok(!m.batters.some((x) => x.name === "Pe"));
  assert.ok(!m.bowlers.some((x) => x.name === "Pd"));
});

test("poster tolerates no-result matches and missing scores", () => {
  const m = buildPosterModel({
    match: { id: "m2", opponent: "X", result: "no_result", team_runs: null, summary: "x".repeat(200) },
    stats: [],
    players,
  });
  assert.equal(m.ours.text, "—");
  assert.equal(m.resultLabel, "NO RESULT");
  assert.equal(m.summary, "");
  assert.deepEqual(m.batters, []);
  assert.match(shareText(m, "https://x/matches.html"), /NO RESULT/);
});
