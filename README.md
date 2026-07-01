# 智享全链管理系统

本项目是第 1 阶段 MVP 的多端工程骨架，基于已生成的开发文档、数据库脚本和 OpenAPI 接口文档创建。

## 目录

| 目录 | 说明 |
|---|---|
| `backend` | 后端 API 服务骨架，包含后台、门店端、小程序、支付、分享收款路由 |
| `admin-web` | 管理后台前端骨架 |
| `store-terminal` | 门店操作端前端骨架 |
| `miniapp` | 微信小程序原生骨架 |
| `docs` | 阶段文档、数据库脚本、OpenAPI 文档 |

## 当前范围

第 1 阶段优先打通商品、客户、价格、库存、订单、销售单、微信支付和分享收款闭环。强离线、完整箱瓶溯源、账期授信、客户专属价和自动发布暂不进入首版主线。

## 启动方式

安装依赖：

```bash
npm install
```

启动后端：

```bash
npm run dev:backend
```

启动管理后台：

```bash
npm run dev:admin
```

启动门店端：

```bash
npm run dev:store
```

微信小程序请使用微信开发者工具打开 `miniapp` 目录。

## 无数据库自测模式

如果当前电脑暂时没有 MySQL 或 Docker，可以使用 Mock 数据模式先测试接口和前端主流程：

```bash
npm run dev:mock
```

Mock 模式内置：

- 默认账号：`admin`
- 默认密码：`admin123`
- 默认门店：`默认门店`
- 示例商品：`示例白酒 53度 500ml`
- 示例库存：线上 120 瓶，线下 240 瓶

Mock 模式适合验证登录、商品列表、库存查询、销售单创建、分享收款链接、客户收款页和支付参数生成。正式联调仍需使用 MySQL 导入 `docs/phase1_schema.sql` 和 `docs/phase1_seed.sql`。

另开一个终端可执行接口主链路自测：

```bash
npm run test:flow
```

## 下一步

1. 将 `docs/phase1_schema.sql` 导入 MySQL。
2. 将 `docs/phase1_seed.sql` 导入 MySQL，生成默认管理员和演示商品。
3. 根据 `docs/phase1_openapi.yaml` 补齐后端服务实现。
4. 将后台、门店端、小程序页面与真实 API 联调。
5. 接入微信支付 V3 参数和回调验签。

## 开发默认账号

| 账号 | 密码 | 说明 |
|---|---|---|
| `admin` | `admin123` | 超级管理员，仅用于开发环境 |

## 数据库初始化

使用 Docker Compose 一键启动 MySQL 和 Redis：

```bash
docker compose up -d mysql redis
```

首次启动 MySQL 容器时，会自动执行：

- `docs/phase1_schema.sql`
- `docs/phase1_seed.sql`

如果使用本机 MySQL，可手动导入：

```bash
mysql -uroot -p < docs/phase1_schema.sql
mysql -uroot -p liquor_inventory < docs/phase1_seed.sql
```

后端开发环境变量可从示例文件复制：

```bash
cp backend/.env.example backend/.env
```
