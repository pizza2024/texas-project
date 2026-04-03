FROM node:20-alpine

RUN apk add --no-cache libc6-compat openssl

WORKDIR /repo

ARG APP_NAME
RUN test -n "$APP_NAME"
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

# Enable corepack and activate the correct package manager version
RUN corepack enable && corepack prepare npm@10.0.0 --activate

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

# Remove packageManager field that trips up Next.js build (uses npm internally)
RUN sed -i '/"packageManager"/d' package.json

# Backend needs generated Prisma client types before TypeScript compilation.
RUN if [ "$APP_NAME" = "backend" ]; then npm run db:generate --workspace="$APP_NAME"; fi
RUN npm run build --workspace="$APP_NAME"

EXPOSE 3000 3001 4000
