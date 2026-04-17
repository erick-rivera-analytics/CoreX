import fs from "node:fs";

const requiredDocs = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "docs/README.md",
  "docs/quality-baseline.md",
  "docs/reuse-index.md",
  "docs/extender-modulos.md",
  "docs/ui-canon.md",
  "docs/security-ops.md",
  "docs/chatbot.md",
  "docs/testing.md",
  "docs/despliegue.md",
  "docs/definition-of-done.md",
  "docs/module-contracts.md",
];

const failures = [];

for (const file of requiredDocs) {
  if (!fs.existsSync(file)) failures.push(`Falta documento requerido: ${file}`);
}

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
for (const script of ["check", "canon:check", "docs:check", "typecheck", "lint", "test", "build"]) {
  if (!packageJson.scripts?.[script]) failures.push(`Falta script package.json: ${script}`);
}

const envExample = fs.existsSync(".env.example") ? fs.readFileSync(".env.example", "utf8") : "";
for (const envName of ["SESSION_SECRET", "COOKIE_SECURE", "APP_ORIGIN", "API_ORIGIN_CHECK_ENABLED"]) {
  if (!envExample.includes(`${envName}=`)) failures.push(`Falta variable en .env.example: ${envName}`);
}

if (failures.length > 0) {
  console.error("Docs check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.info("Docs check passed.");
