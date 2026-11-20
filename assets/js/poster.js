// Match summary poster: pure data model (testable) + canvas renderer.
// Only team totals and player figures the viewer is already allowed to read are used.
import { overs } from "./stats.js";

const RESULT_LABEL = {
  won: "VICTORY",
  lost: "DEFEAT",
  tied: "MATCH TIED",
  no_result: "NO RESULT",
};

export function buildPosterModel({
  match,
  stats = [],
  players = [],
  brand = "Haveli Mitters",
  canSee = () => true,
  nameOf = (p) => p.name,
  opponent,
  venue = "",
  dateText = "",
}) {
  const name = (id) => {
    const p = players.find((x) => x.id === id);
    return p ? nameOf(p) : "";
  };
  const rows = stats.filter(
    (r) => r.match_id === match.id && canSee(r.player_id) && name(r.player_id),
  );
  const batters = rows
    .filter((r) => r.batted && r.runs > 0)
    .sort((a, b) => b.runs - a.runs || a.balls - b.balls)
    .slice(0, 3)
    .map((r) => ({
      name: name(r.player_id),
      value: r.runs + (r.not_out ? "*" : ""),
      detail: "(" + r.balls + ")",
    }));
  const bowlers = rows
    .filter((r) => r.bowling_balls > 0 || r.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets || a.conceded - b.conceded)
    .slice(0, 3)
    .map((r) => ({
      name: name(r.player_id),
      value: r.wickets + "/" + r.conceded,
      detail: "(" + overs(r.bowling_balls) + ")",
    }));
  const score = (runs, wickets, balls) =>
    runs == null
      ? { text: "—", overs: "" }
      : { text: runs + "/" + (wickets ?? 0), overs: overs(balls || 0) };
  const result = match.result || "no_result";
  return {
    brand,
    opponent: opponent || match.opponent,
    venue,
    dateText,
    season: match.season || "",
    result,
    resultLabel: RESULT_LABEL[result] || "RESULT",
    ours: score(match.team_runs, match.team_wickets, match.team_balls),
    theirs: score(
      match.opponent_runs,
      match.opponent_wickets,
      match.opponent_balls,
    ),
    summary: match.summary && match.summary.length <= 90 ? match.summary : "",
    batters,
    bowlers,
  };
}

export function shareText(model, link = "") {
  return [
    "🏏 " + model.brand + " vs " + model.opponent,
    model.ours.text + " – " + model.theirs.text,
    "🏆 " + model.resultLabel,
    link,
  ]
    .filter(Boolean)
    .join("\n");
}

const loadImage = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

export async function drawPoster(canvas, model, logoSrc = "") {
  const W = 1080,
    H = 1350;
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  const css = getComputedStyle(document.body);
  const body = (css.fontFamily || "sans-serif").split(",")[0] || "sans-serif";
  const F = (w, s) => `${w} ${s}px ${body}, "Noto Sans Arabic", sans-serif`;
  if (document.fonts?.ready) await document.fonts.ready;
  const logo = await loadImage(logoSrc);
  const gold = "#d8b574",
    text = "#f5ebda",
    muted = "#b6a99a";
  const round = (x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  const fit = (str, max, weight, size, min = 22) => {
    let s = size;
    g.font = F(weight, s);
    while (g.measureText(str).width > max && s > min) g.font = F(weight, --s);
  };

  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#171310");
  bg.addColorStop(0.6, "#211b17");
  bg.addColorStop(1, "#2a221c");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 250, 20, W / 2, 250, 560);
  glow.addColorStop(0, "rgba(216,181,116,.28)");
  glow.addColorStop(1, "rgba(216,181,116,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(216,181,116,.55)";
  g.lineWidth = 3;
  round(36, 36, W - 72, H - 72, 28);
  g.stroke();

  g.textAlign = "center";
  if (logo) {
    const s = 150,
      r = Math.min(s / logo.width, s / logo.height);
    g.drawImage(
      logo,
      W / 2 - (logo.width * r) / 2,
      80 + (s - logo.height * r) / 2,
      logo.width * r,
      logo.height * r,
    );
  } else {
    g.strokeStyle = gold;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(W / 2, 155, 70, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = gold;
    g.font = F(800, 64);
    g.fillText("HM", W / 2, 178);
  }
  g.fillStyle = gold;
  g.font = F(700, 30);
  g.fillText("MATCH SUMMARY" + (model.season ? "  ·  " + model.season : ""), W / 2, 320);
  g.fillStyle = text;
  fit(model.brand.toUpperCase(), W - 200, 800, 88);
  g.fillText(model.brand.toUpperCase(), W / 2, 415);
  g.fillStyle = muted;
  fit("vs " + model.opponent, W - 200, 600, 46);
  g.fillText("vs " + model.opponent, W / 2, 480);
  g.font = F(500, 26);
  const meta = [model.dateText, model.venue].filter(Boolean).join("  ·  ");
  if (meta) g.fillText(meta, W / 2, 530);

  const row = (y, team, sc, ov, hl) => {
    g.fillStyle = hl ? "rgba(216,181,116,.15)" : "rgba(245,235,218,.05)";
    round(90, y, W - 180, 116, 18);
    g.fill();
    g.strokeStyle = hl ? "rgba(216,181,116,.6)" : "rgba(245,235,218,.12)";
    g.lineWidth = 2;
    g.stroke();
    g.textAlign = "right";
    g.fillStyle = hl ? gold : text;
    g.font = F(800, 58);
    g.fillText(sc, W - 125, y + 70);
    g.fillStyle = muted;
    g.font = F(500, 22);
    g.fillText(ov ? ov + " ov" : "", W - 125, y + 98);
    const room = W - 250 - 230;
    g.textAlign = "left";
    g.fillStyle = text;
    fit(team.toUpperCase(), room, 700, 44);
    g.fillText(team.toUpperCase(), 125, y + 72);
  };
  row(580, model.brand, model.ours.text, model.ours.overs, model.result === "won");
  row(716, model.opponent, model.theirs.text, model.theirs.overs, model.result === "lost");

  const pill = model.result === "won" ? gold : model.result === "lost" ? "#e0786b" : muted;
  g.font = F(800, 44);
  const pw = g.measureText(model.resultLabel).width + 110;
  g.fillStyle = pill;
  round((W - pw) / 2, 868, pw, 88, 44);
  g.fill();
  g.textAlign = "center";
  g.fillStyle = "#171310";
  g.fillText(model.resultLabel, W / 2, 868 + 58);
  if (model.summary) {
    g.fillStyle = muted;
    fit(model.summary, W - 220, 500, 26, 18);
    g.fillText(model.summary, W / 2, 1000);
  }

  const col = (x, title, items) => {
    g.textAlign = "left";
    g.fillStyle = gold;
    g.font = F(700, 32);
    g.fillText(title, x, 1065);
    g.fillStyle = "rgba(216,181,116,.4)";
    g.fillRect(x, 1082, 400, 2);
    if (!items.length) {
      g.fillStyle = muted;
      g.font = F(500, 24);
      g.fillText("—", x, 1130);
    }
    items.forEach((it, i) => {
      const y = 1132 + i * 56;
      g.fillStyle = text;
      fit(it.name, 230, 600, 26, 16);
      g.fillText(it.name, x, y);
      g.textAlign = "right";
      g.fillStyle = gold;
      g.font = F(800, 32);
      g.fillText(it.value + " " + it.detail, x + 400, y);
      g.textAlign = "left";
    });
  };
  col(90, "TOP BATTERS", model.batters);
  col(590, "TOP BOWLERS", model.bowlers);
  g.textAlign = "center";
  g.fillStyle = muted;
  g.font = F(500, 22);
  g.fillText(model.brand, W / 2, 1300);
  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("Poster export blocked"))),
        "image/png",
      );
    } catch (err) {
      reject(err);
    }
  });
}
