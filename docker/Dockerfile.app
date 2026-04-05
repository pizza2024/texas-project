FROM node:20-alpine

RUN apk add --no-cache libc6-compat openssl

WORKDIR /repo

ARG APP_NAME
RUN test -n "$APP_NAME"
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

# Enable corepack and activate pnpm (project uses pnpm workspaces)
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy only package manifests. Do not copy the root lockfile because it currently
# mixes Next 15 and Next 16 SWC packages across workspaces and breaks Docker builds.
COPY package.json ./
COPY turbo.json ./
COPY pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/shared/package.json ./packages/shared/

# Resolve dependencies fresh for the selected workspace.
RUN pnpm install --workspace="$APP_NAME"

COPY . .

# Backend needs generated Prisma client types before TypeScript compilation.
RUN if [ "$APP_NAME" = "backend" ]; then pnpm --filter "$APP_NAME" run db:generate; fi
RUN pnpm --filter "$APP_NAME" run build

EXPOSE 3000 3001 4000
