import {
  S,
  $,
  t,
  e,
  local,
  url,
  settings,
  db,
  api,
  toast,
  themeButtons,
  bindCommon,
} from "./core.js";
const root = $("#main"),
  params = new URLSearchParams(location.search);
let mode = params.get("mode") || "login";
const invitation = params.get("invite") || "";
function frame(body) {
  root.innerHTML = `<div class="auth-shell"><section class="panel auth-card"><div class="row between"><a href="index.html" class="text-btn">← ${t("Home")}</a><div class="actions">${themeButtons()}</div></div>${url(S.config.logo_url) ? `<img class="auth-logo" src="${e(url(S.config.logo_url))}" alt="${e(local(S.config, "brand_name"))}">` : ""}<h1>${t("Captain’s desk")}</h1>${body}</section></div>`;
  bindCommon();
}
const field = (id, label, type = "text", required = true) =>
  `<label class="field"><span>${t(label)}</span><input id="${id}" type="${type}" ${required ? "required" : ""} ${type === "password" ? 'minlength="10" autocomplete="new-password"' : ""}></label>`;
function login() {
  frame(`<p class="muted">${t("Only approved team admins can enter.")}</p>${!db() ? `<div class="error-banner">${t("Connect Supabase to enable secure sign-in.")}<br><span class="ltr">assets/js/config.js · docs/SETUP.md</span></div>` : ""}
 <form id="auth-form">${field("email", "Email", "email")}${field("password", "Password", "password")}<button class="btn full" ${!db() ? "disabled" : ""}>${t("Sign in")}</button></form>
 <div class="row between" style="margin-top:17px"><button class="text-btn" id="forgot">${t("Forgot password?")}</button><button class="text-btn" id="register">${t("Create account")}</button></div>`);
  $("#forgot").disabled = !db();
  $("#register").disabled = !db();
  $("#password").removeAttribute("minlength");
  $("#password").autocomplete = "current-password";
  $("#forgot").onclick = () => {
    mode = "reset";
    reset();
  };
  $("#register").onclick = () => {
    mode = "register";
    register();
  };
  $("#auth-form").onsubmit = async (ev) => {
    ev.preventDefault();
    await busy(ev.currentTarget, async () => {
      await api(
        db().auth.signInWithPassword({
          email: $("#email").value.trim(),
          password: $("#password").value,
        }),
      );
      await enter();
    });
  };
}
function register() {
  frame(
    `<h3>${t("Create account")}</h3><p class="note">${t("Only approved team admins can enter.")}</p><form id="auth-form">${field("name", "Display name")}${field("email", "Email", "email")}${field("password", "Password", "password")}${field("confirm", "Confirm password", "password")}<button class="btn full" ${!db() ? "disabled" : ""}>${t("Register")}</button></form><button class="text-btn" id="login" style="margin-top:15px">${t("Sign in")}</button>`,
  );
  $("#login").onclick = login;
  $("#auth-form").onsubmit = async (ev) => {
    ev.preventDefault();
    await busy(ev.currentTarget, async () => {
      if ($("#password").value !== $("#confirm").value)
        throw Error(t("Confirm password"));
      const target = new URL("account.html", location.href);
      if (invitation) target.searchParams.set("invite", invitation);
      await api(
        db().auth.signUp({
          email: $("#email").value.trim(),
          password: $("#password").value,
          options: {
            data: { display_name: $("#name").value.trim() },
            emailRedirectTo: target.href,
          },
        }),
      );
      toast(t("Check your email to confirm your account."));
    });
  };
}
function reset() {
  frame(
    `<h3>${t("Forgot password?")}</h3><form id="auth-form">${field("email", "Email", "email")}<button class="btn full">${t("Send reset link")}</button></form><button class="text-btn" id="login" style="margin-top:15px">${t("Sign in")}</button>`,
  );
  $("#login").onclick = login;
  $("#auth-form").onsubmit = async (ev) => {
    ev.preventDefault();
    await busy(ev.currentTarget, async () => {
      await api(
        db().auth.resetPasswordForEmail($("#email").value.trim(), {
          redirectTo: new URL("account.html?mode=recovery", location.href).href,
        }),
      );
      toast(t("Check your email for the reset link."));
    });
  };
}
function recovery() {
  frame(
    `<h3>${t("New password")}</h3><form id="auth-form">${field("password", "New password", "password")}${field("confirm", "Confirm password", "password")}<button class="btn full">${t("Save password")}</button></form>`,
  );
  $("#auth-form").onsubmit = async (ev) => {
    ev.preventDefault();
    await busy(ev.currentTarget, async () => {
      if ($("#password").value !== $("#confirm").value)
        throw Error(t("Confirm password"));
      await api(db().auth.updateUser({ password: $("#password").value }));
      toast(t("Saved."));
      location.href = "admin.html";
    });
  };
}
async function enter() {
  const { user } = await api(db().auth.getUser());
  S.user = user;
  if (mode === "recovery") {
    recovery();
    return;
  }
  if (invitation) {
    frame(
      `<h3>${t("Accept invitation")}</h3><p class="note ltr">${e(user.email)}</p><button class="btn full" id="accept">${t("Accept invitation")}</button><button class="text-btn" id="signout">${t("Sign out")}</button>`,
    );
    $("#accept").onclick = async () => {
      try {
        await api(db().rpc("hm_redeem_invite", { p_token: invitation }));
        location.replace("admin.html");
      } catch (err) {
        toast(err.message, true);
      }
    };
    $("#signout").onclick = async () => {
      await db().auth.signOut();
      login();
    };
    return;
  }
  const approved = await api(db().rpc("hm_is_admin"));
  if (!approved) {
    frame(
      `<div class="error-banner">${t("No admin permissions for this account.")}</div><p class="note ltr">${e(user.email)}</p><button class="btn full" id="signout">${t("Sign out")}</button>`,
    );
    $("#signout").onclick = async () => {
      await db().auth.signOut();
      login();
    };
    return;
  }
  if (document.body.dataset.page === "account") {
    location.replace("admin.html");
    return;
  }
  const members = await api(db().rpc("hm_members"));
  S.role = members.find((m) => m.user_id === user.id)?.role;
  const admin = await import("./admin.js");
  await admin.start(members);
}
async function busy(form, fn) {
  const b = form.querySelector("button[type=submit],button");
  b.disabled = true;
  try {
    await fn();
  } catch (err) {
    toast(err.message, true);
  } finally {
    b.disabled = false;
  }
}
await settings();
if (db()) {
  db().auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      mode = "recovery";
      recovery();
    }
    if (event === "SIGNED_OUT" && document.body.dataset.page === "admin")
      login();
  });
  const session = await api(db().auth.getSession());
  if (session.session) {
    try {
      await enter();
    } catch (err) {
      login();
      toast(err.message, true);
    }
  } else if (mode === "register") register();
  else login();
} else login();
