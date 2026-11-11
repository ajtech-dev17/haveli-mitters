import { applyAppearance } from "./appearance.js";
import { ur, en } from "./i18n.js";
export const defaults = {
  brand_name: "Haveli Mitters",
  brand_name_ur: "حویلی مِٹرز",
  headline: "Play with pride. Rise together.",
  headline_ur: "فخر سے کھیلو۔ مل کر آگے بڑھو۔",
  subtitle:
    "The home of our team. Every player, every innings, every moment that brings us together.",
  subtitle_ur:
    "ہماری ٹیم کا مرکز۔ ہر کھلاڑی، ہر اننگز اور ہر یادگار لمحہ ایک جگہ۔",
  logo_url: "assets/images/team-logo.png",
  default_theme: "dark",
  default_language: "en",
  timezone: "Asia/Karachi",
  profile_default: "public",
  stats_default: "public",
  force_private: false,
  appearance: {},
  office_address: "",
  office_address_ur: "",
  office_map_url: "",
  gallery_categories: "win,team,training,special",
  flags: {
    squad: true,
    matches: true,
    stats: true,
    moments: true,
    social: true,
    location: true,
    countdown: true,
    leaders: true,
    orbit: true,
    audio: true,
    video: true,
    sociallinks: true,
    live_location: true,
    team: true,
    live: true,
    player: true,
    back_to_top: true,
    theme_switch: true,
    language_switch: true,
    maintenance: false,
  },
};
export const S = {
  config: structuredClone(defaults),
  revision: 0,
  players: [],
  matches: [],
  stats: [],
  media: [],
  locations: [],
  user: null,
  role: null,
  readableStats: new Set(),
};
export const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const page = document.body.dataset.page;
export const getPref = (k) => {
  try {
    return localStorage.getItem("hm-" + k);
  } catch {
    return null;
  }
};
export const setPref = (k, v) => {
  try {
    localStorage.setItem("hm-" + k, v);
  } catch {}
};
export const lang = () =>
  getPref("language") || S.config.default_language || "en";
export const t = (s) => (lang() === "ur" ? ur[s] || s : en[s] || s);
export const e = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const local = (o, k) =>
  lang() === "ur" && o[k + "_ur"] ? o[k + "_ur"] : o[k] || "";
export const n = (v) =>
  v == null
    ? "—"
    : Number.isInteger(Number(v))
      ? Number(v).toLocaleString("en")
      : Number(v).toFixed(2);
export const flag = (k) => S.config.flags[k] !== false;
export function url(v) {
  if (typeof v !== "string" || !v.trim()) return "";
  try {
    const u = new URL(v, location.href);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}
export function date(v, short = false) {
  if (!v) return "—";
  return new Date(v).toLocaleString(lang() === "ur" ? "ur-PK" : "en-GB", {
    timeZone: S.config.timezone || "Asia/Karachi",
    day: "numeric",
    month: "short",
    year: short ? undefined : "numeric",
    hour: short ? undefined : "2-digit",
    minute: short ? undefined : "2-digit",
  });
}
let client;
export function db() {
  if (client) return client;
  const c = window.HM_CONFIG || {};
  if (!c.supabaseUrl || !c.publishableKey || !window.supabase) return null;
  client = window.supabase.createClient(c.supabaseUrl, c.publishableKey, {
    global: {
      fetch: async (input, init = {}) => {
        const controller = new AbortController(),
          cancel = () => controller.abort();
        const original = init.signal;
        if (original?.aborted) cancel();
        else original?.addEventListener("abort", cancel, { once: true });
        const timeout = setTimeout(
          cancel,
          String(input).includes("/storage/") ? 120000 : 15000,
        );
        try {
          return await fetch(input, { ...init, signal: controller.signal });
        } finally {
          clearTimeout(timeout);
          original?.removeEventListener("abort", cancel);
        }
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
export async function api(query) {
  const r = await query;
  if (r.error) throw Error(t(r.error.message));
  return r.data;
}
export async function all(table, publicOnly = false) {
  if (!db()) return [];
  let out = [];
  for (let start = 0; ; start += 500) {
    let q = db()
      .from("hm_" + table)
      .select("*")
      .order(
        table === "stats" ? "match_id" : table === "location" ? "id" : "id",
        { ascending: true },
      )
      .range(start, start + 499);
    if (table === "stats") q = q.order("player_id", { ascending: true });
    if (publicOnly && ["players", "matches", "media"].includes(table))
      q = q.eq("published", true);
    if (publicOnly && table === "players") q = q.neq("status", "removed");
    const data = await api(q);
    out.push(...data);
    if (data.length < 500) break;
  }
  return out;
}
export async function settings() {
  if (db()) {
    try {
      const r = await api(
        db().from("hm_settings").select("*").eq("id", 1).single(),
      );
      S.config = {
        ...defaults,
        ...r.config,
        flags: { ...defaults.flags, ...r.config.flags },
      };
      S.revision = r.revision;
      S.loadError = null;
    } catch (error) {
      S.loadError = error.message;
    }
  }
  applyPreferences();
}
export function applyPreferences() {
  document.documentElement.lang = lang();
  document.documentElement.dir = lang() === "ur" ? "rtl" : "ltr";
  document.documentElement.dataset.theme =
    getPref("theme") || S.config.default_theme || "dark";
  applyAppearance(S.config.appearance);
}
export function brand() {
  return `<a class="brand" href="index.html"><img src="${e(url(S.config.logo_url))}" alt="${e(local(S.config, "brand_name"))}" width="56" height="56"><span><strong>${e(local(S.config, "brand_name"))}</strong><small>${t("Official team portal")}</small></span></a>`;
}
export const routes = [
  ["home", "index.html", "Home"],
  ["team", "team.html", "Our team"],
  ["squad", "squad.html", "Players"],
  ["live", "live.html", "Live match"],
  ["matches", "matches.html", "Matches"],
  ["stats", "stats.html", "Stats"],
  ["moments", "moments.html", "Moments"],
  ["social", "social.html", "Social & media"],
  ["location", "location.html", "Location"],
  ["player", "player.html", "Player login"],
];
export function themeButtons() {
  return `${flag("language_switch") ? '<button class="icon-btn" data-language aria-label="Language">' + (lang() === "ur" ? "EN" : "اردو") + "</button>" : ""}${flag("theme_switch") ? '<button class="icon-btn" data-theme aria-label="' + t("Theme") + '">◐</button>' : ""}`;
}
export function shell() {
  $("#header").innerHTML =
    `<header class="header"><div class="wrap header-inner">${brand()}<nav class="nav" id="navigation" aria-label="${t("Home")}">${routes
      .filter((r) => r[0] === "home" || flag(r[0]))
      .map(
        (r) =>
          `<a href="${r[1]}" ${page === r[0] ? 'aria-current="page"' : ""}>${t(r[2])}</a>`,
      )
      .join(
        "",
      )}</nav><div class="actions">${themeButtons()}<button class="icon-btn menu-btn" id="menu" aria-label="${t("Toggle menu")}" aria-controls="navigation" aria-expanded="false">☰</button></div></div></header>`;
  $("#footer").innerHTML =
    `<footer class="footer"><div class="wrap footer-grid">${brand()}<small>© ${new Date().getFullYear()} ${e(local(S.config, "brand_name"))}<br>${t("One team. One standard.")}</small><button class="developer-trigger" id="developer"><span class="dev-mark">AJ</span><span><small>${t("Crafted by")}</small><strong>AJTech.dev</strong></span><span>→</span></button></div></footer>${flag("back_to_top") ? `<button class="back-top" aria-label="${t("Back to top")}" data-top>↑</button>` : ""}`;
  $("#menu")?.addEventListener("click", () => {
    const on = $("#navigation").classList.toggle("open");
    $("#menu").setAttribute("aria-expanded", on);
  });
  $("#developer")?.addEventListener("click", developer);
  bindCommon();
}
export function bindCommon() {
  $$("[data-theme]")
    .filter((el) => el.tagName === "BUTTON")
    .forEach(
      (b) =>
        (b.onclick = () => {
          setPref(
            "theme",
            document.documentElement.dataset.theme === "dark"
              ? "light"
              : "dark",
          );
          applyPreferences();
        }),
    );
  $$("[data-language]").forEach(
    (b) =>
      (b.onclick = () => {
        setPref("language", lang() === "en" ? "ur" : "en");
        location.reload();
      }),
  );
  $$("[data-top]").forEach(
    (b) => (b.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" })),
  );
  $$("[data-close]").forEach(
    (b) => (b.onclick = () => b.closest("dialog").close()),
  );
}
export function dialog(title, body) {
  const d = $("#modal");
  d.oncancel = null;
  d.innerHTML = `<div class="dialog-head"><h3>${e(title)}</h3><button class="icon-btn" data-close aria-label="${t("Close")}">×</button></div><div class="dialog-body">${body}</div>`;
  bindCommon();
  if (!d.open) d.showModal();
  return d;
}
export const DEVELOPER = Object.freeze({
  brand: "AJTech.dev",
  url: "https://ranaasad-dev.github.io/ajtech-connect/",
});
export function developer() {
  const d = dialog(
    DEVELOPER.brand,
    `<p class="note">${t("Website development & ongoing support")}</p><div class="developer-embed"><iframe title="AJTech.dev developer card" src="${DEVELOPER.url}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p class="note">${t("If the card does not load, open it directly.")}</p><a class="btn" href="${DEVELOPER.url}" target="_blank" rel="noopener noreferrer">${t("Open developer card")} ↗</a>`,
  );
  d.addEventListener(
    "close",
    () => {
      d.querySelector("iframe")?.remove();
    },
    { once: true },
  );
}
let toastTimer;
export function toast(message, error = false) {
  const el = $("#toast");
  el.textContent = message;
  el.className = "toast" + (error ? " error" : "");
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 6500);
}
export function empty(
  title = "No records yet",
  text = "New team updates will appear here.",
) {
  return `<div class="empty"><strong>${t(title)}</strong>${t(text)}</div>`;
}
export function head(k, title, desc = "") {
  return `<div class="wrap page-head"><div class="breadcrumb"><a href="index.html">${t("Home")}</a> / ${t(k)}</div><p class="eyebrow">${t(k)}</p><h1>${t(title)}</h1>${desc ? "<p>" + t(desc) + "</p>" : ""}</div>`;
}
export function metrics(items) {
  return items
    .map(
      ([k, v]) =>
        `<div class="metric"><small>${t(k)}</small><strong class="ltr">${e(v ?? "—")}</strong></div>`,
    )
    .join("");
}
export function safeImages(root = document) {
  $$("img", root).forEach((i) =>
    i.addEventListener(
      "error",
      () => {
        i.hidden = true;
        i.parentElement.classList.add("image-missing");
      },
      { once: true },
    ),
  );
}
export async function upload(file) {
  if (!file) return "";
  const limits = {
    "image/jpeg": 5,
    "image/png": 5,
    "image/webp": 5,
    "audio/mpeg": 20,
    "audio/mp4": 20,
    "audio/ogg": 20,
    "audio/wav": 20,
    "video/mp4": 40,
    "video/webm": 40,
  };
  if (!limits[file.type] || file.size > limits[file.type] * 1024 * 1024)
    throw Error(
      "Use JPG/PNG/WebP up to 5 MB, audio up to 20 MB, or MP4/WebM up to 40 MB.",
    );
  const ext = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "video/mp4": "mp4",
    "video/webm": "webm",
  }[file.type];
  const path = crypto.randomUUID() + "." + ext;
  await api(
    db()
      .storage.from("hm-media")
      .upload(path, file, { contentType: file.type, upsert: false }),
  );
  return db().storage.from("hm-media").getPublicUrl(path).data.publicUrl;
}

const portraitBlobs = new Map();
export function clearPortraits() {
  for (const v of portraitBlobs.values()) URL.revokeObjectURL(v);
  portraitBlobs.clear();
}
export async function hydratePortraits(players) {
  await Promise.allSettled(
    players.map(async (p) => {
      if (!p.photo_path || !db()) return;
      try {
        let src = portraitBlobs.get(p.photo_path);
        if (!src) {
          const blob = await api(
            db().storage.from("hm-portraits").download(p.photo_path),
          );
          src = URL.createObjectURL(blob);
          portraitBlobs.set(p.photo_path, src);
        }
        p._photo = src;
      } catch {
        p._photo = "";
      }
    }),
  );
  return players;
}
export async function uploadPortrait(file, id) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw Error("Use JPG/PNG/WebP up to 5 MB");
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
    file.type
  ];
  const path = id + "/" + crypto.randomUUID() + "." + ext;
  await api(
    db()
      .storage.from("hm-portraits")
      .upload(path, file, { contentType: file.type, upsert: false }),
  );
  return path;
}
export async function refreshReadableStats() {
  S.readableStats = new Set(
    db() ? await api(db().rpc("hm_readable_stats")) : [],
  );
}
export const canSeeStats = (id) => S.readableStats.has(id);
window.addEventListener("pagehide", clearPortraits);
