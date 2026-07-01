# 智享营销系统 · 全面审查报告

**审查日期**：2026-07-02
**审查范围**：main 分支全部代码（后端 + 管理后台 + 商户移动端 + 门店终端）
**审查结果**：发现 **205 个编译错误 + 3 个运行时风险 + 2 个安全隐患**

---

## 一、审查概览

| 维度 | 结果 |
|------|------|
| 后端路由 | 73 个文件，83 条路由注册 |
| 后端控制器 | 74 个文件 |
| 后端服务 | 91 个 admin + 11 个 root 服务 |
| 管理后台视图 | 108 个 Vue 文件 |
| 商户移动端视图 | 77 个 Vue 文件 |
| 数据库表 | init_database.sql 62 张 + 迁移脚本 55 张 = 117 张 |
| 设计稿 | 50 个 HTML 文件 |
| **TypeScript 编译** | **后端 100 错 / admin-web 60 错 / merchant-mobile 45 错** |

---

## 二、严重问题（P0 · 阻塞编译/运行）

### 2.1 后端 TypeScript 编译错误（100 个）

#### A. 路由 ↔ Controller 函数名严重不匹配（~80 个错误）

这是**最核心的问题**：大量路由文件引用了 controller 中**不存在的函数名**。

| 路由文件 | 路由引用的函数 | Controller 实际函数 | 问题 |
|---------|--------------|-------------------|------|
| `alert.routes.ts` | `listAlerts`, `getAlertCounts`, `handleAlert`, `listAlertRules`, `updateAlertRule`, `runCheck` | `list`, `count`, `handle`, `rules`, `updateRule`, `check` | 函数名完全不同 |
| `notification.routes.ts` | `listNotifications`, `getUnreadCount`, `markAsRead`, `markAllAsRead`, `listMiniappNotifications`... | `list`, `unreadCount`, `markRead`, `markAllRead`, `myList`... | 函数名完全不同 |
| `stock-check.routes.ts` | `create`, `getStatistics`, `list`, `getDetail`, `update`, `start`, `complete`, `cancel`, `handleDiff`... | `adminStockCheck`, `storeStockCheck` | 只导出 2 个函数，路由引用 12 个 |
| `store-control.routes.ts` | `listConfigs`, `getConfig`, `updateConfig`, `openStore`, `closeStore`, `suspendStore`, `resumeStore`... | `adminStoreControl`, `storeStoreControl` | 只导出 2 个函数，路由引用 9 个 |
| `admin.routes.ts` | `batchUpdateOrderStatus`, `cancelOrder`, `remarkOrder`, `updateOrderStatus`, `getOrderOperationLogs` | 不存在 | 5 个函数完全缺失 |
| `instant-retail-new.routes.ts` | `getShopConfig`, `saveShopConfig`, `listCategories`, `createCategory`, `listRetailProducts`... | `getConfigs`, `upsertConfig`, `getPlatforms`... | 17 个函数名不匹配 |
| `order-timeout.routes.ts` | `listConfigs`, `createConfig`, `updateConfig`, `deleteConfig`, `listLogs` | `createConfig`, `deleteConfig`, `getStatistics`, `listConfigs`, `listLogs`, `updateConfig` | 部分匹配，`createConfig` 参数类型不匹配 |
| `inventory-batch.routes.ts` | `listBatches`, `getBatchDetail`, `createBatch`, `updateBatch`, `splitBatch`, `listExpiryAlerts`... | `createBatch`, `createExpiryConfig`, `deleteExpiryConfig`, `getBatchDetail`... | 函数名和参数类型均不匹配 |

**根因分析**：这是多轮合并的累积问题。每次合并时只合并了路由文件或只合并了 controller 文件，导致两边不同步。此外，部分 controller 使用"聚合函数"模式（如 `adminStockCheck` 一个函数处理所有 admin 端盘点操作），而路由期望的是"细粒度函数"模式。

**修复方案**：
1. 统一函数命名规范（建议采用细粒度模式，一个路由 handler 对应一个 controller 函数）
2. 或者统一采用聚合模式（一个 controller 导出对象，路由按 method + path 分发）

#### B. auth.service.ts 缺少 changePassword 函数（1 个错误）

```
auth.controller.ts(36,38): Property 'changePassword' does not exist on type 'typeof auth.service'
```

`auth.controller.ts` 第 36 行调用了 `authService.changePassword(...)`，但 `auth.service.ts` 中没有这个函数。

**修复**：在 `auth.service.ts` 中添加 `changePassword` 函数，或修改 controller 直接调用 bcrypt。

#### C. report.controller.ts 使用不存在的 req.userId（1 个错误）

```typescript
// report.controller.ts:94
userId: req.userId!,  // ❌ Express Request 类型没有 userId 属性
```

应为 `req.user!.id`。

#### D. 参数类型不匹配（~13 个错误）

- `string` 赋值给 `number` 参数
- `number` 赋值给 `string` 参数
- 对象字面量属性不存在于目标类型

#### E. 缺失依赖 node-cron（1 个错误）

```
src/jobs/report-aggregation.job.ts(1,18): Cannot find module 'node-cron'
```

`report-aggregation.job.ts` 引用了 `node-cron`，但 `package.json` 中没有声明此依赖。

---

### 2.2 数据库 Schema 严重不一致

#### migrate_v2.sql 与 auth.service.ts 状态类型冲突

```sql
-- migrate_v2.sql 第15行
ALTER TABLE sys_role MODIFY COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE';
-- migrate_v2.sql 第21行
ALTER TABLE sys_user MODIFY COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE';
```

但 `auth.service.ts` 中：

```typescript
// 第10行
if (!account || account.status !== 1 || ...)  // ❌ 与 VARCHAR 冲突
// 第17行
WHERE ur.user_id = ? AND r.status = 1`        // ❌ 与 VARCHAR 冲突
```

**后果**：如果执行了 migrate_v2.sql，所有用户登录都会失败（因为 `'ACTIVE' !== 1` 永远为 true）。

**修复方案二选一**：
- 方案 A：回滚 migrate_v2.sql 的状态变更，保持 TINYINT(1)
- 方案 B：修改 auth.service.ts，将 `status !== 1` 改为 `status !== 'ACTIVE'`，`r.status = 1` 改为 `r.status = 'ACTIVE'`

---

## 三、中等问题（P1 · 影响构建/部署）

### 3.1 前端 TypeScript 编译错误

#### admin-web：60 个错误

| 错误类型 | 数量 | 典型问题 |
|---------|------|---------|
| TS2305 / TS2724 | ~15 | API 函数不存在（CustomerVisit 相关 API 缺失） |
| TS2554 | ~12 | 函数参数数量不匹配 |
| TS2345 / TS2322 | ~10 | 类型不匹配（string vs number/boolean） |
| TS2353 | ~5 | 对象字面量属性不存在 |
| TS2307 | ~2 | 模块找不到（@wangeditor/editor-for-vue） |
| TS6133 | ~16 | 未使用的变量（警告级别，不阻塞） |

**重点问题**：
- `CustomerVisitRecords.vue` 引用了 6 个不存在的 API 函数：`fetchCustomerVisits`, `createCustomerVisit`, `checkinCustomerVisit`, `checkoutCustomerVisit`, `cancelCustomerVisit`, `fetchCustomerVisitDetail`
- `CustomerVisitStats.vue` 引用了 `fetchCustomerVisitStatistics`（不存在）
- `Products.vue` 引用了 `@wangeditor/editor-for-vue`（类型声明缺失）

#### merchant-mobile：45 个错误

| 错误类型 | 数量 | 典型问题 |
|---------|------|---------|
| TS6133 | ~35 | 未使用的变量/导入（警告级别） |
| TS2322 | ~6 | 类型不匹配（string vs boolean） |
| TS18047 | ~2 | 可能为 null 的值 |
| TS2724 | ~2 | 模块成员不存在 |

**评估**：merchant-mobile 的问题 mostly 是未使用变量警告，不影响运行时，但阻塞 TypeScript 严格模式编译。

---

### 3.2 缺失运行时依赖

| 依赖 | 引用位置 | package.json | 状态 |
|------|---------|-------------|------|
| `node-cron` | `report-aggregation.job.ts` | ❌ 未声明 | **缺失** |
| `ts-node` | 开发运行 | ❌ 未声明 | **缺失**（无法直接运行 TS） |

---

### 3.3 环境文件提交到仓库

```
store-terminal/.env.production  被提交到 Git
```

虽然内容只有 `VITE_API_BASE=https://api.onepan.cn/api`，但根据安全规范，任何 `.env*` 文件都不应提交到版本控制。

---

## 四、轻微问题（P2 · 建议优化）

### 4.1 冗余路由文件（未使用）

以下路由文件存在但未被 `server.ts` 导入：

| 文件 | 说明 |
|------|------|
| `instant-retail.routes.ts` | 被 `instant-retail-new.routes.ts` 替代 |
| `menu-permission.routes.ts` | 功能已合并到 rbac.routes.ts |
| `quote.routes.ts` | 功能可能已废弃 |

**建议**：确认后删除，避免混淆。

### 4.2 前端 API 与后端不匹配

admin-web 的 `api.ts` 中声明了多个 CustomerVisit 相关 API，但后端没有对应的 controller/routes。这是 Phase 7（客户管理）的遗留问题——前端超前于后端实现。

### 4.3 代码规范问题

- 后端无 `console.log` 残留（✅ 良好）
- 无空文件（✅ 良好）
- 73 处使用 `requireAuthWithTenant` 中间件（✅ 租户隔离覆盖完整）

---

## 五、安全问题检查

| 检查项 | 状态 | 说明 |
|--------|:---:|:---|
| `.env.production` 在 `.gitignore` | ✅ | 根目录 .gitignore 已包含 |
| `store-terminal/.env.production` 提交 | ⚠️ | 已提交到仓库，需删除 |
| JWT_SECRET 无 fallback | ✅ | env.ts 中抛出错误而非默认值 |
| `sys_role.status` 类型 | ⚠️ | migrate_v2.sql 改为 VARCHAR，但代码仍用数字比较 |
| Rate Limiting | ✅ | 全局 + 登录接口均已配置 |
| CORS 白名单 | ✅ | 已配置 allowedOrigins |
| 密码强度校验 | ✅ | 最少 8 位 |
| Helmet | ✅ | 已配置 |

---

## 六、修复优先级建议

### 第一优先级（立即修复）

1. **修复数据库状态类型冲突**：统一 sys_user/sys_role 的 status 字段类型（推荐保持 TINYINT(1)，回滚 migrate_v2.sql 的相关变更）
2. **修复 auth.service.ts 缺少 changePassword**：添加该函数或修改 controller
3. **修复 report.controller.ts 的 req.userId**：改为 `req.user!.id`
4. **添加 node-cron 到 package.json**：`npm install node-cron @types/node-cron`

### 第二优先级（本周修复）

5. **修复路由 ↔ Controller 函数名不匹配**：
   - 方案：统一采用"细粒度函数"模式，每个路由 handler 对应一个 controller 函数
   - 影响文件：alert.routes.ts、notification.routes.ts、stock-check.routes.ts、store-control.routes.ts、admin.routes.ts、instant-retail-new.routes.ts
6. **修复 admin-web TypeScript 错误**：
   - 删除/注释 CustomerVisit 相关不存在的 API 调用
   - 修复类型不匹配问题
7. **删除 store-terminal/.env.production 并加入 .gitignore**

### 第三优先级（下周修复）

8. **清理 merchant-mobile 的未使用变量警告**
9. **删除冗余路由文件**（instant-retail.routes.ts、menu-permission.routes.ts、quote.routes.ts）
10. **补齐 CustomerVisit 后端 API**（如果该功能仍需保留）

---

## 七、结论

当前代码库处于**"可运行但不可编译"**状态：

- **运行时**：由于使用 `ts-node` 或直接运行 JS（绕过 TS 检查），这些编译错误不会直接导致服务崩溃。但一旦启用严格类型检查或尝试构建部署，所有问题都会暴露。
- **风险点**：数据库状态类型冲突是**最危险的运行时炸弹**——如果有人在生产环境执行了 migrate_v2.sql，所有用户将无法登录。
- **建议**：在 Phase 14（工作总台）开发之前，先花 1-2 天时间集中修复这些编译错误，建立"零 TypeScript 错误"的基线，否则后续问题会持续累积。

---

**报告生成时间**：2026-07-02
**审查人**：凌舟（AI 审计助手）
