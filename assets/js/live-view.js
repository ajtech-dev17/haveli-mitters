import { S, e, t, n, metrics, date } from "./core.js";
import { overs } from "./stats.js";
export function liveMarkup(v, compact = false) {
  if (!v)
    return `<div class="empty"><strong>${t("No live match available")}</strong><p>${t("A live match will appear here when the captain publishes it.")}</p></div>`;
  const st = v.state,
    innings = st.innings || [],
    current = innings.at(-1),
    names = new Map(v.lineup.map((p) => [p.id, p.name]));
  const who = (id) => names.get(id) || t("Restricted / not selected");
  const sideLabel = (side) =>
    side === "home" ? S.config.brand_name : v.opponent;
  const row = (label, value) =>
    `<span><small>${t(label)}</small><strong>${e(value)}</strong></span>`;
  const scores = innings
    .map(
      (i, idx) =>
        `<article class="panel innings-card"><p class="eyebrow">${t("Innings")} ${idx + 1} · ${e(sideLabel(i.side))}</p><div class="score-display ltr">${i.runs}<span>/${i.wickets}</span></div><div class="score-sub ltr">${overs(i.balls)} / ${overs(i.limit)} ${t("Overs")}</div><div class="score-mini">${row("Run rate", i.balls ? n((i.runs * 6) / i.balls) : "0.00")}${i.target ? row("Target", i.target) : ""}${row(
          "Extras",
          Object.values(i.extras || {}).reduce((a, b) => a + b, 0),
        )}</div></article>`,
    )
    .join("");
  const tables = innings
    .map(
      (i, idx) =>
        `<details class="panel innings-details" ${idx === innings.length - 1 ? "open" : ""}><summary>${e(sideLabel(i.side))} · ${t("Scorecard")}</summary><h3>${t("Batting")}</h3><div class="table-wrap"><table><thead><tr>${["Player", "Runs", "Balls", "Fours", "Sixes", "Strike rate"].map((k) => `<th>${t(k)}</th>`).join("")}</tr></thead><tbody>${
          Object.entries(i.batters)
            .map(
              ([id, b]) =>
                `<tr><td>${e(who(id))}${b.out ? `<small> · ${t(b.dismissal || "retired_out")}</small>` : b.retired ? `<small> · ${t("retired_hurt")}</small>` : ""}</td><td>${b.runs}${b.out ? "" : "*"}</td><td>${b.balls}</td><td>${b.fours}</td><td>${b.sixes}</td><td>${b.balls ? n((b.runs * 100) / b.balls) : "—"}</td></tr>`,
            )
            .join("") ||
          `<tr><td colspan="6">${t("No permitted figures yet")}</td></tr>`
        }</tbody></table></div><h3>${t("Bowling")}</h3><div class="table-wrap"><table><thead><tr>${["Player", "Overs", "Conceded", "Wickets", "Economy"].map((k) => `<th>${t(k)}</th>`).join("")}</tr></thead><tbody>${
          Object.entries(i.bowlers)
            .map(
              ([id, b]) =>
                `<tr><td>${e(who(id))}</td><td>${overs(b.balls)}</td><td>${b.conceded}</td><td>${b.wickets}</td><td>${b.balls ? n((b.conceded * 6) / b.balls) : "—"}</td></tr>`,
            )
            .join("") ||
          `<tr><td colspan="5">${t("No permitted figures yet")}</td></tr>`
        }</tbody></table></div><p class="note ltr">WD ${i.extras.wide} · NB ${i.extras.noball} · B ${i.extras.bye} · LB ${i.extras.legbye}</p></details>`,
    )
    .join("");
  const lineups = `<details class="panel innings-details"><summary>${t("Playing XI")}</summary><div class="grid cols2">${[
    "home",
    "away",
  ]
    .map(
      (side) =>
        `<section><h3>${e(sideLabel(side))}</h3><ol>${v.lineup
          .filter((p) => p.side === side)
          .map((p) => `<li>${e(p.name)}</li>`)
          .join("")}</ol></section>`,
    )
    .join("")}</div></details>`;
  if (compact)
    return `<section class="panel compact-live"><div><span class="live-pill">${t(st.phase)}</span><h3>${e(S.config.brand_name)} vs ${e(v.opponent)}</h3><p class="note">${t("Innings")} ${innings.length} · ${e(sideLabel(current.side))}</p></div><div><div class="score-display ltr">${current.runs}<span>/${current.wickets}</span></div><small class="ltr">${overs(current.balls)} / ${overs(current.limit)} ${t("Overs")}${current.target ? " · " + t("Target") + " " + current.target : ""}</small></div><div class="compact-crease">${row("Striker", who(current.striker))}${row("Non-striker", who(current.non_striker))}${row("Bowler", who(current.bowler))}${current.free_hit ? `<span class="badge">${t("Free hit")}</span>` : ""}</div></section>`;
  return `<div class="live-match-head"><div><span class="live-pill"><span class="pulse-dot ${st.phase === "live" ? "" : "quiet"}"></span>${t(st.phase)}</span><h2>${e(S.config.brand_name)} <span class="muted">vs</span> ${e(v.opponent)}</h2><p class="note">${e(v.venue || "")} · ${date(v.starts_at)}</p></div><span class="badge">${t(v.audience === "public" ? "Public" : v.audience === "team" ? "Team only" : "Admins only")}</span></div><div class="grid cols2">${scores}</div>${current?.target && st.phase === "live" ? `<div class="chase-strip">${e(sideLabel(current.side))} · ${Math.max(0, current.target - current.runs)} ${t("runs needed from")} ${Math.max(0, current.limit - current.balls)} ${t("balls")} · ${t("Required rate")} ${current.limit > current.balls ? n((Math.max(0, current.target - current.runs) * 6) / (current.limit - current.balls)) : "—"}</div>` : ""}${st.result ? `<div class="chase-strip">${e(S.config.brand_name)} · ${t(st.result)}</div>` : ""}${st.phase === "live" ? `<div class="panel crease"><div>${row("Striker", who(current.striker))}${row("Non-striker", who(current.non_striker))}${row("Bowler", who(current.bowler))}</div>${current.free_hit ? `<span class="badge gold">${t("Free hit")}</span>` : ""}</div>` : ""}<div class="delivery-strip" aria-label="${t("Recent deliveries")}">${(current?.recent || []).map((b) => `<span class="delivery ${b.wicket ? "wicket" : ""}">${b.wicket ? "W" : b.runs}${b.kind === "wide" ? "wd" : b.kind === "noball" ? "nb" : ""}</span>`).join("")}</div>${v.restricted ? `<p class="restricted">${t("Some individual figures are private. Team totals include all players.")}</p>` : ""}${tables}${lineups}<p class="note ltr">${t("Updated")}: ${date(v.updated_at)} · #${v.revision}</p>`;
}
