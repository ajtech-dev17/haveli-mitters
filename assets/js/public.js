import {
  S,
  $,
  $$,
  t,
  e,
  n,
  local,
  flag,
  url,
  date,
  settings,
  shell,
  empty,
  head,
  metrics,
  dialog,
  all,
  page,
  safeImages,
  db,
  api,
  hydratePortraits,
  clearPortraits,
  refreshReadableStats,
  canSeeStats,
} from "./core.js";
import { aggregate, overs, seasonSummary } from "./stats.js";
import { sessionIdentityChanged } from "./session-refresh.js";
const main = $("#main");
const complete = () => S.matches.filter((m) => m.status === "completed");
const rows = (id, season = "") =>
  S.stats.filter(
    (s) =>
      s.player_id === id &&
      complete().some(
        (m) => m.id === s.match_id && (!season || m.season === season),
      ),
  );
const score = (m) =>
  m.team_runs == null ? "—" : m.team_runs + "/" + m.team_wickets;
const initials = (s) =>
  s
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("");
const button = (label, href) =>
  `<a class="btn" href="${href}">${t(label)} <span>→</span></a>`;
let timer;
export function photo(p) {
  return p._photo || (p.photo_url && url(p.photo_url))
    ? `<img src="${e(p._photo || url(p.photo_url))}" alt="${e(local(p, "name"))}" loading="lazy">`
    : `<span class="initials">${e(initials(local(p, "name")))}</span>`;
}
function playerCard(p) {
  const s = aggregate(rows(p.id));
  return `<article class="panel player feature"><div class="player-photo">${photo(p)}<span class="jersey">#${p.jersey}</span></div><div class="player-body"><div class="row between"><span class="label">${t(p.role)}</span><span class="badge">${t(p.status)}</span></div><h3 style="margin-top:12px">${e(local(p, "name"))}</h3>${canSeeStats(p.id) ? `<div class="numbers"><div><small>${t("Runs")}</small><strong>${n(s.runs)}</strong></div><div><small>${t("Wickets")}</small><strong>${n(s.wickets)}</strong></div><div><small>${t("Played")}</small><strong>${s.matches}</strong></div></div>` : `<p class="restricted">${t("Private statistics")}</p>`}<button class="text-btn" data-player="${p.id}">${t("View profile")} →</button></div></article>`;
}
function matchCard(m) {
  return `<article class="panel feature"><div class="row between"><span class="label">${e(m.season)}</span><span class="badge ${e(m.result || "")}">${t(m.result || m.status)}</span></div><h3 style="margin-top:20px">${e(local(S.config, "brand_name"))} <span class="muted">vs</span><br>${e(local(m, "opponent"))}</h3><p class="note">${date(m.starts_at)} · ${e(local(m, "venue") || t("Venue to be confirmed"))}</p><div class="row between"><div class="result-score ltr">${score(m)}<small>${m.team_balls != null ? overs(m.team_balls) + " " + t("Overs") : t("To be announced")}</small></div>${m.status === "completed" ? `<button class="btn secondary" data-match="${m.id}">${t("Scorecard")} →</button>` : `<span class="badge">${t("Toss")} · ${m.toss_at ? date(m.toss_at) : "—"}</span>`}</div></article>`;
}
function bindCards() {
  $$("[data-player]").forEach(
    (b) => (b.onclick = () => profile(b.dataset.player)),
  );
  $$("[data-match]").forEach(
    (b) => (b.onclick = () => scorecard(b.dataset.match)),
  );
  safeImages();
}
export function profile(id) {
  const p = S.players.find((p) => p.id === id);
  if (!p) return;
  if (!canSeeStats(id)) {
    dialog(
      local(p, "name"),
      `<div class="profile-intro"><div class="player-photo">${photo(p)}</div><p>#${p.jersey} · ${t(p.role)}</p><p>${t("Private statistics")}</p></div>`,
    );
    return;
  }
  const list = rows(id).sort(
    (a, b) =>
      new Date(S.matches.find((m) => m.id === b.match_id).starts_at) -
      new Date(S.matches.find((m) => m.id === a.match_id).starts_at),
  );
  const s = aggregate(list);
  dialog(
    local(p, "name"),
    `<div class="row"><div class="player-photo" style="width:90px;height:90px;border-radius:16px;overflow:hidden">${photo(p)}</div><div><span class="badge">#${p.jersey} · ${t(p.role)}</span><h2 style="margin:10px 0">${e(local(p, "name"))}</h2><p class="note">${e(local(p, "batting_style"))} · ${e(local(p, "bowling_style"))}</p></div></div>
 <p class="eyebrow" style="margin-top:28px">${t("Batting")} · ${t("Career")}</p><div class="grid cols4">${metrics(
   [
     ["Matches", s.matches],
     ["Innings", s.innings],
     ["Runs", s.runs],
     ["Average", n(s.average)],
     ["Strike rate", n(s.strike)],
     ["Highest score", s.highest + (s.highest_not_out ? "*" : "")],
     ["Fifties", s.fifties],
     ["Hundreds", s.hundreds],
     ["Fours", s.fours],
     ["Sixes", s.sixes],
     ["Ducks", s.ducks],
   ],
 )}</div>
 <p class="eyebrow" style="margin-top:28px">${t("Bowling")}</p><div class="grid cols4">${metrics(
   [
     ["Wickets", s.wickets],
     ["Overs", overs(s.bowling_balls)],
     ["Economy", n(s.economy)],
     ["Average", n(s.bowling_average)],
     ["Best figures", s.best ? s.best.wickets + "/" + s.best.conceded : "—"],
     ["3W hauls", s.three],
     ["5W hauls", s.five],
   ],
 )}</div>
 <p class="eyebrow" style="margin-top:28px">${t("Fielding")}</p><div class="grid cols3">${metrics(
   [
     ["Catches", s.catches],
     ["Run outs", s.run_outs],
     ["Stumpings", s.stumpings],
   ],
 )}</div>
 <p class="eyebrow" style="margin-top:28px">${t("Last five appearances")}</p><div class="row">${
   list
     .slice(0, 5)
     .map(
       (r) =>
         `<span class="form-badge" title="${e(
           local(
             S.matches.find((m) => m.id === r.match_id),
             "opponent",
           ),
         )}">${r.batted ? r.runs + (r.not_out ? "*" : "") : t("DNB")} · ${r.wickets}w</span>`,
     )
     .join("") || empty()
 }</div>`,
  );
  safeImages($("#modal"));
}
function scorecard(id) {
  const m = S.matches.find((m) => m.id === id);
  const list = S.stats.filter((s) => s.match_id === id);
  dialog(
    t("Scorecard"),
    `<p class="label">${date(m.starts_at)} · ${e(local(m, "venue"))}</p><div class="grid cols2"><div class="metric"><small>${e(local(S.config, "brand_name"))}</small><strong class="ltr">${score(m)}</strong><small>${overs(m.team_balls || 0)} ${t("Overs")}</small></div><div class="metric"><small>${e(local(m, "opponent"))}</small><strong class="ltr">${m.opponent_runs ?? "—"}/${m.opponent_wickets ?? "—"}</strong><small>${overs(m.opponent_balls || 0)} ${t("Overs")}</small></div></div><p style="margin:20px 0" class="note">${e(local(m, "summary"))}</p><p class="note">${t("Only permitted player figures are shown. Team totals may include restricted players.")}</p><div class="table-wrap"><table><thead><tr>${["Player", "Runs", "Balls", "Wickets", "Overs", "Conceded", "Catches", "Run outs", "Stumpings"].map((k) => "<th>" + t(k) + "</th>").join("")}</tr></thead><tbody>${list.map((r) => `<tr><td>${e(local(S.players.find((p) => p.id === r.player_id) || { name: "—" }, "name"))}</td><td>${r.batted ? r.runs + (r.not_out ? "*" : "") : t("DNB")}</td><td>${r.balls}</td><td>${r.wickets}</td><td>${overs(r.bowling_balls)}</td><td>${r.conceded}</td><td>${r.catches}</td><td>${r.run_outs}</td><td>${r.stumpings}</td></tr>`).join("") || '<tr><td colspan="9">' + t("No records yet") + "</td></tr>"}</tbody></table></div>`,
  );
}
function home() {
  const next = S.matches
    .filter(
      (m) => m.status === "upcoming" && new Date(m.starts_at) > new Date(),
    )
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0];
  const season =
    complete().sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))[0]
      ?.season || String(new Date().getFullYear());
  const leaders = S.players
    .filter((p) => canSeeStats(p.id))
    .map((p) => ({
      p,
      s: aggregate(rows(p.id, season)),
    }));
  const runs = leaders.slice().sort((a, b) => b.s.runs - a.s.runs)[0],
    wickets = leaders.slice().sort((a, b) => b.s.wickets - a.s.wickets)[0];
  main.innerHTML = `<section class="hero"><div class="wrap hero-grid"><div><p class="eyebrow">${t("One team. One standard.")}</p><h1>${e(local(S.config, "headline"))}</h1><p class="intro">${e(local(S.config, "subtitle"))}</p><div class="row">${flag("squad") ? button("Explore the squad", "squad.html") : ""}${flag("matches") ? '<a class="btn secondary" href="matches.html">' + t("View matches") + " →</a>" : ""}</div><div class="hero-foot"><span><strong>${S.players.filter((p) => p.status === "active").length}</strong>${t("Players")}</span><span><strong>${complete().length}</strong>${t("Matches")}</span><span><strong>${complete().filter((m) => m.result === "won").length}</strong>${t("Won")}</span></div></div><div><div class="crest">${flag("orbit") ? '<i class="orbit"></i><i class="orbit o2"></i><i class="orbit o3"></i>' : ""}${url(S.config.logo_url) ? `<img src="${e(url(S.config.logo_url))}" alt="${e(local(S.config, "brand_name"))}" width="330" height="330" fetchpriority="high">` : ""}</div><p class="crest-note">${e(local(S.config, "brand_name"))} · ${e(season)}</p></div></div></section>
 <section class="wrap section"><div class="grid cols2"><article class="panel"><div class="row between"><p class="eyebrow">${t("Next fixture")}</p><span class="badge">${next ? e(next.season) : "HM"}</span></div>${next ? `<h2>vs ${e(local(next, "opponent"))}</h2><p class="note">${e(local(next, "venue"))} · ${date(next.starts_at)}<br>${t("Toss")} · ${date(next.toss_at)}</p>${flag("countdown") ? '<div class="countdown" id="countdown"></div>' : ""}` : `<h3>${t("No fixture announced")}</h3><p class="note">${t("The next match will appear here once confirmed.")}</p>`}</article>
 ${
   flag("leaders")
     ? `<article class="panel"><p class="eyebrow">${t("Season leaders")} · ${e(season)}</p><p class="note">${t("Among visible player statistics")}</p><div class="grid cols2">${[
         ["Top run scorer", runs, "runs", "Runs"],
         ["Top wicket taker", wickets, "wickets", "Wickets"],
       ]
         .map(
           ([label, a, k, unit]) =>
             `<div><span class="label">${t(label)}</span><h3 style="margin:12px 0">${a && a.s[k] > 0 ? e(local(a.p, "name")) : t("Awaiting scorecards")}</h3><div class="result-score gold">${a ? n(a.s[k]) : "—"} <small>${t(unit)}</small></div></div>`,
         )
         .join("")}</div></article>`
     : ""
 }</div></section>
 <section class="wrap section"><div class="section-title"><div><p class="eyebrow">${t("Clubhouse")}</p><h2>${t("Our team, connected.")}</h2></div></div><div class="grid cols3">${[
   ["squad", "Squad", "Meet the Mitters.", "01"],
   ["moments", "Moments", "The moments we share.", "02"],
   ["social", "Social & media", "Stay in the loop.", "03"],
 ]
   .filter((x) => flag(x[0]))
   .map(
     ([key, label, sub, no]) =>
       `<a class="panel feature" href="${key}.html"><span class="label">${no} / ${t(label)}</span><h3 style="margin:28px 0 12px">${t(sub)}</h3><span class="text-btn">${t("Open link")} →</span></a>`,
   )
   .join("")}</div></section>`;
  if (next && flag("countdown")) {
    const update = () => {
      const v = Math.max(0, new Date(next.starts_at) - Date.now());
      $("#countdown").innerHTML = [
        ["Days", Math.floor(v / 864e5)],
        ["Hours", Math.floor(v / 36e5) % 24],
        ["Minutes", Math.floor(v / 6e4) % 60],
        ["Seconds", Math.floor(v / 1e3) % 60],
      ]
        .map(
          ([k, x]) =>
            `<div><strong>${String(x).padStart(2, "0")}</strong><small>${t(k)}</small></div>`,
        )
        .join("");
    };
    update();
    timer = setInterval(update, 1000);
  }
}
function squad() {
  main.innerHTML =
    head("Squad", "Meet the Mitters.") +
    `<section class="wrap section"><div class="toolbar"><input class="search" id="search" type="search" placeholder="${t("Search players")}" aria-label="${t("Search players")}"><select id="sort" aria-label="${t("Most runs")}"><option value="runs">${t("Most runs")}</option><option value="wickets">${t("Most wickets")}</option><option value="jersey">${t("Jersey number")}</option></select></div><div class="chips">${[
      ["all", "All"],
      ["batter", "Batters"],
      ["bowler", "Bowlers"],
      ["all_rounder", "All-rounders"],
      ["wicket_keeper", "Wicket keepers"],
    ]
      .map(
        ([k, v], i) =>
          `<button class="chip ${i === 0 ? "active" : ""}" data-role="${k}">${t(v)}</button>`,
      )
      .join("")}</div><div class="grid cols4" id="cards"></div></section>`;
  let role = "all";
  function draw() {
    const q = $("#search").value.toLowerCase(),
      sort = $("#sort").value;
    let list = S.players.filter(
      (p) =>
        (role === "all" || p.role === role) &&
        [p.name, p.name_ur, p.jersey].join(" ").toLowerCase().includes(q),
    );
    list.sort((a, b) =>
      sort === "jersey"
        ? a.jersey - b.jersey
        : aggregate(rows(b.id))[sort] - aggregate(rows(a.id))[sort],
    );
    $("#cards").innerHTML =
      list.map(playerCard).join("") ||
      empty(
        q ? "Nothing matches your search" : "No records yet",
        q ? "Try another search or filter." : undefined,
      );
    bindCards();
  }
  $("#search").oninput = draw;
  $("#sort").onchange = draw;
  $$("[data-role]").forEach(
    (b) =>
      (b.onclick = () => {
        role = b.dataset.role;
        $$("[data-role]").forEach((x) => x.classList.toggle("active", x === b));
        draw();
      }),
  );
  draw();
}
function matches() {
  main.innerHTML =
    head("Matches", "Fixtures & results.") +
    `<section class="wrap section"><div class="toolbar"><input id="search" type="search" placeholder="${t("Search matches")}" aria-label="${t("Search matches")}"><select id="status" aria-label="${t("Status")}">${["all", "upcoming", "completed", "abandoned"].map((s) => `<option value="${s}">${t(s === "all" ? "All" : s)}</option>`).join("")}</select></div><div class="grid cols2" id="cards"></div></section>`;
  function draw() {
    const q = $("#search").value.toLowerCase(),
      status = $("#status").value;
    const list = S.matches
      .filter(
        (m) =>
          (status === "all" || m.status === status) &&
          [m.opponent, m.opponent_ur, m.venue, m.venue_ur, m.season]
            .join(" ")
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
    $("#cards").innerHTML =
      list.map(matchCard).join("") ||
      empty(q ? "Nothing matches your search" : "No records yet");
    bindCards();
  }
  $("#search").oninput = draw;
  $("#status").onchange = draw;
  draw();
}
function stats() {
  const seasons = [...new Set(complete().map((m) => m.season))]
    .sort()
    .reverse();
  main.innerHTML =
    head("Stats", "Season & career.") +
    `<section class="wrap section"><div class="toolbar"><select id="season" aria-label="${t("Season")}"><option value="">${t("Career")}</option>${seasons.map((s) => `<option>${e(s)}</option>`).join("")}</select><input id="search" type="search" placeholder="${t("Search players")}" aria-label="${t("Search players")}"></div><div class="grid wide-stat" id="summary"></div><div class="section-title" style="margin-top:38px"><h2>${t("Players")}</h2></div><div class="table-wrap"><table><thead><tr>${["Player", "Played", "Runs", "Average", "Strike rate", "Wickets", "Economy", "Catches"].map((k) => "<th>" + t(k) + "</th>").join("")}</tr></thead><tbody id="leaderboard"></tbody></table></div></section>`;
  function draw() {
    const season = $("#season").value,
      q = $("#search").value.toLowerCase(),
      sum = seasonSummary(
        S.matches.filter((m) => !season || m.season === season),
      );
    $("#summary").innerHTML = metrics([
      ["Played", sum.played],
      ["Won", sum.won],
      ["Lost", sum.lost],
      ["Tied", sum.tied],
      ["No result", sum.no_result],
      ["Highest total", sum.highest],
      ["Lowest total", sum.lowest],
    ]);
    const list = S.players
      .filter((p) => canSeeStats(p.id))
      .filter((p) =>
        [p.name, p.name_ur, p.jersey].join(" ").toLowerCase().includes(q),
      )
      .map((p) => ({ p, s: aggregate(rows(p.id, season)) }))
      .sort((a, b) => b.s.runs - a.s.runs);
    $("#leaderboard").innerHTML =
      list
        .map(
          ({ p, s }) =>
            `<tr><td><button class="text-btn" data-player="${p.id}">${e(local(p, "name"))}</button></td><td>${s.matches}</td><td>${s.runs}</td><td>${n(s.average)}</td><td>${n(s.strike)}</td><td>${s.wickets}</td><td>${n(s.economy)}</td><td>${s.catches}</td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="8">' + t("No records yet") + "</td></tr>";
    bindCards();
  }
  $("#season").onchange = draw;
  $("#search").oninput = draw;
  draw();
}
function moments() {
  const media = S.media.filter((m) => m.kind === "moment"),
    categories = [...new Set(media.map((m) => m.category))];
  main.innerHTML =
    head("Moments", "The moments we share.") +
    `<section class="wrap section"><div class="toolbar"><input id="search" type="search" placeholder="${t("Search moments")}" aria-label="${t("Search moments")}"><select id="category" aria-label="${t("Category")}"><option value="">${t("All")}</option>${categories.map((c) => `<option value="${e(c)}">${e(t(c))}</option>`).join("")}</select></div><div class="grid cols3" id="cards"></div></section>`;
  function draw() {
    const q = $("#search").value.toLowerCase(),
      cat = $("#category").value;
    const list = media.filter(
      (m) =>
        (!cat || m.category === cat) &&
        [m.title, m.title_ur, m.description]
          .join(" ")
          .toLowerCase()
          .includes(q),
    );
    $("#cards").innerHTML =
      list
        .map(
          (m) =>
            `<button class="panel feature media-card" style="text-align:start;color:var(--text);cursor:pointer" data-moment="${m.id}"><img class="media-image" src="${e(url(m.url))}" alt="${e(local(m, "title"))}" loading="lazy"><span class="badge">${e(t(m.category))}</span><h3 style="margin-top:12px">${e(local(m, "title"))}</h3><p class="note">${e(local(m, "description"))}</p></button>`,
        )
        .join("") ||
      empty(q ? "Nothing matches your search" : "No records yet");
    $$("[data-moment]").forEach(
      (b) =>
        (b.onclick = () => {
          const m = media.find((x) => x.id === b.dataset.moment);
          dialog(
            local(m, "title"),
            `<img style="width:100%;max-height:65vh;object-fit:contain" src="${e(url(m.url))}" alt="${e(local(m, "title"))}"><p class="note">${e(local(m, "description"))}</p>`,
          );
        }),
    );
    safeImages();
  }
  $("#search").oninput = draw;
  $("#category").onchange = draw;
  draw();
}
export function videoMarkup(value) {
  const safe = url(value);
  if (!safe) return "";
  const u = new URL(safe);
  let id = "";
  if (u.hostname === "youtu.be") id = u.pathname.slice(1);
  if (["www.youtube.com", "youtube.com", "m.youtube.com"].includes(u.hostname))
    id =
      u.searchParams.get("v") ||
      u.pathname.match(/\/(?:shorts|embed)\/([^/]+)/)?.[1] ||
      "";
  if (/^[A-Za-z0-9_-]{11}$/.test(id))
    return `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${t("Video")}" loading="lazy" allow="fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  if (/\.(mp4|webm)$/i.test(u.pathname))
    return `<video src="${e(safe)}" controls preload="none" playsinline></video>`;
  return `<a class="btn secondary" href="${e(safe)}" target="_blank" rel="noopener noreferrer">${t("Watch")} →</a>`;
}
function social() {
  main.innerHTML =
    head("Social & media", "Stay in the loop.") +
    `<section class="wrap section"><div class="toolbar"><input type="search" id="search" placeholder="${t("Search media")}" aria-label="${t("Search media")}"></div><div id="media"></div></section>`;
  function draw() {
    const q = $("#search").value.toLowerCase();
    $("#media").innerHTML = [
      ["social", "sociallinks", "Follow the team"],
      ["audio", "audio", "Audio playlist"],
      ["video", "video", "Videos"],
    ]
      .filter((x) => flag(x[1]))
      .map(([kind, _, title]) => {
        const list = S.media.filter(
          (m) =>
            m.kind === kind &&
            [m.title, m.title_ur, m.description]
              .join(" ")
              .toLowerCase()
              .includes(q),
        );
        return `<div class="section"><h2>${t(title)}</h2><div class="grid cols3">${list.map((m) => `<article class="panel media-card">${m.thumbnail_url ? `<img class="media-image" loading="lazy" src="${e(url(m.thumbnail_url))}" alt="">` : ""}<h3>${e(local(m, "title"))}</h3><p class="note">${e(local(m, "description"))}</p>${kind === "audio" ? `<audio src="${e(url(m.url))}" controls preload="none"></audio>` : kind === "video" ? videoMarkup(m.url) : `<a class="btn secondary" href="${e(url(m.url))}" rel="noopener noreferrer" target="_blank">${t("Open link")} →</a>`}</article>`).join("") || empty()}</div></div>`;
      })
      .join("");
    safeImages();
    $$("audio,video").forEach(
      (el) =>
        (el.onplay = () =>
          $$("audio,video")
            .filter((x) => x !== el)
            .forEach((x) => x.pause())),
    );
  }
  $("#search").oninput = draw;
  draw();
}
function locationPage() {
  main.innerHTML =
    head("Location", "Our home. Our next stop.") +
    `<section class="wrap section"><div class="grid cols2"><article class="panel"><p class="eyebrow">${t("Team office · Haveli")}</p><div class="map-box"><div class="center"><h3>${e(local(S.config, "office_address") || t("Location is not configured yet."))}</h3>${url(S.config.office_map_url) ? `<a class="btn" href="${e(url(S.config.office_map_url))}" target="_blank" rel="noopener noreferrer">${t("Open in Maps")} →</a>` : ""}</div></div></article>${flag("live_location") ? '<article class="panel" id="live-location"></article>' : ""}</div></section>`;
  function draw() {
    const el = $("#live-location");
    if (!el) return;
    const loc = S.locations.find((l) => new Date(l.expires_at) > new Date());
    el.innerHTML = `<p class="eyebrow">${t("Current team location")}</p>${loc ? `<h3>${e(loc.label)}</h3><p class="note">${t("Updated")}: ${date(loc.updated_at)}<br>${t("Shared until")}: ${date(loc.expires_at)}</p><a class="btn" href="https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}" target="_blank" rel="noopener noreferrer">${t("Open in Maps")} →</a>` : empty("No location shared", "Location sharing has ended.")}`;
  }
  draw();
  timer = setInterval(async () => {
    try {
      S.locations = await all("location", true);
    } catch {}
    draw();
  }, 30000);
}
async function init() {
  await settings();
  shell();
  if ((page !== "home" && !flag(page)) || S.config.flags.maintenance) {
    main.innerHTML =
      head("Home", "Page unavailable") +
      `<div class="wrap">${empty("Page unavailable", "This page is currently turned off by the team.")}<p class="center" style="margin-top:20px"><a class="btn secondary" href="index.html">${t("Back home")}</a></p></div>`;
    return;
  }
  try {
    const needStats = ["home", "squad", "stats", "matches", "team"].includes(
      page,
    );
    [S.players, S.matches, S.stats, S.media, S.locations] = await Promise.all([
      needStats ? all("players", true) : [],
      needStats ? all("matches", true) : [],
      needStats ? all("stats") : [],
      ["moments", "social"].includes(page) ? all("media", true) : [],
      page === "location" ? all("location", true) : [],
    ]);
    await refreshReadableStats();
    await hydratePortraits(S.players);
    S.stats = S.stats.filter(
      (s) =>
        S.matches.some((m) => m.id === s.match_id && m.published) &&
        S.players.some((p) => p.id === s.player_id && p.published),
    );
    S.media.sort((a, b) => a.sort_order - b.sort_order);
    (
      ({
        home,
        team,
        squad,
        matches,
        stats,
        moments,
        social,
        location: locationPage,
      })[page] || home
    )();
    safeImages();
    if (page === "home" && flag("live"))
      main.insertAdjacentHTML(
        "afterbegin",
        `<div class="wrap live-entry"><a href="live.html" class="live-pill"><span class="pulse-dot"></span>${t("Live match")} →</a></div>`,
      );
    if (S.loadError)
      main.insertAdjacentHTML(
        "afterbegin",
        `<div class="wrap error-banner">${t("Team updates are temporarily unavailable. Please try again.")}</div>`,
      );
  } catch {
    main.innerHTML = `<div class="wrap page-head">${empty("Team updates are temporarily unavailable. Please try again.", "")}</div>`;
  }
}
window.addEventListener("pagehide", () => clearInterval(timer));
if (page !== "player") init();

function team() {
  const list = S.players
    .filter((p) => p.status === "active")
    .sort((a, b) => a.display_order - b.display_order || a.jersey - b.jersey);
  const captain = list.find((p) => p.leadership === "captain");
  const card = (p, large = false) =>
    `<article class="panel team-card ${large ? "captain-card" : ""}"><div class="team-portrait">${photo(p)}<span class="jersey">#${p.jersey}</span></div><div class="team-caption"><span class="eyebrow">${t(large ? "Captain" : p.leadership === "vice_captain" ? "Vice captain" : p.role)}</span><h${large ? "2" : "3"}>${e(local(p, "name"))}</h${large ? "2" : "3"}><p class="note">${t(p.role)} · #${p.jersey}</p><button class="text-btn" data-player="${p.id}">${t("View profile")} →</button></div></article>`;
  main.innerHTML =
    head(
      "Our team",
      "One team. One standard.",
      "The captain. The players. The Mitters.",
    ) +
    `<section class="wrap section">${captain ? card(captain, true) : ""}<div class="section-title"><h2>${t("Full squad")}</h2><span class="badge">${list.length} ${t("Players")}</span></div><div class="grid cols4">${
      list
        .filter((p) => p.id !== captain?.id)
        .map((p) => card(p))
        .join("") || (!captain ? empty() : "")
    }</div><p class="note">${t("The full squad may include more than eleven players. Match lineups appear on Live match.")}</p></section>`;
  bindCards();
}
let policyTimer;
if (db() && page !== "player") {
  let stamp = null;
  const check = async () => {
    if (document.hidden) return;
    try {
      const next = await api(db().rpc("hm_policy_stamp"));
      if (stamp !== null && stamp !== next) {
        clearPortraits();
        S.players = [];
        S.stats = [];
        const d = $("#modal");
        if (d?.open) d.close();
        if (d) d.innerHTML = "";
        location.reload();
      }
      stamp = next;
    } catch {}
  };
  check();
  policyTimer = setInterval(check, 15000);
  const identityChanged = sessionIdentityChanged();
  let authReloadQueued = false;
  db().auth.onAuthStateChange((event, session) => {
    if (identityChanged(event, session) && !authReloadQueued) {
      authReloadQueued = true;
      clearPortraits();
      S.players = [];
      S.stats = [];
      const modal = $("#modal");
      if (modal?.open) modal.close();
      if (modal) modal.innerHTML = "";
      main.innerHTML = "";
      setTimeout(() => location.reload(), 0);
    }
  });
  window.addEventListener("pagehide", () => clearInterval(policyTimer));
}
