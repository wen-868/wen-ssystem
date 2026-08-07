# 任务卡：ajian_retail_fix_01 — 即时零售缺失后端接口开发（6 模块）

- **派发**：2026-08-08 凌舟（总负责人）
- **负责人**：阿坚（后端/数据库）
- **优先级**：P0（工作台即时零售/小程序功能缺失）
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`

## 一、背景与根因（凌舟已诊断）

用户反馈「工作台 > 即时零售大部分功能更新没了」「小程序整个版块没有了」。诊断结论（API 实测 + 代码比对 + 产品清单对照）：

1. **前端菜单入口被砍**（已由凌舟修复）：`f30aba74`（8/4 导航减法）把即时零售菜单从 12 项砍到 4 项、系统菜单砍掉「小程序配置」等 8 项。凌舟已恢复菜单（admin-web/src/layouts/MainLayout.vue），构建通过，**本任务不处理前端**。
2. **后端接口缺失**（本任务核心）：前端页面和 API 封装早已存在，但以下接口后端从未实现（git 历史无、生产实测 404）：
   - `GET/POST /api/admin/instant-retail/shelf` + `PUT/DELETE /api/admin/instant-retail/shelf/:id`（商品货架）
   - `GET /api/admin/instant-retail/payments` + `GET /api/admin/instant-retail/payments/:paymentNo`（支付记录）
   - `GET /api/admin/instant-retail/deliveries` + `POST /api/admin/instant-retail/deliveries/:deliveryId/assign` + `PUT /api/admin/instant-retail/deliveries/:deliveryId/status`（配送管理）
   - `GET /api/admin/instant-retail/order-board`（60 秒接单看板）
   - `GET/POST /api/admin/retail-announcements` + `PUT/DELETE .../:id`（公告；后端已有 `/api/retail-announcement/admin/retail-announcements` 实现，仅前缀不匹配，**补别名路由即可**）
   - `GET /api/admin/retail-cart/analysis`（购物车分析）
3. **`GET /api/miniapp-order-sync` 生产 500**：后端有实现（routes+controller+service），需排查（疑表缺失或 SQL 错误）。

## 二、必读文件

1. `docs/产品功能清单-v6.1.md` 第七部分「即时零售」（A-R 18 个二级模块，重点 B/F/I/K/M/E 对应缺失接口）
2. **前端契约（必须逐页读取确认数据结构）**：`admin-web/src/api/instant-retail.ts` + `admin-web/src/views/instant-retail/InstantRetailShelf.vue`、`InstantRetailPayment.vue`、`InstantRetailDelivery.vue`、`InstantRetailOrderBoard.vue`、`InstantRetailSync.vue`、`RetailAnnouncement.vue`、`InstantRetailDashboard.vue`
3. 后端可复用：`backend/src/controllers/instant-retail/*`（analytics/fulfillment/order-receiving/platform-integration/reconciliation/review）、`backend/src/services/instant-retail/*`、`backend/src/routes/retail-announcement.routes.ts`、`backend/src/routes/instant-retail-admin-ops.routes.ts`、`instant-retail-admin-platform.routes.ts`
4. 表结构：`docs/migrations/` 中 t_retail_order/t_retail_order_item/t_retail_product/t_retail_cart/t_retail_announcement/t_retail_operation_log/t_miniapp_order/t_miniapp_order_sync_log 定义

## 三、任务清单

### 1. 商品货架 shelf（对应 B 商品货架管理）
- `GET /shelf`：分页列表 + 搜索（keyword/category），字段对齐 InstantRetailShelf.vue 期望
- `POST /shelf`：上架/新增；`PUT /shelf/:id`：编辑；`DELETE /shelf/:id`：下架
- 优先复用 `t_retail_product`（或按前端契约新增货架专用表，任务内自决并说明）
- 数据范围：租户隔离（req.tenantId），requireAuthWithTenant

### 2. 在线支付 payments（对应 F 在线支付）
- `GET /payments`：支付记录列表（分页/筛选 orderNo/paymentMethod/status/date），字段对齐 InstantRetailPayment.vue
- `GET /payments/:paymentNo`：详情
- 数据来源：按前端契约从 `t_retail_order`/`t_miniapp_order` 的支付字段聚合，或新增支付记录表

### 3. 配送管理 deliveries（对应 I 配送管理 + M 履约调度）
- `GET /deliveries`：配送单列表（筛选 orderNo/deliveryStatus/date）
- `POST /deliveries/:deliveryId/assign`：分配骑手 {riderId, riderName}
- `PUT /deliveries/:deliveryId/status`：更新状态 {status}
- 数据来源：t_retail_order 配送字段聚合或新增 t_retail_delivery 表（任务内自决）

### 4. 60 秒接单看板 order-board（对应 K）
- `GET /order-board`：待接单/超时订单聚合（数量、倒计时、来源平台），对齐 InstantRetailOrderBoard.vue
- 可复用 `instant-retail/order-receiving.controller` / fulfillment service 逻辑

### 5. 公告 retail-announcements（补别名）
- 后端已有 `/api/retail-announcement/admin/retail-announcements` 完整实现，**新增 `/api/admin/retail-announcements` 别名路由**（同 controller）即可；前端调用即通

### 6. 购物车分析 retail-cart/analysis（对应 E）
- `GET /api/admin/retail-cart/analysis`：购物车分析（数量/金额/商品分布），复用 t_retail_cart，对齐 InstantRetailDashboard.vue 期望

### 7. miniapp-order-sync 500 排查
- 复现并定位 500（疑 t_miniapp_order_sync_log 表/列缺失或 SQL 错误），修复后实测 200

### 8. 验证（必做）
- 后端 `npm run build` + typecheck 通过
- 本地或生产实测：admin token 调全部新端点 200 且数据结构正确（生产实测前先本地起服务验证）
- 确认未影响既有即时零售接口（orders/configs/reports 等）
- 提交推送 origin/main（中文提交信息；push 网络波动重试）

## 四、验收标准

- 6 个缺失模块接口全部可用（生产实测 200）；miniapp-order-sync 恢复 200
- 前端菜单恢复后（凌舟已改，重新部署 admin-web 生效），即时零售 12 项 + 系统小程序配置入口均可打开且数据正常
- 对照产品清单第七部分，B/F/I/K/M/E 对应管理功能可用
- current-tasks.md 记录完成情况；任务卡归档

## 五、注意事项

- 全程简体中文（代码注释、commit、最终回复）
- 最小改动：只补缺失接口，不重构现有代码；**禁止改动 app-mobile/、miniapp/、admin-web/**（前端由凌舟维护）
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识、复述任务关键内容、给出完成结果与验证证据
- 表结构以现有 t_retail_* 为准，尽量复用；确需新表时补迁移 SQL 并说明
