# 酒类进销存系统｜部署与 MySQL 验证

## 当前主线

- 后端端口：`8080`
- 健康检查：`GET /health`
- 管理后台登录：`POST /api/admin/auth/login`
- 默认数据库：`liquor_inventory`
- 数据库脚本：`docs/phase1_schema.sql`、`docs/phase1_seed.sql`
- MySQL 冒烟测试：`npm run test:mysql`

## 本地 Mock 模式

```bash
npm install
USE_MOCK_DB=true npm --workspace backend run dev
npm --workspace admin-web run dev
npm --workspace store-terminal run dev
```

验证：

```bash
npm --workspace backend test
npm run test:ui
```

## 本地 MySQL 模式

先准备 MySQL 8.x：

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p -e "SELECT VERSION();"
```

启动后端：

```bash
USE_MOCK_DB=false \
DB_HOST=127.0.0.1 \
DB_PORT=3306 \
DB_USER=root \
DB_PASSWORD=root123456 \
DB_NAME=liquor_inventory \
npm --workspace backend run dev
```

后端启动时会：

- 自动创建数据库 `liquor_inventory`
- 如果核心表不存在，执行 `docs/phase1_schema.sql`
- 每次启动幂等执行 `docs/phase1_seed.sql`

验证：

```bash
DB_HOST=127.0.0.1 \
DB_PORT=3306 \
DB_USER=root \
DB_PASSWORD=root123456 \
DB_NAME=liquor_inventory \
API_BASE=http://localhost:8080 \
npm run test:mysql
```

预期：

```text
测试结果：✅ 全部通过 / ❌ 0 失败
```

## Docker Compose

```bash
docker compose up -d --build mysql backend
```

默认服务：

| 服务 | 端口 | 说明 |
|---|---:|---|
| backend | 8080 | Express API |
| mysql | 3306 | MySQL 8.4 |
| admin-web | 5173 | 管理后台静态服务 |
| store-terminal | 5174 | 门店端静态服务 |

Docker 环境变量见 `docker-compose.yml`。

## 回归命令

Mock 主流程：

```bash
USE_MOCK_DB=true npm --workspace backend run dev
node scripts/self-test.mjs
node scripts/quick-store-test.mjs
npm run test:qa
```

构建：

```bash
npm --workspace backend run build
npm --workspace admin-web run build
npm --workspace store-terminal run build
```

## 生产建议

- 不要使用 root 账号连接生产数据库。
- 为应用创建专用 MySQL 用户。
- `JWT_SECRET` 必须改成生产密钥。
- 生产环境必须设置 `USE_MOCK_DB=false`。
- 微信支付真实回调和小程序真机测试仍需单独验收。
