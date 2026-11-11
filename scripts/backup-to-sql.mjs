// Run: node scripts/backup-to-sql.mjs /path/haveli-backup.json /path/restore.sql
// Review the result, take a new backup, then run in your own Supabase SQL Editor.
import fs from "node:fs";
const [, , input, output] = process.argv;
if (!input || !output)
  throw Error("Usage: node scripts/backup-to-sql.mjs input.json output.sql");
const b = JSON.parse(fs.readFileSync(input, "utf8"));
if (![2, 3].includes(b.version))
  throw Error("Expected a v2 or v3 Haveli Mitters export");
const fields = {
  players: [
    "id",
    "name",
    "name_ur",
    "jersey",
    "role",
    "batting_style",
    "batting_style_ur",
    "bowling_style",
    "bowling_style_ur",
    "photo_url",
    "status",
    "published",
    "created_at",
  ],
  matches: [
    "id",
    "opponent",
    "opponent_ur",
    "venue",
    "venue_ur",
    "starts_at",
    "toss_at",
    "season",
    "status",
    "result",
    "team_runs",
    "team_wickets",
    "team_balls",
    "opponent_runs",
    "opponent_wickets",
    "opponent_balls",
    "summary",
    "summary_ur",
    "published",
    "revision",
    "created_at",
  ],
  stats: [
    "match_id",
    "player_id",
    "batted",
    "runs",
    "balls",
    "not_out",
    "fours",
    "sixes",
    "wickets",
    "bowling_balls",
    "conceded",
    "catches",
    "run_outs",
    "stumpings",
  ],
  media: [
    "id",
    "kind",
    "title",
    "title_ur",
    "description",
    "description_ur",
    "category",
    "url",
    "thumbnail_url",
    "sort_order",
    "published",
    "created_at",
  ],
};
if (b.version === 3) {
  fields.players.push(
    "profile_visibility",
    "stats_visibility",
    "leadership",
    "display_order",
    "photo_path",
  );
  fields.matches.push("audience");
  fields.live_matches = [
    "match_id",
    "config",
    "state",
    "revision",
    "scorer",
    "lease_until",
    "updated_at",
  ];
  fields.lineups = [
    "id",
    "match_id",
    "side",
    "player_id",
    "name",
    "batting_order",
  ];
  fields.live_events = [
    "id",
    "match_id",
    "revision",
    "action",
    "payload",
    "before_state",
    "after_state",
    "actor",
    "voided",
    "created_at",
  ];
  // A restored match requires a fresh scoring claim. User IDs are not portable between projects.
  b.live_matches = b.live_matches.map((x) => ({
    ...x,
    scorer: null,
    lease_until: null,
  }));
  b.live_events = b.live_events.map((x) => ({ ...x, actor: null }));
}
const literal = (v) =>
  "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";
const lines = [
  "-- REVIEW BEFORE RUNNING. Merge restore: matching IDs are overwritten.",
  "-- Records not in this export remain. Auth, membership, storage and live locations are untouched.",
  "begin;",
  "set local standard_conforming_strings=on;",
];
for (const [table, cols] of Object.entries(fields)) {
  if (!Array.isArray(b[table])) throw Error("Missing table " + table);
  const items = b[table].map((row) =>
    Object.fromEntries(cols.map((k) => [k, row[k] ?? null])),
  );
  const data = literal(items);
  if (table === "stats") {
    const matchIds = literal(b.matches.map((m) => m.id));
    lines.push(
      `delete from public.hm_stats where match_id in (select value::uuid from jsonb_array_elements_text(${matchIds}));`,
    );
  }
  const pk =
    table === "stats"
      ? ["match_id", "player_id"]
      : table === "live_matches"
        ? ["match_id"]
        : ["id"];
  const updates = cols
    .filter((c) => !pk.includes(c))
    .map((c) => `${c}=excluded.${c}`)
    .join(",");
  lines.push(
    `insert into public.hm_${table}(${cols.join(",")}) select ${cols.join(",")} from jsonb_populate_recordset(null::public.hm_${table},${data}) on conflict(${pk.join(",")}) do update set ${updates};`,
  );
}
lines.push(
  `update public.hm_settings set config=${literal(b.settings || {})},revision=revision+1,updated_at=now() where id=1;`,
  "commit;",
);
fs.writeFileSync(output, lines.join("\n\n") + "\n");
console.log(
  "Created " + output + ". Review before running; take a current backup first.",
);
