import fs from "node:fs";
import path from "node:path";
const dest = path.resolve("dist");
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
for (const name of fs.readdirSync("."))
  if (name.endsWith(".html")) fs.copyFileSync(name, path.join(dest, name));
fs.cpSync("assets", path.join(dest, "assets"), { recursive: true });
fs.writeFileSync(path.join(dest, ".nojekyll"), "");
if (fs.existsSync("robots.txt"))
  fs.copyFileSync("robots.txt", path.join(dest, "robots.txt"));
console.log(
  "Built static website in dist/ (source SQL, tests and private project files excluded).",
);
