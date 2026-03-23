# TEST_ENV_RELEASE_PLAN 废弃说明

该文件基于旧的混合云平台方案（Railway/Vercel），已废弃。

当前测试环境发布请统一使用 Docker 方案：
- DEPLOYMENT_PLAN.md
- docker-compose.yml
- docker/.env.staging.example

如需新增流程，请在 DEPLOYMENT_PLAN.md 追加，不再维护多套并行方案。
