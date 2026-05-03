import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://luznrsvdmlwcajoxaekn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY não encontrada.");
  console.error("   Adicione a secret no Replit e rode novamente.");
  process.exit(1);
}

const sql = readFileSync(join(__dirname, "supabase-stock-rpc.sql"), "utf-8");

const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => (s.endsWith(";") ? s : s + ";"));

let ok = 0;
let fail = 0;

for (const stmt of statements) {
  if (!stmt || stmt.startsWith("--")) continue;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
  });
  void res;
}

// Run via pg REST direct SQL endpoint
const pgRes = await fetch(
  `${SUPABASE_URL}/pg/query`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  }
);

if (pgRes.ok) {
  console.log("✅ Migration aplicada com sucesso!");
} else {
  const err = await pgRes.text();
  // Fallback: try management API
  const mgmtRes = await fetch(
    `https://api.supabase.com/v1/projects/luznrsvdmlwcajoxaekn/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (mgmtRes.ok) {
    console.log("✅ Migration aplicada com sucesso via Management API!");
  } else {
    const mgmtErr = await mgmtRes.text();
    console.error("❌ Falha ao aplicar migration:", err);
    console.error("   Management API:", mgmtErr);
    console.error("\n📋 Rode o SQL manualmente no Supabase SQL Editor:");
    console.error(sql);
    process.exit(1);
  }
}
