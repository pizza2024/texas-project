#!/bin/bash
# direct-deploy.sh - 直接在服务器上构建和运行（绕过 Docker）
# 适用于性能较低的服务器

set -e

SERVER_IP="35.73.94.102"
SSH_KEY="~/.ssh/LightsailDefaultKey-ap-northeast-1.pem"
SSH_USER="ubuntu"
PROJECT_DIR="/home/ubuntu/workspace/texas-project"

echo "=========================================="
echo "  Texas Poker - Direct Deploy"
echo "=========================================="
echo "Server: $SERVER_IP"
echo "Time: $(date)"
echo "=========================================="

ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << 'EOF'
set -e

# 加载 nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /home/ubuntu/workspace/texas-project

echo "[1/8] 拉取最新代码..."
git fetch origin
git checkout develop
git pull origin develop

echo "[2/8] 安装依赖..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "[3/8] 生成 Prisma Client...
npx prisma generate

echo "[4/8] 构建后端..."
cd apps/backend
pnpm build 2>/dev/null || npm run build
cd ../..

echo "[5/8] 构建前端..."
cd apps/web
pnpm build 2>/dev/null || npm run build
cd ../..

echo "[6/8] 创建日志目录..."
mkdir -p /home/ubuntu/workspace/texas-project/logs

echo "[7/8] 使用 PM2 启动服务..."
# 启动后端
pm2 start /home/ubuntu/workspace/texas-project/ecosystem.config.js --env staging 2>/dev/null || {
    echo "PM2 start failed, trying manual start..."
    pm2 delete all 2>/dev/null || true
    pm2 start --name "texas-backend" --cwd /home/ubuntu/workspace/texas-project/apps/backend "node dist/main.js" --env NODE_ENV=staging
    pm2 save
}

echo "[8/8] 保存 PM2 状态..."
pm2 save

echo ""
echo "=========================================="
echo "  Deploy completed at $(date)"
echo "=========================================="

echo "PM2 状态:"
pm2 list
EOF

echo "部署完成!"
