#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APP_DIR="${APP_DIR:-$PROJECT_ROOT}"
BRANCH="${BRANCH:-main}"
RUN_MIGRATION="${RUN_MIGRATION:-false}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "=========================================="
echo "   Texas Poker 部署脚本"
echo "=========================================="
echo "分支: $BRANCH"
echo "目录: $APP_DIR"
echo "迁移: $RUN_MIGRATION"
echo "=========================================="

cd "$APP_DIR"

if [ ! -d ".git" ]; then
    log_error "不是 Git 仓库，请先克隆项目"
    exit 1
fi

log_info "拉取最新代码..."
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

log_info "安装依赖..."
pnpm install --frozen-lockfile || pnpm install

log_info "生成 Prisma Client..."
pnpm --filter backend run db:generate

if [ "$RUN_MIGRATION" = "true" ]; then
    log_info "执行数据库迁移..."
    pnpm --filter backend run db:migrate:deploy
fi

log_info "启动服务 (使用 PM2)..."

if ! command -v pm2 &> /dev/null; then
    log_warn "PM2 未安装，正在安装..."
    npm install -g pm2
fi

pm2 delete texas-backend 2>/dev/null || true
pm2 delete texas-web 2>/dev/null || true
pm2 delete texas-admin 2>/dev/null || true
pm2 delete texas-docs 2>/dev/null || true

cd "$APP_DIR"

pm2 start pnpm --name "texas-backend" -- start:prod --workspace=backend
pm2 start pnpm --name "texas-web" -- start --workspace=web
pm2 start pnpm --name "texas-admin" -- start --workspace=admin
pm2 start pnpm --name "texas-docs" -- start --workspace=docs

pm2 save

log_info "部署完成!"
echo ""
echo "服务状态:"
pm2 list

echo ""
echo "常用命令:"
echo "  pm2 logs texas-backend    # 查看后端日志"
echo "  pm2 restart all           # 重启所有服务"
echo "  pm2 monit                 # 监控面板"
