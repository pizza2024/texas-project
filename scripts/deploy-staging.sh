#!/bin/bash
# deploy-staging.sh - 部署到测试服务器
# Usage: ./scripts/deploy-staging.sh [commit-sha]

set -e

SERVER_IP="35.73.94.102"
SSH_KEY="~/.ssh/LightsailDefaultKey-ap-northeast-1.pem"
SSH_USER="ubuntu"
PROJECT_DIR="/home/ubuntu/workspace/texas-project"
COMMIT=${1:-$(git rev-parse HEAD)}

echo "=========================================="
echo "  Texas Poker - Deploy to Staging"
echo "=========================================="
echo "Commit: $COMMIT"
echo "Server: $SERVER_IP"
echo "Time: $(date)"
echo "=========================================="

# SSH 并执行部署
ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << 'EOF'
set -e
cd /home/ubuntu/workspace/texas-project

echo "[1/6] 拉取最新代码..."
git fetch origin
git checkout develop
git pull origin develop

echo "[2/6] 安装依赖..."
if command -v pnpm &> /dev/null; then
    pnpm install --frozen-lockfile
elif command -v npm &> /dev/null; then
    npm ci
else
    echo "Error: No package manager found"
    exit 1
fi

echo "[3/6] 生成 Prisma Client..."
npx prisma generate

echo "[4/6] 构建..."
pnpm build || npm run build || { echo "Build failed"; exit 1; }

echo "[5/6] 重启服务 (PM2)..."
if command -v pm2 &> /dev/null; then
    pm2 restart all || pm2 start ecosystem.config.js
    pm2 save
else
    echo "PM2 not found, skipping..."
fi

echo "[6/6] 健康检查..."
curl -sf http://localhost:3000/health || echo "Health check failed"

echo "=========================================="
echo "  Deploy completed at $(date)"
echo "=========================================="
EOF

echo "部署完成!"
