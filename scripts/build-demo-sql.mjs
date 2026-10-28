// Rebuilds supabase/demo-setup.sql: all migrations + the demo data in one file,
// so a demo Supabase project can be set up by pasting it into the SQL Editor.
// Run with: npm run db:demo-sql
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const header = `-- =============================================================================
-- Loop: ONE-STEP DEMO SETUP
--
-- Paste this whole file into a NEW Supabase project (SQL Editor → New query →
-- paste → Run). It creates all the tables and security rules, then fills them
-- with fake demo students, clubs and events.
--
-- Only for a DEMO project. For the real school site, follow DEPLOY.md instead.
-- This file is made from supabase/migrations/*.sql + supabase/seed.sql
-- by scripts/build-demo-sql.mjs. Don't edit it by hand.
-- =============================================================================
`;

const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort().map((f) => `supabase/migrations/${f}`);
files.push("supabase/seed.sql");
const body = files.map((f) => `\n-- >>> ${f}\n${readFileSync(f, "utf8")}`).join("\n");
writeFileSync("supabase/demo-setup.sql", header + body);
console.log(`Wrote supabase/demo-setup.sql from ${files.length} files.`);
