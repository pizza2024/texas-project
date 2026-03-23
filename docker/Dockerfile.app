FROM node:20-alpine

RUN apk add --no-cache libc6-compat openssl

WORKDIR /repo

ARG APP_NAME
RUN test -n "$APP_NAME"

# Copy only package manifests. Do not copy the root lockfile because it currently
# mixes Next 15 and Next 16 SWC packages across workspaces and breaks Docker builds.
COPY package.json ./
COPY turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/shared/package.json ./packages/shared/

# Resolve dependencies fresh for the selected workspace.
RUN npm install --workspace="$APP_NAME" --include-workspace-root --package-lock=false

COPY . .

# Backend needs generated Prisma client types before TypeScript compilation.
RUN if [ "$APP_NAME" = "backend" ]; then npx prisma generate --schema=apps/backend/prisma/schema.prisma; fi
RUN npm run build --workspace="$APP_NAME"

EXPOSE 3000 3001 4000
