import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const root = process.cwd();
// Migration scripts intentionally mention the previous prefix; deployed code must not.
for (const file of [
  ...fs.readdirSync(root).filter((x) => x.endsWith('.html')),
  ...fs.readdirSync('assets/js').filter((x) => x.endsWith('.js')).map((x) => 'assets/js/' + x),
]) {
  if (/\b(?:hh_|HH_|hh-|HH-)/.test(fs.readFileSync(file, 'utf8')))
    throw Error(file + ': old team identifier found; use HM/hm.');
}
for (const name of fs.readdirSync("assets/js"))
  if (name.endsWith(".js"))
    execFileSync(process.execPath, [
      "--check",
      path.join(root, "assets/js", name),
    ]);
for (const file of fs.readdirSync(root).filter((x) => x.endsWith(".html"))) {
  const html = fs.readFileSync(file, "utf8");
  for (const [, href] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(https?:|#|data:)/.test(href)) continue;
    if (!fs.existsSync(path.join(root, href)))
      throw Error(file + ": missing " + href);
  }
}
console.log("JavaScript syntax and static HTML asset paths passed.");
