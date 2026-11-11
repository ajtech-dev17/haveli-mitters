import { mountScoring } from "./scoring.js";
import { appearancePanel, playerAccessPanel } from "./admin-v3.js";
import {
  S,
  $,
  $$,
  t,
  e,
  n,
  local,
  url,
  date,
  db,
  api,
  all,
  toast,
  themeButtons,
  bindCommon,
  brand,
  dialog,
  empty,
  defaults,
  upload,
  uploadPortrait,
  applyPreferences,
} from "./core.js";
import { overs, toBalls, seasonSummary } from "./stats.js";
let stopExtra = null;
let tab = "overview",
  members = [],
  dirty = false,
  geoWatch = null,
  geoExpiry = 0,
  geoLast = 0;
const sections = [
  ["overview", "Dashboard"],
  ["players", "Players"],
  ["matches", "Matches"],
  ["live", "Live scoring"],
  ["player_access", "Player access"],
  ["appearance", "Appearance"],
  ["moments", "Gallery"],
  ["media", "Media & social"],
  ["controls", "Site controls"],
  ["location", "Location"],
  ["access", "Team access"],
  ["account", "My account"],
];
const formSchemas = {
  players: [
    ["name", "Full name", "text", true],
    ["name_ur", "Name (Urdu)"],
    ["jersey", "Jersey number", "number", true],
    [
      "role",
      "Role",
      "select",
      ["batter", "bowler", "all_rounder", "wicket_keeper"],
    ],
    ["batting_style", "Batting style"],
    ["batting_style_ur", "Batting style (Urdu)"],
    ["bowling_style", "Bowling style"],
    ["bowling_style_ur", "Bowling style (Urdu)"],
    ["photo_url", "Photo URL", "url"],
    ["status", "Status", "select", ["active", "retired", "removed"]],
    [
      "leadership",
      "Leadership",
      "select",
      ["player", "captain", "vice_captain"],
    ],
    ["display_order", "Display order", "number"],
    [
      "profile_visibility",
      "Profile visibility",
      "select",
      ["inherit", "public", "private"],
    ],
    [
      "stats_visibility",
      "Stats visibility",
      "select",
      ["inherit", "public", "private"],
    ],
  ],
  media: [
    ["kind", "Kind", "select", ["moment", "audio", "video", "social"]],
    ["title", "Title", "text", true],
    ["title_ur", "Title (Urdu)"],
    ["description", "Description", "textarea"],
    ["description_ur", "Description (Urdu)", "textarea"],
    ["category", "Category", "category"],
    ["url", "URL", "url", true],
    ["thumbnail_url", "Thumbnail URL", "url"],
    ["sort_order", "Sort order", "number"],
  ],
  matches: [
    ["audience", "Match audience", "select", ["public", "team", "admin"]],
    ["opponent", "Opponent", "text", true],
    ["opponent_ur", "Opponent (Urdu)"],
    ["venue", "Venue"],
    ["venue_ur", "Venue (Urdu)"],
    ["starts_at", "Date & time (your timezone)", "datetime-local", true],
    ["toss_at", "Toss time", "datetime-local"],
    ["season", "Season", "text", true],
    ["status", "Status", "select", ["upcoming", "completed", "abandoned"]],
    ["result", "Result", "select", ["", "won", "lost", "tied", "no_result"]],
    ["team_runs", "Team runs", "number"],
    ["team_wickets", "Team wickets", "number"],
    ["team_overs", "Team overs"],
    ["opponent_runs", "Opponent runs", "number"],
    ["opponent_wickets", "Opponent wickets", "number"],
    ["opponent_overs", "Opponent overs"],
    ["summary", "Summary", "textarea"],
    ["summary_ur", "Summary (Urdu)", "textarea"],
  ],
};
function localDate(v) {
  if (!v) return "";
  const d = new Date(v);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function field([key, label, type = "text", options = false], data) {
  let value = data[key] ?? (type === "number" ? 0 : "");
  if (type === "datetime-local") value = localDate(value);
  const opts =
    type === "category"
      ? (S.config.gallery_categories || defaults.gallery_categories)
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : options;
  const input =
    type === "checkbox"
      ? `<input type="checkbox" class="switch" name="${key}" ${value ? "checked" : ""}>`
      : type === "select" || type === "category"
        ? `<select name="${key}" class="full">${[...new Set([...(Array.isArray(opts) ? opts : []), ...(type === "category" && value ? [value] : [])])].map((v) => `<option value="${e(v)}" ${value === v ? "selected" : ""}>${v ? e(t(v)) : "—"}</option>`).join("")}</select>`
        : type === "textarea"
          ? `<textarea name="${key}" rows="3">${e(value)}</textarea>`
          : `<input name="${key}" type="${type}" value="${e(value)}" ${options === true ? "required" : ""} ${type === "number" ? 'min="0" step="1"' : ""}>`;
  return `<label class="field ${type === "textarea" ? "full" : ""}"><span>${t(label)}</span>${input}</label>`;
}
async function reload() {
  [S.players, S.matches, S.stats, S.media, S.locations] = await Promise.all([
    all("players"),
    all("matches"),
    all("stats"),
    all("media"),
    all("location"),
  ]);
}
export async function start(list) {
  members = list;
  await reload();
  $("#main").innerHTML =
    `<div class="admin-layout"><aside class="admin-sidebar">${brand()}<nav class="admin-nav">${sections.map(([key, label]) => `<button data-tab="${key}" class="${key === tab ? "active" : ""}">${t(label)}</button>`).join("")}</nav><div class="admin-bottom"><a class="btn secondary" href="index.html" target="_blank" rel="noopener">${t("Open public site")} →</a><button class="btn secondary" data-signout>${t("Sign out")}</button></div></aside><div class="admin-body"><header class="admin-top"><div><span class="label">${t("Captain’s desk")}</span><h2 id="admin-title">${t("Dashboard")}</h2></div><div class="actions">${themeButtons()}<button class="icon-btn" data-signout title="${t("Sign out")}">↪</button></div></header><div class="admin-content" id="content"></div></div></div>`;
  bindCommon();
  $$("[data-signout]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (dirty && !confirm(t("Cancel") + "?")) return;
        stopGeo(false);
        await db().auth.signOut();
        location.replace("admin.html");
      }),
  );
  $$("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        if (dirty && !confirm(t("Discard unsaved changes?"))) return;
        dirty = false;
        if (tab === "location") stopGeo(false);
        tab = b.dataset.tab;
        $$("[data-tab]").forEach((x) => x.classList.toggle("active", x === b));
        render();
        window.scrollTo({ top: 0 });
      }),
  );
  render();
}
function render() {
  stopExtra?.();
  stopExtra = null;
  $("#admin-title").textContent = t(sections.find((s) => s[0] === tab)[1]);
  if (tab === "overview") overview();
  else if (["players", "matches", "moments", "media"].includes(tab))
    collection();
  else if (tab === "live") stopExtra = mountScoring($("#content"));
  else if (tab === "player_access") playerAccessPanel($("#content"));
  else if (tab === "appearance") appearancePanel($("#content"));
  else if (tab === "controls") controls();
  else if (tab === "location") locationEditor();
  else if (tab === "access") access();
  else account();
}
function overview() {
  const sum = seasonSummary(S.matches.filter((m) => m.published));
  $("#content").innerHTML = `<div class="grid cols3">${[
    ["Players", S.players.length],
    ["Played", sum.played],
    ["Won", sum.won],
    ["Gallery", S.media.filter((m) => m.kind === "moment").length],
    [
      "Draft",
      S.media.filter((m) => !m.published).length +
        S.matches.filter((m) => !m.published).length +
        S.players.filter((p) => !p.published).length,
    ],
    ["Admin", members.length + "/2"],
  ]
    .map(
      ([k, v]) =>
        `<div class="metric"><small>${t(k)}</small><strong>${v}</strong></div>`,
    )
    .join(
      "",
    )}</div><section class="admin-card" style="margin-top:25px"><p class="eyebrow">${t("One team. One standard.")}</p><h2>${e(local(S.config, "brand_name"))}</h2><p class="note">${t("Only approved team admins can enter.")}</p><div class="row"><a href="index.html" target="_blank" rel="noopener" class="btn">${t("Open public site")} →</a><button class="btn secondary" id="backup">${t("Export backup")}</button></div></section>`;
  $("#backup").onclick = async (ev) => {
    const button = ev.currentTarget;
    button.disabled = true;
    try {
      const backup = await api(db().rpc("hm_export_content"));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        }),
      );
      a.download =
        "haveli-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (err) {
      toast(err.message, true);
    } finally {
      button.disabled = false;
    }
  };
}
function collection() {
  const table = tab === "moments" || tab === "media" ? "media" : tab;
  const items =
    table === "media"
      ? S.media.filter((m) =>
          tab === "moments" ? m.kind === "moment" : m.kind !== "moment",
        )
      : S[table];
  $("#content").innerHTML =
    `<div class="toolbar"><input id="admin-search" type="search" placeholder="${t("Search records")}" aria-label="${t("Search records")}"><select id="publication" aria-label="${t("Status")}"><option value="">${t("All")}</option><option value="live">${t("Published")}</option><option value="draft">${t("Draft")}</option></select><button class="btn" id="add">${t(tab === "players" ? "Add player" : tab === "matches" ? "Add match" : tab === "moments" ? "Add moment" : "Add media")} +</button></div><div class="admin-card" id="records"></div>`;
  function draw() {
    const q = $("#admin-search").value.toLowerCase(),
      pub = $("#publication").value;
    const list = items.filter(
      (x) =>
        JSON.stringify(x).toLowerCase().includes(q) &&
        (!pub || x.published === (pub === "live")),
    );
    $("#records").innerHTML = list.length
      ? `<div class="table-wrap"><table><thead><tr><th>${t("Name")}</th><th>${t("Status")}</th><th>${t("Date")}</th><th>${t("Edit")}</th></tr></thead><tbody>${list.map((x) => `<tr><td><strong>${e(local(x, table === "players" ? "name" : table === "matches" ? "opponent" : "title"))}</strong><br><small>${e(table === "players" ? "#" + x.jersey + " · " + t(x.role) : table === "matches" ? x.season + " · " + t(x.status) : t(x.kind) + " · " + t(x.category))}</small></td><td><span class="badge">${t(x.published ? "Published" : "Draft")}</span></td><td>${date(x.starts_at || x.created_at, true)}</td><td><button class="text-btn" data-edit="${x.id}">${t("Edit")} →</button></td></tr>`).join("")}</tbody></table></div>`
      : empty(q ? "Nothing matches your search" : "No records yet");
    $$("[data-edit]").forEach(
      (b) =>
        (b.onclick = () =>
          editor(
            table,
            items.find((x) => x.id === b.dataset.edit),
          )),
    );
  }
  $("#admin-search").oninput = draw;
  $("#publication").onchange = draw;
  $("#add").onclick = () =>
    editor(table, {
      kind: tab === "moments" ? "moment" : "audio",
      role: "batter",
      status: table === "players" ? "active" : "upcoming",
      season: String(new Date().getFullYear()),
    });
  draw();
}
function editor(table, record) {
  const data = { ...record };
  if (table === "matches") {
    data.team_overs = data.team_balls == null ? "" : overs(data.team_balls);
    data.opponent_overs =
      data.opponent_balls == null ? "" : overs(data.opponent_balls);
  }
  const modal = $("#modal");
  modal.innerHTML = `<div class="dialog-head"><h3>${t("Edit")} · ${t(table === "media" ? "Media & social" : table === "players" ? "Players" : "Matches")}</h3><button class="icon-btn" id="cancel-editor" aria-label="${t("Close")}">×</button></div><form id="record-form" class="editor-form"><div class="editor-scroll"><div class="form-grid">${formSchemas[table].map((f) => field(f, data)).join("")}</div>${table !== "matches" ? `<label class="field"><span>${t("Upload file")}</span><input id="asset-file" type="file" accept="${table === "players" ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,audio/*,video/mp4,video/webm"}"></label><p class="note">${t("Upload file")}: JPG/PNG/WebP ≤ 5 MB · audio ≤ 20 MB · video ≤ 40 MB</p>` : `<h3>${t("Player scorecard")}</h3><p class="note">${t("Played")} ✓ · ${t("Batted")} ✓ · ${t("Overs")}: 3.4 = 22 balls</p><div class="table-wrap score-scroll"><table class="score-editor"><thead><tr>${["Player", "Played", "Batted", "Runs", "Balls", "Fours", "Sixes", "Wickets", "Overs", "Conceded", "Catches", "Run outs", "Stumpings", "Not out"].map((k) => "<th>" + t(k) + "</th>").join("")}</tr></thead><tbody>${scoreRows(record)}</tbody></table></div>`}</div><div class="form-actions">${record.id ? `<button type="button" class="btn danger" id="delete-record">${t("Delete")}</button>` : ""}<button type="submit" name="intent" value="draft" class="btn secondary">${t("Save draft")}</button><button type="submit" name="intent" value="publish" class="btn">${t("Publish")}</button></div></form>`;
  if (table === "players" && (record.photo_path || record.photo_url)) {
    $(".editor-scroll", modal).insertAdjacentHTML(
      "beforeend",
      `<label class="toggle-row"><span>${t("Remove current player photo")}</span><input type="checkbox" name="remove_photo"></label>`,
    );
  }
  let edited = false;
  modal.showModal();
  $("#record-form").oninput = () => (edited = true);
  const cancel = () => {
    if (!edited || confirm(t("Discard unsaved changes?"))) modal.close();
  };
  $("#cancel-editor").onclick = cancel;
  modal.oncancel = (ev) => {
    if (edited && !confirm(t("Discard unsaved changes?"))) ev.preventDefault();
  };
  $("#asset-file")?.addEventListener("change", () => {
    const input = $(
      '[name="' + (table === "players" ? "photo_url" : "url") + '"]',
      modal,
    );
    if (input) input.required = false;
  });
  $("#delete-record")?.addEventListener("click", async () => {
    if (
      !confirm(
        t(
          "Delete this record? Match scorecard rows are deleted with the match. For a player with history, use Removed status instead.",
        ),
      )
    )
      return;
    try {
      await api(
        db()
          .from("hm_" + table)
          .delete()
          .eq("id", record.id),
      );
      modal.close();
      await reload();
      render();
      toast(t("Saved."));
    } catch (err) {
      toast(err.message, true);
    }
  });
  $("#record-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget,
      published = ev.submitter?.value === "publish";
    if (
      record.published &&
      !published &&
      !confirm(t("Save as draft and remove this record from the public site?"))
    )
      return;
    const buttons = $$("button", f);
    buttons.forEach((b) => (b.disabled = true));
    try {
      const payload = {};
      for (const [key, label, type] of formSchemas[table]) {
        let v = new FormData(f).get(key);
        payload[key] =
          v === ""
            ? null
            : type === "number"
              ? Number(v)
              : type === "datetime-local"
                ? new Date(v).toISOString()
                : v;
      }
      payload.published = published;
      if (table === "matches") {
        payload.team_balls =
          payload.team_overs === null ? null : toBalls(payload.team_overs);
        payload.opponent_balls =
          payload.opponent_overs === null
            ? null
            : toBalls(payload.opponent_overs);
        delete payload.team_overs;
        delete payload.opponent_overs;
        if (payload.status === "upcoming") payload.result = null;
        const statistics = $$("[data-score-row]", f)
          .filter((row) => $("[data-key=played]", row).checked)
          .map((row) => {
            const r = { player_id: row.dataset.scoreRow };
            for (const k of ["batted", "not_out"])
              r[k] = $("[data-key=" + k + "]", row).checked;
            for (const k of [
              "runs",
              "balls",
              "fours",
              "sixes",
              "wickets",
              "conceded",
              "catches",
              "run_outs",
              "stumpings",
            ])
              r[k] = Number($("[data-key=" + k + "]", row).value || 0);
            r.bowling_balls = toBalls(
              $("[data-key=bowling_overs]", row).value || "0",
            );
            return r;
          });
        if (
          payload.status === "completed" &&
          !statistics.length &&
          payload.result !== "no_result"
        )
          throw Error(
            t(
              "Mark the players who played before publishing a completed match.",
            ),
          );
        await api(
          db().rpc("hm_save_match", {
            p_id: record.id || null,
            p_revision: record.revision || 0,
            p_match: payload,
            p_stats: statistics,
          }),
        );
      } else {
        const file = $("#asset-file").files[0];
        if (file) toast(t("Please wait…"));
        if (table === "players") {
          payload.id = record.id || crypto.randomUUID();
          if (new FormData(f).get("remove_photo") === "on") {
            payload.photo_path = null;
            payload.photo_url = null;
          }
          if (file) {
            payload.photo_path = await uploadPortrait(file, payload.id);
            payload.photo_url = null;
          } else if (
            payload.photo_url &&
            payload.photo_url !== record.photo_url
          )
            payload.photo_path = null;
        } else if (file) payload.url = await upload(file);
        if (table === "media" && !url(payload.url))
          throw Error(t("Add a valid https URL or upload a file."));
        for (const k of ["photo_url", "thumbnail_url"])
          if (payload[k] && !url(payload[k])) throw Error(t("Invalid URL"));
        await api(
          record.id
            ? db()
                .from("hm_" + table)
                .update(payload)
                .eq("id", record.id)
            : db()
                .from("hm_" + table)
                .insert(payload),
        );
      }
      edited = false;
      modal.close();
      await reload();
      render();
      toast(t(published ? "Published." : "Saved."));
    } catch (err) {
      toast(err.message, true);
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  };
}
function scoreRows(match) {
  return S.players
    .filter(
      (p) =>
        p.status !== "removed" ||
        S.stats.some((s) => s.match_id === match.id && s.player_id === p.id),
    )
    .map((p) => {
      const r =
        S.stats.find((s) => s.match_id === match.id && s.player_id === p.id) ||
        {};
      const check = (k, val) =>
        `<td><input type="checkbox" data-key="${k}" ${val ? "checked" : ""} aria-label="${e(p.name + " " + k)}"></td>`;
      const num = (k) =>
        `<td><input type="number" min="0" step="1" data-key="${k}" value="${r[k] || 0}" aria-label="${e(p.name + " " + k)}"></td>`;
      return `<tr data-score-row="${p.id}"><td>${e(local(p, "name"))}</td>${check("played", r.player_id)}${check("batted", r.batted)}${["runs", "balls", "fours", "sixes", "wickets"].map(num).join("")}<td><input data-key="bowling_overs" value="${overs(r.bowling_balls || 0)}" aria-label="${e(p.name + " overs")}"></td>${["conceded", "catches", "run_outs", "stumpings"].map(num).join("")}${check("not_out", r.not_out)}</tr>`;
    })
    .join("");
}
const configGroups = [
  [
    "Brand & homepage",
    [
      ["brand_name", "Team name", "text", true],
      ["brand_name_ur", "Team name (Urdu)"],
      ["headline", "Hero headline"],
      ["headline_ur", "Hero headline (Urdu)"],
      ["subtitle", "Hero subtitle", "textarea"],
      ["subtitle_ur", "Hero subtitle (Urdu)", "textarea"],
      ["logo_url", "Logo URL"],
      ["default_theme", "Default theme", "select", ["dark", "light"]],
      ["default_language", "Default language", "select", ["en", "ur"]],
      ["timezone", "Timezone"],
    ],
  ],
  [
    "Office & gallery",
    [
      ["office_address", "Office address"],
      ["office_address_ur", "Office address (Urdu)"],
      ["office_map_url", "Office Maps URL", "url"],
      ["gallery_categories", "Gallery categories"],
    ],
  ],
  [
    "Privacy defaults",
    [
      [
        "profile_default",
        "Default profile visibility",
        "select",
        ["public", "private"],
      ],
      [
        "stats_default",
        "Default stats visibility",
        "select",
        ["public", "private"],
      ],
      [
        "force_private",
        "Force all player profiles and stats private",
        "checkbox",
      ],
    ],
  ],
];
const features = [
  ...sections
    .filter((x) => ["players", "matches"].includes(x[0]))
    .map(([k, v]) => [k === "players" ? "squad" : k, v]),
  ["stats", "Stats"],
  ["moments", "Moments"],
  ["social", "Social & media"],
  ["location", "Location"],
  ["countdown", "Countdown"],
  ["leaders", "Leader cards"],
  ["orbit", "Rotating circles"],
  ["audio", "Audio"],
  ["video", "Video"],
  ["sociallinks", "Social links"],
  ["live_location", "Live location"],
  ["team", "Our team"],
  ["live", "Live scoring and viewer"],
  ["player", "Player login"],
  ["back_to_top", "Back to top"],
  ["theme_switch", "Theme switch"],
  ["language_switch", "Language switch"],
  ["maintenance", "Maintenance mode"],
];
async function controls() {
  let draft = S.config;
  try {
    const r = await api(
      db().from("hm_settings_drafts").select("*").eq("id", 1).maybeSingle(),
    );
    if (r)
      draft = {
        ...S.config,
        ...r.config,
        flags: { ...S.config.flags, ...r.config.flags },
      };
  } catch {}
  if (tab !== "controls") return;
  $("#content").innerHTML =
    `<form id="settings-form"><div class="savebar"><span class="note">${t("Site controls")}</span><button class="btn secondary" type="submit" value="draft">${t("Save draft")}</button><button class="btn" type="submit" value="publish">${t("Publish")}</button></div>${configGroups.map(([title, fields]) => `<section class="admin-card"><h3>${t(title)}</h3><div class="form-grid">${fields.map((f) => field(f, draft)).join("")}</div>${title === "Brand & homepage" ? `<label class="field"><span>${t("Upload file")} · ${t("Logo URL")}</span><input id="logo-file" type="file" accept="image/png,image/jpeg,image/webp"></label>` : ""}</section>`).join("")}<section class="admin-card"><h3>${t("Pages & features")}</h3><input id="toggle-search" type="search" placeholder="${t("Search records")}" aria-label="${t("Search records")}">${features.map(([k, label]) => `<label class="toggle-row" data-toggle-label="${e(t(label).toLowerCase())}"><span><strong>${t(label)}</strong></span><input type="checkbox" class="switch" name="flag_${k}" ${draft.flags[k] ? "checked" : ""} aria-label="${t(label)}"></label>`).join("")}</section></form>`;
  $("#settings-form").oninput = (ev) => {
    if (ev.target.id !== "toggle-search") dirty = true;
  };
  $("#toggle-search").oninput = (ev) =>
    $$("[data-toggle-label]").forEach(
      (r) =>
        (r.hidden = !r.dataset.toggleLabel.includes(
          ev.target.value.toLowerCase(),
        )),
    );
  $("#settings-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget,
      buttons = $$("button", f);
    buttons.forEach((b) => (b.disabled = true));
    try {
      const payload = { ...draft, flags: { ...draft.flags } },
        data = new FormData(f);
      configGroups.forEach(([, fields]) =>
        fields.forEach(
          ([k, _, type]) =>
            (payload[k] =
              type === "checkbox"
                ? data.get(k) === "on"
                : data.get(k)?.trim() || ""),
        ),
      );
      new Intl.DateTimeFormat("en", { timeZone: payload.timezone });
      features.forEach(
        ([k]) => (payload.flags[k] = data.get("flag_" + k) === "on"),
      );
      const file = $("#logo-file").files[0];
      if (file) toast(t("Please wait…"));
      if (file) payload.logo_url = await upload(file);
      if (!url(payload.logo_url)) throw Error(t("Choose a valid logo URL."));
      await api(
        db().from("hm_settings_drafts").upsert({
          id: 1,
          config: payload,
          updated_at: new Date().toISOString(),
        }),
      );
      if (ev.submitter.value === "publish") {
        S.revision = await api(
          db().rpc("hm_publish_settings", {
            p_revision: S.revision,
            p_config: payload,
          }),
        );
        S.config = payload;
        applyPreferences();
        toast(t("Published."));
      } else toast(t("Saved."));
      draft = payload;
      dirty = false;
    } catch (err) {
      toast(err.message, true);
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  };
}
function locationEditor() {
  const loc = S.locations[0] || {};
  $("#content").innerHTML =
    `<section class="admin-card"><h3>${t("Current team location")}</h3><p class="note">${t("This device location will be public until expiry.")}</p><form id="location-form"><div class="form-grid">${[
      ["label", "Location label"],
      ["latitude", "Latitude", "text", true],
      ["longitude", "Longitude", "text", true],
      ["minutes", "Expiry in minutes", "number", true],
    ]
      .map((f) =>
        field(f, {
          label: loc.label || "Team location",
          latitude: loc.latitude ?? "",
          longitude: loc.longitude ?? "",
          minutes: 60,
        }),
      )
      .join(
        "",
      )}</div><div class="row"><button class="btn">${t("Publish location")}</button><button type="button" class="btn secondary" id="device">${t("Share device location")}</button><button type="button" class="btn secondary" id="watch">${t("Start live sharing")}</button><button type="button" class="btn danger" id="stop">${t("Stop sharing")}</button></div></form><p class="note" id="geo-status" style="margin-top:18px">${loc.expires_at ? t("Shared until") + ": " + date(loc.expires_at) : t("No location shared")}</p></section>`;
  const form = $("#location-form");
  const duration = () => {
    const minutes = Number(new FormData(form).get("minutes"));
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240)
      throw Error(t("Choose 1–240 minutes."));
    return minutes;
  };
  const save = async (lat, lon, expires) => {
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      throw Error(t("Invalid coordinates"));
    const record = {
      id: 1,
      label: new FormData(form).get("label") || "Team location",
      latitude: lat,
      longitude: lon,
      expires_at: new Date(expires).toISOString(),
      updated_at: new Date().toISOString(),
    };
    await api(db().from("hm_location").upsert(record));
    S.locations = [record];
    if ($("#geo-status"))
      $("#geo-status").textContent = t("Shared until") + ": " + date(expires);
  };
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    try {
      stopGeo(false);
      await save(
        Number(new FormData(form).get("latitude")),
        Number(new FormData(form).get("longitude")),
        Date.now() + duration() * 60000,
      );
      toast(t("Published."));
    } catch (err) {
      toast(err.message, true);
    }
  };
  const coords = (p) => {
    form.elements.latitude.value = p.coords.latitude.toFixed(6);
    form.elements.longitude.value = p.coords.longitude.toFixed(6);
  };
  $("#device").onclick = () => {
    if (!navigator.geolocation)
      return toast(t("Geolocation requires HTTPS and browser support."), true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        coords(p);
        toast(t("Save changes"));
      },
      (err) => toast(err.message, true),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  $("#watch").onclick = () => {
    try {
      if (!navigator.geolocation) throw Error(t("Geolocation unavailable"));
      const mins = duration();
      if (!confirm(t("This device location will be public until expiry.")))
        return;
      stopGeo(false);
      geoExpiry = Date.now() + mins * 60000;
      geoLast = 0;
      geoWatch = navigator.geolocation.watchPosition(
        async (p) => {
          if (Date.now() >= geoExpiry) {
            stopGeo(false);
            return;
          }
          if (Date.now() - geoLast < 60000) return;
          geoLast = Date.now();
          coords(p);
          try {
            await save(p.coords.latitude, p.coords.longitude, geoExpiry);
          } catch (err) {
            stopGeo(false);
            toast(err.message, true);
          }
        },
        (err) => {
          stopGeo(false);
          toast(err.message, true);
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 },
      );
      toast(t("Start live sharing"));
    } catch (err) {
      toast(err.message, true);
    }
  };
  $("#stop").onclick = () => stopGeo(true);
}
function stopGeo(remove) {
  if (geoWatch !== null) {
    navigator.geolocation.clearWatch(geoWatch);
    geoWatch = null;
  }
  if (remove)
    api(db().from("hm_location").delete().eq("id", 1))
      .then(() => {
        S.locations = [];
        $("#geo-status") &&
          ($("#geo-status").textContent = t("No location shared"));
        toast(t("Saved."));
      })
      .catch((err) => toast(err.message, true));
}
async function access() {
  members = await api(db().rpc("hm_members"));
  if (tab !== "access") return;
  $("#content").innerHTML =
    `<section class="admin-card"><h3>${t("Team access")} · ${members.length}/2</h3><div class="table-wrap"><table><thead><tr><th>${t("Display name")}</th><th>${t("Email")}</th><th>${t("Role")}</th><th>${t("Edit")}</th></tr></thead><tbody>${members.map((m) => `<tr><td>${e(m.display_name || "—")}</td><td class="ltr">${e(m.email)}</td><td>${t(m.role === "owner" ? "Owner" : "Admin")}</td><td>${S.role === "owner" && m.user_id !== S.user.id ? `<button class="text-btn" data-remove="${m.user_id}">${t("Remove access")}</button>` : "—"}</td></tr>`).join("")}</tbody></table></div></section>${
      S.role === "owner"
        ? `<section class="admin-card"><h3>${t("Invite second admin")}</h3><form id="invite-form"><label class="field"><span>${t("Email")}</span><input name="email" type="email" required></label><button class="btn">${t("Create invitation link")}</button></form><p id="invite-link" class="note ltr" style="overflow-wrap:anywhere;margin-top:18px"></p></section><section class="admin-card"><h3>${t("Transfer ownership")}</h3><form id="transfer-form"><label class="field"><span>${t("Admin")}</span><select name="user" required><option value="">—</option>${members
            .filter((m) => m.user_id !== S.user.id)
            .map((m) => `<option value="${m.user_id}">${e(m.email)}</option>`)
            .join(
              "",
            )}</select></label><label class="toggle-row"><span>${t("Leave after handover")}</span><input name="leave" type="checkbox" checked></label><button class="btn" style="margin-top:18px">${t("Transfer ownership")}</button></form></section>`
        : ""
    }`;
  $$("[data-remove]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (!confirm(t("Remove access") + "?")) return;
        try {
          await api(db().rpc("hm_remove_admin", { p_user: b.dataset.remove }));
          access();
        } catch (err) {
          toast(err.message, true);
        }
      }),
  );
  $("#invite-form")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const token = await api(
        db().rpc("hm_create_invite", {
          p_email: new FormData(ev.currentTarget).get("email"),
        }),
      );
      const u = new URL("account.html", location.href);
      u.searchParams.set("invite", token);
      $("#invite-link").textContent = u.href;
      toast(
        t(
          "Copy this invitation link and share it with that admin. Valid for 48 hours.",
        ),
      );
    } catch (err) {
      toast(err.message, true);
    }
  });
  $("#transfer-form")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    if (
      !confirm(
        t("Transfer owner permissions to the selected admin?") +
          " " +
          (f.get("leave") ? t("Your admin access will be removed.") : ""),
      )
    )
      return;
    try {
      await api(
        db().rpc("hm_transfer_owner", {
          p_user: f.get("user"),
          p_leave: f.get("leave") === "on",
        }),
      );
      location.reload();
    } catch (err) {
      toast(err.message, true);
    }
  });
}
function account() {
  $("#content").innerHTML =
    `<section class="admin-card"><h3>${t("My account")}</h3><p class="note ltr">${e(S.user.email)}</p><form id="account-form"><div class="form-grid">${field(["display_name", "Display name"], { display_name: S.user.user_metadata?.display_name || "" })}${field(["email", "New email", "email"], {})}${field(["password", "New password", "password"], {})}</div><button class="btn">${t("Update account")}</button></form></section>`;
  $("#account-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    try {
      const f = new FormData(form),
        payload = { data: { display_name: f.get("display_name") } };
      if (f.get("email")) payload.email = f.get("email");
      if (f.get("password")) {
        if (f.get("password").length < 10)
          throw Error(t("Use at least 10 characters."));
        payload.password = f.get("password");
      }
      await api(db().auth.updateUser(payload));
      toast(
        f.get("email")
          ? t("Check your email to confirm your account.")
          : t("Saved."),
      );
      form.elements.password.value = "";
      S.user = (await api(db().auth.getUser())).user;
    } catch (err) {
      toast(err.message, true);
    }
  };
}
window.addEventListener("beforeunload", (ev) => {
  if (dirty) {
    ev.preventDefault();
    ev.returnValue = "";
  }
});
window.addEventListener("pagehide", () => {
  stopGeo(false);
  stopExtra?.();
});
