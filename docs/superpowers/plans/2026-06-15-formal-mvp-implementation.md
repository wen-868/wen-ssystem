# 正式可用版方案 A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前演示型智享全链管理系统补齐为第一阶段正式可用版本，覆盖后台基础管理、门店收银、小程序正式配置、基础数据权限和上线验收。

**Architecture:** 先落地共享后端能力和种子数据，再让后台、门店端、小程序三条 UI/业务线并行开发，最后用验收脚本统一收口。第一阶段以线下收款闭环为核心，真实微信支付、退款审核、高级报表和复杂 RBAC 放到第二阶段。

**Tech Stack:** Node.js、TypeScript、Express、MySQL、Vue 3、Element Plus、微信小程序原生工程、npm workspaces、自定义 Node 验收脚本。

---

## 文件边界

### 共享后端与数据库

- Modify: `backend/src/shared/auth.ts`，新增角色判断、门店范围判断和 401/403 统一语义。
- Modify: `backend/src/routes/admin.routes.ts`，补后台商品、门店、客户、订单、库存接口。
- Modify: `backend/src/routes/store.routes.ts`，补门店商品搜索、客户搜索、线下收款库存扣减、门店范围隔离。
- Modify: `backend/src/routes/miniapp.routes.ts`，补小程序临时身份、订单隔离和正式 API 口径。
- Modify: `docs/phase1_schema.sql`，确认并补齐 `product_price_log`、`operation_log`、`miniapp_order.anonymous_member_id` 三类第一阶段需要的结构。
- Modify: `docs/phase1_seed.sql`，补管理员、门店店长、门店操作员、零售客户、批发客户、示例商品和库存。

### 后台

- Modify: `admin-web/src/api.ts`，补后台 API 方法。
- Modify: `admin-web/src/App.vue`，从演示型大工作台改成模块化工作台。
- Create: `admin-web/src/styles/formal-mvp.css`，放置第一阶段后台模块化样式，避免继续扩大 `App.vue`。

### 门店端

- Modify: `store-terminal/src/api.ts`，补门店商品、客户、线下收款 API。
- Modify: `store-terminal/src/App.vue`，补商品选择、客户选择、购物车、线下收款和挂单转销售单。

### 小程序

- Modify: `miniapp/app.js`，改为正式 API 默认配置或可被构建脚本替换的配置。
- Modify: `miniapp/project.config.json`，替换演示 appid 占位，移除正式包不允许的配置。
- Modify: `miniapp/pages/home/index.js`，确保请求正式 API 并带临时身份。
- Modify: `miniapp/pages/order/index.js`，订单列表按身份隔离。
- Modify: `miniapp/pages/order-detail/index.js`，订单详情按身份查询。
- Modify: `scripts/build-mobile-beta.mjs`，正式体验包构建时注入正式 API。

### 验收与部署

- Create: `scripts/acceptance-admin-mvp.mjs`。
- Create: `scripts/acceptance-store-mvp.mjs`。
- Create: `scripts/check-miniapp-release.mjs`。
- Create: `scripts/acceptance-production.mjs`。
- Modify: `scripts/check-production-deploy.mjs`，纳入小程序正式包检查。
- Modify: `package.json`，新增验收命令。
- Modify: `.github/workflows/ci.yml`，纳入非破坏性检查。

---

## 并行策略

### 执行顺序

1. 先执行 Task 1 和 Task 2。它们定义数据、权限和验收框架，是所有同事的共同基础。
2. Task 3、Task 4、Task 5 可以并行执行，分别负责后台、门店端、小程序。
3. Task 6 在 Task 3 和 Task 4 合并后执行，统一销售单收款、库存扣减和流水口径。
4. Task 7 和 Task 8 在所有业务功能完成后执行，跑验收、打包、部署和线上检查。

### 子同事建议

- 同事 A：Task 1，数据和权限基础。
- 同事 B：Task 3，后台正式可用线。
- 同事 C：Task 4，门店正式收银线。
- 同事 D：Task 5，小程序正式配置线。
- 同事 E：Task 2、Task 7、Task 8，验收脚本和部署门禁。

每个任务完成后必须提交一次 git commit。合并前必须跑该任务列出的最小命令。

---

### Task 1: 数据、角色和权限基础

**Files:**
- Modify: `docs/phase1_seed.sql`
- Modify: `backend/src/shared/auth.ts`
- Modify: `backend/src/routes/admin.routes.ts`
- Modify: `backend/src/routes/store.routes.ts`
- Test: `backend/src/__tests__/auth.test.ts`

- [ ] **Step 1: 写失败测试，验证角色和门店范围判断**

Create `backend/src/__tests__/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hasAnyRole, canAccessStore } from "../shared/auth";

describe("auth role and store helpers", () => {
  it("allows admin roles to access admin APIs", () => {
    expect(hasAnyRole({ id: 1, username: "admin", roles: ["SUPER_ADMIN"] }, ["SUPER_ADMIN"])).toBe(true);
  });

  it("rejects store operator from admin-only APIs", () => {
    expect(hasAnyRole({ id: 2, username: "store", roles: ["STORE_OPERATOR"], storeId: 1 }, ["SUPER_ADMIN"])).toBe(false);
  });

  it("allows super admin to access any store", () => {
    expect(canAccessStore({ id: 1, username: "admin", roles: ["SUPER_ADMIN"] }, 2)).toBe(true);
  });

  it("prevents a store operator from accessing another store", () => {
    expect(canAccessStore({ id: 2, username: "store", roles: ["STORE_OPERATOR"], storeId: 1 }, 2)).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm --workspace backend test -- auth.test.ts
```

Expected:

```text
FAIL backend/src/__tests__/auth.test.ts
hasAnyRole is not exported
```

- [ ] **Step 3: 实现最小权限 helper**

Modify `backend/src/shared/auth.ts`:

```ts
export type RoleCode = "SUPER_ADMIN" | "OPERATION_ADMIN" | "STORE_MANAGER" | "STORE_OPERATOR" | "FINANCE";

export type AuthUser = {
  id: number;
  username: string;
  roles: string[];
  storeId?: number | null;
};

export function hasAnyRole(user: AuthUser | undefined, allowedRoles: string[]) {
  if (!user) return false;
  if (user.roles.includes("SUPER_ADMIN")) return true;
  return allowedRoles.some((role) => user.roles.includes(role));
}

export function canAccessStore(user: AuthUser | undefined, storeId: number | null | undefined) {
  if (!user) return false;
  if (user.roles.includes("SUPER_ADMIN") || user.roles.includes("OPERATION_ADMIN")) return true;
  if (!storeId) return false;
  return Number(user.storeId) === Number(storeId);
}
```

Keep the existing `signToken` and `requireAuth` behavior in the same file. If the file already defines `AuthUser`, extend it rather than duplicating it.

- [ ] **Step 4: 增加 role middleware**

Modify `backend/src/shared/auth.ts`:

```ts
import type { RequestHandler } from "express";

export function requireRoles(allowedRoles: string[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ code: "401", message: "未登录" });
      return;
    }
    if (!hasAnyRole(req.user, allowedRoles)) {
      res.status(403).json({ code: "403", message: "无权限访问" });
      return;
    }
    next();
  };
}
```

- [ ] **Step 5: 给 admin 和 store route 加基础角色约束**

Modify `backend/src/routes/admin.routes.ts`:

```ts
import { requireAuth, requireRoles } from "../shared/auth";

const requireAdmin = [requireAuth, requireRoles(["SUPER_ADMIN", "OPERATION_ADMIN", "FINANCE"])];
```

Use `...requireAdmin` on admin routes that currently use only `requireAuth`.

Modify `backend/src/routes/store.routes.ts`:

```ts
import { canAccessStore, requireAuth, requireRoles } from "../shared/auth";

const requireStoreUser = [requireAuth, requireRoles(["SUPER_ADMIN", "OPERATION_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"])];
```

Use `...requireStoreUser` on store routes and reject explicit `storeId` values that `canAccessStore(req.user, storeId)` returns false for.

- [ ] **Step 6: 补正式种子数据**

Modify `docs/phase1_seed.sql` to include:

```sql
INSERT INTO sys_user (id, username, password_hash, real_name, mobile, store_id, status)
VALUES
  (2, 'store_manager', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '默认店长', '13800000001', 1, 1),
  (3, 'store_operator', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '默认店员', '13800000002', 1, 1)
ON DUPLICATE KEY UPDATE
  real_name = VALUES(real_name),
  mobile = VALUES(mobile),
  store_id = VALUES(store_id),
  status = VALUES(status);
```

The hash above is the same `admin123` hash used by the existing `admin` seed row.

Add role links:

```sql
INSERT INTO sys_user_role (user_id, role_id)
SELECT 2, id FROM sys_role WHERE role_code = 'STORE_MANAGER'
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

INSERT INTO sys_user_role (user_id, role_id)
SELECT 3, id FROM sys_role WHERE role_code = 'STORE_OPERATOR'
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);
```

Add retail and wholesale members:

```sql
INSERT INTO member (id, member_no, name, mobile, customer_type, assigned_staff_id, status)
VALUES
  (1, 'MB-DEMO-RETAIL', '零售客户', '13900000001', 'RETAIL', 1, 1),
  (2, 'MB-DEMO-WHOLESALE', '批发客户', '13900000002', 'WHOLESALE', 1, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  mobile = VALUES(mobile),
  customer_type = VALUES(customer_type),
  assigned_staff_id = VALUES(assigned_staff_id),
  status = VALUES(status);
```

- [ ] **Step 7: 运行后端测试**

Run:

```bash
npm --workspace backend test
```

Expected:

```text
Test Files  3 passed
```

- [ ] **Step 8: 提交**

```bash
git add backend/src/shared/auth.ts backend/src/routes/admin.routes.ts backend/src/routes/store.routes.ts backend/src/__tests__/auth.test.ts docs/phase1_seed.sql
git commit -m "feat: 添加基础角色权限和正式种子数据"
```

---

### Task 2: 验收脚本骨架和 package 命令

**Files:**
- Create: `scripts/acceptance-admin-mvp.mjs`
- Create: `scripts/acceptance-store-mvp.mjs`
- Create: `scripts/check-miniapp-release.mjs`
- Create: `scripts/acceptance-production.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写后台验收脚本骨架**

Create `scripts/acceptance-admin-mvp.mjs`:

```js
const API_BASE = process.env.API_BASE || "http://localhost:8080/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok || body.code === "500") {
    throw new Error(`${options.method || "GET"} ${path} failed: ${res.status} ${text}`);
  }
  return body.data;
}

const login = await request("/admin/auth/login", {
  method: "POST",
  body: JSON.stringify({ username: "admin", password: "admin123" })
});

const auth = { Authorization: `Bearer ${login.token}` };
const products = await request("/admin/products", { headers: auth });
if (!Array.isArray(products.records)) throw new Error("商品列表没有 records");

const stores = await request("/admin/stores", { headers: auth });
if (!Array.isArray(stores.records)) throw new Error("门店列表没有 records");

const members = await request("/admin/members", { headers: auth });
if (!Array.isArray(members.records)) throw new Error("客户列表没有 records");

console.log("ACCEPTANCE_ADMIN_MVP_PASS");
```

- [ ] **Step 2: 写门店验收脚本骨架**

Create `scripts/acceptance-store-mvp.mjs`:

```js
const API_BASE = process.env.API_BASE || "http://localhost:8080/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok || body.code === "500") {
    throw new Error(`${options.method || "GET"} ${path} failed: ${res.status} ${text}`);
  }
  return body.data;
}

const login = await request("/admin/auth/login", {
  method: "POST",
  body: JSON.stringify({ username: "store_operator", password: "admin123" })
});

const auth = { Authorization: `Bearer ${login.token}` };
const dashboard = await request("/store/dashboard", { headers: auth });
if (!dashboard) throw new Error("门店工作台无数据");

const inventory = await request("/store/inventory", { headers: auth });
if (!Array.isArray(inventory.records)) throw new Error("库存列表没有 records");

console.log("ACCEPTANCE_STORE_MVP_PASS");
```

- [ ] **Step 3: 写小程序正式包检查脚本**

Create `scripts/check-miniapp-release.mjs`:

```js
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const files = walk("miniapp").filter((file) => /\.(js|json|wxml|wxss)$/.test(file));
const text = files.map((file) => readFileSync(file, "utf8")).join("\n");

if (text.includes("localhost")) throw new Error("小程序正式包不能包含 localhost");
if (text.includes("demoMode: true")) throw new Error("小程序正式包不能包含 demoMode: true");
if (text.includes('"touristappid"')) throw new Error("小程序正式包不能使用 touristappid");

const app = readFileSync("miniapp/app.js", "utf8");
if (!app.includes("https://api.onepan.cn/api")) throw new Error("小程序 app.js 必须指向 https://api.onepan.cn/api");

console.log("MINIAPP_RELEASE_CHECK_PASS");
```

- [ ] **Step 4: 写生产验收脚本**

Create `scripts/acceptance-production.mjs`:

```js
const ADMIN_URL = process.env.ADMIN_URL || "https://admin.onepan.cn";
const STORE_URL = process.env.STORE_URL || "https://store.onepan.cn";
const API_BASE = process.env.API_BASE || "https://api.onepan.cn/api";

async function mustFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

const adminHtml = await mustFetch(`${ADMIN_URL}/`);
const storeHtml = await mustFetch(`${STORE_URL}/`);
await mustFetch(`${API_BASE.replace(/\/api$/, "")}/health`);

for (const html of [adminHtml, storeHtml]) {
  if (html.includes("localhost:8080")) throw new Error("线上 HTML 包含 localhost");
}

console.log("ACCEPTANCE_PRODUCTION_PASS");
```

- [ ] **Step 5: 接入 package.json**

Modify `package.json` scripts:

```json
{
  "test:acceptance:admin": "node scripts/acceptance-admin-mvp.mjs",
  "test:acceptance:store": "node scripts/acceptance-store-mvp.mjs",
  "test:miniapp-release": "node scripts/check-miniapp-release.mjs",
  "test:acceptance:production": "node scripts/acceptance-production.mjs"
}
```

Keep existing scripts unchanged and add these new entries after `test:mysql`.

- [ ] **Step 6: 运行静态脚本**

Run:

```bash
npm run test:miniapp-release
```

Expected before Task 5:

```text
小程序正式包不能包含 localhost
```

This failing check is expected until Task 5 finishes.

- [ ] **Step 7: 提交**

```bash
git add scripts/acceptance-admin-mvp.mjs scripts/acceptance-store-mvp.mjs scripts/check-miniapp-release.mjs scripts/acceptance-production.mjs package.json
git commit -m "test: 添加正式可用版验收脚本骨架"
```

---

### Task 3: 后台正式可用线

**Files:**
- Modify: `backend/src/routes/admin.routes.ts`
- Modify: `admin-web/src/api.ts`
- Modify: `admin-web/src/App.vue`
- Test: `scripts/acceptance-admin-mvp.mjs`

- [ ] **Step 1: 扩展后台验收脚本为失败测试**

Modify `scripts/acceptance-admin-mvp.mjs` to add calls after member list:

```js
const marker = Date.now();
const createdProduct = await request("/admin/products", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    name: `验收商品${marker}`,
    categoryId: 1,
    skuName: `验收商品${marker} 500ml`,
    barcode: `AC${marker}`,
    retailPrice: 199,
    wholesalePrice: 149,
    miniappPrice: 189,
    storePrice: 199,
    stockType: "OFFLINE",
    initialQty: 10,
    warningThreshold: 2
  })
});

if (!createdProduct.spuId || !createdProduct.skuId) throw new Error("新增商品没有返回 spuId/skuId");

await request(`/admin/products/${createdProduct.spuId}/status`, {
  method: "PATCH",
  headers: auth,
  body: JSON.stringify({ status: "ON_SALE" })
});

await request(`/admin/products/${createdProduct.skuId}/price`, {
  method: "PUT",
  headers: auth,
  body: JSON.stringify({ retailPrice: 209, wholesalePrice: 159, miniappPrice: 199, storePrice: 209 })
});

const priceLogs = await request(`/admin/products/${createdProduct.skuId}/price-logs`, { headers: auth });
if (!Array.isArray(priceLogs.records) || priceLogs.records.length === 0) throw new Error("改价后没有价格日志");
```

- [ ] **Step 2: 运行后台验收确认失败**

Run:

```bash
API_BASE=http://localhost:8080/api npm run test:acceptance:admin
```

Expected:

```text
PATCH /admin/products/.../status failed
```

- [ ] **Step 3: 实现商品状态和价格日志接口**

Modify `backend/src/routes/admin.routes.ts`:

```ts
adminRouter.patch("/products/:spuId/status", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({ status: z.enum(["DRAFT", "ON_SALE", "OFF_SALE"]) }).parse(req.body);
  await query("UPDATE product_spu SET status = ?, updated_at = NOW() WHERE id = ?", [body.status, req.params.spuId]);
  res.json(ok({ spuId: Number(req.params.spuId), status: body.status }));
}));

adminRouter.get("/products/:skuId/price-logs", requireAuth, asyncHandler(async (req, res) => {
  const records = await query<any>(
    `SELECT id, sku_id AS skuId, old_price AS oldPrice, new_price AS newPrice, price_type AS priceType, operator_id AS operatorId, created_at AS createdAt
     FROM product_price_log
     WHERE sku_id = ?
     ORDER BY id DESC
     LIMIT 50`,
    [req.params.skuId]
  );
  res.json(ok({ records }));
}));
```

If `product_price_log` column names differ, inspect `docs/phase1_schema.sql` and use the actual names.

- [ ] **Step 4: Update price endpoint to write logs**

Modify the existing `PUT /products/:skuId/price` handler:

```ts
const previous = await queryOne<any>(
  "SELECT retail_price AS retailPrice, wholesale_price AS wholesalePrice, miniapp_price AS miniappPrice, store_price AS storePrice FROM product_price WHERE sku_id = ?",
  [skuId]
);
```

Before update, insert log rows for changed values:

```ts
const priceChanges = [
  ["RETAIL", previous?.retailPrice, body.retailPrice],
  ["WHOLESALE", previous?.wholesalePrice, body.wholesalePrice],
  ["MINIAPP", previous?.miniappPrice, body.miniappPrice],
  ["STORE", previous?.storePrice, body.storePrice]
].filter(([, oldValue, newValue]) => Number(oldValue) !== Number(newValue));

for (const [priceType, oldValue, newValue] of priceChanges) {
  await query(
    `INSERT INTO product_price_log (sku_id, price_type, old_price, new_price, operator_id)
     VALUES (?, ?, ?, ?, ?)`,
    [skuId, priceType, oldValue ?? 0, newValue, req.user?.id ?? 0]
  );
}
```

- [ ] **Step 5: 补后台 API 方法**

Modify `admin-web/src/api.ts`:

```ts
export async function updateProductStatus(spuId: number, status: "DRAFT" | "ON_SALE" | "OFF_SALE") {
  const { data } = await api.patch(`/admin/products/${spuId}/status`, { status });
  return data.data;
}

export async function fetchPriceLogs(skuId: number) {
  const { data } = await api.get(`/admin/products/${skuId}/price-logs`);
  return data.data as { records: unknown[] };
}
```

- [ ] **Step 6: 补后台页面操作**

Modify `admin-web/src/App.vue`:

- Add product status buttons in the product row:

```vue
<el-button size="small" @click="handleProductStatus(scope.row, 'ON_SALE')">上架</el-button>
<el-button size="small" @click="handleProductStatus(scope.row, 'OFF_SALE')">下架</el-button>
```

- Add handler:

```ts
async function handleProductStatus(row: any, status: "DRAFT" | "ON_SALE" | "OFF_SALE") {
  await updateProductStatus(row.spuId, status);
  ElMessage.success(status === "ON_SALE" ? "商品已上架" : "商品已下架");
  await loadProducts();
}
```

- [ ] **Step 7: 运行验收**

Run:

```bash
API_BASE=http://localhost:8080/api npm run test:acceptance:admin
npm --workspace admin-web run build
```

Expected:

```text
ACCEPTANCE_ADMIN_MVP_PASS
✓ built
```

- [ ] **Step 8: 提交**

```bash
git add backend/src/routes/admin.routes.ts admin-web/src/api.ts admin-web/src/App.vue scripts/acceptance-admin-mvp.mjs
git commit -m "feat: 补齐后台商品上架和价格日志"
```

---

### Task 4: 门店正式收银线

**Files:**
- Modify: `backend/src/routes/store.routes.ts`
- Modify: `store-terminal/src/api.ts`
- Modify: `store-terminal/src/App.vue`
- Test: `scripts/acceptance-store-mvp.mjs`

- [ ] **Step 1: 扩展门店验收脚本为失败测试**

Modify `scripts/acceptance-store-mvp.mjs`:

```js
const products = await request("/store/products?keyword=示例", { headers: auth });
if (!Array.isArray(products.records) || products.records.length === 0) throw new Error("门店商品搜索无结果");

const members = await request("/store/members?keyword=批发", { headers: auth });
if (!Array.isArray(members.records) || members.records.length === 0) throw new Error("门店客户搜索无结果");

const sku = products.records[0];
const member = members.records[0];
const saleBill = await request("/store/sale-bills", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    storeId: 1,
    customerId: member.memberId,
    customerName: member.name,
    customerMobile: member.mobile,
    items: [{ skuId: sku.skuId, quantity: 1, unitPrice: Number(sku.storePrice || sku.retailPrice) }]
  })
});

await request(`/store/sale-bills/${saleBill.billNo}/offline-payment`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ amount: saleBill.receivableAmount, paymentMethod: "CASH" })
});
```

- [ ] **Step 2: 运行门店验收确认失败**

Run:

```bash
API_BASE=http://localhost:8080/api npm run test:acceptance:store
```

Expected:

```text
GET /store/products?keyword=示例 failed
```

- [ ] **Step 3: 实现门店商品搜索**

Modify `backend/src/routes/store.routes.ts`:

```ts
storeRouter.get("/products", asyncHandler(async (req, res) => {
  const keyword = String(req.query.keyword || "");
  const barcode = String(req.query.barcode || "");
  const records = await query<any>(
    `SELECT s.id AS skuId, s.sku_code AS skuCode, p.name AS productName, s.sku_name AS skuName,
            s.barcode, pr.retail_price AS retailPrice, pr.wholesale_price AS wholesalePrice,
            pr.store_price AS storePrice, ib.available_qty AS availableQty
     FROM product_sku s
     JOIN product_spu p ON p.id = s.spu_id
     JOIN product_price pr ON pr.sku_id = s.id
     LEFT JOIN inventory_balance ib ON ib.sku_id = s.id AND ib.stock_type = 'OFFLINE'
     WHERE p.status = 'ON_SALE'
       AND (? = '' OR p.name LIKE ? OR s.sku_name LIKE ?)
       AND (? = '' OR s.barcode = ?)
     ORDER BY s.id DESC
     LIMIT 50`,
    [keyword, `%${keyword}%`, `%${keyword}%`, barcode, barcode]
  );
  res.json(ok({ records }));
}));
```

- [ ] **Step 4: 实现门店客户搜索**

Modify `backend/src/routes/store.routes.ts`:

```ts
storeRouter.get("/members", asyncHandler(async (req, res) => {
  const keyword = String(req.query.keyword || "");
  const records = await query<any>(
    `SELECT id AS memberId, member_no AS memberNo, name, mobile, customer_type AS customerType
     FROM member
     WHERE status = 1
       AND (? = '' OR name LIKE ? OR mobile LIKE ?)
     ORDER BY id DESC
     LIMIT 50`,
    [keyword, `%${keyword}%`, `%${keyword}%`]
  );
  res.json(ok({ records }));
}));
```

- [ ] **Step 5: 接入前端 API**

Modify `store-terminal/src/api.ts`:

```ts
export async function searchStoreProducts(keyword: string) {
  const { data } = await api.get("/store/products", { params: { keyword } });
  return data.data as { records: any[] };
}

export async function searchStoreMembers(keyword: string) {
  const { data } = await api.get("/store/members", { params: { keyword } });
  return data.data as { records: any[] };
}

export async function createOfflinePayment(billNo: string, amount: number, paymentMethod: string) {
  const { data } = await api.post(`/store/sale-bills/${billNo}/offline-payment`, { amount, paymentMethod });
  return data.data;
}
```

- [ ] **Step 6: 改门店端开单 UI**

Modify `store-terminal/src/App.vue`:

- Add product search input:

```vue
<el-input v-model="productKeyword" :placeholder="'输入商品名或条码'" @keyup.enter="handleSearchProducts" />
<el-button @click="handleSearchProducts">搜索商品</el-button>
```

- Add product result table with add button:

```vue
<el-table :data="productOptions">
  <el-table-column prop="productName" label="商品" />
  <el-table-column prop="skuName" label="规格" />
  <el-table-column prop="availableQty" label="库存" />
  <el-table-column label="操作">
    <template #default="scope">
      <el-button size="small" @click="addCartItem(scope.row)">加入</el-button>
    </template>
  </el-table-column>
</el-table>
```

- Add state and handlers:

```ts
const productKeyword = ref("");
const productOptions = ref<any[]>([]);
const cartItems = ref<any[]>([]);

async function handleSearchProducts() {
  const data = await searchStoreProducts(productKeyword.value);
  productOptions.value = data.records;
}

function addCartItem(row: any) {
  cartItems.value.push({
    skuId: row.skuId,
    skuName: row.skuName,
    quantity: 1,
    unitPrice: Number(row.storePrice || row.retailPrice)
  });
}
```

- [ ] **Step 7: 运行验收和构建**

Run:

```bash
API_BASE=http://localhost:8080/api npm run test:acceptance:store
npm --workspace store-terminal run build
```

Expected:

```text
ACCEPTANCE_STORE_MVP_PASS
✓ built
```

- [ ] **Step 8: 提交**

```bash
git add backend/src/routes/store.routes.ts store-terminal/src/api.ts store-terminal/src/App.vue scripts/acceptance-store-mvp.mjs
git commit -m "feat: 补齐门店商品选择和线下收款"
```

---

### Task 5: 小程序正式配置和订单隔离

**Files:**
- Modify: `miniapp/app.js`
- Modify: `miniapp/project.config.json`
- Modify: `miniapp/pages/home/index.js`
- Modify: `miniapp/pages/order/index.js`
- Modify: `miniapp/pages/order-detail/index.js`
- Modify: `backend/src/routes/miniapp.routes.ts`
- Modify: `scripts/build-mobile-beta.mjs`
- Test: `scripts/check-miniapp-release.mjs`

- [ ] **Step 1: 运行小程序正式包检查确认失败**

Run:

```bash
npm run test:miniapp-release
```

Expected:

```text
小程序正式包不能包含 localhost
```

- [ ] **Step 2: 修改小程序正式配置**

Modify `miniapp/app.js`:

```js
App({
  globalData: {
    apiBase: "https://api.onepan.cn/api",
    demoMode: false
  },
  onLaunch() {
    const anonymousId = wx.getStorageSync("anonymous_member_id");
    if (!anonymousId) {
      wx.setStorageSync("anonymous_member_id", `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`);
    }
  }
});
```

- [ ] **Step 3: 修改小程序 project config**

Modify `miniapp/project.config.json`:

```json
{
  "appid": "wx0000000000000000",
  "projectname": "liquor-inventory-miniapp",
  "setting": {
    "urlCheck": true
  }
}
```

`wx0000000000000000` 是第一阶段体验包静态检查用 appid。提交微信体验版前，用真实小程序 appid 替换该值，并保持 `urlCheck: true`。

- [ ] **Step 4: 小程序请求带匿名身份**

Modify `miniapp/pages/home/index.js` before `wx.request` calls:

```js
const anonymousId = wx.getStorageSync("anonymous_member_id") || "";
```

Add header:

```js
header: {
  "x-anonymous-member-id": anonymousId
}
```

Do the same in `miniapp/pages/order/index.js` and `miniapp/pages/order-detail/index.js`.

- [ ] **Step 5: 后端订单按匿名身份隔离**

Modify `backend/src/routes/miniapp.routes.ts`:

- In `POST /orders`, read:

```ts
const anonymousMemberId = String(req.headers["x-anonymous-member-id"] || "");
```

- Store it in an existing remark or extension field if schema has one. If no suitable column exists, add `anonymous_member_id VARCHAR(128)` to `miniapp_order` in `docs/phase1_schema.sql` and use it in insert/select.

- In `GET /orders`, filter:

```ts
WHERE (? = '' OR anonymous_member_id = ?)
```

Use `[anonymousMemberId, anonymousMemberId]`.

- [ ] **Step 6: 修改 build-mobile-beta 注入正式配置**

Modify `scripts/build-mobile-beta.mjs`:

```js
const apiBase = process.env.MINIAPP_API_BASE || "https://api.onepan.cn/api";
```

After copying `miniapp` to `.beta-build/miniapp`, replace `app.js` content so it contains `apiBase` and `demoMode: false`.

- [ ] **Step 7: 运行检查**

Run:

```bash
npm run test:miniapp-release
npm run build:mobile-beta
```

Expected:

```text
MINIAPP_RELEASE_CHECK_PASS
MOBILE_BETA_PACKAGE_READY miniapp-beta.zip
```

- [ ] **Step 8: 提交**

```bash
git add miniapp/app.js miniapp/project.config.json miniapp/pages/home/index.js miniapp/pages/order/index.js miniapp/pages/order-detail/index.js backend/src/routes/miniapp.routes.ts docs/phase1_schema.sql scripts/build-mobile-beta.mjs
git commit -m "feat: 小程序切换正式API并隔离订单"
```

---

### Task 6: 收款后库存扣减和流水闭环

**Files:**
- Modify: `backend/src/routes/store.routes.ts`
- Test: `scripts/acceptance-store-mvp.mjs`

- [ ] **Step 1: 扩展门店验收脚本检查库存扣减**

Modify `scripts/acceptance-store-mvp.mjs` before creating sale bill:

```js
const beforeInventory = await request("/store/inventory", { headers: auth });
const beforeRow = beforeInventory.records.find((row) => Number(row.skuId) === Number(sku.skuId) && row.stockType === "OFFLINE");
const beforeQty = Number(beforeRow?.availableQty ?? 0);
```

After offline payment:

```js
const afterInventory = await request("/store/inventory", { headers: auth });
const afterRow = afterInventory.records.find((row) => Number(row.skuId) === Number(sku.skuId) && row.stockType === "OFFLINE");
const afterQty = Number(afterRow?.availableQty ?? 0);
if (afterQty !== beforeQty - 1) {
  throw new Error(`线下收款后库存未扣减：before=${beforeQty}, after=${afterQty}`);
}
```

- [ ] **Step 2: 运行确认失败**

Run:

```bash
API_BASE=http://localhost:8080/api npm run test:acceptance:store
```

Expected:

```text
线下收款后库存未扣减
```

- [ ] **Step 3: 修改 offline-payment 为事务**

Modify `backend/src/routes/store.routes.ts` existing `offline-payment` handler:

```ts
await transaction(async (conn) => {
  const bill = await queryOne<any>("SELECT bill_no AS billNo, store_id AS storeId, unreceived_amount AS unreceivedAmount FROM sale_bill WHERE bill_no = ?", [req.params.billNo]);
  if (!bill) throw new Error("销售单不存在");
  if (body.amount <= 0 || body.amount > Number(bill.unreceivedAmount)) throw new Error("收款金额不合法");

  await conn.execute(
    `INSERT INTO payment_order (pay_no, source_type, source_no, channel, amount, status)
     VALUES (?, 'SALE_BILL', ?, ?, ?, 'SUCCESS')`,
    [payNo, req.params.billNo, body.paymentMethod, body.amount]
  );

  await conn.execute(
    `UPDATE sale_bill
     SET received_amount = received_amount + ?,
         unreceived_amount = GREATEST(unreceived_amount - ?, 0),
         collection_status = CASE WHEN unreceived_amount - ? <= 0 THEN 'PAID' ELSE 'PARTIAL' END,
         updated_at = NOW()
     WHERE bill_no = ?`,
    [body.amount, body.amount, body.amount, req.params.billNo]
  );
});
```

Use the repository’s existing transaction helper if it exists. If it does not exist, use `pool.getConnection()` as already done in admin product creation.

- [ ] **Step 4: 扣减销售单明细库存并写流水**

Inside the same transaction, fetch sale bill items:

```ts
const items = await conn.execute(
  `SELECT sku_id AS skuId, quantity FROM sale_bill_item WHERE bill_no = ?`,
  [req.params.billNo]
);
```

For each item:

```ts
await conn.execute(
  `UPDATE inventory_balance
   SET physical_qty = physical_qty - ?,
       available_qty = available_qty - ?,
       updated_at = NOW()
   WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE' AND available_qty >= ?`,
  [item.quantity, item.quantity, bill.storeId, item.skuId, item.quantity]
);

await conn.execute(
  `INSERT INTO inventory_ledger (ledger_no, store_id, sku_id, stock_type, change_qty, before_qty, after_qty, reason, operator_id)
   VALUES (?, ?, ?, 'OFFLINE', ?, 0, 0, '销售出库', ?)`,
  [makeBizNo("IL"), bill.storeId, item.skuId, -Number(item.quantity), req.user?.id ?? 0]
);
```

If schema requires non-zero `before_qty` and `after_qty`, query the inventory row before update and use actual values.

- [ ] **Step 5: 防止重复扣减**

Before deducting inventory, check whether a success payment for this sale bill already exists:

```ts
const existingSuccess = await queryOne<any>(
  "SELECT pay_no AS payNo FROM payment_order WHERE source_type = 'SALE_BILL' AND source_no = ? AND status = 'SUCCESS' LIMIT 1",
  [req.params.billNo]
);
```

If `existingSuccess` exists and sale bill is already `PAID`, return existing status without deducting again.

- [ ] **Step 6: 运行验收**

Run:

```bash
API_BASE=http://localhost:8080/api npm run test:acceptance:store
```

Expected:

```text
ACCEPTANCE_STORE_MVP_PASS
```

- [ ] **Step 7: 提交**

```bash
git add backend/src/routes/store.routes.ts scripts/acceptance-store-mvp.mjs
git commit -m "feat: 线下收款后扣减库存并写流水"
```

---

### Task 7: 生产验收和 CI 收口

**Files:**
- Modify: `scripts/acceptance-production.mjs`
- Modify: `scripts/check-production-deploy.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`

- [ ] **Step 1: 扩展生产验收脚本登录后台和门店**

Modify `scripts/acceptance-production.mjs`:

```js
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await res.json();
  if (!res.ok || body.code === "500") throw new Error(`${path} failed: ${JSON.stringify(body)}`);
  return body.data;
}

const adminLogin = await api("/admin/auth/login", {
  method: "POST",
  body: JSON.stringify({ username: "admin", password: "admin123" })
});

const adminAuth = { Authorization: `Bearer ${adminLogin.token}` };
const adminProducts = await api("/admin/products", { headers: adminAuth });
if (!Array.isArray(adminProducts.records)) throw new Error("生产后台商品列表异常");

const storeLogin = await api("/admin/auth/login", {
  method: "POST",
  body: JSON.stringify({ username: "store_operator", password: "admin123" })
});

const storeAuth = { Authorization: `Bearer ${storeLogin.token}` };
const storeInventory = await api("/store/inventory", { headers: storeAuth });
if (!Array.isArray(storeInventory.records)) throw new Error("生产门店库存列表异常");
```

- [ ] **Step 2: CI 增加非破坏性检查**

Modify `.github/workflows/ci.yml` to run:

```yaml
- name: Production deploy contract
  run: npm run test:production-deploy

- name: Miniapp release static check
  run: npm run test:miniapp-release
```

Do not run destructive acceptance scripts in CI unless the CI starts an isolated mock backend.

- [ ] **Step 3: 本地运行构建和检查**

Run:

```bash
npm run test:production-deploy
npm run test:miniapp-release
npm run build
```

Expected:

```text
PRODUCTION_DEPLOY_CONTRACT_PASS
MINIAPP_RELEASE_CHECK_PASS
```

- [ ] **Step 4: 提交**

```bash
git add scripts/acceptance-production.mjs scripts/check-production-deploy.mjs .github/workflows/ci.yml package.json
git commit -m "test: 收口正式可用版生产验收"
```

---

### Task 8: 服务器部署和线上验收

**Files:**
- Modify only if deployment script fails: `deploy/03-deploy.sh`
- Modify only if archive bootstrap fails: `deploy/07-local-archive-deploy.sh`

- [ ] **Step 1: 本地生成部署包**

Run:

```bash
cd /workspace/liquor-inventory-system
npm install
VITE_API_BASE=https://api.onepan.cn/api npm --workspace admin-web run build
VITE_API_BASE=https://api.onepan.cn/api npm --workspace store-terminal run build
npm run test:production-deploy
npm run test:miniapp-release
cd /workspace
rm -f /workspace/liquor-inventory-system-deploy.zip
zip -qr /workspace/liquor-inventory-system-deploy.zip liquor-inventory-system \
  -x 'liquor-inventory-system/.git/*' \
     'liquor-inventory-system/node_modules/*' \
     'liquor-inventory-system/*/node_modules/*' \
     'liquor-inventory-system/admin-web/dist/*' \
     'liquor-inventory-system/store-terminal/dist/*' \
     'liquor-inventory-system/backend/dist/*' \
     'liquor-inventory-system/.beta-build/*' \
     'liquor-inventory-system/*.zip' \
     'liquor-inventory-system/*.tsbuildinfo' \
     'liquor-inventory-system/*/*.tsbuildinfo'
```

Expected:

```text
PRODUCTION_DEPLOY_CONTRACT_PASS
MINIAPP_RELEASE_CHECK_PASS
```

- [ ] **Step 2: 服务器部署**

On server:

```bash
cd /home/ubuntu
sudo rm -rf /opt/zhixiang/liquor-inventory-system
sudo mkdir -p /opt/zhixiang
sudo unzip -o liquor-inventory-system-deploy.zip -d /opt/zhixiang
sudo chown -R ubuntu:ubuntu /opt/zhixiang
cd /opt/zhixiang/liquor-inventory-system
bash deploy/07-local-archive-deploy.sh
```

- [ ] **Step 3: 线上验收**

Run:

```bash
API_BASE=https://api.onepan.cn/api npm run test:acceptance:production
API_BASE=https://api.onepan.cn/api npm run test:acceptance:admin
API_BASE=https://api.onepan.cn/api npm run test:acceptance:store
```

Expected:

```text
ACCEPTANCE_PRODUCTION_PASS
ACCEPTANCE_ADMIN_MVP_PASS
ACCEPTANCE_STORE_MVP_PASS
```

- [ ] **Step 4: 浏览器验收**

Open:

```text
https://admin.onepan.cn/reset.html
https://store.onepan.cn/reset.html
```

Then log in:

```text
后台：admin / admin123
门店：store_operator / admin123
```

Expected:

- 后台商品列表可见。
- 后台新增商品后可上架。
- 门店端可搜索商品。
- 门店端可创建销售单并线下收款。
- 门店端库存随收款扣减。

- [ ] **Step 5: 提交部署修正**

If deployment scripts were changed:

```bash
git add deploy/03-deploy.sh deploy/07-local-archive-deploy.sh
git commit -m "fix: 修正正式可用版部署脚本"
```

If no deployment scripts changed, do not create an empty commit.

---

## 自检清单

- Spec coverage:
  - 后台商品、门店、客户、订单、库存：Task 3。
  - 门店商品搜索、客户选择、开单、线下收款、挂单：Task 4。
  - 收款后库存扣减和流水：Task 6。
  - 小程序正式配置、订单隔离：Task 5。
  - 数据和基础权限：Task 1。
  - 验收脚本和生产检查：Task 2、Task 7、Task 8。
- Scope control:
  - 没有接真实微信支付。
  - 没有做完整退款审核。
  - 没有做复杂 RBAC。
  - 没有做高级报表。
- Parallel safety:
  - Task 1 先行。
  - Task 3、4、5 可以并行。
  - Task 6 依赖 Task 4。
  - Task 7、8 收口。
