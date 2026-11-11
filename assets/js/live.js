import { S, $, t, db, api, settings, shell, head, flag } from "./core.js";
import { liveMarkup } from "./live-view.js";
const main = $("#main"),
  id = new URLSearchParams(location.search).get("match");
let timer,
  fetching = false,
  stopped = false;
await settings();
shell();
main.innerHTML =
  head("Live match", "Every ball. Together.") +
  '<section class="wrap section"><p class="note" id="connection" role="status"></p><div id="live-score"></div></section>';
async function refresh() {
  if (stopped || fetching || document.hidden) return;
  fetching = true;
  try {
    const previous = S.revision;
    await settings();
    if (previous !== S.revision) shell();
    if (!flag("live") || S.config.flags.maintenance) {
      $("#live-score").innerHTML = liveMarkup(null);
      $("#connection").textContent = t("Live viewer is currently off");
      return;
    }
    const data = db()
      ? await api(db().rpc("hm_live_view", { p_match: id }))
      : null;
    $("#live-score").innerHTML = liveMarkup(data);
    $("#connection").textContent = t(
      db()
        ? "Connected · updates every 5 seconds"
        : "Waiting for the team to connect its live service",
    );
  } catch {
    // Fail closed: a lost authorization check must not retain private score data.
    $("#live-score").innerHTML = "";
    $("#connection").textContent = t("Connection lost. Reconnecting…");
  } finally {
    fetching = false;
  }
}
await refresh();
timer = setInterval(refresh, 5000);
document.addEventListener("visibilitychange", refresh);
window.addEventListener("online", refresh);
if (db())
  db().auth.onAuthStateChange((event) => {
    if (["SIGNED_OUT", "SIGNED_IN"].includes(event)) {
      const el = $("#live-score");
      if (el) el.innerHTML = "";
      setTimeout(refresh, 0);
    }
  });
window.addEventListener("pagehide", () => {
  stopped = true;
  clearInterval(timer);
});
