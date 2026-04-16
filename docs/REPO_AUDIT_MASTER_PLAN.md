> LEGACY / reference only.

# CoreX Greenfield Rewrite — Master Plan



## Context



CoreX is an agricultural operations intelligence dashboard ("Centro de Inteligencia Empresarial") connecting to PostgreSQL (datalakehouse) with materialized views in `gld`/`slv`/`mdl` schemas. The current codebase has 183 files, 33,592 LOC, 24 pages, 37 API endpoints. It works, but suffers from:



- **Monolithic UI components** (3 files >1000 LOC, 13 files >500 LOC, 28 files >300 LOC)

- **No shared component system** — each module has its own tables, forms, overlays

- **No tests** — only 1 unit test file (68 LOC)

- **Security holes** — session secret defaults to dev value, env admin bypass, no rate limiting, no CSRF, no audit logging

- **Visual inconsistency** — each explorer looks different, no unified design language

- **Business logic mixed with UI** — explorers contain formatting, state machines, data transformation



**Why rewrite instead of refactor:** The structural debt is baked into every layer. Every explorer is a monolith. There is no shared table, form, or overlay system to refactor toward. Building a canonical component system and migrating modules to it is equivalent effort to a greenfield rewrite, but the greenfield approach produces cleaner results because we don't carry legacy patterns.



**What we preserve:** All SQL queries (they connect to real PostgreSQL materialized views), the auth architecture (HMAC sessions + RBAC), the API route pattern (thin wrappers), the navigation catalog (resource keys, permissions), and the server cache approach. We preserve the LOGIC, not the CODE.



---



## Phase 0 — Audit Summary



### Current Functional Modules (all operational)



| Module | Pages | API Endpoints | Key Old Files |

|--------|-------|---------------|---------------|

| Dashboard Home | 1 | 0 | `page.tsx` (111 LOC) |

| Fenograma | 1 | 8 | `fenograma.ts` (2621), `fenograma-block-modal.tsx` (2496), `fenograma-explorer.tsx` (299), `fenograma-pivot-table.tsx` (621) |

| Campo | 1 | 0 | `campo.ts` (363), `campo-map.tsx` (944), `campo-explorer.tsx` (624), `campo-sub-map-modal.tsx` (693) |

| Mortality | 1 | 6 | `mortality.ts` (667), `mortality-explorer.tsx` (300), `mortality-table.tsx` (215) |

| Comparacion | 1 | 2 | `comparacion.ts` (657), `comparison-explorer.tsx` (509) |

| Productividad | 1 | 2 | `productividad.ts` (499), `productividad-explorer.tsx` (788) |

| Programaciones | 1 | 3 | `programaciones.ts` (166), `programaciones-explorer.tsx` (812) |

| Postcosecha Balanzas | 1 | 1 | `postcosecha-balanzas.ts` (1427), `balanzas-explorer.tsx` (737) |

| Postcosecha SKUs | 1 | 2 | `postcosecha-skus.ts` (634), `postcosecha-skus-explorer.tsx` (745) |

| Postcosecha Clasificacion | 1 | 2 | `postcosecha-clasificacion-en-blanco.ts` (520), explorer (1076) |

| Talento Humano (3 views) | 3 | 4 | `talento-humano.ts` (875), `talento-shared.tsx` (657) |

| Admin Usuarios | 1 | 3 | `users.ts` (245), `usuarios-explorer.tsx` (687) |

| Perfil | 1 | 1 | `page.tsx` (154) |

| Chat | 0 | 1 | `chat/route.ts` (108), `chatbot-modal.tsx` (175) |

| Login | 1 | 3 | `login/page.tsx` (211), `auth.ts` (102) |



### Critical Security Issues



| Severity | Issue | Location |

|----------|-------|----------|

| HIGH | SESSION_SECRET defaults to dev value | `core/auth/session.ts:13-22` |

| HIGH | Env admin bypass (ADMIN_USERNAME/PASSWORD) | `lib/auth.ts:20-26` |

| MEDIUM | No rate limiting on login | All auth routes |

| MEDIUM | No CSRF protection | No implementation |

| MEDIUM | No session revocation mechanism | Cookie-only, no blacklist |

| MEDIUM | No audit logging | No implementation |

| LOW | No input validation library | Manual string checks |

| LOW | No pagination on user list | `lib/users.ts` |



### Architecture Issues



| Issue | Impact |

|-------|--------|

| No shared table component | Each module builds its own `<table>` |

| No shared form system | Each CRUD module has ad-hoc forms |

| No shared overlay system | Modals/sheets differ between modules |

| fenograma-block-modal.tsx: 2496 LOC | Untestable, unmaintainable monolith |

| fenograma.ts: 2621 LOC | All queries + types + transforms in one file |

| postcosecha-balanzas.ts: 1427 LOC | Same problem |

| 47 client components, 0 component tests | No quality gate |

| Business logic in UI | Formatting, derivation, state machines in explorers |



---



## Phase 1 — Target Architecture



### Structure



```

src/

  app/

    (public)/

      login/page.tsx

    (dashboard)/

      layout.tsx                    # AppShell wrapper

      dashboard/

        page.tsx                    # Home

        fenograma/page.tsx

        campo/page.tsx

        mortality/page.tsx

        comparacion/page.tsx

        productividad/page.tsx

        programaciones/page.tsx

        perfil/page.tsx

        postcosecha/

          balanzas/page.tsx

          administrar-maestros/skus/page.tsx

          planificacion/

            programaciones/page.tsx

            plan-de-trabajo/page.tsx

            solver/clasificacion-en-blanco/page.tsx

          registros/page.tsx

        talento-humano/

          composicion-laboral/page.tsx

          demografia-personal/page.tsx

          rotacion-laboral/page.tsx

        admin/seguridad/usuarios/page.tsx

    api/                            # API routes (thin wrappers)

      auth/login/route.ts

      auth/logout/route.ts

      auth/me/route.ts

      health/db/route.ts

      fenograma/...

      mortality/...

      (same structure as current, migrated)

    layout.tsx                      # Root layout

    loading.tsx

    not-found.tsx

    global-error.tsx



  modules/                          # Domain modules (business logic)

    auth/

      components/login-form.tsx

      actions/login.ts

      schemas.ts

    users/

      queries.ts                    # MIGRATE-LOGIC from lib/users.ts

      types.ts

      schemas.ts

      components/

        users-page.tsx

        users-table.tsx

        user-form-dialog.tsx

    fenograma/

      queries/

        pivot.ts                    # Split from lib/fenograma.ts (2621 LOC)

        block-modal.ts

        beds.ts

        valves.ts

        harvest-curve.ts

        labor-hours.ts

      types.ts

      schemas.ts

      components/

        fenograma-page.tsx

        fenograma-filters.tsx

        fenograma-pivot.tsx

        fenograma-kpi-summary.tsx

        block-modal/

          block-modal.tsx           # Decomposed from 2496 LOC monolith

          block-cycles-tab.tsx

          block-beds-tab.tsx

          block-valves-tab.tsx

          block-harvest-curve.tsx

          block-labor-hours.tsx

          block-labor-person.tsx

      hooks/

        use-block-modal.ts

        use-cycle-selection.ts

        use-valve-selection.ts

        use-curve-data.ts

    campo/

      queries.ts

      types.ts

      components/

        campo-page.tsx

        campo-map.tsx               # Leaflet integration, dynamic import

        campo-legend.tsx

        campo-cycle-selector.tsx

        campo-block-detail.tsx

    mortality/

      queries.ts

      types.ts

      schemas.ts

      components/

        mortality-page.tsx

        mortality-filters.tsx

        mortality-table.tsx

        mortality-kpi-summary.tsx

        mortality-curve-panel.tsx

    comparacion/

      queries.ts

      types.ts

      schemas.ts

      components/

        comparacion-page.tsx

        comparacion-filters.tsx

        comparacion-table.tsx

        comparacion-radar.tsx

    productividad/

      queries.ts

      types.ts

      schemas.ts

      components/

        productividad-page.tsx

        productividad-filters.tsx

        productividad-table.tsx

        productividad-kpi-cards.tsx

    programaciones/

      queries.ts

      types.ts

      components/

        programaciones-page.tsx

        programaciones-calendar.tsx

        programaciones-event-grid.tsx

    postcosecha/

      balanzas/

        queries.ts                  # Split from lib/postcosecha-balanzas.ts (1427 LOC)

        types.ts

        components/

          balanzas-page.tsx

          balanzas-filters.tsx

          balanzas-process-viewer.tsx

          balanzas-grouped-table.tsx

      skus/

        queries.ts

        types.ts

        schemas.ts

        components/

          skus-page.tsx

          skus-table.tsx

          sku-form-dialog.tsx

      clasificacion/

        queries.ts

        types.ts

        client.ts

        components/

          clasificacion-page.tsx

          clasificacion-form.tsx

          clasificacion-results.tsx

    talento-humano/

      queries.ts

      types.ts

      utils.ts

      schemas.ts

      components/

        composicion-page.tsx

        composicion-table.tsx

        demografia-page.tsx

        demografia-table.tsx

        rotacion-page.tsx

        rotacion-chart.tsx

        person-detail-sheet.tsx

    medical/

      queries.ts

      types.ts

      components/

        medical-panel.tsx

    dashboard-home/

      components/

        home-page.tsx

        home-kpi-grid.tsx

        home-module-cards.tsx

    chat/

      components/

        chatbot-modal.tsx



  shared/

    ui/                             # Canonical primitives (shadcn/ui, restyled)

      button.tsx

      input.tsx

      label.tsx

      select.tsx

      badge.tsx

      separator.tsx

      avatar.tsx

      tooltip.tsx

      tabs.tsx

      skeleton.tsx

      scroll-area.tsx

      switch.tsx

      checkbox.tsx

      radio-group.tsx

      progress.tsx

      popover.tsx

      command.tsx

      card.tsx

    layout/                         # Shell system

      app-shell.tsx

      sidebar-nav.tsx

      sidebar-brand.tsx

      sidebar-footer.tsx

      topbar.tsx

      page-container.tsx

      page-header.tsx

      mobile-nav.tsx

      theme-toggle.tsx

    navigation/

      catalog.ts                    # MIGRATE-LOGIC from core/navigation/catalog.ts

      nav-types.ts

      breadcrumbs.tsx

      use-active-nav.ts

    data-table/                     # Canonical table system

      data-table.tsx                # TanStack React Table wrapper

      data-table-toolbar.tsx

      data-table-search.tsx

      data-table-filters.tsx

      data-table-pagination.tsx

      data-table-column-toggle.tsx

      data-table-row-actions.tsx

      data-table-empty.tsx

      column-helpers.ts

      types.ts

    forms/                          # Canonical form system

      form-shell.tsx                # react-hook-form + zod wrapper

      form-section.tsx

      form-grid.tsx

      form-field.tsx

      text-field.tsx

      number-field.tsx

      password-field.tsx

      select-field.tsx

      multi-select-field.tsx

      switch-field.tsx

      checkbox-field.tsx

      date-field.tsx

      form-actions.tsx

    overlays/

      dialog-shell.tsx

      confirm-dialog.tsx

      sheet-shell.tsx

      drawer-shell.tsx

    feedback/

      empty-state.tsx

      error-state.tsx

      loading-state.tsx

      skeleton-block.tsx

      skeleton-table.tsx

      skeleton-form.tsx

    data/

      kpi-card.tsx

      metric-card.tsx

      surface-card.tsx

      chart-card.tsx

      trend-badge.tsx

    hooks/

      use-current-user.ts

      use-fetch.ts

      use-media-query.ts

      use-debounce.ts

    lib/

      utils.ts                      # cn() utility

      fonts.ts                      # Inter font

      fetch-json.ts                 # CONSERVE from lib/fetch-json.ts

      multi-select.ts               # CONSERVE from lib/multi-select.ts

      chart-colors.ts

      format.ts                     # Consolidated number/date/percent formatting

    config/

      site.ts                       # Product name, metadata

      env.ts                        # Typed env access with Zod validation

    types/

      api.ts                        # Shared API response types



  server/

    db/

      pool.ts                       # MIGRATE-LOGIC from lib/db.ts

      pool-postharvest.ts           # MIGRATE-LOGIC from lib/postcosecha-db.ts

      query.ts                      # Typed query<T>() wrapper

      health.ts

      index.ts

    auth/

      session.ts                    # REWRITE from core/auth/session.ts

      credentials.ts                # REWRITE from lib/auth.ts (NO env admin bypass)

      cookies.ts

      session-user.ts

      access-control.ts             # MIGRATE-LOGIC from lib/access-control.ts

      api-guard.ts                  # REWRITE from lib/api-auth.ts

      index.ts

    cache/

      server-cache.ts               # CONSERVE from lib/server-cache.ts

      query-cache.ts                # CONSERVE from lib/query-cache.ts

      index.ts

    security/

      rate-limiter.ts               # NEW - sliding window rate limiter

      audit.ts                      # NEW - audit log to PostgreSQL

      index.ts



  middleware.ts                     # REWRITE from proxy.ts

```



### Design Direction



- **Font:** Inter (single family, via `next/font`)

- **Color base:** Grayscale (slate/zinc scale) with a single muted accent (blue-gray or indigo-gray)

- **Dark mode:** First-class, with dedicated CSS custom properties, not inverted

- **Radii:** `--radius-sm: 6px`, `--radius-md: 8px`, `--radius-lg: 12px` — contained, not cartoonish

- **Shadows:** Minimal, soft (`0 1px 2px rgba(0,0,0,0.05)` level)

- **Borders:** 1px, `border-border` (muted gray)

- **Spacing:** 4px grid, consistent across all modules

- **Sidebar:** Narrow (240-260px), clean, collapsible, with grouped nav

- **Topbar:** Minimal — breadcrumbs left, user menu + theme toggle right

- **Tables:** Consistent column alignment, subtle row hover, no heavy borders

- **Cards:** Flat surfaces, minimal elevation, consistent padding

- **States:** Every view has loading (skeleton), empty, error states — same visual language



### Dependencies (Keep/Add/Remove)



**Keep (unchanged):**

- next, react, react-dom, typescript, tailwindcss

- pg (PostgreSQL), bcryptjs, swr, zod

- @tanstack/react-table, react-hook-form, @hookform/resolvers

- recharts, leaflet, react-leaflet, bpmn-js

- All @radix-ui/* primitives

- lucide-react, class-variance-authority, clsx, tailwind-merge

- date-fns, cmdk, sonner, vaul, next-themes

- sharp, geotiff, proj4, shapefile, pngjs (geospatial pipeline)

- zustand (minimal use, but keep)



**Add:**

- None required — existing deps cover all needs



**Remove:**

- @dnd-kit/* (4 packages) — not used in any current module

- react-resizable-panels — not needed in new design

- react-day-picker — evaluate if needed (date-fns + custom may suffice)



---



## Phase 2 — File Disposition Map



### ELIMINATE (rebuild from scratch — ~60 files)



All UI components, explorers, shell, layout:

- `src/components/dashboard/*` (ALL 37 files — every explorer, modal, panel, chart wrapper)

- `src/components/layout/*` (2 files — module-shell, page-intro)

- `src/components/sidebar/*` (5 files — nav-item, mobile-sidebar, sidebar-footer, sidebar-brand, nav-group)

- `src/components/ui/*` (18 files — all shadcn primitives, reinstall fresh)

- `src/components/app-sidebar.tsx`

- `src/components/site-header.tsx`

- `src/components/site-footer.tsx`

- `src/components/user-account-menu.tsx`

- `src/components/theme-provider.tsx`

- `src/components/dashboard-scale-toggle.tsx`

- `src/components/logo.tsx`

- `src/core/layout/dashboard-shell.tsx`

- `src/core/app/providers.tsx`

- `src/contexts/theme-context.ts`

- `src/config/sidebar-data.ts`

- `src/features/*/index.ts` (3 barrel files)

- `src/hooks/use-theme.ts`



### REWRITE (same purpose, new implementation — ~30 files)



- `src/core/auth/session.ts` → `src/server/auth/session.ts` (enforce secret, add version)

- `src/lib/auth.ts` → `src/server/auth/credentials.ts` (remove env admin bypass)

- `src/lib/api-auth.ts` → `src/server/auth/api-guard.ts` (add rate limiting)

- `src/lib/api-error.ts` → structured error types

- `src/lib/chart-colors.ts` → aligned to new design tokens

- `src/lib/fonts.ts` → Inter only

- `src/proxy.ts` → `src/middleware.ts`

- `src/app/login/page.tsx` → redesigned login

- `src/app/(dashboard)/dashboard/page.tsx` → new home with canonical components

- `src/app/(dashboard)/dashboard/perfil/page.tsx` → redesigned profile

- All `src/app/(dashboard)/dashboard/*/page.tsx` → new pages using canonical components

- All `src/app/api/*/route.ts` → add Zod validation, keep thin wrapper pattern

- All `src/hooks/use-*.ts` → move to respective module directories



### MIGRATE-LOGIC (extract SQL/business logic, rewrite structure — ~25 files)



- `src/lib/db.ts` → `src/server/db/pool.ts` (pool config + query wrapper)

- `src/lib/postcosecha-db.ts` → `src/server/db/pool-postharvest.ts`

- `src/lib/access-control.ts` → `src/server/auth/access-control.ts`

- `src/lib/users.ts` → `src/modules/users/queries.ts`

- `src/lib/fenograma.ts` (2621 LOC) → split into 6 files in `src/modules/fenograma/queries/`

- `src/lib/mortality.ts` → `src/modules/mortality/queries.ts`

- `src/lib/campo.ts` → `src/modules/campo/queries.ts`

- `src/lib/comparacion.ts` → `src/modules/comparacion/queries.ts`

- `src/lib/productividad.ts` → `src/modules/productividad/queries.ts`

- `src/lib/programaciones.ts` → `src/modules/programaciones/queries.ts`

- `src/lib/postcosecha-balanzas.ts` (1427 LOC) → split in `src/modules/postcosecha/balanzas/queries.ts`

- `src/lib/postcosecha-skus.ts` → `src/modules/postcosecha/skus/queries.ts`

- `src/lib/postcosecha-clasificacion-en-blanco.ts` → `src/modules/postcosecha/clasificacion/queries.ts`

- `src/lib/postcosecha-clasificacion-en-blanco-types.ts` → `src/modules/postcosecha/clasificacion/types.ts`

- `src/lib/postcosecha-clasificacion-en-blanco-client.ts` → `src/modules/postcosecha/clasificacion/client.ts`

- `src/lib/postcosecha-sku-types.ts` → `src/modules/postcosecha/skus/types.ts`

- `src/lib/talento-humano.ts` → `src/modules/talento-humano/queries.ts`

- `src/lib/talento-humano-utils.ts` → `src/modules/talento-humano/utils.ts`

- `src/lib/salud.ts` → `src/modules/medical/queries.ts`

- `src/core/navigation/catalog.ts` → `src/shared/navigation/catalog.ts`

- `src/core/brand.ts` → `src/shared/config/site.ts`

- `src/config/dashboard.ts` → merged into catalog



### CONSERVE (keep as-is or near-identical — ~8 files)



- `src/lib/server-cache.ts` → `src/server/cache/server-cache.ts` (well-designed, 74 LOC, fully tested)

- `src/lib/query-cache.ts` → `src/server/cache/query-cache.ts` (TTL strategy map)

- `src/lib/fetch-json.ts` → `src/shared/lib/fetch-json.ts` (clean, 22 LOC)

- `src/lib/multi-select.ts` → `src/shared/lib/multi-select.ts` (correct encode/decode)

- `src/lib/utils.ts` → `src/shared/lib/utils.ts` (cn() utility)

- `src/lib/__tests__/server-cache.test.ts` → move to `src/server/cache/__tests__/`

- `src/data/campo-blocks-map.json` → keep (static geometry data)

- `public/data/*.json`, `public/rasters/*` → keep (GeoJSON + raster tiles)

- `sql/*.sql` → keep (schema definitions)

- `scripts/*` → keep (utility scripts)



---



## Phase 3 — Implementation Order



### Step 1: Project Scaffold + Design Tokens

- Create new directory structure under `src/`

- Set up `globals.css` with CSS custom properties for design tokens

- Configure `next.config.ts` with security headers, standalone output

- Set up `tsconfig.json` with strict mode and path aliases

- Install fresh shadcn/ui primitives with new token styling



### Step 2: Server Infrastructure

- `src/server/db/` — Pool singleton, query wrapper, health check

- `src/server/cache/` — Migrate server-cache and query-cache

- `src/server/auth/` — Session (hardened), credentials (no env bypass), cookies, access control, API guard

- `src/server/security/` — Rate limiter, audit logger

- `src/middleware.ts` — Route protection

- **Tests:** session, access-control, rate-limiter, server-cache



### Step 3: Canonical Component System

Build order (strict dependency chain):

1. Primitives (shadcn/ui restyled)

2. Feedback (empty-state, error-state, loading-state, skeletons)

3. Layout Shell (app-shell, sidebar-nav, topbar, page-container, page-header)

4. Navigation (catalog migration, breadcrumbs)

5. Data Display (kpi-card, metric-card, surface-card, chart-card)

6. Data Table (full system with toolbar, search, filters, pagination)

7. Forms (full system with form-shell, fields, validation)

8. Overlays (dialog-shell, confirm-dialog, sheet-shell)



### Step 4: Auth Pages + App Shell Integration

- Login page (redesigned, with rate limiting + audit)

- Dashboard layout with AppShell

- Profile page

- Verify: auth flow works end-to-end (login → dashboard → logout)



### Step 5: Module Migration (domain layers + UI)

Migration order by dependency depth and complexity:



| Order | Module | Why This Order |

|-------|--------|----------------|

| 1 | Dashboard Home | Validates shell, KPI cards, navigation catalog |

| 2 | Admin Usuarios | Validates DataTable + Forms + Overlays + CRUD |

| 3 | Perfil | Simple page, validates auth context |

| 4 | Mortality | Validates table + chart + drill-down pattern |

| 5 | Productividad | Validates filter + table + KPI pattern |

| 6 | Fenograma | Most complex — decompose 2496 LOC modal into 8-10 components |

| 7 | Comparacion | Validates radar chart + side-by-side |

| 8 | Campo | Validates Leaflet maps (dynamic import, no SSR) |

| 9 | Programaciones | Validates calendar pattern |

| 10 | Postcosecha Balanzas | Validates BPMN viewer integration |

| 11 | Postcosecha SKUs | Validates CRUD with form validation |

| 12 | Postcosecha Clasificacion | Validates solver integration |

| 13 | Talento Composicion | Validates shared talento pattern |

| 14 | Talento Demografia | Reuses talento pattern |

| 15 | Talento Rotacion | Reuses pattern + timeline chart |

| 16 | Chat | Validates chatbot modal |



For each module:

1. Create `queries.ts` (migrate SQL verbatim from old `lib/*.ts`)

2. Create `types.ts` (extract type definitions)

3. Create `schemas.ts` (Zod validation for API inputs)

4. Create API routes (thin wrappers, same URL patterns)

5. Create UI components using canonical system (DataTable, FormShell, etc.)

6. Create page.tsx (Server Component, passes data to client components)

7. Wire up loading.tsx and error.tsx



### Step 6: Testing Push

- Unit tests for server auth, security, cache

- Unit tests for format utilities, filter normalization

- Component tests for DataTable, FormShell, empty/error states

- Integration tests for auth flow + user CRUD API

- Target: 80%+ on server code, core shared components



### Step 7: Polish + Production Readiness

- Dark mode validation across ALL modules

- Mobile responsive testing

- Skeleton screens for every page

- Error boundaries at module level

- Performance audit (bundle size, dynamic imports for Leaflet/bpmn-js/recharts)

- Docker build validation (`output: standalone`)

- Remove old codebase files



---



## Phase 4 — Security Hardening Plan



| Change | Implementation |

|--------|---------------|

| Enforce SESSION_SECRET | Throw at startup if not set (remove DEFAULT_DEV_SECRET) |

| Remove env admin bypass | Delete `hasEnvAdminCredentials()` — all users in `public.users` |

| Rate limiting | Sliding window: 5 login/min/IP, 60 API/min/user |

| Input validation | Zod schemas on every API route |

| Audit logging | `public.audit_log` table: login, logout, user CRUD, permission changes |

| Session versioning | Include `v` field in token; increment to revoke all sessions |

| Password policy | Zod: min 8 chars |

| User list pagination | Add LIMIT/OFFSET to user queries |



---



## Phase 5 — Naming Conventions



| Element | Convention | Example |

|---------|-----------|---------|

| Directories | kebab-case | `data-table/`, `talento-humano/` |

| Component files | kebab-case.tsx | `fenograma-pivot.tsx` |

| React exports | PascalCase | `FenogramaPivot` |

| Functions | camelCase | `getFenogramaDashboardData()` |

| Types/Interfaces | PascalCase | `CycleProfileCard` |

| Constants | SCREAMING_SNAKE_CASE | `MAX_POOL_SIZE` |

| API routes | plural + kebab-case | `/api/admin/users`, `/api/talento-humano/activos` |

| API payloads | camelCase | `{ cycleKey, parentBlock }` |

| CSS tokens | kebab-case custom properties | `--color-surface`, `--radius-md` |

| Technical names | English | `queries.ts`, `types.ts` |

| User-facing labels | Spanish | "Composicion laboral", "Mortandades" |



### Complexity Limits (enforced in review)



- Function > 50 lines = must split

- File > 300 lines = warning, > 500 lines = must split

- Nesting > 4 levels = must refactor

- `any` without justification = not allowed

- Component > 200 LOC = evaluate decomposition



---



## Phase 6 — Testing Strategy



| Layer | Tool | Target Coverage |

|-------|------|----------------|

| Server auth/security | Vitest | 90%+ |

| Server cache | Vitest | 100% (already has tests) |

| Shared components | Vitest + @testing-library/react | 80%+ |

| Domain query transforms | Vitest | 85%+ |

| API routes (integration) | Vitest + mocked DB | Key flows |

| E2E (critical paths) | Playwright (future) | Login, CRUD, navigation |



### What to test first:

1. Session create/verify/expire

2. Access control resolution

3. Rate limiter

4. DataTable rendering with mock data

5. FormShell validation with Zod schemas

6. User CRUD API (create, read, update, delete)

7. Format utilities (toNumber, roundValue, toPercent)



---



## Phase 7 — Deployment Strategy



- **Output:** `standalone` for Docker (same as current)

- **Dockerfile:** Multi-stage (deps → build → runner), non-root user

- **docker-compose.yml:** Same structure, port 3000

- **CI pipeline target:** lint → typecheck → test → build

- **Environment validation:** Zod schema validates all required env vars at startup

- **Health check:** `GET /api/health/db`

- **Rollback:** Docker image tags per version



---



## Verification Plan



After each phase, verify:



### After Step 2 (Server Infrastructure):

```bash

npm run test                    # All server tests pass

npm run typecheck               # No type errors

```



### After Step 3 (Component System):

```bash

npm run build                   # Build succeeds

npm run test                    # Component tests pass

```



### After Step 4 (Auth + Shell):

- Navigate to `/login` → enter credentials → redirected to `/dashboard`

- Navigate to `/dashboard` → see shell (sidebar, topbar, content area)

- Click logout → redirected to `/login`

- Try `/dashboard` without auth → redirected to `/login`



### After Each Module (Step 5):

- Page loads with real data from PostgreSQL

- Filters work (SWR revalidation via API)

- Tables render correctly with DataTable

- Loading state shows skeleton

- Error state shows error message

- Dark mode renders correctly

- Mobile responsive works



### Final Verification:

```bash

npm run lint                    # Clean

npm run typecheck               # Clean

npm run test                    # All tests pass (80%+ coverage)

npm run build                   # Standalone build succeeds

docker compose build            # Docker image builds

```

- All 16 modules functional with real data

- Visual consistency across all modules (same tables, forms, overlays)

- Dark mode correct everywhere

- Mobile responsive everywhere

- No files from old codebase remaining in active use



---



## Documentation Deliverables



Created during implementation:



| Document | Purpose |

|----------|---------|

| `docs/REPO_AUDIT_MASTER_PLAN.md` | This plan, finalized |

| `docs/ARCHITECTURE_TARGET.md` | Target architecture with diagrams |

| `docs/COMPONENT_CANON.md` | Shared component API reference |

| `docs/NAMING_CONVENTIONS.md` | Naming rules |

| `docs/SECURITY_HARDENING_PLAN.md` | Security changes |

| `docs/MIGRATION_PHASES.md` | Module migration tracking |

| `docs/API_STANDARDIZATION_PLAN.md` | API route patterns |

| `docs/UX_UI_SYSTEM_TARGET.md` | Design tokens, visual direction |
> LEGACY / reference only. No usar este documento como fuente viva de crecimiento.

