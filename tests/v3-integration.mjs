// PostgreSQL integration tests with local Auth/Storage stubs, not a hosted Supabase test.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
process.on("uncaughtException", (err) => {
  console.error(
    err.message,
    err.where || "",
    err.query || "",
    err.stack
      ?.split("\n")
      .filter((x) => x.includes("v3-integration"))
      .join("\n") || "",
  );
  process.exit(1);
});
const db = new PGlite({ extensions: { pgcrypto } }),
  q = async (s, p = []) => (await db.query(s, p)).rows,
  run = (s) => db.exec(s);
await run(`create role anon;create role authenticated;create schema auth;create schema storage;create schema extensions;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
grant select on storage.objects to anon,authenticated;`);
await run(fs.readFileSync("sql/base-v2.sql", "utf8"));
const users = Array.from({ length: 5 }, () => randomUUID()),
  [owner, admin, one, two, stranger] = users;
for (let i = 0; i < users.length; i++)
  await q("insert into auth.users values($1,$2,now(),'{}')", [
    users[i],
    `u${i}@example.test`,
  ]);
await q("insert into hm_admins(user_id,role) values($1,'owner'),($2,'admin')", [
  owner,
  admin,
]);
const as = async (id = null) => {
  await run("reset role");
  await q("select set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
  await run("set role " + (id ? "authenticated" : "anon"));
};
await as(owner);
const players = [];
for (let i = 1; i <= 12; i++)
  players.push(
    (
      await q(
        "insert into hm_players(name,jersey,role,published) values($1,$2,'all_rounder',true) returning id",
        ["Player " + i, i],
      )
    )[0].id,
  );
await run("reset role");
await run(fs.readFileSync("sql/upgrade-v3-complete.sql", "utf8"));
await run(fs.readFileSync("sql/upgrade-v3-complete.sql", "utf8"));
assert.equal((await q("select count(*)::int n from hm_players"))[0].n, 12);
await as();
assert.equal((await q("select count(*)::int n from hm_players"))[0].n, 12);
await as(owner);
const publish = async (config) => {
  const rev = (await q("select revision from hm_settings"))[0].revision;
  return q("select hm_publish_settings($1,$2)", [rev, config]);
};
const invite = async (id, email) =>
  (await q("select hm_player_invite($1,$2) token", [id, email]))[0].token;
const tok = await invite(players[0], "u2@example.test");
await as(two);
await assert.rejects(
  () => q("select hm_accept_player($1)", [tok]),
  /different email/,
);
await as(one);
assert.equal(
  (await q("select hm_accept_player($1) id", [tok]))[0].id,
  players[0],
);
await assert.rejects(() => q("select hm_accept_player($1)", [tok]), /expired/);
await as(owner);
const t2 = await invite(players[1], "u3@example.test");
await as(two);
await q("select hm_accept_player($1)", [t2]);
await as(stranger);
assert.equal((await q("select hm_is_admin() yes"))[0].yes, false);
await assert.rejects(
  () => q("select hm_player_invite($1,$2)", [players[2], "x@ex.test"]),
  /Admin access/,
);
const blocked = await q("update hm_players set name='Hacked' returning id");
assert.equal(blocked.length, 0);
assert.equal(
  (await q("select name from hm_players where id=$1", [players[0]]))[0].name,
  "Player 1",
);
await as(owner);
await q("update hm_players set stats_visibility='private' where id=$1", [
  players[0],
]);
await q(
  "update hm_players set profile_visibility='private',stats_visibility='private' where id=$1",
  [players[1]],
);
const mid = (
  await q(
    "insert into hm_matches(opponent,starts_at,season,status,result,team_runs,team_wickets,team_balls,opponent_runs,opponent_wickets,opponent_balls,published) values('Visitors',now(),'2026','completed','won',12,0,6,10,0,6,true) returning id",
  )
)[0].id;
for (const id of players.slice(0, 3))
  await q(
    "insert into hm_stats(match_id,player_id,batted,runs,balls) values($1,$2,true,4,2)",
    [mid, id],
  );
await as();
assert.equal((await q("select count(*)::int n from hm_players"))[0].n, 11);
assert.equal((await q("select count(*)::int n from hm_stats"))[0].n, 1);
await as(one);
assert.equal((await q("select count(*)::int n from hm_stats"))[0].n, 2);
assert.equal(
  (
    await q("select count(*)::int n from hm_players where id=$1", [players[1]])
  )[0].n,
  0,
);
await as(two);
assert.equal((await q("select count(*)::int n from hm_stats"))[0].n, 2);
await as(owner);
await publish({ profile_default: "private", stats_default: "private" });
await as();
assert.equal((await q("select count(*)::int n from hm_players"))[0].n, 0);
await as(owner);
await q(
  "update hm_players set profile_visibility='public',stats_visibility='public' where id=$1",
  [players[2]],
);
await as();
assert.equal((await q("select count(*)::int n from hm_stats"))[0].n, 1);
await as(owner);
await publish({ force_private: true });
await as();
assert.equal((await q("select count(*)::int n from hm_players"))[0].n, 0);
await as(one);
assert.equal((await q("select count(*)::int n from hm_players"))[0].n, 1);
await as(owner);
await publish({});
// Settings drafts never alter public policy. Developer data is stripped server-side.
await q(
  "insert into hm_settings_drafts(id,config) values(1,'{\"force_private\":true}') on conflict(id) do update set config=excluded.config",
);
await publish({ developer_brand: "changed", flags: { developer_card: false } });
const cfg = (await q("select config from hm_settings"))[0].config;
assert.equal(cfg.developer_brand, undefined);
assert.equal(cfg.flags.developer_card, undefined);
await assert.rejects(
  () => publish({ appearance: { dark_bg: "#000000", dark_text: "#111111" } }),
  /readable colors/,
);
await q(
  "update hm_players set photo_path=id::text||'/portrait.webp' where id=$1",
  [players[0]],
);
await run("reset role");
await q(
  "insert into storage.objects(bucket_id,name) values('hm-portraits',$1)",
  [players[0] + "/portrait.webp"],
);
await as();
assert.equal(
  (
    await q(
      "select count(*)::int n from storage.objects where bucket_id='hm-portraits'",
    )
  )[0].n,
  1,
);
await as(owner);
await q("update hm_players set profile_visibility='private' where id=$1", [
  players[0],
]);
await as();
assert.equal(
  (
    await q(
      "select count(*)::int n from storage.objects where bucket_id='hm-portraits'",
    )
  )[0].n,
  0,
);
await as(one);
assert.equal(
  (
    await q(
      "select count(*)::int n from storage.objects where bucket_id='hm-portraits'",
    )
  )[0].n,
  1,
);
await as(owner);
await q(
  "update hm_players set photo_url='https://example.test/p.jpg' where id=$1",
  [players[3]],
);
await assert.rejects(
  () => publish({ force_private: true }),
  /protected storage/,
);
await q("update hm_players set photo_url=null where id=$1", [players[3]]);
await q("select hm_revoke_player($1,true)", [players[0]]);
await as(one);
assert.equal(
  (
    await q("select count(*)::int n from hm_players where id=$1", [players[0]])
  )[0].n,
  0,
);
await as(owner);
const expired = await invite(players[0], "u2@example.test");
await run("reset role");
await q(
  "update hm_player_invites set expires_at=now()-interval '1 second' where player_id=$1",
  [players[0]],
);
await as(one);
await assert.rejects(
  () => q("select hm_accept_player($1)", [expired]),
  /expired/,
);
await as(owner);
const fresh = await invite(players[0], "u2@example.test");
await as(one);
await q("select hm_accept_player($1)", [fresh]);
console.log(
  "PASS migration, invitations, own-profile isolation, defaults/overrides, drafts, portrait RLS, revocation, contrast and fixed developer branding.",
);

await as(owner);
const fixture = async () =>
  (
    await q(
      "insert into hm_matches(opponent,starts_at,season,status,published) values('Away XI',now(),'2026','upcoming',true) returning id,revision",
    )
  )[0];
const match = await fixture(),
  config = {
    overs: 2,
    max_bowler_overs: 1,
    first_batting: "home",
    toss_winner: "home",
    toss_decision: "bat",
    free_hit: true,
  };
await q("select hm_start_live($1,$2,$3,$4,$5)", [
  match.id,
  match.revision,
  config,
  players.slice(0, 3),
  ["Away One", "Away Two", "Away Three"],
]);
const view = async (id = match.id) =>
  (await q("select hm_live_view($1) v", [id]))[0].v;
let v = await view();
const home = v.lineup.filter((x) => x.side === "home"),
  away = v.lineup.filter((x) => x.side === "away");
let rev = v.revision;
const cmd = async (action, payload = {}, id = randomUUID(), expected = rev) => {
  const x = (
    await q("select hm_live_command($1,$2,$3,$4,$5) v", [
      match.id,
      expected,
      id,
      action,
      payload,
    ])
  )[0].v;
  rev = x.revision;
  return x;
};
const innings = async () => (await view()).state.innings.at(-1);
await cmd("batters", { striker: home[0].id, non_striker: home[1].id });
await cmd("bowler", { id: away[0].id });
await cmd("delivery", { kind: "noball", nb_kind: "legbye", runs: 2 });
let i = await innings();
assert.equal(i.runs, 3);
assert.equal(i.balls, 0);
assert.equal(i.batters[home[0].id].balls, 1);
assert.equal(i.bowlers[away[0].id].conceded, 1);
assert.equal(i.extras.legbye, 2);
assert.equal(i.free_hit, true);
await assert.rejects(
  () => cmd("delivery", { kind: "legal", runs: 0, wicket: "bowled" }),
  /no-ball\/free hit/,
);
await cmd("delivery", { kind: "wide", runs: 0 });
i = await innings();
assert.equal(i.free_hit, true);
assert.equal(i.batters[home[0].id].balls, 1);
await cmd("delivery", { kind: "legal", runs: 4, boundary: 0 });
i = await innings();
assert.equal(i.batters[home[0].id].fours, 0);
assert.equal(i.free_hit, false);
await cmd("delivery", { kind: "legal", runs: 4, boundary: 4 });
const request = randomUUID(),
  expected = rev;
await cmd("delivery", { kind: "legal", runs: 1 }, request, expected);
const before = await innings();
const duplicate = await cmd(
  "delivery",
  { kind: "legal", runs: 1 },
  request,
  expected,
);
assert.equal(duplicate.duplicate, true);
assert.deepEqual(await innings(), before);
await assert.rejects(
  () => cmd("delivery", { kind: "legal", runs: 2 }, request, expected),
  /different command/,
);
await assert.rejects(
  () => cmd("delivery", { kind: "legal", runs: 0 }, randomUUID(), expected),
  /Score changed/,
);
assert.equal(before.striker, home[1].id);
await cmd("delivery", { kind: "bye", runs: 1 });
await cmd("delivery", { kind: "legal", runs: 0 });
await cmd("delivery", {
  kind: "legal",
  runs: 0,
  wicket: "caught",
  out_id: home[0].id,
  fielder: away[1].id,
});
i = await innings();
assert.equal(i.balls, 6);
assert.equal(i.striker, home[1].id);
assert.equal(i.non_striker, "");
assert.equal(i.bowler, "");
assert.equal(i.bowlers[away[0].id].wickets, 1);
assert.equal(i.fielding[away[1].id].catches, 1);
await assert.rejects(() => cmd("bowler", { id: away[0].id }), /consecutive/);
await cmd("batters", { striker: home[1].id, non_striker: home[2].id });
await cmd("bowler", { id: away[1].id });
const beforeRunout = await innings();
await cmd("delivery", {
  kind: "legal",
  runs: 0,
  wicket: "run_out",
  out_id: home[1].id,
  fielder: away[0].id,
  crossed: true,
});
i = await innings();
assert.equal(i.striker, home[2].id);
assert.equal(i.bowlers[away[1].id].wickets, 0);
assert.equal((await view()).state.phase, "break");
await cmd("undo", { reason: "Wrong batter selected" });
assert.deepEqual(await innings(), beforeRunout);
await cmd("delivery", { kind: "legal", runs: 0 });
const revisionToRewind = rev;
await cmd("delivery", { kind: "legal", runs: 6, boundary: 6 });
await cmd("rewind", {
  revision: revisionToRewind,
  reason: "Replay correction",
});
assert.deepEqual(await innings(), beforeRunout);
await cmd("end_innings", { reason: "Official innings closed" });
await cmd("second_innings");
await cmd("batters", { striker: away[0].id, non_striker: away[1].id });
await cmd("bowler", { id: home[0].id });
await cmd("delivery", { kind: "legal", runs: 4, boundary: 4 });
await cmd("target", { target: 4, limit: 6, reason: "Official reduced target" });
assert.equal((await view()).state.phase, "review");
await cmd("finalize");
assert.equal((await view()).state.phase, "completed");
assert.equal(
  (await q("select result from hm_matches where id=$1", [match.id]))[0].result,
  "lost",
);
assert.equal(
  (
    await q("select count(*)::int n from hm_stats where match_id=$1", [
      match.id,
    ])
  )[0].n,
  3,
);
const firstStats = await q(
  "select * from hm_stats where match_id=$1 order by player_id",
  [match.id],
);
await assert.rejects(
  () => q("select hm_save_match($1,0,'{}','[]')", [match.id]),
  /Use Live scoring/,
);
await cmd("reopen", { reason: "Review final approval" });
assert.equal(
  (
    await q("select count(*)::int n from hm_stats where match_id=$1", [
      match.id,
    ])
  )[0].n,
  0,
);
await cmd("finalize");
assert.deepEqual(
  await q("select * from hm_stats where match_id=$1 order by player_id", [
    match.id,
  ]),
  firstStats,
);
// Privacy in all live projections, even with direct RPC access.
await as();
v = await view();
assert.equal(
  v.lineup.some((x) => x.id === home[0].id),
  false,
);
assert.equal(v.state.innings[0].batters[home[0].id], undefined);
assert.equal(v.state.innings[1].bowlers[home[0].id], undefined);
assert.equal(v.state.innings[0].recent.length, 0);
await assert.rejects(
  () => q("select * from hm_live_events"),
  /permission denied/,
);
await as(stranger);
assert.equal((await q("select count(*)::int n from hm_live_matches"))[0].n, 0);
await assert.rejects(
  () => q("select hm_live_claim($1,false)", [match.id]),
  /Admin access/,
);
await as(one);
v = await view();
assert.equal(
  v.lineup.some((x) => x.id === home[0].id),
  true,
);
assert.equal(
  v.lineup.some((x) => x.id === home[1].id),
  false,
);
await as(owner);
await cmd("audience", { audience: "team", published: true });
await as();
assert.equal(await view(), null);
await as(stranger);
assert.equal(await view(), null);
await as(one);
assert.notEqual(await view(), null);
await as(owner);
await cmd("audience", { audience: "admin", published: true });
await as(one);
assert.equal(await view(), null);
await as(admin);
await assert.rejects(
  () => q("select hm_live_claim($1,false)", [match.id]),
  /Another admin/,
);
await q("select hm_live_claim($1,true)", [match.id]);
await as(owner);
await assert.rejects(
  () => cmd("audience", { audience: "public" }),
  /Claim scoring/,
);
await as(admin);
await cmd("audience", { audience: "public", published: false });
await as(one);
assert.equal(await view(), null);
await as(admin);
await cmd("audience", { audience: "public", published: true });
await publish({ flags: { live: false } });
await as();
assert.equal(await view(), null);
await as(owner);
await publish({});
console.log(
  "PASS scoring/extras/free hit, boundaries, strike, wickets/fielding, idempotency, revisions, undo/rewind, targets, finalization replacement, live privacy/audiences and scorer takeover.",
);
await as(stranger);
await assert.rejects(() => q("select hm_export_content()"), /Admin access/);
await as(owner);
const backup = (await q("select hm_export_content() b"))[0].b;
assert.equal(backup.version, 3);
assert.equal(backup.players.length, 12);
assert.equal(backup.lineups.length, 6);
assert.equal(backup.player_accounts, undefined);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "hm-v3-restore-"));
try {
  fs.writeFileSync(path.join(temp, "backup.json"), JSON.stringify(backup));
  execFileSync(process.execPath, [
    "scripts/backup-to-sql.mjs",
    path.join(temp, "backup.json"),
    path.join(temp, "restore.sql"),
  ]);
  await run("reset role");
  await run(fs.readFileSync(path.join(temp, "restore.sql"), "utf8"));
  assert.deepEqual(
    (
      await q("select state from hm_live_matches where match_id=$1", [match.id])
    )[0].state,
    backup.live_matches[0].state,
  );
  assert.equal(
    (await q("select count(*)::int n from hm_live_events"))[0].n,
    backup.live_events.length,
  );
  assert.equal(
    (
      await q("select scorer from hm_live_matches where match_id=$1", [
        match.id,
      ])
    )[0].scorer,
    null,
  );
  assert.equal(
    (
      await q("select stats_visibility from hm_players where id=$1", [
        players[0],
      ])
    )[0].stats_visibility,
    "private",
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log(
  "PASS v3 portable backup/restore with live history and privacy preserved.",
);
await db.close();
