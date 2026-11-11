// Optional integration test: npm install --no-save @electric-sql/pglite
// This emulates the Supabase Auth and Storage schemas locally; it is not a live Supabase test.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const db = new PGlite({ extensions: { pgcrypto } });
const run = (s) => db.exec(s),
  query = async (s, p = []) => (await db.query(s, p)).rows;
await run(`
 create role anon; create role authenticated;
 create schema auth; create schema storage; create schema extensions;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
`);
await run(fs.readFileSync("sql/setup.sql", "utf8"));
// Rerun validates this schema's idempotence.
await run(fs.readFileSync("sql/setup.sql", "utf8"));
const owner = "00000000-0000-0000-0000-000000000001",
  second = "00000000-0000-0000-0000-000000000002",
  third = "00000000-0000-0000-0000-000000000003";
await run(
  `insert into auth.users values ('${owner}','owner@example.test',now(),'{}'),('${second}','captain@example.test',now(),'{}'),('${third}','third@example.test',now(),'{}');insert into public.hm_admins(user_id,role) values('${owner}','owner');`,
);
const as = async (role, id = "") => {
  await run("reset role");
  await query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await run("set role " + role);
};
await as("authenticated", owner);
const [p] = await query(
  "insert into hm_players(name,jersey,role,published) values('Test player',7,'batter',true) returning id",
);
await run(
  "insert into hm_players(name,jersey,role,published) values('Draft player',8,'bowler',false)",
);
const match = {
  opponent: "Test XI",
  starts_at: "2026-10-01T09:00:00Z",
  season: "2026",
  status: "completed",
  result: "won",
  team_runs: 60,
  team_wickets: 2,
  team_balls: 60,
  opponent_runs: 50,
  opponent_wickets: 3,
  opponent_balls: 60,
  published: true,
};
const stats = [
  {
    player_id: p.id,
    batted: true,
    runs: 50,
    balls: 30,
    wickets: 2,
    bowling_balls: 22,
    conceded: 15,
  },
];
const save = async (id, rev, m, s) =>
  (
    await query("select hm_save_match($1,$2,$3::jsonb,$4::jsonb) as id", [
      id,
      rev,
      JSON.stringify(m),
      JSON.stringify(s),
    ])
  )[0].id;
const mid = await save(null, 0, match, stats);
await save(mid, 1, match, [{ ...stats[0], runs: 55 }]);
assert.equal(
  (await query("select count(*)::int n,sum(runs)::int runs from hm_stats"))[0]
    .runs,
  55,
);
await assert.rejects(() => save(mid, 1, match, stats), /Match changed/);
await assert.rejects(
  () => save(mid, 2, match, [{ ...stats[0], runs: 999 }]),
  /Player runs exceed/,
);
assert.equal(
  (await query("select revision from hm_matches where id=$1", [mid]))[0]
    .revision,
  2,
);
assert.equal((await query("select runs from hm_stats"))[0].runs, 55);
await query(
  'insert into hm_settings_drafts(id,config) values(1,\'{"headline":"PRIVATE"}\')',
);
assert.equal(
  (
    await query(
      'select hm_publish_settings(0,\'{"headline":"PUBLIC"}\') as revision',
    )
  )[0].revision,
  1,
);
await assert.rejects(
  () => query("select hm_publish_settings(0,'{}')"),
  /Another admin/,
);
await run(
  "insert into hm_location values(1,31,74,'Expired',now()-interval '1 minute',now())",
);
await as("anon");
assert.equal((await query("select count(*)::int n from hm_players"))[0].n, 1);
assert.equal((await query("select count(*)::int n from hm_location"))[0].n, 0);
assert.equal(
  (await query("select config from hm_settings"))[0].config.headline,
  "PUBLIC",
);
assert.equal((await query("select count(*)::int n from hm_stats"))[0].n, 1);
await assert.rejects(
  () =>
    query("insert into hm_players(name,jersey,role) values('No',10,'batter')"),
  /permission denied/,
);
await assert.rejects(
  () => query("select * from hm_settings_drafts"),
  /permission denied/,
);
await assert.rejects(
  () => query("select hm_create_invite('x@example.test')"),
  /permission denied/,
);
await as("authenticated", third);
assert.equal((await query("select hm_is_admin() as yes"))[0].yes, false);
await assert.rejects(
  () =>
    query("insert into hm_players(name,jersey,role) values('No',10,'batter')"),
  /row-level security/,
);
await assert.rejects(
  () => query("select * from hm_members()"),
  /Admin access required/,
);
await as("authenticated", owner);
const token = (
  await query("select hm_create_invite('captain@example.test') as token")
)[0].token;
await as("authenticated", third);
await assert.rejects(
  () => query("select hm_redeem_invite($1)", [token]),
  /different email/,
);
await as("authenticated", second);
await query("select hm_redeem_invite($1)", [token]);
await assert.rejects(
  () => query("select hm_create_invite('third@example.test')"),
  /Owner access required/,
);
await as("authenticated", owner);
const token3 = (
  await query("select hm_create_invite('third@example.test') as token")
)[0].token;
await as("authenticated", third);
await assert.rejects(
  () => query("select hm_redeem_invite($1)", [token3]),
  /Maximum two admins/,
);
await as("authenticated", owner);
await query("select hm_transfer_owner($1,true)", [second]);
assert.equal((await query("select hm_is_admin() as yes"))[0].yes, false);
await assert.rejects(
  () => query("select hm_publish_settings(1,'{}')"),
  /Admin access required/,
);
await as("authenticated", second);
assert.equal((await query("select hm_is_owner() as yes"))[0].yes, true);
assert.equal((await query("select count(*)::int n from hm_members()"))[0].n, 1);
// Check the content-export restore converter, including quoted names.
await query("update hm_players set name=$1 where id=$2", [
  "O'Neil \\\\ test",
  p.id,
]);
const backup = {
  version: 2,
  settings: (await query("select config from hm_settings"))[0].config,
};
for (const name of ["players", "matches", "stats", "media"])
  backup[name] = await query("select * from hm_" + name);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "hm-restore-"));
fs.writeFileSync(path.join(temp, "backup.json"), JSON.stringify(backup));
execFileSync(process.execPath, [
  "scripts/backup-to-sql.mjs",
  path.join(temp, "backup.json"),
  path.join(temp, "restore.sql"),
]);
await run("reset role");
await run(fs.readFileSync(path.join(temp, "restore.sql"), "utf8"));
assert.equal(
  (await query("select name from hm_players where id=$1", [p.id]))[0].name,
  "O'Neil \\\\ test",
);
assert.equal((await query("select runs from hm_stats"))[0].runs, 55);
fs.rmSync(temp, { recursive: true, force: true });
await db.close();
console.log(
  "Schema rerun, public/admin RLS, unauthorized access, atomic match edits/rollback, revisions, drafts, invite ownership, two-admin cap, handover and content restore passed.",
);
