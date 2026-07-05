# 全局深度测试报告 v2

**测试日期**: 2026-07-04 第二次完整测试  
**测试工程师**: 苏然  
**测试范围**: 后端 + 四个前端项目  
**测试类型**: 自动化测试、TypeScript 类型检查、生产构建验证、安全审计、代码质量深度扫描  

---

## 一、测试结果总览

| 项目 | 测试文件 | 测试用例 | 通过 | TS类型 | 生产构建 | npm安全 |
|------|---------|---------|------|--------|---------|---------|
| backend | 15 | 275 | 275 ✅ | 0 errors ✅ | N/A | 0 vulns ✅ |
| admin-web | N/A | N/A | N/A | 0 errors ✅ | ❌ 失败 | 2 vulns ⚠️ |
| merchant-mobile | N/A | N/A | N/A | 0 errors ✅ | ✅ 439KB | 2 vulns ⚠️ |
| saas-admin | N/A | N/A | N/A | 0 errors ✅ | ✅ 1.1MB | 2 vulns ⚠️ |
| store-terminal | N/A | N/A | N/A | 0 errors ✅ | ✅ 1.0MB | 2 vulns ⚠️ |

---

## 二、后端测试详情

### 2.1 单元测试 — 全部通过

```
Test Files  15 passed (15)
     Tests  275 passed (275)
  Duration  39.58s
```

测试覆盖模块：
- `error-collection.test.ts` — 错误收集功能
- `purchase-order.test.ts` — 采购订单 CRUD + 流程
- `purchase-in-stock.test.ts` — 采购入库
- `purchase-return.test.ts` — 采购退货
- `supplier.test.ts` — 供应商管理
- `customer-payment.test.ts` — 客户付款
- `customer-statement.test.ts` — 客户对账单
- `sale-return.test.ts` — 销售退货
- `inventory-fifo.test.ts` — 库存 FIFO 成本核算
- `store-control.test.ts` — 门店自动开关门
- `marketing.test.ts` — 优惠券/满减计算
- `price.test.ts` — 协议价/阶梯价匹配

### 2.2 TypeScript 编译 — 零错误
```bash
npx tsc --noEmit → 0 errors
```

### 2.3 npm 安全审计 — 零漏洞
```bash
npm audit → 0 vulnerabilities
```

---

## 三、前端项目测试详情

### 3.1 admin-web

| 检查项 | 结果 | 详情 |
|--------|------|------|
| vue-tsc | ✅ 0 errors | 类型检查通过 |
| vite build | ❌ 失败 | wangeditor 不兼容 Vue 3.4+ |
| 视图文件 | 111 个 | 全部存在 |
| 路由数量 | 106 个 | 全部有对应视图 |

**构建失败详情**:
```
error: "default" is not exported by "vue/dist/vue.runtime.esm-bundler.js",
imported by "@wangeditor/editor-for-vue/dist/index.esm.js"
```
涉及文件: [Products.vue:364-365](file:///workspace/admin-web/src/views/Products.vue#L364-L365)

### 3.2 merchant-mobile

| 检查项 | 结果 | 详情 |
|--------|------|------|
| vue-tsc | ✅ 0 errors | 类型检查通过 |
| vite build | ✅ 成功 | 产物 439.62 KB (gzip: 152.76 KB) |
| 视图文件 | 78+ 个 | 1 个缺失 |
| 路由数量 | 81 个 | 1 个路由对应视图缺失 |

**对比上次测试改进**: 3 个之前缺失的视图文件已创建（order-list、order-detail、inventory-sync），vue-tsc 从 62 个错误降到 0。

### 3.3 saas-admin

| 检查项 | 结果 | 详情 |
|--------|------|------|
| vue-tsc | ✅ 0 errors | 类型检查通过 |
| vite build | ✅ 成功 | Dashboard 1.13MB, index 1.09MB |
| 视图文件 | 9 个 | 全部存在 |
| 路由数量 | 10 个 | MonitorView 未注册 |

**构建警告**: 2 个 chunk 超过 500KB 推荐值。

### 3.4 store-terminal（新发现的前端项目）

| 检查项 | 结果 | 详情 |
|--------|------|------|
| vue-tsc | ✅ 0 errors | 类型检查通过 |
| vite build | ✅ 成功 | element-plus chunk 1.0MB |
| 视图文件 | 12 个 | 全部存在 |
| 路由数量 | 12 个 | 全部有对应视图 |
| 错误处理 | ✅ 良好 | 41 个 catch 块 |
| XSS 防护 | ✅ 安全 | 0 个 v-html/innerHTML |
| console.log | ✅ 清洁 | 0 处调试日志 |

---

## 四、P0 级问题（必须立即修复）

### P0-1: admin-web 构建失败 — wangeditor 不兼容

**文件**: [admin-web/package.json](file:///workspace/admin-web/package.json)  
**原因**: `@wangeditor/editor-for-vue@^1.0.2` 不兼容 Vue 3.4+ 的 ESM 导出方式  
**影响**: 整个 admin-web 无法构建部署  
**修复**: 升级到 `@wangeditor/editor-for-vue@next` 或替换为 Tiptap/Quill

### P0-2: 47 个 Controller 的 168 个 try-catch 全部绕过 error-handler

**严重程度**: 🔴 极高  
**涉及文件**: 47 个 controller  
**典型模式**（[credit.controller.ts](file:///workspace/backend/src/controllers/admin/credit.controller.ts) — 11 处）:
```typescript
export const initCredit = asyncHandler(async (req, res) => {
  try {
    const result = await creditLimitService.initCredit(customerId, body, ctx);
    res.json(ok(result));
  } catch (e: any) {
    // ❌ 错误被直接返回，永远到达不了 errorHandler
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});
```

**影响链**:
- `errorHandler` 的 `console.error` 永远不会记录这些错误 → [error-handler.ts:6](file:///workspace/backend/src/shared/error-handler.ts#L6)
- 飞书告警通知永远不会触发 → [feishu-report.ts](file:///workspace/backend/src/shared/feishu-report.ts)
- 错误日志持久化永远不会被调用 → [error-log.service.ts](file:///workspace/backend/src/services/admin/error-log.service.ts)
- Phase 18-C 的"自动收集错误信息"功能**形同虚设**

**涉及最严重的 controller**:
| Controller | try-catch 数量 |
|-----------|---------------|
| [aftersale.controller.ts](file:///workspace/backend/src/controllers/aftersale.controller.ts) | 11 |
| [credit.controller.ts](file:///workspace/backend/src/controllers/admin/credit.controller.ts) | 11 |
| [stock-check.controller.ts](file:///workspace/backend/src/controllers/stock-check.controller.ts) | 9 |
| [marketing-group-buy.controller.ts](file:///workspace/backend/src/controllers/admin/marketing-group-buy.controller.ts) | 7 |
| [transfer-order.controller.ts](file:///workspace/backend/src/controllers/admin/transfer-order.controller.ts) | 6 |
| [customer-visit.controller.ts](file:///workspace/backend/src/controllers/admin/customer-visit.controller.ts) | 6 |
| [marketing-coupon.controller.ts](file:///workspace/backend/src/controllers/admin/marketing-coupon.controller.ts) | 6 |
| [marketing-flash-sale.controller.ts](file:///workspace/backend/src/controllers/admin/marketing-flash-sale.controller.ts) | 6 |

**修复方案**: 移除 controller 中的 try-catch，让 `asyncHandler` 自动传递错误到 `errorHandler`。在 service 层抛出带 `statusCode` 的业务错误。

### P0-3: Store `/me` 端点无认证保护

**文件**: [store.routes.ts:45](file:///workspace/backend/src/routes/store.routes.ts#L45)  
```typescript
// Auth (无需认证) — 注释说无需认证但路由不应该在这里
storeRouter.get("/me", authController.getMe);  // ← 第45行，在中间件之前

// 需要认证
storeRouter.use(requireAuthWithTenant);  // ← 第48行
```

**影响**: 未认证用户访问 `/api/store/me` 时，`getMe` 使用 `req.user!` 非空断言导致服务崩溃。  
**修复**: 将 `/me` 移到 `requireAuthWithTenant` 之后。

### P0-4: admin-web 和 merchant-mobile 的 api.ts 零错误处理

**文件**:
- [admin-web/src/api.ts](file:///workspace/admin-web/src/api.ts) — 2113 行，0 处 try-catch
- [merchant-mobile/src/api.ts](file:///workspace/merchant-mobile/src/api.ts) — 2602 行，仅 1 处 try-catch

**admin-web 拦截器**只处理了 401，其他错误（403/404/500）全部静默失败。  
**store-terminal 对比**: 41 个 catch 块，错误处理良好 — 可作为参考。

### P0-5: merchant-mobile 1 个路由引用不存在的视图

**文件**: [merchant-mobile/src/router.ts](file:///workspace/merchant-mobile/src/router.ts)  
**缺失**: `src/views/PurchaseReturnDetailView.vue`  
**影响**: 访问该路由时白屏。  
**对比**: 上次测试发现的 4 个缺失视图中有 3 个已修复（order-list、order-detail、inventory-sync）。

---

## 五、P1 级问题（本周内修复）

### P1-1: 四个前端项目 npm 安全漏洞

| 项目 | 漏洞 | 严重程度 | 版本范围 |
|------|------|---------|---------|
| 全部 4 个前端 | vite | 🔴 high | <=6.4.2 (CWE-22 路径遍历) |
| 全部 4 个前端 | esbuild | 🟡 moderate | <=0.24.2 (CWE-346) |

**修复**: 升级 vite 到 6.4.3+（或 7.x），esbuild 到 0.25+。

### P1-2: admin-web 28 个表单无输入校验

**涉及文件**（完整列表）:
```
AftersaleView         CommissionRules       PurchaseOrders
ApprovalRules         SystemConfigView      InventoryBatch
SalesOrderCreate      MyApprovals           TagGroups
PlatformPanel         OrderRoutingView      CollectionLinks
OrderTimeoutView      SaleReturnsView       InventoryBatchPrice
CommissionRecords     OrderProductMapView   MarketingMaterial
CustomerProfile       MarketingView         CreditView
PurchaseInStocks      InventoryAlertConfig  PurchasePlans
ProductImport         SupplierStatements    MarketingPointsMall
CustomerPrices
```

**影响**: 用户可提交空值、超长文本、非法字符，导致后端 400 错误或数据异常。

### P1-3: 硬编码假密钥

**文件**: [InstantRetailPlatform.vue](file:///workspace/admin-web/src/views/InstantRetailPlatform.vue)
- 第 34 行: `appSecret: "jd_app_secret_xxxxxx"`
- 第 48 行: `signSecret: "jd_sign_secret_abc123xyz"`
- 第 65 行: `appSecret: "meituan_app_secret_xxxxxx"`
- 第 79 行: `signSecret: "mt_sign_secret_def456uvw"`
- 第 108 行: `signSecret: "eleme_sign_secret_ghi789rst"`

虽然是假密钥，但容易误导开发者且在生产构建中暴露。应改为空字符串，由后端 API 返回真实配置。

### P1-4: saas-admin MonitorView 未注册路由

**文件**: [saas-admin/src/router/index.ts](file:///workspace/saas-admin/src/router/index.ts)  
**问题**: 路由文件中完全没有 `MonitorView` 或 `monitor` 相关配置。  
**同时**: MonitorView.vue 前端字段与后端 API 返回不一致（前端要 `connections`/`qps`，后端返回 `connection`/`errorCount`）。

### P1-5: saas-admin 和 store-terminal 构建产物过大

| 项目 | 过大 chunk | 大小 |
|------|-----------|------|
| saas-admin | Dashboard | 1.13 MB |
| saas-admin | index | 1.09 MB |
| store-terminal | element-plus | 1.00 MB |

**修复**: 配置 `build.rollupOptions.output.manualChunks` 拆分 element-plus。

### P1-6: 后端缺少统一日志框架

**统计**: 36 处 `console.log/error/warn` 分布在 21 个文件中。  
**主要分布**:
- [feishu-report.ts](file:///workspace/backend/src/shared/feishu-report.ts) — 2 处
- [redis-cache.ts](file:///workspace/backend/src/shared/redis-cache.ts) — 4 处
- [error-handler.ts](file:///workspace/backend/src/shared/error-handler.ts) — 1 处
- [即时零售适配器](file:///workspace/backend/src/services/instant-retail/adapters/) — 美团/京东/饿了么各 3+ 处

**修复**: 引入 winston 或 pino 统一日志框架。

---

## 六、P2 级问题（可排期修复）

### P2-1: TypeScript `any` 类型泛滥

**统计**: 338 处 `as any` 使用，分布在 100 个文件中。  
**最严重的文件**:
- [stock-check.service.ts](file:///workspace/backend/src/services/admin/stock-check.service.ts) — 26 处
- [transfer-execution.service.ts](file:///workspace/backend/src/services/transfer-execution.service.ts) — 20 处
- [store-control.service.ts](file:///workspace/backend/src/services/admin/store-control.service.ts) — 19 处
- [product-sync.ts](file:///workspace/backend/src/shared/product-sync.ts) — 13 处
- [transfer-order.service.ts](file:///workspace/backend/src/services/transfer-order.service.ts) — 13 处

### P2-2: admin.routes.ts 胖路由 — 83 个端点

**文件**: [admin.routes.ts](file:///workspace/backend/src/routes/admin.routes.ts)  
**建议**: 按业务模块拆分为多个路由文件（如 `product.routes.ts`、`order.routes.ts`、`marketing.routes.ts` 等）。

### P2-3: 10 个 TODO/FIXME 未实现

| 文件 | 数量 | 内容 |
|------|------|------|
| [quote-push.service.ts](file:///workspace/backend/src/services/admin/quote-push.service.ts) | 3 | 短信/小程序/邮件服务 |
| [feishu-report.ts](file:///workspace/backend/src/shared/feishu-report.ts) | 3 | 飞书告警增强 |
| [store-terminal/api.ts](file:///workspace/store-terminal/src/api.ts) | 3 | API 功能待完善 |
| [tenant-admin.service.ts](file:///workspace/backend/src/services/platform/tenant-admin.service.ts) | 1 | 租户管理增强 |

### P2-4: admin-web 中 innerHTML 使用

**文件**: 5 处 echarts 图表清理使用 `innerHTML = ""`  
- [ReportsProducts.vue:113](file:///workspace/admin-web/src/views/ReportsProducts.vue#L113)
- [ReportsEmployees.vue:91](file:///workspace/admin-web/src/views/ReportsEmployees.vue#L91)
- [ReportsStores.vue:103](file:///workspace/admin-web/src/views/ReportsStores.vue#L103)
- [FinanceProfit.vue:181](file:///workspace/admin-web/src/views/FinanceProfit.vue#L181)
- [FinanceProfit.vue:262](file:///workspace/admin-web/src/views/FinanceProfit.vue#L262)

**风险评估**: 低风险（仅用于清空图表容器），建议改用 `while (el.firstChild) el.removeChild(el.firstChild)`。

### P2-5: SQL 动态拼接风格

**文件**:
- [common.service.ts:29](file:///workspace/backend/src/services/instant-retail/common.service.ts#L29)
- [common.service.ts:58](file:///workspace/backend/src/services/instant-retail/common.service.ts#L58)
- [customer-segment.service.ts:50](file:///workspace/backend/src/services/admin/customer-segment.service.ts#L50)

**说明**: 虽然使用了参数化查询（`?` 占位符），但动态拼接 SQL 字符串的代码风格容易在维护中引入注入风险。建议使用 Knex 等查询构建器。

---

## 七、测试通过项（值得肯定）

| 项目 | 结果 |
|------|------|
| 后端 275 个单元测试 | ✅ 全部通过 |
| 后端 TypeScript 编译 | ✅ 0 错误 |
| 后端 npm 安全审计 | ✅ 0 漏洞 |
| 四个前端 TypeScript 检查 | ✅ 全部 0 错误 |
| merchant-mobile 生产构建 | ✅ 成功 (439KB) |
| saas-admin 生产构建 | ✅ 成功 |
| store-terminal 生产构建 | ✅ 成功 |
| 前端 XSS 防护 | ✅ 所有项目 0 v-html 使用 |
| store-terminal 错误处理 | ✅ 41 个 catch 块 |
| store-terminal 代码清洁度 | ✅ 0 console.log、0 innerHTML |
| 环境变量保护 | ✅ .env 已加入 .gitignore |
| 密码哈希 | ✅ 使用 bcrypt |
| 认证中间件 | ✅ 大部分路由正确使用 requireAuthWithTenant |
| SQL 注入防护 | ✅ 使用参数化查询 |
| Helmet/CORS/RateLimit | ✅ 已配置 |

---

## 八、对比上次测试的变化

| 问题 | 上次状态 | 本次状态 |
|------|---------|---------|
| merchant-mobile vue-tsc 62 错误 | ❌ | ✅ 已修复 |
| merchant-mobile 3 个缺失视图 | ❌ | ✅ 已创建 |
| admin-web vue-tsc 报错 | ⚠️ | ✅ 已修复 |
| merchant-mobile 1 个缺失视图 | ❌ | ❌ 仍缺失 |
| admin-web 构建失败 | ❌ | ❌ 未修复 |
| Store /me 无认证 | ❌ | ❌ 未修复 |
| Controller 错误处理绕过 | ❌ | ❌ 未修复 |
| 硬编码密钥 | ❌ | ❌ 未修复 |
| 新发现 store-terminal 项目 | — | ✅ 测试通过 |

---

## 九、优先级矩阵

| 优先级 | 数量 | 问题概述 |
|--------|------|---------|
| P0 | 5 | 构建失败、错误处理全绕过、无认证路由、零错误处理、缺失视图 |
| P1 | 6 | 安全漏洞、28个表单无校验、硬编码密钥、MonitorView缺失、产物过大、日志混乱 |
| P2 | 5 | any泛滥、胖路由、TODO未实现、innerHTML、SQL风格 |

---

## 十、复现脚本

### 1. 复现后端全部测试
```bash
cd /workspace/backend && npm install --legacy-peer-deps && npx vitest run
# 预期: 15 files, 275 tests, all passed
```

### 2. 复现 admin-web 构建失败
```bash
cd /workspace/admin-web && npm install --legacy-peer-deps && npx vite build
# 预期: "default" is not exported by "vue/dist/vue.runtime.esm-bundler.js"
```

### 3. 复现 Store /me 无认证
```bash
curl http://localhost:8080/api/store/me
# 预期: 服务端崩溃 (req.user is undefined)
```

### 4. 复现所有前端构建
```bash
cd /workspace/merchant-mobile && npm install --legacy-peer-deps && npx vue-tsc --noEmit && npx vite build
cd /workspace/saas-admin && npm install --legacy-peer-deps && npx vue-tsc --noEmit && npx vite build
cd /workspace/store-terminal && npm install --legacy-peer-deps && npx vue-tsc --noEmit && npx vite build
```

### 5. 复现安全漏洞扫描
```bash
for dir in admin-web merchant-mobile saas-admin store-terminal; do
  echo "=== $dir ===" && cd /workspace/$dir && npm audit --json | python3 -c "import sys,json;d=json.load(sys.stdin);[print(f'{k}: {v[\"severity\"]}') for k,v in d.get('vulnerabilities',{}).items()]"
done
```

---

## 十一、统计汇总

| 类别 | 数量 |
|------|------|
| 后端测试文件 | 15 |
| 后端测试用例 | 275 |
| 后端路由文件 | 71 |
| 后端 Controller | 100 |
| 后端 Service | 130+ |
| 前端项目 | 4 个 |
| 前端视图文件 | 210+ |
| 前端路由 | 209+ |
| 发现问题总数 | 16 |
| P0 问题 | 5 |
| P1 问题 | 6 |
| P2 问题 | 5 |

---

*报告生成时间: 2026-07-04 22:10 CST*  
*测试工程师: 苏然*  
*分支: trae/solo-agent-4ikMYJ*