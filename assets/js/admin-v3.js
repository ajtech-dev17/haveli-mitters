import {
  S,
  $,
  $$,
  e,
  t,
  db,
  api,
  all,
  toast,
  date,
  applyPreferences,
} from "./core.js";
import {
  appearanceDefaults,
  validateAppearance,
  applyAppearance,
  contrast,
} from "./appearance.js";
export async function appearancePanel(root) {
  const host = document.createElement("div");
  root.replaceChildren(host);
  let draft = { ...S.config },
    appearance = { ...appearanceDefaults, ...S.config.appearance };
  try {
    const r = await api(
      db()
        .from("hm_settings_drafts")
        .select("config")
        .eq("id", 1)
        .maybeSingle(),
    );
    if (r) draft = { ...S.config, ...r.config };
    appearance = { ...appearanceDefaults, ...draft.appearance };
  } catch (err) {
    toast(err.message, true);
  }
  if (!host.isConnected) return;
  host.innerHTML = `<form id="appearance-form"><div class="savebar"><strong>${t("Appearance")}</strong><button class="btn secondary" name="intent" value="draft">${t("Save draft")}</button><button class="btn" name="intent" value="publish">${t("Publish")}</button></div><p class="note">${t("Bronze and gold is the default. Preview changes before publishing.")}</p><div class="grid cols2">${["dark", "light"].map((mode) => `<section class="admin-card"><h3>${t(mode)}</h3><div class="form-grid">${["bg", "panel", "text", "gold"].map((k) => `<label class="field"><span>${t({ bg: "Background", panel: "Cards", text: "Text", gold: "Accent" }[k])}</span><input type="color" name="${mode}_${k}" value="${appearance[mode + "_" + k]}"></label>`).join("")}</div></section>`).join("")}</div><section class="admin-card"><h3>${t("Typography")}</h3><div class="form-grid">${[
    ["font_body", "Body font"],
    ["font_heading", "Heading font"],
    ["font_urdu", "Urdu font"],
  ]
    .map(
      ([key, label]) =>
        `<label class="field"><span>${t(label)}</span><select name="${key}">${(key ===
        "font_urdu"
          ? [
              ["noto", "Noto Sans Arabic"],
              ["system", "System"],
            ]
          : [
              ["dm", "DM Sans"],
              ["manrope", "Manrope"],
              ["system", "System"],
              ["georgia", "Georgia"],
            ]
        )
          .map(
            ([id, name]) =>
              `<option value="${id}" ${appearance[key] === id ? "selected" : ""}>${name}</option>`,
          )
          .join("")}</select></label>`,
    )
    .join(
      "",
    )}</div><button type="button" class="btn secondary" id="appearance-reset">${t("Restore Haveli Default")}</button></section><section id="appearance-preview" class="panel appearance-preview"><span class="eyebrow">HAVELI MITTERS</span><h2>${t("Play with pride. Rise together.")}</h2><p>${t("Readable on every screen. Made for the team.")}</p><button type="button" class="btn">${t("View profile")}</button></section><p id="contrast-result" class="note" role="status"></p></form>`;
  const form = $("#appearance-form", host),
    get = () => Object.fromEntries(new FormData(form)),
    preview = () => {
      try {
        appearance = validateAppearance(get());
        applyAppearance(appearance, $("#appearance-preview", host));
        $("#contrast-result", host).textContent = t("Contrast checks passed");
      } catch (err) {
        $("#contrast-result", host).textContent = t(err.message);
      }
    };
  form.oninput = preview;
  $("#appearance-reset", host).onclick = () => {
    for (const [k, v] of Object.entries(appearanceDefaults))
      form.elements[k].value = v;
    preview();
  };
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const buttons = $$("button", form);
    buttons.forEach((b) => (b.disabled = true));
    try {
      appearance = validateAppearance(get());
      const payload = { ...draft, appearance };
      await api(
        db()
          .from("hm_settings_drafts")
          .upsert({
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
    } catch (err) {
      toast(err.message, true);
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  };
  preview();
}
export async function playerAccessPanel(root) {
  const host = document.createElement("div");
  root.replaceChildren(host);
  try {
    const [players, access] = await Promise.all([
      all("players"),
      api(db().rpc("hm_player_access")),
    ]);
    if (!host.isConnected) return;
    host.innerHTML = `<p class="note">${t("Player accounts are separate from the two team admins. Players set their own passwords.")}</p><div class="toolbar"><input type="search" id="access-search" placeholder="${t("Search players")}" aria-label="${t("Search players")}"></div><div class="admin-card" id="player-access-list"></div><section class="admin-card"><h3>${t("Invite player")}</h3><form id="player-invite-form"><div class="form-grid"><label class="field"><span>${t("Player")}</span><select name="player" required>${players.map((p) => `<option value="${p.id}">${e(p.name)} · #${p.jersey}</option>`).join("")}</select></label><label class="field"><span>${t("Email")}</span><input name="email" type="email" required></label></div><button class="btn" ${players.length ? "" : "disabled"}>${t("Create invitation link")}</button></form><div id="player-invite-result" class="invite-result" hidden><p class="note">${t("Share this link privately with the intended player. It expires in 48 hours.")}</p><input id="player-invite-link" readonly aria-label="${t("Invitation link")}"><button class="btn secondary" id="copy-player-invite">${t("Copy link")}</button></div></section>`;
    const draw = () => {
      const q = $("#access-search", host).value.toLowerCase();
      $("#player-access-list", host).innerHTML =
        `<div class="table-wrap"><table><thead><tr>${["Player", "Status", "Email", "Expires", "Action"].map((k) => `<th>${t(k)}</th>`).join("")}</tr></thead><tbody>${players
          .filter((p) => [p.name, p.jersey].join(" ").toLowerCase().includes(q))
          .map((p) => {
            const a = access.find((a) => a.player_id === p.id);
            return `<tr><td>${e(p.name)} #${p.jersey}</td><td><span class="badge">${t(a?.linked ? "Connected" : a ? (new Date(a.expires_at) > new Date() ? "Pending" : "Expired") : "Not invited")}</span></td><td>${e(a?.email || "—")}</td><td>${a?.expires_at ? date(a.expires_at) : "—"}</td><td>${a ? `<button class="text-btn" data-revoke="${p.id}" data-linked="${!!a.linked}">${t(a.linked ? "Remove player access" : "Revoke invitation")}</button>` : "—"}</td></tr>`;
          })
          .join("")}</tbody></table></div>`;
      $$("[data-revoke]", host).forEach(
        (b) =>
          (b.onclick = async () => {
            if (
              !confirm(t("Revoke this access? The player history will remain."))
            )
              return;
            b.disabled = true;
            try {
              await api(
                db().rpc("hm_revoke_player", {
                  p_player: b.dataset.revoke,
                  p_unlink: b.dataset.linked === "true",
                }),
              );
              await playerAccessPanel(root);
              toast(t("Saved."));
            } catch (err) {
              toast(err.message, true);
              b.disabled = false;
            }
          }),
      );
    };
    $("#access-search", host).oninput = draw;
    draw();
    $("#player-invite-form", host).onsubmit = async (ev) => {
      ev.preventDefault();
      const b = ev.submitter;
      b.disabled = true;
      try {
        const f = new FormData(ev.currentTarget),
          token = await api(
            db().rpc("hm_player_invite", {
              p_player: f.get("player"),
              p_email: f.get("email"),
            }),
          ),
          u = new URL("player.html", location.href);
        u.searchParams.set("invite", token);
        $("#player-invite-link", host).value = u.href;
        $("#player-invite-result", host).hidden = false;
        const fresh = await api(db().rpc("hm_player_access"));
        access.splice(0, access.length, ...fresh);
        draw();
      } catch (err) {
        toast(err.message, true);
      } finally {
        b.disabled = false;
      }
    };
    $("#copy-player-invite", host).onclick = async () => {
      try {
        await navigator.clipboard.writeText(
          $("#player-invite-link", host).value,
        );
        toast(t("Copied."));
      } catch {
        $("#player-invite-link", host).select();
        toast(t("Select and copy the link."));
      }
    };
  } catch (err) {
    if (host.isConnected) host.textContent = err.message;
  }
}
