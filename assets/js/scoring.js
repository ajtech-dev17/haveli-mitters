import { S, $, $$, t, e, db, api, all, toast, dialog, date } from "./core.js";
import { liveMarkup } from "./live-view.js";
const options = (list, value = "") =>
  '<option value="">—</option>' +
  list
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === value ? "selected" : ""}>${e(p.name)}</option>`,
    )
    .join("");
const select = (name, label, list, value = "") =>
  `<label class="field"><span>${t(label)}</span><select name="${name}">${options(list, value)}</select></label>`;
const input = (name, label, value, type = "number") =>
  `<label class="field"><span>${t(label)}</span><input name="${name}" type="${type}" value="${e(value)}" ${type === "number" ? 'min="0" step="1"' : ""} required></label>`;
export function mountScoring(root) {
  const host = document.createElement("div");
  root.replaceChildren(host);
  let setupShown = false,
    lastError = "",
    stopped = false,
    busy = false,
    connected = true,
    view = null,
    matchId = "",
    pending = null,
    timer,
    heartbeat,
    matches = [],
    players = [],
    lives = [];
  host.innerHTML = `<div class="toolbar"><label class="field full"><span>${t("Choose match")}</span><select id="scoring-match"><option value="">${t("Please wait…")}</option></select></label><a class="btn secondary" href="live.html" target="_blank" rel="noopener">${t("Open live viewer")} ↗</a></div><div id="scoring-status" role="status" class="note"></div><div id="scoring-body"></div>`;
  const status = (message, error = false) => {
    if (!host.isConnected) return;
    const el = $("#scoring-status", host);
    el.textContent = t(message);
    el.className = error ? "error-banner" : "note";
  };
  async function init() {
    try {
      [matches, players, lives] = await Promise.all([
        all("matches"),
        all("players"),
        api(db().from("hm_live_matches").select("match_id")),
      ]);
      if (stopped) return;
      matches.sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
      $("#scoring-match", host).innerHTML =
        '<option value="">' +
        t("Choose an upcoming fixture or an existing live match") +
        "</option>" +
        matches
          .filter(
            (m) =>
              m.status === "upcoming" || lives.some((l) => l.match_id === m.id),
          )
          .map(
            (m) =>
              `<option value="${m.id}">${e(m.opponent)} · ${date(m.starts_at, true)} · ${t(lives.some((l) => l.match_id === m.id) ? "Live scoring" : m.status)}</option>`,
          )
          .join("");
      $("#scoring-match", host).onchange = async (ev) => {
        if (
          pending &&
          !confirm(t("A submission is unresolved. Switch matches?"))
        ) {
          ev.target.value = matchId;
          return;
        }
        matchId = ev.target.value;
        view = null;
        pending = null;
        setupShown = false;
        lastError = "";
        await load(true);
      };
      status("Create an upcoming fixture in Matches, then select it here.");
    } catch (err) {
      status(err.message, true);
    }
  }
  async function load(force = false) {
    if (stopped || !host.isConnected || !matchId || busy) return;
    try {
      const data = await api(db().rpc("hm_live_view", { p_match: matchId }));
      if (stopped) return;
      const reconnected = !connected;
      connected = true;
      if (!data) {
        view = null;
        if (force || !setupShown) {
          setup();
          setupShown = true;
        }
        return;
      }
      if (
        force ||
        !view ||
        reconnected ||
        data.revision !== view.revision ||
        data.scorer !== view.scorer
      ) {
        view = data;
        draw();
      } else view = data;
      if (pending) pendingControls();
      else if (lastError) status(lastError, true);
      else
        status(
          "Connected. Each delivery is saved only after server confirmation.",
        );
    } catch (err) {
      connected = false;
      status(
        "Connection lost. Keep this tab open and retry after reconnecting.",
        true,
      );
      $$("[data-write]", host).forEach((b) => (b.disabled = true));
    }
  }
  async function claim(takeover = false) {
    try {
      await api(
        db().rpc("hm_live_claim", { p_match: matchId, p_takeover: takeover }),
      );
      await load(true);
    } catch (err) {
      status(err.message, true);
    }
  }
  async function send(action, payload = {}, reuse = false) {
    if (busy || !view || (!reuse && pending)) return;
    if (!navigator.onLine) {
      status("Offline. Reconnect before scoring.", true);
      return;
    }
    if (!reuse)
      pending = {
        p_match: matchId,
        p_revision: view.revision,
        p_request: crypto.randomUUID(),
        p_action: action,
        p_payload: payload,
      };
    busy = true;
    lastError = "";
    $$("[data-write]", host).forEach((b) => (b.disabled = true));
    status("Saving…");
    try {
      await api(db().rpc("hm_live_command", pending));
      pending = null;
      connected = true;
      status("Saved.");
    } catch (err) {
      lastError = err.message;
      status(err.message, true);
      if (
        !/fetch|network|timeout|connection|offline|abort|server|502|503|504/i.test(
          err.message,
        )
      )
        pending = null;
    } finally {
      busy = false;
      await load(!lastError);
      if (pending) pendingControls();
      else
        $$("[data-write]", host).forEach(
          (b) => (b.disabled = !connected || view?.scorer !== S.user.id),
        );
    }
  }
  function pendingControls() {
    status(
      "Save status is uncertain. Retry the same submission to avoid duplicates.",
      true,
    );
    $("#pending-controls", host)?.remove();
    const box = document.createElement("div");
    box.id = "pending-controls";
    box.className = "row";
    box.innerHTML = `<button class="btn" id="retry-pending">${t("Retry same submission")}</button><button class="btn secondary" id="discard-pending">${t("Discard pending submission")}</button>`;
    $("#scoring-body", host).prepend(box);
    $$("[data-write]", host).forEach((b) => (b.disabled = true));
    $("#retry-pending", host).onclick = () => send("", {}, true);
    $("#discard-pending", host).onclick = () => {
      if (
        confirm(
          t(
            "Discard this pending request? Check the current score before entering it again.",
          ),
        )
      ) {
        pending = null;
        lastError = "";
        load(true);
      }
    };
  }

  function setup() {
    const active = players
        .filter((p) => p.status === "active")
        .sort(
          (a, b) => a.display_order - b.display_order || a.jersey - b.jersey,
        ),
      m = matches.find((m) => m.id === matchId);
    if (!m) {
      $("#scoring-body", host).innerHTML = "";
      return;
    }
    $("#scoring-body", host).innerHTML =
      `<section class="admin-card"><h2>${t("Set up live scoring")}</h2><p class="note">${t("Select equal lineups of 2–11 players. The full squad can be larger.")}</p><form id="live-setup"><div class="form-grid">${input("overs", "Overs limit", 20)}${input("max_bowler_overs", "Maximum overs per bowler", 4)}<label class="field"><span>${t("Toss winner")}</span><select name="toss_winner"><option value="home">${e(S.config.brand_name)}</option><option value="away">${e(m.opponent)}</option></select></label><label class="field"><span>${t("Toss decision")}</span><select name="toss_decision"><option value="bat">${t("Bat")}</option><option value="bowl">${t("Bowl")}</option></select></label></div><label class="toggle-row"><span>${t("Free hit after a no-ball")}</span><input name="free_hit" type="checkbox" checked></label><h3>${t("Playing XI")}</h3><div class="lineup-picker">${active.map((p, i) => `<label class="toggle-row"><span>${e(p.name)} · #${p.jersey} · ${t(p.role)}</span><input name="home" type="checkbox" value="${p.id}" ${i < 11 ? "checked" : ""}></label>`).join("")}</div><label class="field"><span>${t("Opponent lineup: one name per line, in batting order")}</span><textarea name="away" rows="11" required></textarea></label><p class="note">${t("The selected team players use their squad display order. Choose batters as they come to the crease.")}</p><button class="btn">${t("Start match")}</button></form></section>`;
    $("#live-setup", host).onsubmit = async (ev) => {
      ev.preventDefault();
      const b = ev.submitter;
      b.disabled = true;
      try {
        const f = new FormData(ev.currentTarget),
          winner = f.get("toss_winner"),
          decision = f.get("toss_decision");
        await api(
          db().rpc("hm_start_live", {
            p_match: matchId,
            p_revision: m.revision,
            p_config: {
              overs: Number(f.get("overs")),
              max_bowler_overs: Number(f.get("max_bowler_overs")),
              toss_winner: winner,
              toss_decision: decision,
              first_batting:
                decision === "bat"
                  ? winner
                  : winner === "home"
                    ? "away"
                    : "home",
              free_hit: f.get("free_hit") === "on",
            },
            p_home: f.getAll("home"),
            p_away: f
              .get("away")
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean),
          }),
        );
        lives.push({ match_id: matchId });
        await load(true);
      } catch (err) {
        status(err.message, true);
        b.disabled = false;
      }
    };
  }
  async function reasonAction(action, extra = {}) {
    const d = dialog(
      t(action),
      `<form id="reason-form"><label class="field"><span>${t("Reason")}</span><textarea name="reason" required minlength="3"></textarea></label><button class="btn">${t("Confirm")}</button></form>`,
    );
    $("#reason-form", d).onsubmit = (ev) => {
      ev.preventDefault();
      const reason = new FormData(ev.currentTarget).get("reason").trim();
      d.close();
      send(action, { ...extra, reason });
    };
  }
  function draw() {
    const st = view.state,
      i = st.innings.at(-1),
      phase = st.phase,
      mine = view.scorer === S.user.id,
      batting = view.lineup.filter((p) => p.side === i.side),
      fielding = view.lineup.filter((p) => p.side !== i.side),
      available = batting.filter((p) => !i.batters[p.id]?.out),
      canWrite = mine && connected && !pending;
    const body = $("#scoring-body", host);
    body.innerHTML = `<div class="score-admin-summary">${liveMarkup(view, true)}</div><section class="admin-card"><div class="row between"><h3>${t("Scoring control")}</h3><button class="btn secondary" id="claim-scoring">${t(mine ? "Refresh scoring control" : "Take over scoring")}</button></div><p class="note">${t(mine ? "You control this scoring desk." : "Another admin controls scoring. Take over explicitly to continue.")}</p><details><summary>${t("Live and match audience")} · ${t(view.audience)}</summary><form id="live-audience"><div class="row"><label class="field"><span>${t("Live and match audience")}</span><select name="audience">${[
      ["public", "Public"],
      ["team", "Private · team players and admins"],
      ["admin", "Private · admins only"],
    ]
      .map(
        ([k, l]) =>
          `<option value="${k}" ${view.audience === k ? "selected" : ""}>${t(l)}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="toggle-row"><span>${t("Published")}</span><input type="checkbox" name="published" ${view.published ? "checked" : ""}></label><button data-write class="btn secondary">${t("Save audience")}</button></div><p class="note">${t("Individual player privacy still applies. Draft matches are visible to admins only.")}</p></form></details></section>
  ${
    phase === "live"
      ? `<section class="admin-card"><h3>${t("At the crease")}</h3><form id="choose-batters"><div class="form-grid">${select("striker", "Striker", available, i.striker)}${select("non_striker", "Non-striker", available, i.non_striker)}</div><button data-write class="btn secondary">${t("Confirm batters")}</button></form><form id="choose-bowler" class="row">${select("id", "Bowler", fielding, i.bowler)}<button data-write class="btn secondary">${t("Confirm bowler")}</button></form><button data-write id="swap-strike" class="text-btn">${t("Correct strike / swap ends")}</button></section><section class="admin-card scoring-entry"><h3>${t("Record delivery")}</h3><p class="note">${t("Runs exclude the automatic one-run wide/no-ball penalty. Mark boundaries explicitly.")}</p><form id="delivery-form"><div class="quick-runs">${[0, 1, 2, 3, 4, 6].map((n) => `<button type="button" data-quick="${n}" data-write>${n}${[4, 6].includes(n) ? " ★" : ""}</button>`).join("")}</div><div class="form-grid"><label class="field"><span>${t("Delivery type")}</span><select name="kind">${["legal", "wide", "noball", "bye", "legbye"].map((k) => `<option value="${k}">${t(k)}</option>`).join("")}</select></label>${input("runs", "Runs (excluding penalty)", 0)}<label class="field"><span>${t("Boundary")}</span><select name="boundary"><option value="0">${t("Not a boundary")}</option><option value="4">4</option><option value="6">6</option></select></label><label class="field"><span>${t("No-ball runs credited to")}</span><select name="nb_kind"><option value="bat">${t("Batter")}</option><option value="bye">${t("Byes")}</option><option value="legbye">${t("Leg-byes")}</option></select></label><label class="field"><span>${t("Dismissal")}</span><select name="wicket">${["none", "bowled", "caught", "lbw", "stumped", "hit_wicket", "run_out", "obstructing_field", "hit_ball_twice"].map((k) => `<option value="${k}">${t(k)}</option>`).join("")}</select></label>${select(
          "out_id",
          "Dismissed batter",
          batting.filter((p) => [i.striker, i.non_striker].includes(p.id)),
          i.striker,
        )}${select("fielder", "Fielder", fielding)}</div><label class="toggle-row"><span>${t("Run-out: crossed on the unfinished run")}</span><input name="crossed" type="checkbox"></label><div class="savebar"><span>${t("Check the umpire signal before saving")}</span><button data-write class="btn">${t("Save delivery")}</button></div></form></section>`
      : ""
  }
  <section class="admin-card"><h3>${t("Match actions")}</h3><div class="row">${phase === "break" ? `<button data-write id="start-chase" class="btn">${t("Start second innings")}</button>` : ""}${phase === "review" ? `<button data-write id="finalize-match" class="btn">${t("Approve final scorecard")}</button>` : ""}${["completed", "abandoned"].includes(phase) ? `<button data-write id="reopen-match" class="btn secondary">${t("Reopen for correction")}</button>` : `<button data-write id="undo-delivery" class="btn secondary">${t("Undo last action")}</button><button data-write id="rewind-score" class="btn secondary">${t("Correct earlier entry")}</button><button data-write id="abandon-match" class="btn danger">${t("Abandon / no result")}</button>`}${phase === "live" ? `<button data-write id="end-innings" class="btn secondary">${t("End innings")}</button><button data-write id="retire-batter" class="btn secondary">${t("Retire batter")}</button>` : ""}${st.innings.length === 2 && ["live", "review"].includes(phase) ? `<button data-write id="revise-target" class="btn secondary">${t("Official revised target")}</button>` : ""}</div><p class="note">${t("Corrections remain in the audit history. Earlier-entry correction rewinds later scoring; re-enter those deliveries afterward.")}</p></section><details class="admin-card"><summary>${t("Review full scorecard")}</summary>${liveMarkup(view)}</details>`;
    $$("[data-write]", body).forEach((b) => (b.disabled = !canWrite));
    $("#claim-scoring", body).onclick = () => {
      if (mine || confirm(t("Take scoring control from the other admin?")))
        claim(!mine);
    };
    $("#live-audience", body).onsubmit = (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.currentTarget);
      send("audience", {
        audience: f.get("audience"),
        published: f.get("published") === "on",
      });
    };
    const on = (id, fn) => {
      const b = $("#" + id, body);
      if (b) b.onclick = fn;
    };
    if (phase === "live") {
      $("#choose-batters", body).onsubmit = (ev) => {
        ev.preventDefault();
        send("batters", Object.fromEntries(new FormData(ev.currentTarget)));
      };
      $("#choose-bowler", body).onsubmit = (ev) => {
        ev.preventDefault();
        send("bowler", Object.fromEntries(new FormData(ev.currentTarget)));
      };
      $$("[data-quick]", body).forEach(
        (b) =>
          (b.onclick = () => {
            const f = $("#delivery-form", body);
            f.elements.kind.value = "legal";
            f.elements.runs.value = b.dataset.quick;
            f.elements.boundary.value = ["4", "6"].includes(b.dataset.quick)
              ? b.dataset.quick
              : "0";
            f.elements.wicket.value = "none";
          }),
      );
      $("#delivery-form", body).onsubmit = (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget),
          p = Object.fromEntries(f);
        p.runs = Number(p.runs);
        p.boundary = Number(p.boundary);
        p.crossed = f.get("crossed") === "on";
        send("delivery", p);
      };
    }
    on("start-chase", () => send("second_innings"));
    on("finalize-match", () => {
      if (
        confirm(t("Approve this scorecard and update season/career records?"))
      )
        send("finalize");
    });
    on("swap-strike", () => reasonAction("swap"));
    on("undo-delivery", () => reasonAction("undo"));
    on("end-innings", () => reasonAction("end_innings"));
    on("abandon-match", () => reasonAction("abandon"));
    on("reopen-match", () => reasonAction("reopen"));
    on("revise-target", () => {
      const d = dialog(
        t("Official revised target"),
        `<p class="note">${t("Enter the target provided by the officials. This is not an automatic DLS calculator.")}</p><form id="target-form">${input("target", "Target", i.target)}${input("limit", "Maximum legal balls", i.limit)}${input("reason", "Reason", "", "text")}<button class="btn">${t("Save")}</button></form>`,
      );
      $("#target-form", d).onsubmit = (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        d.close();
        send("target", {
          target: Number(f.get("target")),
          limit: Number(f.get("limit")),
          reason: f.get("reason"),
        });
      };
    });
    on("retire-batter", () => {
      const d = dialog(
        t("Retire batter"),
        `<form id="retire-form">${select(
          "id",
          "Player",
          batting.filter((p) => [i.striker, i.non_striker].includes(p.id)),
        )}<label class="field"><span>${t("Type")}</span><select name="kind"><option value="hurt">${t("Retired hurt")}</option><option value="out">${t("Retired out")}</option></select></label>${input("reason", "Reason", "", "text")}<button class="btn">${t("Save")}</button></form>`,
      );
      $("#retire-form", d).onsubmit = (ev) => {
        ev.preventDefault();
        const f = Object.fromEntries(new FormData(ev.currentTarget));
        d.close();
        send("retire", f);
      };
    });
    on("rewind-score", async () => {
      try {
        const events = await api(
          db()
            .from("hm_live_events")
            .select("revision,action,payload,created_at")
            .eq("match_id", matchId)
            .eq("voided", false)
            .order("revision", { ascending: false })
            .limit(500),
        );
        const list = events.filter(
          (e) =>
            ![
              "audience",
              "undo",
              "rewind",
              "reopen",
              "finalize",
              "abandon",
            ].includes(e.action),
        );
        const d = dialog(
          t("Correct earlier entry"),
          `<p class="note">${t("This restores the score before the selected entry. Later deliveries must be entered again.")}</p><form id="rewind-form"><label class="field"><span>${t("Entry")}</span><select name="revision">${list.map((x) => `<option value="${x.revision}">#${x.revision} · ${t(x.action)} · ${e(x.payload.kind || "")} ${e(x.payload.runs ?? "")} · ${date(x.created_at)}</option>`).join("")}</select></label>${input("reason", "Reason", "", "text")}<button class="btn danger" ${list.length ? "" : "disabled"}>${t("Rewind score")}</button></form>`,
        );
        $("#rewind-form", d).onsubmit = (ev) => {
          ev.preventDefault();
          const f = new FormData(ev.currentTarget);
          d.close();
          send("rewind", {
            revision: Number(f.get("revision")),
            reason: f.get("reason"),
          });
        };
      } catch (err) {
        toast(err.message, true);
      }
    });
  }
  init();
  timer = setInterval(() => {
    if (!document.hidden) load();
  }, 5000);
  heartbeat = setInterval(async () => {
    if (view?.scorer === S.user.id && !stopped && !document.hidden && !busy) {
      try {
        await api(
          db().rpc("hm_live_claim", { p_match: matchId, p_takeover: false }),
        );
      } catch {
        await load(true);
      }
    }
  }, 30000);
  const online = () => load(true);
  window.addEventListener("online", online);
  return () => {
    stopped = true;
    clearInterval(timer);
    clearInterval(heartbeat);
    window.removeEventListener("online", online);
  };
}
