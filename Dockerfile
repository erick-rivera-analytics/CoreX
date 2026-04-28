FROM node:20-alpine AS base

ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat

WORKDIR /app

FROM base AS deps

COPY package.json package-lock.json ./

RUN npm ci

FROM base AS builder

ARG SESSION_SECRET
ARG AUTH_MIN_SESSION_SECRET_LENGTH=32

ENV NODE_ENV=production
ENV SESSION_SECRET=$SESSION_SECRET
ENV AUTH_MIN_SESSION_SECRET_LENGTH=$AUTH_MIN_SESSION_SECRET_LENGTH

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p public
RUN npm run build

# El runner usa Debian (glibc) en lugar de Alpine (musl).
# PuLP bundlea un binario CBC compilado para glibc; en Alpine/musl falla con
# "Error while trying to execute .../cbc/linux/i64/cbc". Debian lo ejecuta sin problemas.
# Los stages de build (base/deps/builder) siguen en Alpine para mayor velocidad.
FROM node:20-slim AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=7777
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# LaTeX runtime para pdf-canon (canon.cls):
#   - texlive-latex-extra        → tcolorbox, adjustbox, titlesec, multirow, etc.
#   - texlive-fonts-recommended  → wrappers .sty (tgpagella.sty, helvet.sty)
#   - texlive-fonts-extra        → inconsolata, fuentes auxiliares
#   - texlive-lang-spanish       → babel[spanish] requerido por canon.cls
#   - texlive-pictures           → tikz (lo carga tcolorbox[most])
#   - tex-gyre                   → archivos de fuente TeX Gyre Pagella; con
#                                  --no-install-recommends NO se arrastra como
#                                  Recommends de texlive-fonts-recommended y
#                                  por eso "tgpagella.sty not found" aparecia
#                                  aun teniendo el .sty: faltaban los .pfb/.tfm.
#   - lmodern                    → fallback tipográfico
# `mktexlsr` regenera la base ls-R de kpathsea para que pdflatex localice los
# .sty/.tfm recien instalados sin depender del trigger del paquete.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     python3 python3-pip python3-numpy python3-pandas \
     texlive-latex-extra texlive-fonts-recommended texlive-fonts-extra texlive-lang-spanish \
     texlive-pictures tex-gyre lmodern \
  && mktexlsr \
  && pip3 install --no-cache-dir --break-system-packages pulp \
  && ln -sf python3 /usr/bin/python \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid 1001 --no-create-home nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts/validate-runtime-env.mjs ./scripts/validate-runtime-env.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/solver_clasificacion_en_blanco_bridge.py ./scripts/solver_clasificacion_en_blanco_bridge.py
COPY --from=builder --chown=nextjs:nodejs /app/scripts/postharvest_solver_engine.py ./scripts/postharvest_solver_engine.py
COPY --from=builder --chown=nextjs:nodejs /app/pdf-canon ./pdf-canon

USER nextjs

EXPOSE 7777

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 7777) + '/api/health/live').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node scripts/validate-runtime-env.mjs && node server.js"]
