# 正式壳第二阶段打磨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把第一阶段已上线的"正式可用壳"在不动后端的前提下，从"功能能跑"升级到"操作有手感、文案专业、误操作有兜底、金额好读、数据好找"。

**Architecture:** 沿用单文件 SFC + `activeNav` 分区，新增 `utils/format.ts`，复用 axios interceptor、Element Plus 的 `el-form rules` 和 `ElMessageBox.confirm`，无新依赖。

**Tech Stack:** Vue 3 `<script setup>`、Element Plus、Axios、Vite。

---

## 文件结构

- Add: `admin-web/src/utils/format.ts`
- Add: `store-terminal/src/utils/format.ts`
- Modify: `admin-web/src/api.ts`（401 拦截器）
- Modify: `store-terminal/src/api.ts`（401 拦截器）
- Modify: `admin-web/src/App.vue`（去演示 + 校验 + 二次确认 + formatYuan + 搜索分页）
- Modify: `store-terminal/src/App.vue`（同上）
- Modify: `scripts/ui-contract-test.mjs`（每 task 加静态契约断言）

---

### Task 1: 401 自动登出（admin + store）

**Files:**
- Modify: `admin-web/src/api.ts`、`store-terminal/src/api.ts`
- Modify: `admin-web/src/App.vue`、`store-terminal/src/App.vue`
- Test: `scripts/ui-contract-test.mjs`

- [ ] **Step 1: 写静态契约失败用例**

在 `scripts/ui-contract-test.mjs` 末尾 `console.log("UI_CONTRACT_PASS");` 之前追加：

```js
assertIncludes("admin-web/src/api.ts", "interceptors.response");
assertIncludes("admin-web/src/api.ts", "auth:logout");
assertIncludes("store-terminal/src/api.ts", "interceptors.response");
assertIncludes("store-terminal/src/api.ts", "auth:logout");
assertIncludes("admin-web/src/App.vue", "auth:logout");
assertIncludes("store-terminal/src/App.vue", "auth:logout");
```
并把 `files` 列表加上两个 `api.ts`。

- [ ] **Step 2: 运行确认 FAIL**：`npm run test:ui`

- [ ] **Step 3: 实现 admin 401 拦截**

`admin-web/src/api.ts` 在 `api.interceptors.request.use` 后添加：

```ts
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("admin_token");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:logout"));
      }
    }
    return Promise.reject(error);
  }
);
```

- [ ] **Step 4: 实现 store 401 拦截**

`store-terminal/src/api.ts` 同样添加，移除 `store_token` 和 `admin_token` 两个 key。

- [ ] **Step 5: admin App.vue 监听 auth:logout**

在 `onMounted` 之后添加：

```ts
window.addEventListener("auth:logout", () => {
  token.value = "";
  activeNav.value = "首页";
  ElMessage.warning("登录已过期，请重新登录");
});
```

- [ ] **Step 6: store App.vue 同步监听**，重置 `activeNav` 到 `"工作台"`。

- [ ] **Step 7: 运行 `npm run test:ui` 确认 PASS**

---

### Task 2: 去除演示文案、专业化默认值

**Files:** `admin-web/src/App.vue`、`store-terminal/src/App.vue`、`scripts/ui-contract-test.mjs`

- [ ] **Step 1: 静态契约——禁止出现演示字眼**

在 `ui-contract-test.mjs` 中加：

```js
function assertNotIncludes(file, text) {
  if (contents[file].includes(text)) {
    throw new Error(`${file} 仍包含 ${text}`);
  }
}
for (const phrase of ["新增演示商品", "演示新品白酒", "演示新门店", "演示新客户", "演示客户", "示例地址"]) {
  assertNotIncludes("admin-web/src/App.vue", phrase);
}
for (const phrase of ["演示客户", "13900000000"]) {
  assertNotIncludes("store-terminal/src/App.vue", phrase);
}
```

- [ ] **Step 2: 运行确认 FAIL**：`npm run test:ui`

- [ ] **Step 3: admin-web 修改**

  - `productDialogVisible` 弹窗 title `"新增演示商品"` → `"新增商品"`，按钮文案 `"新增演示商品"` → `"新增商品"`。
  - `productForm` 默认值改为：`{ name: "", mainImage: "", skuName: "", barcode: "", boxRatio: 6, retailPrice: 0, wholesalePrice: 0 }`。
  - `storeForm` 默认值改为：`{ code: "", name: "", address: "", phone: "" }`。
  - `memberForm` 默认值改为：`{ name: "", mobile: "", customerType: "RETAIL" }`。

- [ ] **Step 4: store-terminal 修改**

  - `saleForm.customerName` 默认 `""`、`saleForm.customerMobile` 默认 `""`。
  - 客户搜索 placeholder 保留"输入客户名或手机号"。

- [ ] **Step 5: 运行 `npm run test:ui` 确认 PASS**

---

### Task 3: 关键表单校验

**Files:** `admin-web/src/App.vue`、`store-terminal/src/App.vue`、`scripts/ui-contract-test.mjs`

- [ ] **Step 1: 静态契约**

```js
assertIncludes("admin-web/src/App.vue", "productFormRef");
assertIncludes("admin-web/src/App.vue", "productRules");
assertIncludes("admin-web/src/App.vue", "storeFormRef");
assertIncludes("admin-web/src/App.vue", "memberFormRef");
assertIncludes("admin-web/src/App.vue", "/^1[3-9]\\d{9}$/");
assertIncludes("store-terminal/src/App.vue", "invFormRef");
```

- [ ] **Step 2: FAIL** → `npm run test:ui`

- [ ] **Step 3: admin productForm 加校验**

```ts
const productFormRef = ref();
const productRules = {
  name: [{ required: true, message: "请填写商品名称", trigger: "blur" }],
  skuName: [{ required: true, message: "请填写 SKU 名称", trigger: "blur" }],
  retailPrice: [{ validator: (_: any, v: number, cb: any) => v > 0 ? cb() : cb(new Error("零售价需大于 0")), trigger: "blur" }],
  wholesalePrice: [{ validator: (_: any, v: number, cb: any) => v > 0 ? cb() : cb(new Error("批发价需大于 0")), trigger: "blur" }]
};
```

`<el-form ref="productFormRef" :model="productForm" :rules="productRules" label-width="110px">` 各 `el-form-item` 加 `prop`。`handleCreateProduct` 开头加 `await productFormRef.value?.validate()`。

- [ ] **Step 4: admin storeForm 加校验**：`code`/`name` required，`phone` 加正则 `/^1[3-9]\d{9}$/`。

- [ ] **Step 5: admin memberForm 加校验**：`name` required，`mobile` 必填 + 手机号正则。

- [ ] **Step 6: store invForm 加校验**：`change` 自定义 validator 不为 0。

- [ ] **Step 7: 运行 `npm run test:ui` 确认 PASS**

---

### Task 4: 高风险操作二次确认

**Files:** `admin-web/src/App.vue`、`store-terminal/src/App.vue`、`scripts/ui-contract-test.mjs`

- [ ] **Step 1: 静态契约**

```js
assertIncludes("admin-web/src/App.vue", "ElMessageBox");
assertIncludes("admin-web/src/App.vue", "确认退出");
assertIncludes("admin-web/src/App.vue", "确认调整");
assertIncludes("store-terminal/src/App.vue", "ElMessageBox");
assertIncludes("store-terminal/src/App.vue", "确认退出");
```

- [ ] **Step 2: FAIL** → `npm run test:ui`

- [ ] **Step 3: admin 二次确认**

import 加 `import { ElMessage, ElMessageBox } from "element-plus";`。`handleLogout` 改为先 `await ElMessageBox.confirm("确认退出当前登录?", "提示", { type: "warning" }).catch(() => null)`，取消则 return。`handleProductStatus` 在执行前 `await ElMessageBox.confirm(...)`。`handleUpdatePrice` 同理 `确认调整 ${priceForm.skuName} 价格为 ¥${priceForm.price}?`。

- [ ] **Step 4: store 二次确认**

`handleLogout` + `handleInvAdjust`（`确认对 ${invForm.skuName} 的 ${invForm.stockType} 库存调整 ${invForm.change}?`）加确认。

- [ ] **Step 5: 运行 `npm run test:ui` 确认 PASS**

---

### Task 5: 金额格式化（formatYuan）

**Files:** 新建 `admin-web/src/utils/format.ts`、`store-terminal/src/utils/format.ts`，修改两个 App.vue，`ui-contract-test.mjs`

- [ ] **Step 1: 静态契约**

```js
files.push("admin-web/src/utils/format.ts", "store-terminal/src/utils/format.ts");
assertIncludes("admin-web/src/utils/format.ts", "formatYuan");
assertIncludes("store-terminal/src/utils/format.ts", "formatYuan");
assertIncludes("admin-web/src/App.vue", "formatYuan");
assertIncludes("store-terminal/src/App.vue", "formatYuan");
```

- [ ] **Step 2: FAIL** → `npm run test:ui`

- [ ] **Step 3: 新建工具文件**

```ts
export function formatYuan(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "¥0.00";
  return "¥" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
```

- [ ] **Step 4: admin 接入 formatYuan**：商品列表的 `retailPrice` / `wholesalePrice`，订单的 `payableAmount`，销售单的 `receivableAmount` / `receivedAmount` / `unreceivedAmount`，收款的 `amount` / `paidAmount`，订单详情的 `payableAmount`、`unitPrice`、`subtotalAmount`，报表门店业绩的 `totalSales`，cards `今日销售额` / `待收款`。

- [ ] **Step 5: store 接入 formatYuan**：cashier 购物车小计、合计、`currentAmount`、销售单列表 `receivableAmount` / `unreceivedAmount`、库存（无金额跳过）、订单详情。

- [ ] **Step 6: 运行 `npm run test:ui` 确认 PASS**

---

### Task 6: 商品 / 客户列表关键字搜索（admin）

为控制单次部署风险，第二阶段先落地最高频的 admin "商品" 和 "客户" 两个列表搜索。其他列表（销售单/门店/store销售单/库存查询）放到第三阶段。

**Files:** `admin-web/src/App.vue`、`admin-web/src/api.ts`、`scripts/ui-contract-test.mjs`

- [ ] **Step 1: 静态契约**

```js
assertIncludes("admin-web/src/App.vue", "productsKeyword");
assertIncludes("admin-web/src/App.vue", "membersKeyword");
```

- [ ] **Step 2: FAIL** → `npm run test:ui`

- [ ] **Step 3: api.ts 扩展 fetchProducts/fetchMembers**

```ts
export async function fetchProducts(params?: { keyword?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/products", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchMembers(params?: { keyword?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/members", { params: { page: 1, pageSize: 30, ...params } });
  return data.data;
}
```

- [ ] **Step 4: App.vue 加状态和 UI**

```ts
const productsKeyword = ref("");
const membersKeyword = ref("");
async function loadProducts() {
  const data = await fetchProducts({ keyword: productsKeyword.value || undefined });
  products.value = data.records || [];
}
async function loadMembers() {
  const data = await fetchMembers({ keyword: membersKeyword.value || undefined });
  members.value = data.records || [];
}
function searchProducts() { loadProducts(); }
function searchMembers() { loadMembers(); }
```

商品/客户卡 header 增加 `<el-input v-model="productsKeyword" size="small" style="width:180px" placeholder="商品名/SKU" clearable @clear="searchProducts" @keyup.enter="searchProducts" />` + `<el-button size="small" @click="searchProducts">搜索</el-button>`。客户同理。

- [ ] **Step 5: 运行 `npm run test:ui` 确认 PASS**

---

### Task 7: 本地全量测试 + 部署 + 生产验收

- [ ] **Step 1: 本地全量**

```bash
npm run test:ui
npm run test:backend
npm run test:acceptance:admin
npm run test:acceptance:store
```

四套测试都要 PASS。

- [ ] **Step 2: git commit**

```bash
git add -A
git commit -m "feat: 第二阶段打磨——401自动登出/去演示/校验/确认/金额/搜索"
```

- [ ] **Step 3: 打包 + 服务器部署 + 生产验收**

```bash
tar -czf /workspace/zhixiang-polish-phase2.tar.gz \
  -C /workspace liquor-inventory-system
# 服务器：解压 → SKIP_GIT_PULL=true bash deploy/03-deploy.sh
# 服务器：npm run test:production-deploy && npm run test:acceptance:production
```

- [ ] **Step 4: 浏览器人工验收**

两个域名各登录一次，跑一遍：401 自动登出 / 表单校验拦空 / 改价确认 / 金额格式 / 商品搜索。
