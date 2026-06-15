# ---- Dependencies ----
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json

RUN pnpm install --frozen-lockfile --filter=@metanoia/api...

# ---- Build ----
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules

COPY packages/types packages/types
COPY packages/config packages/config
COPY apps/api apps/api
COPY turbo.json package.json pnpm-workspace.yaml ./

# Generate Prisma Client before compiling. Without this, @prisma/client exposes
# only stub `{}` types and tsc fails (every query result typed as `{}`).
RUN cd apps/api && pnpm exec prisma generate

RUN pnpm turbo build --filter=@metanoia/api

# ---- Migrator (one-shot: prisma migrate deploy + RLS policies) ----
# Derives from `build` (has schema, migrations, prisma CLI and scripts/).
# Used by the db-migrate compose service (target: migrator) — NOT the runtime image.
# bash + psql are required by scripts/apply-rls.sh.
FROM build AS migrator
RUN apk add --no-cache bash postgresql-client
WORKDIR /app/apps/api
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm run db:rls"]

# ---- Runner ----
FROM node:20-alpine AS runner
RUN addgroup -g 1001 -S app && adduser -S app -u 1001
WORKDIR /app

# pnpm uses a symlinked node_modules: apps/api/node_modules symlinks into the
# workspace-root .pnpm store (/app/node_modules/.pnpm). The runtime must preserve
# that layout — copying only apps/api/node_modules leaves every dependency a
# dangling symlink (e.g. Cannot find module '@sentry/nestjs'). So we copy the
# root store too and keep the app under /app/apps/api.
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=app:app /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=app:app /app/apps/api/package.json ./apps/api/package.json
# Workspace packages are symlinked from apps/api/node_modules/@metanoia/* into
# /app/packages/*. Copy their built output or those symlinks dangle at runtime
# (e.g. Cannot find module '@metanoia/types'). types is required at runtime;
# config is dev-only but copied so its symlink does not dangle.
COPY --from=build --chown=app:app /app/packages/types ./packages/types
COPY --from=build --chown=app:app /app/packages/config ./packages/config

USER app
EXPOSE 3001

CMD ["node", "apps/api/dist/main"]
