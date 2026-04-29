# Texas Hold'em Project Monorepo

This is a Turborepo monorepo containing:

- `apps/backend`: NestJS backend application
- `apps/web`: Next.js frontend application

## Commands

- `npm run dev`: Start development servers
- `npm run build`: Build all applications
- `npm run lint`: Lint all applications
- `npm run docker:local:up`: Start local Docker stack with `docker-compose.local.yml`
- `npm run docker:local:down`: Stop local Docker stack
- `npm run docker:staging:up`: Start Lightsail/staging Docker stack
- `npm run docker:staging:down`: Stop Lightsail/staging Docker stack
- `npm run docker:remote:up`: Start server image-based stack via `docker-compose.remote.yml`
- `npm run docker:remote:down`: Stop server image-based stack

## Recommended Flow

1. Local validation first:
   - `npm run docker:local:up`
   - verify `http://localhost:3000`, `http://localhost:3001`, `http://localhost:4000/health`
   - `npm run docker:local:down`

2. Then deploy to staging/Lightsail:
   - `npm run docker:staging:up`
   - verify `https://api.not-replaced-yet.com/health`
   - smoke test login, room list/create/join, websocket events

## Deployment Docs

- Baseline deployment plan: `DEPLOYMENT_PLAN.md`
- Lightsail execution checklist: `LIGHTSAIL_DEPLOYMENT.md`
- GitHub Actions workflow: `.github/workflows/deploy-lightsail.yml`
- Main compose: `docker-compose.yml`
- Local compose layer: `docker-compose.local.yml`
- Remote image compose: `docker-compose.remote.yml`

## Documentation

技术文档见 [`apps/docs/`](./apps/docs/content/)，本地运行：`npm run dev --workspace=docs`（端口 4002）
