# SaaS总平台独立化修复 — R48

> 仓库：https://github.com/wen-868/wen-ssystem  
> 唯一分支：main  
> 创建时间：2026-07-17  
> 优先级：**P0 — 最高优先级，阻塞平台功能**  
> 前置依赖：R47（数据库表命名统一）完成后执行

---

## 一、核心概念（所有人必须先理解）

### 1.1 系统架构（两级结构）

```
┌─────────────────────────────────────────────────┐
│              SaaS 总平台（平台管理员）               │
│   管理租户、管理套餐、审核评价、财务对账、系统配置    │
│   用户表: platform_admin（无 tenant_id）           │
│   登录: /api/platform-auth/login                  │
│   认证: requirePlatformAuth                       │
│   前端: saas-admin（独立项目）                      │
├─────────────────────────────────────────────────┤
│              商家工作台（商家管理员）                 │
│   商品、库存、销售、采购、客户、门店、报表           │
│   用户表: t_sys_user（有 tenant_id）               │
│   登录: /api/admin/auth/login                     │
│   认证: requireAuthWithTenant                      │
│   前端: admin-web + app-mobile                    │
└─────────────────────────────────────────────────┘
```

**总平台在商家工作台之上**。总平台管理商家（租户），不隶属于任何租户。总平台管理员不需要 `tenant_id`。

### 1.2 两套认证系统（绝对不能混用）

| 维度 | 商家认证 | 平台认证 |
|------|---------|---------|
| 中间件 | `requireAuthWithTenant` | `requirePlatformAuth` |
| 用户表 | `t_sys_user`（有 `tenant_id`） | `platform_admin`（无 `tenant_id`） |
| JWT 标识 | `issuer=zhixiang-system`, `audience=zhixiang-client` | `type=platform_admin` |
| 登录入口 | `POST /api/admin/auth/login` | `POST /api/platform-auth/login` |
| Token 存储前端 | `auth_token`（admin-web） | `platform_token`（saas-admin） |
| Token 有效期 | 4 小时 | 8 小时 |

### 1.3 auto-routes.ts 的 auth 配置值

目前 `auto-routes.ts` 只识别 3 个 auth 值：

| auth 值 | 行为 | 适用场景 |
|---------|------|---------|
| `"requireAuthWithTenant"` | 先验证 JWT + 再校验 tenant_id | **仅商家路由** |
| `"requireAuth"` | 只验证 JWT，不校验 tenant_id | 商家但不需要租户的路由（极少） |
| `"none"` | 不添加任何中间件 | 登录、回调等公开接口，或路由内部手动挂载中间件 |

**关键缺失**：auto-routes.ts **没有 `"requirePlatformAuth"` 选项**。所以所有平台路由要么用 `auth: "none"` 然后内部手动挂载 `requirePlatformAuth`，要么需要给 auto-routes.ts 新增平台认证支持。

---

## 二、当前 BUG 列表（每个都有确切文件和行号）

### BUG-1: 3 个平台路由错误使用了商家租户认证 [P0]

**问题**：这些路由的 `routeConfig.auth = "requireAuthWithTenant"`，导致 `requireAuthWithTenant` 中间件会在 JWT 中查找 `tenantId`，但平台管理员的 JWT 没有 `tenantId`，直接返回 403。**平台管理员完全无法访问这些功能。**

| 文件 | 行号 | 当前 auth 值 | 应该用 |
|------|------|-------------|--------|
| `backend/src/routes/platform.routes.ts` | 11-15 | `"requireAuthWithTenant"` | 平台认证 |
| `backend/src/routes/platform-review.routes.ts` | 27-31 | `"requireAuthWithTenant"` | 平台认证 |
| `backend/src/routes/platform-reconciliation.routes.ts` | 21-25 | `"requireAuthWithTenant"` | 平台认证 |

**修复方式**（二选一）：
- 方案 A：把 `auth` 改为 `"none"`，然后路由文件内部手动 `router.use(requirePlatformAuth)`
- 方案 B：给 `auto-routes.ts` 新增 `"requirePlatformAuth"` 选项，然后直接配置 `auth: "requirePlatformAuth"`

**推荐方案 B**（更规范）。

### BUG-2: 3 个平台功能路由用了普通商家认证 [P0]

**问题**：这些路由的前缀是 `/api/admin/`（商家前缀），`auth: "requireAuth"` 只验证 JWT 但不检查 `type === "platform_admin"`。**任何商家管理员都能操作平台公告、审计日志、财务结算。**

| 文件 | 行号 | 当前 auth 值 | 前缀 | 问题 |
|------|------|-------------|------|------|
| `backend/src/routes/admin-platform-announcement.routes.ts` | 15-19 | `"requireAuth"` | `/api/admin/platform-announcements` | 平台功能挂在商家前缀下 |
| `backend/src/routes/admin-platform-audit-log.routes.ts` | 11-15 | `"requireAuth"` | `/api/admin/platform-audit-logs` | 同上 |
| `backend/src/routes/admin-platform-settlement.routes.ts` | 14-18 | `"requireAuth"` | `/api/admin/platform-settlements` | 同上 |

**修复方式**：
1. 路由前缀从 `/api/admin/` 改为 `/api/platform/`（平台前缀）
2. auth 从 `"requireAuth"` 改为平台认证

### BUG-3: saas-admin 前端 Token Key 不一致 [P0]

**问题**：saas-admin 中存在**新旧两套认证体系**，token key 名不一致，导致**用户登录成功后被路由守卫拦截，永远无法进入系统**。

| 组件 | 旧体系（体系 A） | 新体系（体系 B） |
|------|----------------|----------------|
| Token Key | `saas_token` | `platform_token` |
| 用户信息 Key | `saas_user` | Pinia store（内存） |
| 登录 API | `POST /api/admin/auth/login`（商家登录！） | `POST /api/platform/auth/login` |
| 请求拦截器 | `api.ts` 读 `saas_token` | `utils/request.ts` 通过 authStore 读 `platform_token` |
| 路由守卫 | `router/index.ts` 读 `saas_token` | （未使用） |
| 登录页 | `views/LoginView.vue` | `views/login/PlatformLogin.vue` |

**致命冲突**：
- 当前路由指向新登录页 `PlatformLogin.vue`，该页通过 authStore 写入 `platform_token`
- 但路由守卫（`router/index.ts:165`）检查的是 `saas_token`
- **结果：登录成功后，路由守卫找不到 token → 重定向回登录页 → 死循环**

| 文件 | 行号 | 当前值 | 需要改为 |
|------|------|--------|---------|
| `saas-admin/src/router/index.ts` | 15 | `localStorage.getItem("saas_token")` | 使用 authStore 或 `platform_token` |
| `saas-admin/src/router/index.ts` | 24 | `localStorage.getItem("saas_user")` | 使用 authStore |
| `saas-admin/src/router/index.ts` | 165 | `localStorage.getItem("saas_token")` | 使用 authStore 或 `platform_token` |
| `saas-admin/src/router/index.ts` | 169 | `localStorage.removeItem("saas_token")` | 使用 authStore.logout() |
| `saas-admin/src/views/LoginView.vue` | 62 | `saas_token` | **删除此文件**（旧登录页） |
| `saas-admin/src/api.ts` | 17 | `saas_token` | 使用 authStore 或 `platform_token` |
| `saas-admin/src/api.ts` | 28 | `saas_token` | 使用 authStore.logout() |
| `saas-admin/src/api.ts` | 92 | `saasLogin` 调商家登录 | **删除 saasLogin** |

### BUG-4: 平台路由前缀冲突 [P1]

**问题**：3 个路由文件共用前缀 `/api/platform`，Express 按文件名字母排序注册，后注册的路由会覆盖前面的同名路由。

| 文件 | 前缀 |
|------|------|
| `platform.routes.ts` | `/api/platform` |
| `platform-config.routes.ts` | `/api/platform` |
| `platform-applications.routes.ts` | `/api/platform` |

**修复方式**：给每个文件分配独立前缀，如 `/api/platform/config`、`/api/platform/applications`。

### BUG-5: requirePlatformAuth 安全性不足 [P1]

**问题**：`backend/src/middleware/auth.ts:119` 的 `requirePlatformAuth` 不验证 JWT 的 `issuer` 和 `audience`，商家用户的 JWT 如果手动加入 `type: "platform_admin"` 就能冒充平台管理员。

**修复方式**：在 `requirePlatformAuth` 中增加 issuer/audience 校验。

---

## 三、修复任务分解

### 任务 1: auto-routes.ts 新增平台认证支持 [P0]

**负责人**：待分配  
**预计**：2 小时

**要做的事**：
1. 在 `backend/src/shared/auto-routes.ts` 的 `getAuthMiddlewares()` 函数中新增 `"requirePlatformAuth"` 选项
2. 新增后，该 auth 值会自动给路由添加 `requirePlatformAuth` + `csrfMiddleware`
3. 导入 `requirePlatformAuth` from `../middleware/auth`

**具体修改**（auto-routes.ts）：
```typescript
// 当前代码只有：
if (auth === "requireAuthWithTenant") return [...requireAuthWithTenant, csrfMiddleware];
if (auth === "requireAuth") return [requireAuth, csrfMiddleware];
if (auth === "none") return [];

// 新增：
if (auth === "requirePlatformAuth") return [requirePlatformAuth, csrfMiddleware];
```

**验收标准**：
- `npx tsc --noEmit` 0 错误
- 修改后不影响其他路由

---

### 任务 2: 修复 3 个平台路由的 auth 配置 [P0]

**负责人**：待分配  
**预计**：1 小时

**前提**：任务 1 完成

**要做的事**：

#### 2a: platform.routes.ts（第 11-15 行）
```typescript
// 改前：
export const routeConfig: RouteConfig = {
  prefix: "/api/platform",
  router: platformRouter,
  auth: "requireAuthWithTenant",  // ← 错误！平台路由不能要租户
};

// 改后：
export const routeConfig: RouteConfig = {
  prefix: "/api/platform",
  router: platformRouter,
  auth: "requirePlatformAuth",  // ← 正确
};
```

#### 2b: platform-review.routes.ts（第 27-31 行）
```typescript
// 改前：auth: "requireAuthWithTenant"
// 改后：auth: "requirePlatformAuth"
// 同时删除文件内部每个路由上手动挂载的 requireAuthWithTenant（第 10/13/16/19/22/25 行）
// 因为 auto-routes 会自动添加 requirePlatformAuth，手动挂载会导致中间件执行两次
```

#### 2c: platform-reconciliation.routes.ts（第 21-25 行）
```typescript
// 改前：auth: "requireAuthWithTenant"
// 改后：auth: "requirePlatformAuth"
// 同样删除文件内部手动挂载的 requireAuthWithTenant
```

**验收标准**：
- 平台管理员登录后能访问 `/api/platform`、`/api/platform-review`、`/api/platform-reconciliation`
- 商家管理员访问这些路由返回 403

---

### 任务 3: 修复 3 个 admin-platform 路由的前缀和认证 [P0]

**负责人**：待分配  
**预计**：2 小时

**要做的事**：

#### 3a: admin-platform-announcement.routes.ts
- 前缀从 `/api/admin/platform-announcements` 改为 `/api/platform/announcements`
- auth 从 `"requireAuth"` 改为 `"requirePlatformAuth"`

#### 3b: admin-platform-audit-log.routes.ts
- 前缀从 `/api/admin/platform-audit-logs` 改为 `/api/platform/audit-logs`
- auth 从 `"requireAuth"` 改为 `"requirePlatformAuth"`

#### 3c: admin-platform-settlement.routes.ts
- 前缀从 `/api/admin/platform-settlements` 改为 `/api/platform/settlements`
- auth 从 `"requireAuth"` 改为 `"requirePlatformAuth"`

**注意**：改完前缀后，saas-admin 前端的 API 路径也要同步修改。

**验收标准**：
- 商家管理员无法访问这些路由
- 平台管理员可以正常访问

---

### 任务 4: 修复 saas-admin 前端 Token Key 不一致 [P0]

**负责人**：待分配  
**预计**：3 小时

**要做的事**：

1. **统一 token key 为 `platform_token`**（体系 B 是正确的）

2. **修改 `saas-admin/src/router/index.ts`**：
   - 第 15 行：`saas_token` → 通过 authStore 获取
   - 第 24 行：`saas_user` → 通过 authStore 获取
   - 第 165 行：`saas_token` → 通过 authStore 获取
   - 第 169 行：`saas_token`/`saas_user` 清除 → authStore.logout()

3. **修改 `saas-admin/src/api.ts`**：
   - 第 17 行：`saas_token` → `platform_token`（或通过 authStore）
   - 第 28 行：`saas_token`/`saas_user` 清除 → authStore.logout()
   - 删除 `saasLogin` 函数（第 92 行），这个函数调的是商家登录接口

4. **删除 `saas-admin/src/views/LoginView.vue`**（旧登录页，调商家登录接口的）

5. **确认路由默认登录页指向 `views/login/PlatformLogin.vue`**

6. **修改 saas-admin 中所有 API 调用的 baseURL**，确保指向平台后端而非商家后端

**验收标准**：
- saas-admin 登录成功后能正常跳转到首页（不循环重定向）
- 所有 API 请求携带 `platform_token`（不是 `saas_token`）
- 控制台无 token 相关的警告/错误

---

### 任务 5: 修复平台路由前缀冲突 [P1]

**负责人**：待分配  
**预计**：1 小时

**要做的事**：

| 文件 | 当前前缀 | 改为 |
|------|---------|------|
| `platform.routes.ts` | `/api/platform` | `/api/platform`（保持，或 `/api/platform/overview`） |
| `platform-config.routes.ts` | `/api/platform` | `/api/platform/config` |
| `platform-applications.routes.ts` | `/api/platform` | `/api/platform/applications` |

**注意**：改完后 saas-admin 前端的 API 路径要同步修改。

**验收标准**：
- 无路由覆盖 warning
- 所有平台 API 正常响应

---

### 任务 6: 增强 requirePlatformAuth 安全性 [P1]

**负责人**：待分配  
**预计**：1 小时

**要做的事**：
1. 在 `backend/src/middleware/auth.ts` 的 `requirePlatformAuth` 中增加 issuer 校验
2. 使用独立的 issuer（如 `zhixiang-platform`）区分平台和商家 JWT
3. 同时修改 `platform-auth.controller.ts` 的 JWT 签发，使用平台专用 issuer

**验收标准**：
- 商家 JWT 无法通过平台认证
- 平台 JWT 无法通过商家认证

---

## 四、执行顺序

```
任务 1（auto-routes 新增平台认证）
  ↓
任务 2（修复 3 个平台路由 auth）  ← 依赖任务 1
  ↓
任务 3（修复 3 个 admin-platform 前缀）  ← 依赖任务 1
  ↓
任务 4（修复 saas-admin token key）  ← 与后端任务可并行
  ↓
任务 5（修复路由前缀冲突）  ← 依赖任务 2
  ↓
任务 6（增强安全性）
```

---

## 五、验收总标准

完成后必须通过以下检查：

1. **平台管理员能登录 saas-admin** → 使用 `platform_admin` 表中的账号
2. **平台管理员能访问所有 `/api/platform/*` 路由** → 无 403
3. **商家管理员不能访问 `/api/platform/*` 路由** → 返回 403
4. **saas-admin 登录后不循环重定向** → 能正常进入首页
5. **saas-admin 所有 API 请求携带正确的 token** → 无 401
6. **`npx tsc --noEmit` 0 错误**
7. **后端冒烟测试全部通过**

---

## 六、踩坑警告

1. **不要把平台路由挂到 `/api/admin/` 前缀下** — `/api/admin/` 是商家路由，任何商家管理员都能访问
2. **不要在平台路由中使用 `requireAuthWithTenant`** — 平台管理员没有 tenantId
3. **不要在平台路由中使用 `requireAuth`** — 这只验证 JWT 签名，不检查 `type === "platform_admin"`，商家用户也能通过
4. **saas-admin 的 token key 必须与路由守卫、请求拦截器一致** — 否则登录后永远进不去
5. **不要删除旧的 `platform_admin` 表或改它的名字** — 它是平台认证的唯一用户表
