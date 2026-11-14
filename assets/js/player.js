import {
  S,
  $,
  $$,
  t,
  e,
  n,
  local,
  url,
  settings,
  shell,
  db,
  api,
  all,
  toast,
  head,
  metrics,
  empty,
  hydratePortraits,
  clearPortraits,
  flag,
  bindCommon,
  date,
} from "./core.js";
import { aggregate, overs } from "./stats.js";
const params = new URLSearchParams(location.search),
  invite = params.get("invite"),
  main = $("#main");
let recovery = params.get("mode") === "recovery",
  checkTimer,
  stamp;
const field = (name, label, type = "text", required = true) =>
  `<label class="field"><span>${t(label)}</span><input name="${name}" type="${type}" ${required ? "required" : ""} ${type === "password" ? 'minlength="10" autocomplete="new-password"' : ""}></label>`;
const frame = (body) => {
  main.innerHTML = `<section class="wrap section"><div class="panel auth-card"><img class="auth-logo" src="${e(url(S.config.logo_url))}" alt="${e(S.config.brand_name)}"><h1>${t("Player login")}</h1>${body}</div></section>`;
};
async function busy(form, fn) {
  const buttons = $$("button", form);
  buttons.forEach((b) => (b.disabled = true));
  try {
    await fn(new FormData(form));
  } catch (err) {
    toast(err.message, true);
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}
function auth(mode = "login") {
  const signup = mode === "register",
    reset = mode === "reset";
  frame(
    `<p class="note">${t("Your own profile. Your performance.")}</p>${!db() ? `<p class="error-banner">${t("Connect Supabase to enable secure sign-in.")}</p>` : ""}<form id="player-auth">${signup ? field("name", "Display name") : ""}${field("email", "Email", "email")}${!reset ? field("password", "Password", "password") : ""}<button class="btn full" ${!db() ? "disabled" : ""}>${t(reset ? "Send reset link" : signup ? "Create account" : "Sign in")}</button></form><div class="row between auth-links"><button class="text-btn" data-auth="${signup || reset ? "login" : "register"}">${t(signup || reset ? "Sign in" : "Create account")}</button><button class="text-btn" data-auth="reset">${t("Forgot password?")}</button></div><p class="note">${t("An admin invitation links your account to your player profile.")}</p>`,
  );
  if (!signup && !reset) {
    $("input[name=password]").removeAttribute("minlength");
    $("input[name=password]").autocomplete = "current-password";
  }
  $$("[data-auth]").forEach((b) => (b.onclick = () => auth(b.dataset.auth)));
  $("#player-auth").onsubmit = (ev) => {
    ev.preventDefault();
    busy(ev.currentTarget, async (f) => {
      const email = f.get("email").trim(),
        password = f.get("password");
      if (reset) {
        await api(
          db().auth.resetPasswordForEmail(email, {
            redirectTo: new URL("player.html?mode=recovery", location.href)
              .href,
          }),
        );
        toast(t("Check your email for the reset link."));
        return;
      }
      if (signup) {
        const target = new URL("player.html", location.href);
        if (invite) target.searchParams.set("invite", invite);
        await api(
          db().auth.signUp({
            email,
            password,
            options: {
              data: { display_name: f.get("name").trim() },
              emailRedirectTo: target.href,
            },
          }),
        );
        toast(t("Check your email to confirm your account."));
        return;
      }
      await api(db().auth.signInWithPassword({ email, password }));
      await enter();
    });
  };
}
function passwordForm() {
  frame(
    `<h3>${t("New password")}</h3><form id="recover">${field("password", "New password", "password")}${field("confirm", "Confirm password", "password")}<button class="btn full">${t("Save password")}</button></form>`,
  );
  $("#recover").onsubmit = (ev) => {
    ev.preventDefault();
    busy(ev.currentTarget, async (f) => {
      if (f.get("password") !== f.get("confirm"))
        throw Error("Passwords do not match");
      await api(db().auth.updateUser({ password: f.get("password") }));
      location.replace("player.html");
    });
  };
}
function signout() {
  return api(db().auth.signOut()).then(() => {
    clearPortraits();
    S.players = [];
    S.stats = [];
    location.replace("player.html");
  });
}
async function enter() {
  const { user } = await api(db().auth.getUser());
  S.user = user;
  if (!user) {
    auth();
    return;
  }
  if (recovery) {
    passwordForm();
    return;
  }
  if (invite) {
    frame(
      `<h3>${t("Accept invitation")}</h3><p class="note ltr">${e(user.email)}</p><button class="btn full" id="accept-player">${t("Accept invitation")}</button><button class="text-btn" id="logout">${t("Sign out")}</button>`,
    );
    $("#logout").onclick = signout;
    $("#accept-player").onclick = async () => {
      const b = $("#accept-player");
      b.disabled = true;
      try {
        await api(db().rpc("hm_accept_player", { p_token: invite }));
        location.replace("player.html");
      } catch (err) {
        toast(err.message, true);
        b.disabled = false;
      }
    };
    return;
  }
  const link = await api(
    db()
      .from("hm_player_accounts")
      .select("player_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  );
  if (!link) {
    frame(
      `<h3>${t("Admin access only")}</h3><p class="note">${t("This account is not linked to a player profile. Live match setup and scoring are available only to the single authorized admin account.")}</p><p class="ltr">${e(user.email)}</p><div class="row"><a class="btn" href="admin.html">${t("Open Captain’s Desk")}</a><button class="btn secondary" id="logout">${t("Sign out")}</button></div>`,
    );
    $("#logout").onclick = signout;
    return;
  }
  const p = await api(
    db().from("hm_players").select("*").eq("id", link.player_id).maybeSingle(),
  );
  if (!p) {
    frame(
      `<p>${t("Your profile is unavailable. Contact the captain.")}</p><button class="btn" id="logout">${t("Sign out")}</button>`,
    );
    $("#logout").onclick = signout;
    return;
  }
  S.players = await hydratePortraits([p]);
  [S.matches, S.stats] = await Promise.all([
    all("matches", true),
    api(db().from("hm_stats").select("*").eq("player_id", p.id)),
  ]);
  S.stats = S.stats.filter((r) =>
    S.matches.some((m) => m.id === r.match_id && m.status === "completed"),
  );
  render(p);
}
function render(p) {
  const years = [...new Set(S.matches.map((m) => m.season))].sort().reverse();
  main.innerHTML =
    head("My profile", local(p, "name")) +
    `<section class="wrap section"><div class="panel own-profile"><div class="profile-portrait">${p._photo || p.photo_url ? `<img src="${e(p._photo || url(p.photo_url))}" alt="${e(p.name)}">` : `<span>#${p.jersey}</span>`}</div><div><span class="badge">#${p.jersey} · ${t(p.role)}</span><h2>${e(p.name)}</h2><p class="note">${e(local(p, "batting_style"))} · ${e(local(p, "bowling_style"))}</p><p class="note">${t("Your access includes your own private statistics.")}</p></div><button id="logout" class="btn secondary">${t("Sign out")}</button></div><div class="toolbar"><label>${t("Season")}<select id="my-season"><option value="">${t("Career")}</option>${years.map((y) => `<option>${e(y)}</option>`).join("")}</select></label></div><div id="my-stats"></div><section class="panel account-panel"><h2>${t("My account")}</h2><form id="my-account"><div class="form-grid">${field("name", "Display name", "text", false)}${field("email", "Email", "email")}${field("password", "New password", "password", false)}</div><p class="note">${t("Leave the password blank to keep it. Email changes require confirmation.")}</p><button class="btn">${t("Update account")}</button></form></section></section>`;
  $("#logout").onclick = signout;
  $("#my-account input[name=name]").value =
    S.user.user_metadata?.display_name || "";
  $("#my-account input[name=email]").value = S.user.email;
  $("#my-account").onsubmit = (ev) => {
    ev.preventDefault();
    busy(ev.currentTarget, async (f) => {
      const update = { data: { display_name: f.get("name").trim() } };
      if (f.get("email").trim() !== S.user.email)
        update.email = f.get("email").trim();
      if (f.get("password")) update.password = f.get("password");
      await api(
        db().auth.updateUser(update, {
          emailRedirectTo: new URL("player.html", location.href).href,
        }),
      );
      toast(t("Saved. Check your email for any confirmation."));
    });
  };
  const draw = () => {
    const season = $("#my-season").value,
      rows = S.stats
        .filter((r) =>
          S.matches.some(
            (m) => m.id === r.match_id && (!season || m.season === season),
          ),
        )
        .sort(
          (a, b) =>
            new Date(S.matches.find((m) => m.id === b.match_id).starts_at) -
            new Date(S.matches.find((m) => m.id === a.match_id).starts_at),
        ),
      s = aggregate(rows);
    $("#my-stats").innerHTML =
      `<h2>${t("Batting")}</h2><div class="grid cols4">${metrics([
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
      ])}</div><h2 class="section-label">${t("Bowling")}</h2><div class="grid cols4">${metrics(
        [
          ["Wickets", s.wickets],
          ["Overs", overs(s.bowling_balls)],
          ["Economy", n(s.economy)],
          ["Average", n(s.bowling_average)],
          [
            "Best figures",
            s.best ? s.best.wickets + "/" + s.best.conceded : "—",
          ],
          ["3W hauls", s.three],
          ["5W hauls", s.five],
        ],
      )}</div><h2 class="section-label">${t("Fielding")}</h2><div class="grid cols3">${metrics(
        [
          ["Catches", s.catches],
          ["Run outs", s.run_outs],
          ["Stumpings", s.stumpings],
        ],
      )}</div><h2 class="section-label">${t("Last five appearances")}</h2><div class="row">${
        rows
          .slice(0, 5)
          .map(
            (r) =>
              `<span class="form-badge">${r.batted ? r.runs + (r.not_out ? "*" : "") : t("DNB")} · ${r.wickets}w</span>`,
          )
          .join("") || empty()
      }</div><h2 class="section-label">${t("Match history")}</h2><div class="table-wrap"><table><thead><tr>${["Date", "Opponent", "Runs", "Balls", "Wickets"].map((x) => `<th>${t(x)}</th>`).join("")}</tr></thead><tbody>${rows
        .map((r) => {
          const m = S.matches.find((m) => m.id === r.match_id);
          return `<tr><td>${date(m.starts_at, true)}</td><td>${e(m.opponent)}</td><td>${r.batted ? r.runs + (r.not_out ? "*" : "") : t("DNB")}</td><td>${r.balls}</td><td>${r.wickets}</td></tr>`;
        })
        .join("")}</tbody></table></div>`;
  };
  $("#my-season").onchange = draw;
  draw();
  bindCommon();
}
await settings();
shell();
if (!flag("player") || S.config.flags.maintenance)
  main.innerHTML = head("Player login", "Page unavailable");
else if (!db()) auth();
else {
  db().auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      recovery = true;
      passwordForm();
    }
    if (event === "SIGNED_OUT") {
      clearPortraits();
      auth();
    }
  });
  try {
    const s = await api(db().auth.getSession());
    if (s.session) await enter();
    else auth();
  } catch (err) {
    auth();
    toast(err.message, true);
  }
  const check = async () => {
    if (document.hidden) return;
    try {
      const v = await api(db().rpc("hm_policy_stamp"));
      if (stamp && stamp !== v) {
        clearPortraits();
        const m = $("#modal");
        if (m.open) m.close();
        main.innerHTML = head("My profile", "Please wait…");
        await settings();
        if (!flag("player") || S.config.flags.maintenance)
          main.innerHTML = head("Player login", "Page unavailable");
        else await enter();
      }
      stamp = v;
    } catch {}
  };
  check();
  checkTimer = setInterval(check, 15000);
}
window.addEventListener("pagehide", () => clearInterval(checkTimer));
