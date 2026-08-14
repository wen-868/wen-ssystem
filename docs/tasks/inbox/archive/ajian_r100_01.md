# R100-01 阿坚：订单异常 + 员工复职 + 商品图片上传/创建 + 核价/价格异常

> 派单人：凌舟 | 日期：2026-08-14 | 优先级：P1

## 背景

移动端全局审查发现以下功能为「开发中」占位（后端缺接口，前端降级提示）。本任务补齐后端接口并完成前端真实对接，不留假数据。

## 必读

`docs/项目统一标准.md`、`docs/项目规则.md`、`docs/tasks/current-tasks.md`、`docs/踩坑日志.md`、`docs/API接口文档.md`、`docs/memories/阿坚-记忆.md`、`docs/verify-five-defense.md`。参考 `app-mobile/src/api/modules/` 现有模块风格与 `backend/src/routes|controllers|services` 现有分层。

## 任务内容

### 1. 订单异常模块
- 后端：新增 `t_order_exception` 表（迁移 146，文件头不写注释）+ 路由/控制器/服务
  - GET /api/admin/order-exceptions（列表，支持 keyword/status/分页）
  - GET /api/admin/order-exceptions/:id（详情）
  - POST /api/admin/order-exceptions（创建，从订单标记异常）
  - PUT /api/admin/order-exceptions/:id/status（处理状态：PENDING/PROCESSING/RESOLVED/CLOSED）
  - PUT /api/admin/order-exceptions/:id（编辑备注）
- 前端：`app-mobile/src/api/modules/exceptions.ts` 去掉 reject 占位改为真实调用；`pages-sub/order/order-exception/exception.vue` 由占位改为真实列表/详情/状态操作

### 2. 员工复职
- 后端：`employee.service` 补 `restoreStaff`（把离职员工 status 置回启用），新增 POST /api/admin/staff/:id/restore 路由
- 前端：`pages-sub/admin/admin/employees.vue` 的「复职」按钮对接真实接口（替换“开发中”提示）

### 3. 商品图片上传 / 创建提交
- 后端：新增 POST /api/admin/products/upload-image（multer 单文件 image，存 backend/storage/product-images，返回 URL），复用 `avatar.routes.ts` 的 multer 模式
- 前端：`pages-sub/product/product/product-edit.vue` 主图上传对接；「创建商品」提交对接 POST /api/admin/products（后端已有 products 路由则复用，无则补）

### 4. 核价 / 价格异常
- 后端：确认或补 POST /api/admin/prices/review（核价提交）与 GET /api/admin/prices/anomalies（价格异常列表）
- 前端：`pages/products/products.vue` 的操作卡「核价/价格异常」对接真实接口

## 验收

1. 后端类型检查通过，新增接口 curl 冒烟 200；2. 前端构建通过（`npm run build:h5`）；3. 移动端对应页面无“开发中”占位、无假数据；4. 更新 `docs/API接口文档.md` 与 `docs/数据库变更清单.md`。

## 提交

中文 commit 信息，推送到 main（网络不稳时重试）。完成后把任务卡移入 `docs/tasks/inbox/archive/` 并在 `current-tasks.md` 更新状态。
