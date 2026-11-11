import test from "node:test";
import assert from "node:assert/strict";
import {
  appearanceDefaults,
  validateAppearance,
  contrast,
} from "../assets/js/appearance.js";
import { aggregate } from "../assets/js/stats.js";
test("default palette is readable and invalid colors/fonts are rejected", () => {
  assert.deepEqual(validateAppearance(), appearanceDefaults);
  assert.equal(contrast("#000000", "#ffffff"), 21);
  assert.throws(
    () => validateAppearance({ dark_bg: "#111111", dark_text: "#121212" }),
    /contrast/,
  );
  assert.throws(
    () => validateAppearance({ font_body: "url(evil)" }),
    /supported/,
  );
  assert.throws(
    () => validateAppearance({ dark_gold: "red;display:none" }),
    /six-digit/,
  );
});
test("highest score preserves not-out status, including tied scores", () => {
  const rows = [
    { batted: true, runs: 88, balls: 50, not_out: false },
    { batted: true, runs: 88, balls: 50, not_out: true },
  ];
  const s = aggregate(rows);
  assert.equal(s.highest, 88);
  assert.equal(s.highest_not_out, true);
  assert.equal(s.average, 176);
});
