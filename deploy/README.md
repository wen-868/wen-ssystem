# 智享全链管理系统公测部署指南

本文档用于公测服务器部署。默认假设服务器为 Ubuntu 22.04，代码路径为 `/opt/zhixiang/liquor-inventory-system`。

## 准备服务器

建议配置：

```text
2 核 CPU
4GB 内存
80GB 云盘
3M-5M 带宽
Ubuntu 22.04
```

需要安装：

```bash
sudo apt-get update
sudo apt-get install -y git curl mysql-server-8.0
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## 创建数据库账号

不要使用 root 账号连接应用数据库。先生成随机密码：

```bash
openssl rand -base64 24
```

把生成结果替换到 `deploy/01-create-app-user.sql` 中的：

```text
CHANGE_ME_TO_STRONG_PASSWORD
```

执行：

```bash
mysql -uroot -p < deploy/01-create-app-user.sql
```

## 配置环境变量

```bash
cp deploy/.env.example .env
vi .env
```

必须修改：

```text
JWT_SECRET
DB_PASSWORD
MYSQL_ROOT_PASSWORD
DOMAIN
ADMIN_EMAIL
```

生成 JWT：

```bash
openssl rand -base64 32
```

## 部署应用

```bash
bash deploy/03-deploy.sh
```

脚本会执行：

```text
git pull origin main
npm install
构建后端、管理后台、门店端
启动后端
运行 MySQL smoke test
运行 QA 回归
```

日志位置：

```bash
tail -f logs/backend.log
```

## 配置 HTTPS

先确认 DNS 已经解析到服务器：

```text
api.域名
admin.域名
store.域名
```

执行：

```bash
bash deploy/05-setup-https.sh
```

验证：

```bash
curl -I https://api.你的域名/health
sudo certbot renew --dry-run
```

## 配置数据库备份

手动测试：

```bash
sudo bash deploy/02-mysql-backup.sh
ls -lh /var/backups/mysql/
```

加入定时任务：

```bash
sudo crontab -e
```

添加：

```cron
0 2 * * * /opt/zhixiang/liquor-inventory-system/deploy/02-mysql-backup.sh >> /var/log/mysql-backup.log 2>&1
```

## 恢复演练

建议至少恢复到测试库演练一次：

```bash
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS liquor_inventory_test DEFAULT CHARACTER SET utf8mb4;"
gunzip -c /var/backups/mysql/liquor_inventory_YYYYMMDD_HHMMSS.sql.gz | mysql -uroot -p liquor_inventory_test
```

## 日常运维

```bash
bash deploy/03-deploy.sh
tail -f logs/backend.log
npm run test:mysql
npm run test:qa
sudo bash deploy/02-mysql-backup.sh
ls -lh /var/backups/mysql/
sudo certbot renew --dry-run
```

## 升级步骤

每次升级前先备份：

```bash
sudo bash deploy/02-mysql-backup.sh
```

再部署：

```bash
git status --short
bash deploy/03-deploy.sh
```

如果 smoke test 或 QA 回归失败，不要继续发放试用账号，先查看：

```bash
tail -n 120 logs/backend.log
```

## 安全要求

- 应用使用 `zhixiang_app` 账号连接 MySQL。
- `.env` 不提交到 Git。
- `JWT_SECRET` 使用随机强密钥。
- 公网只开放 `22/80/443`。
- MySQL 不对公网开放。
- HTTPS 证书自动续期测试必须通过。
- 至少完成一次备份恢复演练。

## 已知边界

- 微信支付真实回调仍是专项验收项。
- 小程序真机仍需单独验收。
- 库存负数/低库存预警展示口径由林夕和业务侧确认。
