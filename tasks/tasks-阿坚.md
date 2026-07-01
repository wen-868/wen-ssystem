# 阿坚 · Bug修复 · 后端

**日期**：2026-07-02
**状态**：待开始
**来源**：全面审查报告 + WorkBuddy 测试报告交叉核对

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 修复 `auth.service.ts` 状态类型冲突 | P0 | ❌ |
| 2 | 补充 `auth.service.ts` 的 `changePassword` 函数 | P0 | ❌ |
| 3 | 修复 `report.controller.ts` 的 `req.userId` | P0 | ❌ |
| 4 | 修复 `alert.routes.ts` ↔ `alert.controller.ts` 函数名不匹配（6处） | P0 | ❌ |
| 5 | 修复 `notification.routes.ts` ↔ `notification.controller.ts` 函数名不匹配（8处） | P0 | ❌ |
| 6 | 修复 `stock-check.routes.ts` ↔ `stock-check.controller.ts` 对象属性访问错误（11处） | P0 | ❌ |
| 7 | 修复 `store-control.routes.ts` ↔ `store-control.controller.ts` 对象属性访问错误（10处） | P0 | ❌ |
| 8 | 补充 `order.controller.ts` 缺失的5个函数 | P0 | ❌ |
| 9 | 修复 `store.routes.ts` 中 `batchController.listBatchesBySpu` 和 `getTraceChain` 缺失 | P0 | ❌ |
| 10 | 修复即时零售3个适配器的 `platformCall`/`useMock` 引用错误 | P0 | ❌ |
| 11 | 修复 `instant-retail-new.routes.ts` 17个缺失的零售管理函数 | P0 | ❌ |
| 12 | 安装 `node-cron` 到 package.json | P1 | ❌ |

---

## 详细说明

### 1. 修复 `auth.service.ts` 状态类型冲突 ⚡ 最危险
- **文件**：`backend/src/services/admin/auth.service.ts`
- **问题**：第 10 行 `account.status !== 1` 和第 17 行 `r.status = 1`，用数字比较，但 `docs/migrate_v2.sql` 把 status 改成了 VARCHAR(16)，值为 `'ACTIVE'`/`'DISABLED'`
- **后果**：执行 migrate_v2.sql 后所有用户无法登录
- **修复方案**：**回滚 migrate_v2.sql 中的状态类型变更**（第 15、21 行），保持 TINYINT(1)。删除 migrate_v2.sql 中将数字转字符串的第 24-27 行数据迁移。原因：改代码比改数据库安全，且其他模块也依赖数字类型 status
- **验证**：修改后运行单元测试 `npx vitest run tests/auth.test.ts` 确保通过

### 2. 补充 `auth.service.ts` 的 `changePassword` 函数
- **文件**：`backend/src/services/admin/auth.service.ts`、`backend/src/controllers/admin/auth.controller.ts`
- **问题**：`auth.controller.ts` 第 36 行调用 `authService.changePassword(req.user!.id, body.oldPassword, body.newPassword)`，但 service 中无此函数
- **修复**：在 `auth.service.ts` 中添加 `changePassword(userId, oldPassword, newPassword)` 函数
  - 校验旧密码：`bcrypt.compare(oldPassword, user.password_hash)`
  - 校验新密码强度（最少8位）
  - 哈希新密码：`bcrypt.hash(newPassword, 10)`
  - 更新数据库
- **验证**：运行单元测试

### 3. 修复 `report.controller.ts` 的 `req.userId`
- **文件**：`backend/src/controllers/admin/report.controller.ts`
- **问题**：第 94 行使用 `req.userId!`，Express Request 类型没有 `userId` 属性
- **修复**：改为 `req.user!.id`

### 4. 修复 `alert.routes.ts` ↔ `alert.controller.ts`（6处不匹配）
- **路由期望**：`listAlerts`, `getAlertCounts`, `handleAlert`, `listAlertRules`, `updateAlertRule`, `runCheck`
- **Controller 实际**：`list`, `count`, `handle`, `rules`, `updateRule`, `check`
- **修复方案**：修改 `alert.routes.ts`，将函数引用改为匹配 controller 的实际导出名：
  - `ctrl.listAlerts` → `ctrl.list`
  - `ctrl.getAlertCounts` → `ctrl.count`
  - `ctrl.handleAlert` → `ctrl.handle`
  - `ctrl.listAlertRules` → `ctrl.rules`
  - `ctrl.updateAlertRule` → `ctrl.updateRule`
  - `ctrl.runCheck` → `ctrl.check`

### 5. 修复 `notification.routes.ts` ↔ `notification.controller.ts`（8处不匹配）
- **路由期望**：`listNotifications`, `getUnreadCount`, `markAsRead`, `markAllAsRead`, `listMiniappNotifications`, `getMiniappUnreadCount`, `markMiniappAsRead`, `markMiniappAllAsRead`
- **Controller 实际**：`list`, `unreadCount`, `markRead`, `markAllRead`, `myList`, `myUnreadCount`, `myMarkRead`, `myMarkAllRead`
- **修复方案**：修改 `notification.routes.ts`，将函数引用改为匹配 controller 的实际导出名

### 6. 修复 `stock-check.routes.ts` ↔ `stock-check.controller.ts`（11处）
- **问题**：Controller 导出 `adminStockCheck = { create, list, statistics, detail, update, start, complete, cancel, handleDiff }` 和 `storeStockCheck = { my, detail, updateItem, submit }` 对象，路由使用 `ctrl.create` 无法访问
- **修复方案**：修改 `stock-check.routes.ts`，将 `ctrl.xxx` 改为 `ctrl.adminStockCheck.xxx`（admin 端）或 `ctrl.storeStockCheck.xxx`（store 端），同时修正函数名差异：
  - `ctrl.getStatistics` → `ctrl.adminStockCheck.statistics`
  - `ctrl.getDetail` → `ctrl.adminStockCheck.detail`
  - `ctrl.getMyList` → `ctrl.storeStockCheck.my`

### 7. 修复 `store-control.routes.ts` ↔ `store-control.controller.ts`（10处）
- **同问题6**：Controller 导出 `adminStoreControl = {...}` 和 `storeStoreControl = {...}` 对象
- **修复方案**：修改 `store-control.routes.ts`：
  - `ctrl.listConfigs` → `ctrl.adminStoreControl.getConfigs`
  - `ctrl.updateConfig` → `ctrl.adminStoreControl.upsertConfig`
  - `ctrl.openStore` → `ctrl.adminStoreControl.open`
  - `ctrl.closeStore` → `ctrl.adminStoreControl.close`
  - `ctrl.suspendStore` → `ctrl.adminStoreControl.suspend`
  - `ctrl.resumeStore` → `ctrl.adminStoreControl.resume`
  - `ctrl.listStatusLogs` → `ctrl.adminStoreControl.getLogs`
  - `ctrl.getStoreStatus` → `ctrl.storeStoreControl.status`
  - `ctrl.listMyLogs` → `ctrl.storeStoreControl.myLogs`

### 8. 补充 `order.controller.ts` 缺失的 5 个函数
- **文件**：`backend/src/controllers/admin/order.controller.ts`（当前仅 67 行，6 个函数）
- **缺失函数**：
  - `cancelOrder` — 取消订单（更新状态为 CANCELLED，记录原因）
  - `remarkOrder` — 备注订单（更新 remark 字段）
  - `updateOrderStatus` — 更新订单状态（通用状态流转）
  - `getOrderOperationLogs` — 获取订单操作日志（查询 order_operation_log 表）
  - `batchUpdateOrderStatus` — 批量更新订单状态（批量操作）
- **实现要求**：每个函数需要使用 `req.tenantId!` 做租户隔离，使用 zod 校验参数
- **注意**：如果对应的 service 层函数也不存在，需要同时补充

### 9. 修复 `store.routes.ts` 的 batchController 引用
- **文件**：`backend/src/routes/store.routes.ts`
- **问题**：`batchController.listBatchesBySpu` 和 `batchController.getTraceChain` 在 `controllers/inventory-batch.controller.ts`（非 admin）中不存在
- **修复方案**：
  - 方案 A：将 `store.routes.ts` 中的 import 改为 `../controllers/admin/inventory-batch.controller.js`，并将 `listBatchesBySpu` 改为 `getProductBatches`，`getTraceChain` 改为 `getBatchTrace`
  - 方案 B：在 `controllers/inventory-batch.controller.ts`（非 admin）中添加这两个函数的 store 端版本

### 10. 修复即时零售 3 个适配器的引用错误
- **文件**：
  - `backend/src/services/instant-retail/adapters/jd-adapter.ts`
  - `backend/src/services/instant-retail/adapters/eleme-adapter.ts`
  - `backend/src/services/instant-retail/adapters/meituan-adapter.ts`
- **问题**：第 10 行 `import { platformCall, useMock } from "../http-client.js"`，但 `http-client.ts` 导出的是 `isMock()` 函数和 `HttpClient` 类
- **修复方案**：修改 3 个适配器的 import 和调用：
  - `platformCall(...)` → 使用 `HttpClient` 实例的方法
  - `useMock()` → 改为 `isMock()`

### 11. 修复 `instant-retail-new.routes.ts` 17 个缺失函数
- **文件**：`backend/src/routes/instant-retail-new.routes.ts`、`backend/src/controllers/admin/instant-retail.controller.ts`
- **问题**：路由引用了 `getShopConfig`, `saveShopConfig`, `listCategories`, `createCategory`, `updateCategory`, `deleteCategory`, `listRetailProducts`, `addRetailProduct`, `updateRetailProduct`, `deleteRetailProduct`, `updateRetailOrderStatus`, `listBanners`, `createBanner`, `updateBanner`, `deleteBanner` — controller 中均不存在
- **修复方案**：在 `instant-retail.controller.ts` 中补充这些函数，或者**注释掉路由中尚未实现的部分**，避免服务启动失败（推荐先注释，后续再实现）

### 12. 安装 `node-cron`
- **命令**：`cd backend && npm install node-cron@3 && npm install -D @types/node-cron`
- **原因**：`report-aggregation.job.ts` 引用了 node-cron，但未安装

---

## 验收标准

1. `cd backend && npx tsc --noEmit` 编译错误数为 0
2. `cd backend && npx vitest run` 149 个单元测试全部通过
3. `USE_MOCK_DB=true JWT_SECRET=test-secret npx tsx src/server.ts` 服务能正常启动（无 Route.xxx() requires callback 报错）
4. 安全修复未被回退：JWT_SECRET 无 fallback、.env.production 在 .gitignore
