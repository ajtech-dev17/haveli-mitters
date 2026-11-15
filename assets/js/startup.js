// A plain script can explain local file loading even when ES modules are blocked.
(() => {
  const message = (title, body) => {
    const loader = document.querySelector(".loading-state");
    if (!loader) return;
    const heading = document.createElement("h2");
    heading.textContent = title;
    const detail = document.createElement("p");
    detail.textContent = body;
    loader.querySelectorAll("p,h2").forEach((el) => el.remove());
    loader.append(heading, detail);
  };
  if (location.protocol === "file:") {
    message(
      "Open with a local web server",
      "In VS Code, right-click index.html → Open with Live Server. Or run: python -m http.server 8000, then open http://localhost:8000/. یہ پروجیکٹ براہِ راست فائل کھولنے سے نہیں چلے گا۔",
    );
    return;
  }
  setTimeout(
    () =>
      message(
        "The clubhouse is taking a little longer",
        "Check your connection and reload this page. / اپنا انٹرنیٹ کنکشن چیک کریں اور صفحہ دوبارہ کھولیں۔",

        // --- SQUAD SYSTEM STARTUP DISPATCHER ---
document.addEventListener('DOMContentLoaded', () => {
    const pageType = document.body.getAttribute('data-page');

    if (pageType === 'admin') {
        setTimeout(() => {
            if (typeof renderAdminSquadManager === 'function') {
                renderAdminSquadManager();
            }
        }, 500); // Thoda delay taaki DOM fully load ho jaye
    } else if (pageType === 'team') {
        setTimeout(() => {
            if (typeof renderActiveTeamSquad === 'function') {
                renderActiveTeamSquad();
            }
        }, 500);
    }
});
      ),
    18000,
  );
})();
