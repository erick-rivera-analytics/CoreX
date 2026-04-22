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

FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=7777
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# Python 3 + dependencias del solver de postcosecha (numpy, pandas, pulp)
# py3-numpy y py3-pandas se instalan desde apk (compilados para musl).
# pulp no esta en apk -> se instala con pip usando --break-system-packages,
# que es seguro en contenedores Docker (no hay sistema que proteger).
RUN apk add --no-cache libc6-compat python3 py3-pip py3-numpy py3-pandas \
  && pip3 install --no-cache-dir --break-system-packages pulp \
  && ln -sf python3 /usr/bin/python \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts/validate-runtime-env.mjs ./scripts/validate-runtime-env.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/solver_clasificacion_en_blanco_bridge.py ./scripts/solver_clasificacion_en_blanco_bridge.py
COPY --from=builder --chown=nextjs:nodejs /app/scripts/postharvest_solver_engine.py ./scripts/postharvest_solver_engine.py

USER nextjs

EXPOSE 7777

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 7777) + '/api/health/live').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node scripts/validate-runtime-env.mjs && node server.js"]
