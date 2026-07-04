# 前端全面测试报告

> **测试人**：苏然（测试工程师）  
> **测试日期**：2026-07-04  
> **测试分支**：trae/solo-agent-4ikMYJ  
> **检测范围**：admin-web、merchant-mobile、saas-admin 三个前端项目  

---

## 一、测试概览

| 指标 | admin-web | merchant-mobile | saas-admin |
|------|:---:|:---:|:---:|
| Vue 视图数 | 111 | 78 | 9 |
| 路由数 | 106 | 81 | 10 |
| TypeScript 编译 | ✅ 零错误 | ✅ 零错误 | ✅ 零错误 |
| Vite 构建 | ❌ 失败 | ✅ 成功 | ✅ 成功 |
| 前端测试 | 0 | 0 | 0 |
| npm 漏洞 | 2 个 | 2 个 | 2 个 |
| 发现问题数 | 10 | 5 | 2 |

---

## 二、admin-web 项目（105 个视图）

### 构建状态：❌ 失败

**失败原因**：`@wangeditor/editor-for-vue` 依赖缺失且版本不兼容

**涉及文件**：[`admin-web/src/views/Products.vue`](file:///workspace/admin-web/src/views/Products.vue) 第 364-365 行

```typescript
import { Editor, Toolbar } from "@wangeditor/editor-for-vue";
import "@wangeditor/editor/dist/css/style.css";
```

**错误信息**：
```
"default" is not exported by "vue/dist/vue.runtime.esm-bundler.js", 
imported by "@wangeditor/editor-for-vue/dist/index.esm.js"
```

**修复建议**：
1. 方案 A：升级 `@wangeditor/editor-for-vue` 到兼容 Vue 3.4+ 的版本
2. 方案 B：如果富文本编辑器非必需，替换为 `<textarea>` 或 Element Plus 的 `<el-input type="textarea">`

---

### 2.1 API 层无错误处理（P0）

- **文件**：[`admin-web/src/api.ts`](file:///workspace/admin-web/src/api.ts)（2113 行）
- **问题**：整个 api.ts 没有 `try-catch` 或 `.catch()` 错误处理
- **响应拦截器**只处理了 401，其他错误（网络错误、500、超时）全部静默失败

```typescript
// ❌ 当前代码：只处理 401，其他错误全部忽略
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("admin_token");
      window.dispatchEvent(new Event("auth:logout"));
    }
    return Promise.reject(error); // 错误被抛出但无人捕获
  }
);
```

**影响**：用户在页面上看不到任何错误提示，操作失败也不知道原因。

**修复建议**：添加全局错误提示（Element Plus 的 `ElMessage.error`）：

```typescript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("admin_token");
      window.dispatchEvent(new Event("auth:logout"));
      return Promise.reject(error);
    }
    const msg = error?.response?.data?.message || error?.message || "请求失败";
    ElMessage.error(msg);
    return Promise.reject(error);
  }
);
```

---

### 2.2 27 个表单缺少校验规则（P1）

有 `el-form` 组件但**没有 `rules` 属性**的视图：

| 视图 | 说明 |
|------|------|
| `AftersaleView.vue` | 售后处理表单 |
| `ApprovalRules.vue` | 审批规则配置 |
| `CollectionLinks.vue` | 收款链接设置 |
| `CommissionRecords.vue` | 佣金记录 |
| `CommissionRules.vue` | 佣金规则配置 |
| `CreditView.vue` | 授信额度 |
| `CustomerPrices.vue` | 客户价格 |
| `CustomerProfile.vue` | 客户档案 |
| `InventoryAlertConfig.vue` | 库存预警配置 |
| `InventoryBatch.vue` | 批次管理 |
| `InventoryBatchPrice.vue` | 批次定价 |
| `MarketingMaterial.vue` | 营销素材 |
| `MarketingPointsMall.vue` | 积分商城 |
| `MarketingView.vue` | 营销活动 |
| `MyApprovals.vue` | 我的审批 |
| `OrderProductMapView.vue` | 商品映射 |
| `OrderRoutingView.vue` | 订单路由 |
| `OrderTimeoutView.vue` | 超时配置 |
| `ProductImport.vue` | 商品导入 |
| `PurchaseInStocks.vue` | 采购入库 |
| `PurchasePayments.vue` | 采购付款 |
| `PurchasePlans.vue` | 采购计划 |
| `ReceiptsView.vue` | 收款单 |
| `ReconciliationView.vue` | 对账 |
| `StoreValueCards.vue` | 储值卡 |
| `SupplierStatements.vue` | 供应商对账 |
| `Units.vue` | 单位管理 |

**影响**：用户可以提交空值、非法值，导致后端 400 错误或脏数据。

**修复**：为每个 `el-form` 添加 `:rules` 属性。

---

### 2.3 硬编码假密钥（P1）

- **文件**：[`admin-web/src/views/InstantRetailPlatform.vue`](file:///workspace/admin-web/src/views/InstantRetailPlatform.vue)

```typescript
// 第 34 行 - 京东
appSecret: "jd_app_secret_xxxxxx",
signSecret: "jd_sign_secret_abc123xyz",

// 第 65 行 - 美团
appSecret: "meituan_app_secret_xxxxxx",
signSecret: "mt_sign_secret_def456uvw",

// 第 108 行 - 饿了么
signSecret: "eleme_sign_secret_ghi789rst",
```

**影响**：虽然是占位数据，但容易误提交到生产环境。

**修复**：改为从环境变量或后端 API 获取。

---

### 2.4 超大视图文件（P2）

| 文件 | 行数 |
|------|:---:|
| `Dashboard.vue` | **1121** |
| `InstantRetailShelf.vue` | 1015 |
| `MarketingMaterial.vue` | 943 |
| `InstantRetailConfig.vue` | 898 |
| `InstantRetailOrderBoard.vue` | 895 |
| `MarketingView.vue` | 764 |
| `InstantRetailReport.vue` | 753 |
| `InstantRetailOrders.vue` | 709 |
| `MarketingDashboard.vue` | 708 |

> 建议：超过 500 行的视图应拆分为子组件。

---

### 2.5 未使用的死代码视图（P2）

以下 9 个视图存在但未被路由引用：

| 文件 | 行数 |
|------|:---:|
| `CustomerVisitRecords.vue` | — |
| `CustomerVisitStats.vue` | — |
| `MarketingPromotion.vue` | — |
| `NotFound.vue` | — |
| `PurchaseReturns.vue` | — |
| `Subscriptions.vue` | — |
| `TenantDetail.vue` | — |
| `Tenants.vue` | — |

> 注：`LoginView.vue` 在路由中直接 import，非动态加载，属于正常使用。

---

### 2.6 api.ts 过大（P2）

- 2113 行，所有 API 函数集中在一个文件
- 建议按模块拆分：`api/auth.ts`、`api/product.ts`、`api/order.ts` 等

---

### 2.7 MainLayout 过大（P2）

- [`admin-web/src/layouts/MainLayout.vue`](file:///workspace/admin-web/src/layouts/MainLayout.vue)：557 行
- 99 个侧边栏菜单项全部硬编码在模板中
- 建议：菜单配置独立为 `menu.config.ts`，按模块拆分

---

## 三、merchant-mobile 项目（78 个视图）

### 构建状态：✅ 成功

---

### 3.1 API 层几乎无错误处理（P0）

- **文件**：[`merchant-mobile/src/api.ts`](file:///workspace/merchant-mobile/src/api.ts)（2602 行）
- 整个 api.ts 只有 **1 处** try-catch
- 所有 API 调用失败时用户看不到错误提示

**影响**：和 admin-web 相同的问题，但更严重（2602 行代码只有 1 处错误处理）。

**修复**：同 admin-web 2.1 节的方案。

---

### 3.2 4 个路由引用不存在的视图（P0）

这些路由在访问时会报 404 白屏：

| 路由引用 | 实际文件 |
|------|------|
| `instant-retail/order-list.vue` | ❌ 不存在 |
| `instant-retail/order-detail.vue` | ❌ 不存在 |
| `instant-retail/inventory-sync.vue` | ❌ 不存在 |
| `PurchaseReturnDetailView.vue` | ❌ 不存在 |

**定位文件**：[`merchant-mobile/src/router.ts`](file:///workspace/merchant-mobile/src/router.ts)

**修复**：创建对应视图文件，或删除这些路由。

---

### 3.3 1 个未使用的死代码视图（P2）

- `SaleReturnView.vue` 存在但未被路由引用
- 注：`CreateSaleReturnView.vue` 和 `SaleReturnsView.vue` 已被引用，`SaleReturnView.vue` 可能是旧版本

---

### 3.4 3 个 TODO 未实现（P2）

| 文件 | 行号 | TODO 内容 |
|------|:---:|------|
| `SaleReturnDetailView.vue` | 167 | 调用审核 API |
| `SaleReturnDetailView.vue` | 185 | 调用退款 API |
| `ProfileView.vue` | 99 | 后端尚未实现修改密码 API |

---

### 3.5 api.ts 过大（P2）

- 2602 行，三个项目中最大
- 建议按模块拆分

---

## 四、saas-admin 项目（9 个视图）

### 构建状态：✅ 成功（有警告）

**警告**：两个 chunk 超过 500KB
```
dist/assets/index-Dd1QSB8H.js   1,087.08 kB
dist/assets/Dashboard-B-ic6Jeh.js  1,132.31 kB
```

---

### 4.1 缺少 MonitorView 路由和页面（P1）

- 监控告警功能的 `MonitorView.vue` 存在但**路由未注册**
- 侧边栏也**没有菜单入口**
- 用户无法访问监控页面

**涉及文件**：
- [`saas-admin/src/router/index.ts`](file:///workspace/saas-admin/src/router/index.ts) — 缺少路由
- [`saas-admin/src/layouts/MainLayout.vue`](file:///workspace/saas-admin/src/layouts/MainLayout.vue) — 缺少菜单项

**修复**：在路由和侧边栏中注册 MonitorView。

---

### 4.2 前后端字段不匹配（P1）

[`saas-admin/src/views/MonitorView.vue`](file:///workspace/saas-admin/src/views/MonitorView.vue) 的字段和后端 API 返回的不一致：

| 前端期望字段 | 后端实际返回 |
|------|------|
| `connections` | `connection` |
| `slowQueries` | （无此字段） |
| `memoryUsage` | （无此字段） |
| `qps` | `errorCount` |
| `avgResponseTime` | `errorRate` |

**影响**：即使路由修好，页面数据也全是 0。

---

## 五、三个项目共性问题

| 问题 | admin-web | merchant-mobile | saas-admin |
|------|:---:|:---:|:---:|
| 前端测试 | 0 | 0 | 0 |
| npm 漏洞（esbuild） | 2 | 2 | 2 |
| API 错误处理缺失 | P0 | P0 | — |
| api.ts 过大 | 2113 行 | 2602 行 | 198 行 |
| 类型安全（`:any`） | 未统计 | 未统计 | 未统计 |

---

## 六、修复优先级

| 优先级 | 项目 | 问题 | 预估工作量 |
|:---:|------|------|:---:|
| P0 | admin-web | 修复 wangeditor 构建失败 | 0.5h |
| P0 | admin-web | api.ts 添加全局错误处理 | 0.5h |
| P0 | merchant-mobile | api.ts 添加全局错误处理 | 0.5h |
| P0 | merchant-mobile | 修复 4 个路由引用不存在的视图 | 1h |
| P1 | admin-web | 27 个表单添加校验规则 | 2-3h |
| P1 | admin-web | 清理硬编码假密钥 | 0.5h |
| P1 | saas-admin | 注册 MonitorView 路由 + 菜单 | 0.5h |
| P1 | saas-admin | 修复前后端字段不匹配 | 1h |
| P2 | admin-web | 删除 9 个未使用的视图 | 0.5h |
| P2 | merchant-mobile | 删除 SaleReturnView.vue 或注册路由 | 0.5h |
| P2 | merchant-mobile | 实现 3 个 TODO | 2-3h |
| P2 | 全部 | 拆分超大 api.ts | 2-3h |
| P2 | 全部 | 拆分超大视图组件 | 持续 |
| P2 | 全部 | 升级 vite 修复 npm 漏洞 | 0.5h |

---

## 七、复现脚本

```bash
# 1. TypeScript 类型检查
cd /workspace/admin-web && npx vue-tsc --noEmit
cd /workspace/merchant-mobile && npx vue-tsc --noEmit
cd /workspace/saas-admin && npx vue-tsc --noEmit

# 2. 构建测试
cd /workspace/admin-web && npx vite build    # ❌ 失败
cd /workspace/merchant-mobile && npx vite build  # ✅ 成功
cd /workspace/saas-admin && npx vite build   # ✅ 成功

# 3. 安全审计
cd /workspace/admin-web && npm audit
cd /workspace/merchant-mobile && npm audit
cd /workspace/saas-admin && npm audit

# 4. 路由完整性检查
# 见各节中的具体命令
```

---

> **报告完成时间**：2026-07-04  
> **下次测试**：建议修复完成后重新跑构建 + 功能测试