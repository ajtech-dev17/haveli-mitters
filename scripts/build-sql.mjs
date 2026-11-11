import fs from "node:fs";
const body = (p) =>
  fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter((x) => !["begin;", "commit;"].includes(x.trim().toLowerCase()))
    .join("\n");
const ext = body("sql/upgrade-v3.sql") + "\n" + body("sql/live-v3.sql");
fs.writeFileSync(
  "sql/setup.sql",
  "-- 01 - Haveli Mitters - HM Database Setup v3.1\n-- Fresh HM installation. Existing old-prefix database: use migrate-prefix.sql.\nbegin;\n" +
    "do $$ begin if exists(select 1 from pg_tables where schemaname='public' and left(tablename,3)='hh_') then raise exception 'Existing old-prefix tables found. Use sql/migrate-prefix.sql; do not create a second database beside them.'; end if; end $$;\n" +
    body("sql/base-v2.sql") +
    "\n" +
    ext +
    "\ncommit;\n",
);
fs.writeFileSync(
  "sql/upgrade-v3-complete.sql",
  "-- EXISTING HM V2 UPGRADE ONLY. For old-prefix v2/v3 use migrate-prefix.sql.\nbegin;\n" +
    ext +
    "\ncommit;\n",
);
fs.writeFileSync(
  "sql/migrate-prefix.sql",
  "-- 03 - Haveli Mitters - HM Prefix Migration v3.1\n-- Existing old-prefix v2/v3 ONLY. Back up first; read docs/HM-MIGRATION.md.\n-- One transaction: an error rolls back the database rename.\nbegin;\n" +
    body("sql/rename-prefix.sql") + "\n" + body("sql/repair-media-policies.sql") + "\n" + ext +
    "\nnotify pgrst, 'reload schema';\ncommit;\n",
);
