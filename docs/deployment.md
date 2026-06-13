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
DB_USER=zhixiang_app \
DB_PASSWORD=CHANGE_ME_TO_STRONG_DB_PASSWORD \
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
DB_USER=zhixiang_app \
DB_PASSWORD=CHANGE_ME_TO_STRONG_DB_PASSWORD \
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
cp deploy/.env.example .env
# 修改 .env 中的 JWT_SECRET、DB_PASSWORD、MYSQL_ROOT_PASSWORD、DOMAIN、ADMIN_EMAIL
docker compose up -d --build mysql backend
```

默认服务：

| 服务 | 端口 | 说明 |
|---|---:|---|
| backend | 8080 | Express API |
| mysql | 3306 | MySQL 8.4 |
| admin-web | 5173 | 管理后台静态服务 |
| store-terminal | 5174 | 门店端静态服务 |

Docker 环境变量来自项目根目录 `.env`。不要在 `.env` 中使用示例密码。

## 公测部署

完整部署资料在 `deploy/README.md`。

最短流程：

```bash
cp deploy/.env.example .env
openssl rand -base64 24
# 把随机密码写入 deploy/01-create-app-user.sql 和 .env
mysql -uroot -p < deploy/01-create-app-user.sql
bash deploy/03-deploy.sh
```

域名解析完成后配置 HTTPS：

```bash
bash deploy/05-setup-https.sh
```

配置备份：

```bash
sudo bash deploy/02-mysql-backup.sh
sudo crontab -e
```

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
- `.env` 不能提交到 Git。
- MySQL 不要对公网开放。
- 防火墙只开放 `22/80/443`。
- 上线前至少完成一次备份恢复演练。
- 微信支付真实回调和小程序真机测试仍需单独验收。

## 升级步骤

升级前先备份：

```bash
sudo bash deploy/02-mysql-backup.sh
```

再部署：

```bash
git pull origin main
bash deploy/03-deploy.sh
```

如果 `npm run test:mysql` 或 `npm run test:qa` 失败，先不要继续发放试用账号。

## 故障排查

后端启动失败：

```bash
tail -n 120 logs/backend.log
```

数据库连接失败：

```bash
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" -e "SELECT 1;"
```

HTTPS 证书失败：

```bash
sudo nginx -t
sudo certbot renew --dry-run
```

备份失败：

```bash
sudo bash deploy/02-mysql-backup.sh
ls -lh /var/backups/mysql/
```
