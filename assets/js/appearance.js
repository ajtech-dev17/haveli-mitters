export const appearanceDefaults = Object.freeze({
  dark_bg: "#171310",
  dark_panel: "#211b17",
  dark_text: "#f5ebda",
  dark_gold: "#d8b574",
  light_bg: "#f5f0e7",
  light_panel: "#fffdf8",
  light_text: "#30231b",
  light_gold: "#896229",
  font_body: "dm",
  font_heading: "manrope",
  font_urdu: "noto",
});
export const fonts = {
  dm: '"DM Sans", sans-serif',
  manrope: "Manrope, sans-serif",
  system: "system-ui, sans-serif",
  georgia: "Georgia, serif",
};
function luminance(hex) {
  const a = hex
    .slice(1)
    .match(/../g)
    .map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}
export function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function validateAppearance(value = {}) {
  const a = { ...appearanceDefaults, ...value };
  for (const key of Object.keys(appearanceDefaults)) {
    if (key.startsWith("font_")) {
      if (
        key === "font_urdu"
          ? !["noto", "system"].includes(a[key])
          : !Object.hasOwn(fonts, a[key])
      )
        throw Error("Choose a supported font");
    } else if (!/^#[0-9a-f]{6}$/i.test(a[key]))
      throw Error("Use a six-digit hex color");
  }
  for (const mode of ["dark", "light"]) {
    if (
      contrast(a[mode + "_text"], a[mode + "_bg"]) < 4.5 ||
      contrast(a[mode + "_text"], a[mode + "_panel"]) < 4.5
    )
      throw Error(
        "Text contrast must be at least 4.5:1 against the background and cards",
      );
    if (contrast(a[mode + "_gold"], a[mode + "_bg"]) < 3)
      throw Error("Accent contrast must be at least 3:1");
  }
  return a;
}
export function applyAppearance(
  value = {},
  scope = document.documentElement,
  mode = document.documentElement.dataset.theme,
) {
  let a;
  try {
    a = validateAppearance(value);
  } catch {
    a = appearanceDefaults;
  }
  const m = mode === "light" ? "light" : "dark";
  for (const k of ["bg", "panel", "text", "gold"])
    scope.style.setProperty("--" + k, a[m + "_" + k]);
  scope.style.setProperty(
    "--panel2",
    m === "dark" && a.dark_panel === appearanceDefaults.dark_panel
      ? "#2a221c"
      : m === "light" && a.light_panel === appearanceDefaults.light_panel
        ? "#eee4d4"
        : a[m + "_panel"],
  );
  scope.style.setProperty("--line", a[m + "_gold"] + "35");
  scope.style.setProperty(
    "--muted",
    `color-mix(in srgb, ${a[m + "_text"]} 72%, ${a[m + "_bg"]})`,
  );
  scope.style.setProperty(
    "--on-gold",
    contrast(a[m + "_gold"], "#171310") >= 4.5
      ? "#171310"
      : contrast(a[m + "_gold"], "#ffffff") >= 4.5
        ? "#ffffff"
        : "#000000",
  );
  const ur = document.documentElement.lang === "ur";
  scope.style.setProperty(
    "--body-font",
    ur
      ? a.font_urdu === "noto"
        ? '"Noto Sans Arabic",sans-serif'
        : "system-ui,sans-serif"
      : fonts[a.font_body],
  );
  scope.style.setProperty(
    "--heading-font",
    ur
      ? a.font_urdu === "noto"
        ? '"Noto Sans Arabic",sans-serif'
        : "system-ui,sans-serif"
      : fonts[a.font_heading],
  );
}
