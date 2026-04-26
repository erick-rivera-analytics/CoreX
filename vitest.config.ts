import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Shim para Next.js `server-only` — package real es vacío en producción
      // (Next.js lo bloquea en client bundle); en vitest necesitamos noop
      // explícito porque el resolver no lo encuentra. Permite que tests de
      // src/lib/users.ts (auth-session, dead-plants-reseed) se carguen.
      "server-only": path.resolve(__dirname, "vitest-shims/server-only.ts"),
    },
  },
  test: {
    globals: true,
    // Excluir specs E2E (Playwright opt-in, requiere `@playwright/test`).
    // Mantener excludes default de vitest (node_modules, dist, .next, etc).
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.{idea,git,cache,output,temp}/**",
      "tests/e2e/**",
    ],
  },
});
