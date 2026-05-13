#!/bin/bash
# health-check.sh - 服务器健康检查
# Usage: ./scripts/health-check.sh

set -e

SERVER_IP="35.73.94.102"
SSH_KEY="~/.ssh/LightsailDefaultKey-ap-northeast-1.pem"
SSH_USER="ubuntu"

echo "=========================================="
echo "  Health Check - $(date)"
echo "=========================================="

ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" << 'EOF'
set -e

echo "--- 系统状态 ---"
uptime
echo ""

echo "--- 磁盘使用 ---"
df -h / | tail -1
echo ""

echo "--- 内存使用 ---"
free -h
echo ""

echo "--- PM2 进程 ---"
pm2 list || echo "PM2 not running"
echo ""

echo "--- Docker 容器 ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker not available"
echo ""

echo "--- HTTP 健康检查 ---"
HEALTH_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Backend: OK (HTTP $HEALTH_STATUS)"
else
    echo "❌ Backend: FAILED (HTTP $HEALTH_STATUS)"
fi

# 检查 WebSocket
WS_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")
if [ "$WS_STATUS" = "200" ] || [ "$WS_STATUS" = "404" ]; then
    echo "✅ API: OK (HTTP $WS_STATUS)"
else
    echo "❌ API: FAILED (HTTP $WS_STATUS)"
fi

echo ""
echo "=========================================="
EOF

echo "健康检查完成: $(date)"
