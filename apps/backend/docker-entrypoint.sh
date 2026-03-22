#!/bin/sh
# Entrypoint script for Railway deployment

set -e

echo "🚀 Starting Texas Hold'em Backend..."

# 运行数据库迁移
echo "📦 Running Prisma migrations..."
npx prisma migrate deploy || {
    echo "⚠️  Migration failed, but continuing..."
}

# 启动应用
echo "✅ Starting application..."
exec node dist/src/main.js
