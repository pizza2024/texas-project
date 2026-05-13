// ecosystem.config.js - PM2 配置
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'texas-backend',
      script: 'dist/main.js',
      cwd: './apps/backend',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'staging',
        PORT: 3000,
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      time: true,
      // 重启策略
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'texas-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      cwd: './apps/web',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'staging',
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
