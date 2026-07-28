# 智享酒业进销存系统 - 部署清单

## 系统版本
- 版本: v2.0.0
- 构建日期: 2026-06-20
- GitHub 仓库: https://github.com/wen-868/wen-ssystem.git

## 服务器信息
- IP: 159.75.153.59
- 域名: onepan.cn
- 子域名:
  - api.onepan.cn (后端 API)
  - admin.onepan.cn (管理后台)
  - m.onepan.cn (商家端 H5)

## 构建产物验证

| 项目 | 构建状态 | 产物路径 | 大小 |
|------|---------|---------|------|
| backend | 通过 | backend/dist/ | ~50 个 JS 文件 |
| admin-web | 通过 | admin-web/dist/ | vite 构建产物 |
| merchant-mobile | 通过 | merchant-mobile/dist/ | vite 构建产物 |

## 测试验证

| 测试项 | 状态 | 结果 |
|--------|------|------|
| UI 合同测试 | 通过 | UI_CONTRACT_PASS |
| 生产部署检查 | 通过 | PRODUCTION_DEPLOY_CONTRACT_PASS |
| 后端单元测试 | 通过 | 149 个测试全部通过 |

## 数据库准备

1. **初始化脚本**: `docs/init_database.sql` (62 张表)
2. **种子数据**: `docs/seed_data.sql` (150 条记录)
3. **备份脚本**: `deploy/02-mysql-backup.sh`

## 部署步骤

### 方式一: 服务器已有代码 (推荐)
```bash
cd /opt/zhixiang/liquor-inventory-system
bash deploy/03-deploy.sh
```

### 方式二: 全新服务器一键部署
```bash
# 上传 deploy-production.tar.gz 到 /root/
chmod +x /root/deploy-production.sh
/root/deploy-production.sh
```

### 方式三: 使用 bootstrap 脚本
```bash
curl -fsSL https://raw.githubusercontent.com/wen-868/wen-ssystem/main/deploy/06-onepan-bootstrap.sh | bash
```

## 环境变量配置

复制 `deploy/.env.example` 为 `.env`，修改以下必填项:

```bash
JWT_SECRET=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 24)
DOMAIN=onepan.cn
ADMIN_EMAIL=your-email@example.com
VITE_API_BASE=https://api.onepan.cn/api
```

## HTTPS 配置

```bash
bash deploy/05-setup-https.sh
```

## 回滚方案

### 快速回滚
```bash
# 1. 停止当前服务
pm2 delete zhixiang-api

# 2. 恢复数据库 (如有必要)
mysql -u root -p liquor_inventory < /var/backups/mysql/liquor_inventory_YYYYMMDD_HHMMSS.sql

# 3. 回滚代码
git reset --hard HEAD~1

# 4. 重新部署
bash deploy/03-deploy.sh
```

### 数据库备份
- 自动备份: 每天凌晨 2 点执行
- 备份路径: `/var/backups/mysql/`
- 手动备份: `sudo bash deploy/02-mysql-backup.sh`

## 运维命令

```bash
# 查看日志
pm2 logs zhixiang-api

# 重启服务
pm2 restart zhixiang-api

# 查看状态
pm2 status

# 健康检查
curl https://api.onepan.cn/health
```

## 小程序部署

小程序源码位于 `miniapp/` 目录，使用微信开发者工具导入并上传。

## 注意事项

1. `.env` 文件不要提交到 Git
2. 首次部署前确保 DNS 解析已配置
3. 微信支付配置需要在 `.env` 中填写真实值
4. 建议部署前先执行数据库备份
