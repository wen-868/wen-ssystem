# 全局深度测试报告

**测试日期**: 2026-07-04  
**测试工程师**: 苏然  
**测试范围**: 后端 + 三个前端项目（admin-web、merchant-mobile、saas-admin）  
**测试类型**: 自动化测试、TypeScript 类型检查、构建验证、安全审计、代码质量审查  

---

## 一、测试概览

| 项目 | 测试文件 | 测试用例 | 通过 | 失败 | TypeScript | 构建 | npm 安全 |
|------|---------|---------|------|------|-----------|------|---------|
| backend | 15 | 275 | 275 | 0 | ✅ 0 errors | N/A | ✅ 0 vulns |
| admin-web | N/A | N/A | N/A | N/A | ⚠️ vue-tsc 报错 | ❌ 失败 | ⚠️ 2 vulns |
| merchant-mobile | N/A | N/A | N/A | N/A | ✅ 0 errors | ✅ 成功 | ⚠️ 2 vulns |
| saas-admin | N/A | N/A | N/A | N/A | ✅ 0 errors | ✅ 成功 | ⚠️ 2 vulns |

---

## 二、P0 级问题（必须立即修复）

### P0-1: admin-web 构建失败 — wangeditor 与 Vue 3.4+ 不兼容

**文件**: [admin-web/package.json](file:///workspace/admin-web/package.json#L13)  
**原因**: `@wangeditor/editor-for-vue@^1.0.2` 不兼容 Vue 3.4+ 的 ESM 导出方式  

**错误信息**:
```
"default" is not exported by "vue/dist/vue.runtime.esm-bundler.js",
imported by "@wangeditor/editor-for-vue/dist/index.esm.js"
```

**影响范围**: [Products.vue](file:///workspace/admin-web/src/views/Products.vue#L364-L365) 引用了 wangeditor 组件，导致整个 admin-web 无法构建  

**修复建议**:
1. 升级到 `@wangeditor/editor-for-vue@next`（支持 Vue 3.4+）
2. 或替换为其他富文本编辑器（如 Tiptap、Quill）
3. 或降级 Vue 到 3.3.x

---

### P0-2: Controller 错误处理全部绕过 error-handler 中间件

**严重程度**: 🔴 极高  
**问题描述**: 系统设计了统一的 `errorHandler` 中间件和 `asyncHandler` 包装器，但 48 个 controller 文件中的 169 个 try-catch 块在 catch 中直接调用 `res.status().json()` 返回响应，导致错误**永远走不到 error-handler**。

**典型错误模式**（存在于几乎所有 controller）：

```typescript
// credit.controller.ts:57-62
export const initCredit = asyncHandler(async (req, res) => {
  try {
    const result = await creditLimitService.initCredit(customerId, body, ctx);
    res.json(ok(result));
  } catch (e: any) {
    // ❌ 错误在这里被捕获并直接返回，永远不会到达 errorHandler
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});
```

**影响**:
- `errorHandler` 中的 `console.error(err)` 永远不会记录这些错误（[error-handler.ts:6](file:///workspace/backend/src/shared/error-handler.ts#L6)）
- 飞书告警通知永远不会触发（[feishu-report.ts](file:///workspace/backend/src/shared/feishu-report.ts)）
- 错误日志持久化（[error-log.service.ts](file:///workspace/backend/src/services/admin/error-log.service.ts)）永远不会被调用
- 所有 Phase 18-C 的"自动收集错误信息"功能形同虚设

**涉及文件**（部分列举）:
- [aftersale.controller.ts](file:///workspace/backend/src/controllers/aftersale.controller.ts) — 11 个 try-catch
- [credit.controller.ts](file:///workspace/backend/src/controllers/admin/credit.controller.ts) — 11 个 try-catch
- [stock-check.controller.ts](file:///workspace/backend/src/controllers/stock-check.controller.ts) — 9 个 try-catch
- [instant-retail.controller.ts](file:///workspace/backend/src/controllers/admin/instant-retail.controller.ts) — 多个 try-catch
- 以及其他 44 个 controller 文件

**修复建议**:
```typescript
// ✅ 正确写法：移除 try-catch，让 asyncHandler 自动传递错误到 errorHandler
export const initCredit = asyncHandler(async (req, res) => {
  const result = await creditLimitService.initCredit(customerId, body, ctx);
  res.json(ok(result));
});
```
然后在 service 层抛出带 `statusCode` 的业务错误即可被 errorHandler 正确处理。

---

### P0-3: Store `/me` 路由缺少认证保护

**文件**: [store.routes.ts:45](file:///workspace/backend/src/routes/store.routes.ts#L45)  
**问题**: `storeRouter.get("/me", authController.getMe)` 在 `storeRouter.use(requireAuthWithTenant)` 之前注册，导致该端点**无需认证即可访问**。

```typescript
// store.routes.ts:42-48
// Auth (无需认证)
storeRouter.get("/me", authController.getMe);  // ❌ 第45行，在中间件之前

// 需要认证
storeRouter.use(requireAuthWithTenant);  // 第48行
```

**影响**: 未认证用户访问 `/api/store/me` 时，`getMe` 中使用 `req.user!` 非空断言会直接崩溃（[store/auth.controller.ts:15](file:///workspace/backend/src/controllers/store/auth.controller.ts#L15)）。

**修复建议**: 将 `/me` 路由移到 `requireAuthWithTenant` 中间件之后。

---

### P0-4: admin-web 和 merchant-mobile 的 api.ts 零错误处理

**文件**:
- [admin-web/src/api.ts](file:///workspace/admin-web/src/api.ts) — 2113 行，0 处 try-catch
- [merchant-mobile/src/api.ts](file:///workspace/merchant-mobile/src/api.ts) — 2602 行，仅 1 处 try-catch

**admin-web 响应拦截器**（[api.ts](file:///workspace/admin-web/src/api.ts)）:
```typescript
// 只处理了 401，其他错误（403、404、500等）全部静默失败
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("admin_token");
      router.push("/login");
    }
    return Promise.reject(error); // 但调用方没有 catch
  }
);
```

**影响**: 任何 API 调用失败时，用户看到的是空白页面或未定义错误，没有任何提示。

---

### P0-5: merchant-mobile 4 个路由引用不存在的视图文件

**文件**: [merchant-mobile/src/router.ts](file:///workspace/merchant-mobile/src/router.ts)  
**缺失的视图文件**:
1. `instant-retail/order-list.vue` — 即时零售订单列表
2. `instant-retail/order-detail.vue` — 即时零售订单详情
3. `instant-retail/inventory-sync.vue` — 即时零售库存同步
4. `PurchaseReturnDetailView.vue` — 采购退货详情

**影响**: 用户访问这些路由时会白屏。

---

## 三、P1 级问题（本周内修复）

### P1-1: 全局 npm 安全漏洞 — 三个前端项目

| 项目 | 漏洞包 | 严重程度 | 影响版本 | CVE |
|------|--------|---------|---------|-----|
| admin-web | vite | high | <=6.4.2 | CWE-22 路径遍历 |
| admin-web | esbuild | moderate | <=0.24.2 | CWE-346 |
| merchant-mobile | vite | high | <=6.4.2 | 同上 |
| merchant-mobile | esbuild | moderate | <=0.24.2 | 同上 |
| saas-admin | vite | high | <=6.4.2 | 同上 |
| saas-admin | esbuild | moderate | <=0.24.2 | 同上 |

**修复建议**: 升级 vite 到 6.4.3+（或 7.x），esbuild 到 0.25+。

---

### P1-2: admin-web 27 个表单无输入校验

**影响文件**（部分列举）:
- [Brands.vue](file:///workspace/admin-web/src/views/Brands.vue)
- [Units.vue](file:///workspace/admin-web/src/views/Units.vue)
- [Suppliers.vue](file:///workspace/admin-web/src/views/Suppliers.vue)
- [ProductCategories.vue](file:///workspace/admin-web/src/views/ProductCategories.vue)
- [CustomerTags.vue](file:///workspace/admin-web/src/views/CustomerTags.vue)
- [TagGroups.vue](file:///workspace/admin-web/src/views/TagGroups.vue)
- 以及其他 21 个视图

**影响**: 用户可提交空值、超长文本、非法字符，可能导致后端 400 错误或数据异常。

**修复建议**: 使用 Element Plus 的 `el-form` 验证规则，或使用 zod 在前端校验。

---

### P1-3: 硬编码假密钥

**文件**: [InstantRetailPlatform.vue](file:///workspace/admin-web/src/views/InstantRetailPlatform.vue)

```typescript
appSecret: "jd_app_secret_xxxxxx",
signSecret: "jd_sign_secret_abc123xyz",
// 以及美团、饿了么的假密钥
```

**影响**: 虽然是假密钥，但容易让开发者误以为这是真实配置，且在生产构建中会暴露。

**修复建议**: 将默认值改为空字符串，由后端 API 返回真实配置。

---

### P1-4: saas-admin MonitorView 缺失路由 + 前后端字段不匹配

**问题 1**: [saas-admin/src/router/index.ts](file:///workspace/saas-admin/src/router/index.ts) 缺少 MonitorView 路由注册。

**问题 2**: [MonitorView.vue](file:///workspace/saas-admin/src/views/MonitorView.vue) 前端期望字段与后端返回不一致：

| 前端期望字段 | 后端实际返回 | 
|-------------|-------------|
| `connections` | `connection` |
| `qps` | 无此字段 |
| 无 | `errorCount`（后端有但前端未使用） |

---

### P1-5: saas-admin 构建产物过大

**文件**: saas-admin 构建输出  
**问题**: Dashboard chunk 1.13MB, index chunk 1.09MB，超过 500KB 推荐值。

**修复建议**: 
- 使用动态 `import()` 进行代码分割
- 配置 `build.rollupOptions.output.manualChunks`

---

### P1-6: 后端 100+ console.log 调用，缺少统一日志框架

**涉及文件**: 38 个文件，100+ 处 console 调用  
**主要分布**:
- [即时零售适配器](file:///workspace/backend/src/services/instant-retail/adapters/) — 美团/京东/饿了么适配器各 10+ 处
- [feishu-report.ts](file:///workspace/backend/src/shared/feishu-report.ts) — 5 处
- [redis-cache.ts](file:///workspace/backend/src/shared/redis-cache.ts) — 5 处
- [alert.service.ts](file:///workspace/backend/src/services/alert.service.ts) — 6 处
- [subscription-expiry.service.ts](file:///workspace/backend/src/services/subscription-expiry.service.ts) — 10 处

**修复建议**: 引入 winston 或 pino 统一日志框架，支持日志级别、格式化和输出目标配置。

---

## 四、P2 级问题（可排期修复）

### P2-1: TODO 未实现功能

**文件**: [quote-push.service.ts](file:///workspace/backend/src/services/admin/quote-push.service.ts)
- 第 482 行: `// TODO: 接入真实短信服务`
- 第 488 行: `// TODO: 接入小程序订阅消息`
- 第 492 行: `// TODO: 接入邮件服务`

### P2-2: tsconfig 废弃配置

- [merchant-mobile/tsconfig.json](file:///workspace/merchant-mobile/tsconfig.json): `baseUrl` 在 TS 7.0 中将被废弃
- [saas-admin/tsconfig.json](file:///workspace/saas-admin/tsconfig.json): `moduleResolution=node10` 在 TS 7.0 中将被废弃

### P2-3: admin-web 中 innerHTML 使用

**文件**: 5 处 echarts 图表清理使用 `innerHTML = ""`  
- [ReportsProducts.vue:113](file:///workspace/admin-web/src/views/ReportsProducts.vue#L113)
- [ReportsEmployees.vue:91](file:///workspace/admin-web/src/views/ReportsEmployees.vue#L91)
- [ReportsStores.vue:103](file:///workspace/admin-web/src/views/ReportsStores.vue#L103)
- [FinanceProfit.vue:181](file:///workspace/admin-web/src/views/FinanceProfit.vue#L181)
- [FinanceProfit.vue:262](file:///workspace/admin-web/src/views/FinanceProfit.vue#L262)

**风险评估**: 低风险（仅用于清空图表容器），但建议改用 `while (el.firstChild) el.removeChild(el.firstChild)`。

### P2-4: SQL 动态拼接（参数化安全，但代码风格需改进）

**文件**:
- [common.service.ts:29](file:///workspace/backend/src/services/instant-retail/common.service.ts#L29)
- [common.service.ts:58](file:///workspace/backend/src/services/instant-retail/common.service.ts#L58)
- [customer-segment.service.ts:50](file:///workspace/backend/src/services/admin/customer-segment.service.ts#L50)

**说明**: 虽然使用了参数化查询（`?` 占位符），但动态拼接 SQL 字符串的代码风格容易在后续维护中引入 SQL 注入。建议使用查询构建器（如 Knex）。

### P2-5: admin-web vue-tsc 类型检查失败

**原因**: node_modules 从 workspace root 提升，导致 vue-tsc 找不到 element-plus 的 type declarations。需要确认 monorepo 配置或使用 `--legacy-peer-deps` 安装。

---

## 五、测试通过项（值得肯定的部分）

| 项目 | 结果 |
|------|------|
| 后端 275 个单元测试 | ✅ 全部通过 |
| 后端 TypeScript 编译 | ✅ 0 错误 |
| 后端 npm 安全审计 | ✅ 0 漏洞 |
| merchant-mobile TypeScript | ✅ 0 错误 |
| merchant-mobile 生产构建 | ✅ 成功 |
| saas-admin TypeScript | ✅ 0 错误 |
| saas-admin 生产构建 | ✅ 成功 |
| 前端 XSS 防护 | ✅ 无 v-html 使用 |
| 前端 innerHTML 注入 | ✅ 无危险用法 |
| 环境变量保护 | ✅ .env 已加入 .gitignore |
| 密码哈希 | ✅ 使用 bcrypt（非 MD5/SHA1） |
| 认证中间件 | ✅ 大部分路由正确使用 requireAuthWithTenant |
| SQL 注入防护 | ✅ 使用参数化查询 |
| Helmet 安全头 | ✅ 已配置 |
| CORS 配置 | ✅ 已配置白名单 |
| Rate Limiting | ✅ 全局 + 登录接口双重限流 |
| 请求体大小限制 | ✅ 2MB 限制 |
| Zod 参数校验 | ✅ 广泛使用 |

---

## 六、优先级矩阵

| 优先级 | 数量 | 问题概述 |
|--------|------|---------|
| P0 | 5 | 构建失败、错误处理全绕过、无认证路由、零错误处理、缺失视图 |
| P1 | 6 | 安全漏洞、无表单校验、硬编码密钥、字段不匹配、产物过大、日志混乱 |
| P2 | 5 | TODO未实现、配置废弃、innerHTML、SQL风格、类型检查 |

---

## 七、复现脚本

### 1. 复现 admin-web 构建失败
```bash
cd /workspace/admin-web
npm install --legacy-peer-deps
npx vite build
# 预期：报错 "default" is not exported by "vue/dist/vue.runtime.esm-bundler.js"
```

### 2. 复现 Store /me 无认证
```bash
# 直接访问 /api/store/me 不带 token
curl http://localhost:8080/api/store/me
# 预期：服务端崩溃（req.user is undefined）
```

### 3. 复现路由缺失视图
```bash
cd /workspace/merchant-mobile
# 检查视图文件是否存在
ls src/views/instant-retail/order-list.vue 2>&1
ls src/views/instant-retail/order-detail.vue 2>&1
ls src/views/instant-retail/inventory-sync.vue 2>&1
ls src/views/PurchaseReturnDetailView.vue 2>&1
# 预期：全部 File not found
```

### 4. 复现后端测试
```bash
cd /workspace/backend
npm install --legacy-peer-deps
npx vitest run
# 预期：15 files, 275 tests, all passed
```

---

## 八、统计汇总

| 类别 | 数量 |
|------|------|
| 后端测试文件 | 15 |
| 后端测试用例 | 275 |
| 后端路由文件 | 71 |
| 后端 Controller 文件 | 100 |
| 后端 Service 文件 | 130+ |
| admin-web 视图文件 | 111 |
| merchant-mobile 视图文件 | 78 |
| saas-admin 视图文件 | 9 |
| 发现问题总数 | 16 |
| P0 问题 | 5 |
| P1 问题 | 6 |
| P2 问题 | 5 |

---

*报告生成时间: 2026-07-04 22:00 CST*  
*测试工程师: 苏然*  
*分支: trae/solo-agent-4ikMYJ*