# 正式可用前端壳 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `admin-web` 和 `store-terminal` 从“所有模块堆在一页的演示页”升级为登录清晰、菜单可切换、按钮有反馈、关键功能可验收的正式可用壳。

**Architecture:** 保留现有 Vue 单文件入口和 API 调用函数，不重写后端，不引入新状态管理。通过 `activeNav`、登录态、统一错误提示、模块级 `v-if` 分区，把现有功能组织成可点击的后台和门店端菜单。

**Tech Stack:** Vue 3 `<script setup>`、Element Plus、Axios、Vite、Node.js 验收脚本。

---

## 文件结构

- Modify: `admin-web/src/App.vue`
  - 增加登录页状态、真实菜单切换、退出登录、统一错误处理。
  - 把现有后台区块按菜单分区显示。
- Modify: `store-terminal/src/App.vue`
  - 增加门店登录页状态、真实菜单切换、退出登录、统一错误处理。
  - 把现有门店区块按菜单分区显示。
- Modify: `scripts/ui-contract-test.mjs`
  - 增加对真实菜单、登录页、退出登录、关键功能文案的静态契约检查。
- Modify: `scripts/acceptance-admin-mvp.mjs`
  - 扩展 API 验收，确保后台关键模块所需接口仍可用。
- Modify: `scripts/acceptance-store-mvp.mjs`
  - 保留当前门店闭环验收，补足关键入口依赖接口检查。

---

### Task 1: 后台正式壳状态和登录页

**Files:**
- Modify: `admin-web/src/App.vue`
- Test: `scripts/ui-contract-test.mjs`

- [ ] **Step 1: 写静态契约失败用例**

在 `scripts/ui-contract-test.mjs` 末尾 `console.log("UI_CONTRACT_PASS");` 之前加入：

```js
assertIncludes("admin-web/src/App.vue", "activeNav");
assertIncludes("admin-web/src/App.vue", "admin-login-page");
assertIncludes("admin-web/src/App.vue", "handleLogout");
assertIncludes("admin-web/src/App.vue", "系统管理员");
assertIncludes("admin-web/src/App.vue", "退出登录");
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:ui`

Expected: FAIL，提示 `admin-web/src/App.vue 缺少 activeNav` 或后续新增标识。

- [ ] **Step 3: 修改后台模板顶部结构**

将 `admin-web/src/App.vue` 模板开头改成以下结构。保留原有业务卡片区块，后续任务再按菜单包裹：

```vue
<template>
  <div v-if="!token" class="admin-login-page">
    <el-card class="login-card">
      <template #header>
        <div>
          <h1>智享营销系统管理后台</h1>
          <p class="muted">请先登录，登录后进入正式后台工作台。</p>
        </div>
      </template>
      <el-form label-width="72px" @submit.prevent>
        <el-form-item label="账号">
          <el-input v-model="loginForm.username" placeholder="admin" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" placeholder="admin123" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleLogin">登录进入后台</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
  <div v-else class="layout">
    <aside class="side">
      <h1>智享营销系统管理后台</h1>
      <button
        v-for="item in nav"
        :key="item"
        class="nav-item"
        :class="{ active: item === activeNav }"
        type="button"
        @click="activeNav = item"
      >
        {{ item }}
      </button>
    </aside>
    <main class="main">
      <section class="dashboard-hero">
        <div>
          <h2>{{ activeNav }}</h2>
          <p class="muted">{{ adminNavDescriptions[activeNav] }}</p>
        </div>
        <div class="user-bar">
          <span>系统管理员</span>
          <el-button size="small" @click="handleLogout">退出登录</el-button>
        </div>
      </section>
```

保留原来 `</main></div>` 结束结构，确保模板闭合。

- [ ] **Step 4: 增加后台状态和退出函数**

在 `const nav = [...]` 后加入：

```ts
const activeNav = ref("首页");
const adminNavDescriptions: Record<string, string> = {
  首页: "查看销售、订单、库存和门店业绩总览。",
  商品: "维护商品、上下架和价格。",
  订单: "处理小程序订单、搜索和导出。",
  销售单: "查看销售单和收款状态。",
  库存: "查看库存总览、库存流水和预警。",
  客户: "维护客户和销售归属。",
  门店: "维护门店基础信息。",
  收款: "查看分享收款、支付和退款记录。",
  报表: "查看销售趋势、订单分布和门店业绩。"
};
```

在 `handleLogin` 后加入：

```ts
function handleLogout() {
  localStorage.removeItem("admin_token");
  token.value = "";
  activeNav.value = "首页";
  ElMessage.success("已退出登录");
}
```

- [ ] **Step 5: 运行静态测试**

Run: `npm run test:ui`

Expected: PASS 或只剩后续任务新增标识未通过。

- [ ] **Step 6: 提交**

```bash
git add admin-web/src/App.vue scripts/ui-contract-test.mjs
git commit -m "feat: 增加后台登录壳和菜单状态"
```

---

### Task 2: 后台模块分区和操作反馈

**Files:**
- Modify: `admin-web/src/App.vue`
- Test: `scripts/ui-contract-test.mjs`

- [ ] **Step 1: 写菜单分区契约**

在 `scripts/ui-contract-test.mjs` 后台断言附近加入：

```js
for (const text of ["activeNav === \"商品\"", "activeNav === \"订单\"", "activeNav === \"销售单\"", "activeNav === \"库存\"", "activeNav === \"客户\"", "activeNav === \"门店\"", "activeNav === \"收款\"", "activeNav === \"报表\""]) {
  assertIncludes("admin-web/src/App.vue", text);
}
assertIncludes("admin-web/src/App.vue", "runAdminAction");
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:ui`

Expected: FAIL，提示缺少菜单分区字符串。

- [ ] **Step 3: 增加统一后台动作包装**

在 `admin-web/src/App.vue` 的函数区加入：

```ts
function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function runAdminAction(action: () => Promise<void>, fallback: string) {
  loading.value = true;
  try {
    await action();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, fallback));
  } finally {
    loading.value = false;
  }
}
```

- [ ] **Step 4: 改造后台登录错误反馈**

将 `handleLogin` 改成：

```ts
async function handleLogin() {
  await runAdminAction(async () => {
    const result = await adminLogin(loginForm.username, loginForm.password);
    localStorage.setItem("admin_token", result.token);
    token.value = result.token;
    ElMessage.success("登录成功，正在加载后台数据");
    await Promise.all([loadDashboard(), loadProducts(), loadStores(), loadMembers(), loadOrders(), loadSaleBills(), loadInventoryLogs(), loadInventoryBalances(), loadCollectionLinks(), loadPaymentOrders(), loadRefundOrders(), loadDailySales(), loadOrderStats(), loadStorePerformance(), loadInventoryAlerts()]);
  }, "登录失败，请检查账号密码或稍后再试");
}
```

- [ ] **Step 5: 包裹后台模块区块**

按现有卡片内容增加 `v-if`：

```vue
<section v-if="activeNav === '首页'" class="cards">
  <!-- 原有指标卡片 -->
</section>

<template v-if="activeNav === '商品'">
  <!-- 商品列表卡片 -->
</template>

<template v-if="activeNav === '门店'">
  <!-- 门店管理卡片 -->
</template>

<template v-if="activeNav === '客户'">
  <!-- 客户管理卡片 -->
</template>

<template v-if="activeNav === '订单'">
  <!-- 小程序订单卡片 -->
</template>

<template v-if="activeNav === '销售单'">
  <!-- 销售单卡片 -->
</template>

<template v-if="activeNav === '库存'">
  <!-- 库存预警、库存流水、库存总览 -->
</template>

<template v-if="activeNav === '收款'">
  <!-- 分享收款、支付记录、退款记录 -->
</template>

<template v-if="activeNav === '报表'">
  <!-- 销售趋势、订单状态分布、门店业绩 -->
</template>
```

- [ ] **Step 6: 运行构建**

Run: `npm --workspace admin-web run build`

Expected: PASS，生成 `admin-web/dist`。

- [ ] **Step 7: 提交**

```bash
git add admin-web/src/App.vue scripts/ui-contract-test.mjs
git commit -m "feat: 拆分后台可切换功能模块"
```

---

### Task 3: 门店端正式壳状态和登录页

**Files:**
- Modify: `store-terminal/src/App.vue`
- Test: `scripts/ui-contract-test.mjs`

- [ ] **Step 1: 写门店静态契约**

在 `scripts/ui-contract-test.mjs` 中加入：

```js
assertIncludes("store-terminal/src/App.vue", "activeNav");
assertIncludes("store-terminal/src/App.vue", "store-login-page");
assertIncludes("store-terminal/src/App.vue", "handleLogout");
assertIncludes("store-terminal/src/App.vue", "门店操作员");
assertIncludes("store-terminal/src/App.vue", "退出登录");
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:ui`

Expected: FAIL，提示 `store-terminal/src/App.vue` 缺少新增标识。

- [ ] **Step 3: 修改门店模板顶部结构**

将 `store-terminal/src/App.vue` 模板开头改成：

```vue
<template>
  <div v-if="!token" class="store-login-page">
    <el-card class="login-card">
      <template #header>
        <div>
          <h1>门店操作端</h1>
          <p class="muted">请先登录，登录后进入门店收银和履约工作台。</p>
        </div>
      </template>
      <el-form label-width="72px" @submit.prevent>
        <el-form-item label="账号">
          <el-input v-model="loginForm.username" placeholder="store_operator" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" placeholder="admin123" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleLogin">登录进入门店端</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
  <div v-else class="layout">
    <aside class="side">
      <h1>门店操作端</h1>
      <button
        v-for="item in nav"
        :key="item"
        class="nav-item"
        :class="{ active: item === activeNav }"
        type="button"
        @click="activeNav = item"
      >
        {{ item }}
      </button>
    </aside>
    <main class="main">
      <section class="store-hero">
        <div>
          <h2>{{ activeNav }}</h2>
          <p class="muted">{{ storeNavDescriptions[activeNav] }}</p>
        </div>
        <div class="user-bar">
          <span>门店操作员</span>
          <el-button size="small" @click="handleLogout">退出登录</el-button>
        </div>
      </section>
```

- [ ] **Step 4: 增加门店状态和退出函数**

在 `const nav = [...]` 后加入：

```ts
const activeNav = ref("工作台");
const storeNavDescriptions: Record<string, string> = {
  工作台: "查看门店销售、订单和库存概览。",
  快速收银: "搜索商品和客户，创建销售单并线下收款。",
  销售单: "查看销售单、详情和分享收款。",
  接单履约: "处理小程序订单接单和完成。",
  库存查询: "查看库存、调整库存和库存流水。",
  分享收款: "查看分享收款、支付和退款记录。"
};
```

在 `handleLogin` 后加入：

```ts
function handleLogout() {
  localStorage.removeItem("store_token");
  token.value = "";
  activeNav.value = "工作台";
  ElMessage.success("已退出登录");
}
```

- [ ] **Step 5: 运行静态测试**

Run: `npm run test:ui`

Expected: PASS 或只剩后续任务新增标识未通过。

- [ ] **Step 6: 提交**

```bash
git add store-terminal/src/App.vue scripts/ui-contract-test.mjs
git commit -m "feat: 增加门店登录壳和菜单状态"
```

---

### Task 4: 门店模块分区和操作反馈

**Files:**
- Modify: `store-terminal/src/App.vue`
- Test: `scripts/ui-contract-test.mjs`

- [ ] **Step 1: 写门店分区契约**

在 `scripts/ui-contract-test.mjs` 门店断言附近加入：

```js
for (const text of ["activeNav === \"快速收银\"", "activeNav === \"销售单\"", "activeNav === \"接单履约\"", "activeNav === \"库存查询\"", "activeNav === \"分享收款\""]) {
  assertIncludes("store-terminal/src/App.vue", text);
}
assertIncludes("store-terminal/src/App.vue", "runStoreAction");
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:ui`

Expected: FAIL，提示缺少门店分区字符串。

- [ ] **Step 3: 增加门店统一动作包装**

在 `store-terminal/src/App.vue` 函数区加入：

```ts
function getErrorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

async function runStoreAction(action: () => Promise<void>, fallback: string) {
  loading.value = true;
  try {
    await action();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, fallback));
  } finally {
    loading.value = false;
  }
}
```

- [ ] **Step 4: 改造门店登录错误反馈**

将 `handleLogin` 改成：

```ts
async function handleLogin() {
  await runStoreAction(async () => {
    const result = await storeLogin(loginForm.username, loginForm.password);
    localStorage.setItem("store_token", result.token);
    token.value = result.token;
    ElMessage.success("登录成功，正在加载门店数据");
    await Promise.all([loadInventory(), loadSaleBills(), loadOrders(), loadDashboard(), loadDailySales(), loadInventoryAlerts(), loadRefundOrders()]);
  }, "登录失败，请检查门店账号或稍后再试");
}
```

- [ ] **Step 5: 包裹门店模块区块**

按现有卡片内容增加 `v-if`：

```vue
<template v-if="activeNav === '工作台'">
  <!-- 指标卡片、库存预警、近七日销售趋势 -->
</template>

<template v-if="activeNav === '快速收银'">
  <!-- 快速收银、商品搜索、客户搜索、购物车、挂单 -->
</template>

<template v-if="activeNav === '销售单'">
  <!-- 销售单列表、详情、分享收款 -->
</template>

<template v-if="activeNav === '接单履约'">
  <!-- 小程序订单履约 -->
</template>

<template v-if="activeNav === '库存查询'">
  <!-- 库存查询、库存调整、库存流水 -->
</template>

<template v-if="activeNav === '分享收款'">
  <!-- 分享收款、支付记录、退款记录 -->
</template>
```

- [ ] **Step 6: 运行构建**

Run: `npm --workspace store-terminal run build`

Expected: PASS，生成 `store-terminal/dist`。

- [ ] **Step 7: 提交**

```bash
git add store-terminal/src/App.vue scripts/ui-contract-test.mjs
git commit -m "feat: 拆分门店可切换功能模块"
```

---

### Task 5: 验收脚本和全量本地验证

**Files:**
- Modify: `scripts/acceptance-admin-mvp.mjs`
- Modify: `scripts/acceptance-store-mvp.mjs`
- Modify: `scripts/ui-contract-test.mjs`

- [ ] **Step 1: 扩展后台 API 验收**

在 `scripts/acceptance-admin-mvp.mjs` 的 `members` 检查后加入：

```js
const saleBills = await request("/admin/sale-bills", { headers: auth });
if (!Array.isArray(saleBills.records)) throw new Error("销售单列表没有 records");

const balances = await request("/admin/inventory/balances", { headers: auth });
if (!Array.isArray(balances.records) && !Array.isArray(balances)) throw new Error("库存总览没有 records");

const dashboard = await request("/admin/reports/dashboard", { headers: auth });
if (!dashboard) throw new Error("后台工作台无数据");
```

- [ ] **Step 2: 扩展门店 API 验收**

在 `scripts/acceptance-store-mvp.mjs` 的 `inventoryRecords` 检查后加入：

```js
const saleBills = await request("/store/sale-bills", { headers: auth });
if (!Array.isArray(saleBills.records)) throw new Error("门店销售单列表没有 records");

const orders = await request("/store/orders", { headers: auth });
if (!Array.isArray(orders.records)) throw new Error("门店订单列表没有 records");
```

- [ ] **Step 3: 运行 UI 契约测试**

Run: `npm run test:ui`

Expected: `UI_CONTRACT_PASS`

- [ ] **Step 4: 运行前端构建**

Run: `npm --workspace admin-web run build && npm --workspace store-terminal run build`

Expected: 两个 workspace 均构建成功。

- [ ] **Step 5: 运行后端和验收测试**

Run: `npm run test:backend && npm run test:acceptance:admin && npm run test:acceptance:store`

Expected:

```text
ACCEPTANCE_ADMIN_MVP_PASS
ACCEPTANCE_STORE_MVP_PASS
```

- [ ] **Step 6: 提交**

```bash
git add scripts/acceptance-admin-mvp.mjs scripts/acceptance-store-mvp.mjs scripts/ui-contract-test.mjs
git commit -m "test: 覆盖正式可用壳验收"
```

---

### Task 6: 线上同步和生产验收

**Files:**
- Modify on server: `/opt/zhixiang/liquor-inventory-system/admin-web/src/App.vue`
- Modify on server: `/opt/zhixiang/liquor-inventory-system/store-terminal/src/App.vue`
- Modify on server: `/opt/zhixiang/liquor-inventory-system/scripts/*`

- [ ] **Step 1: 确认本地工作树干净**

Run: `git status --short`

Expected: no output.

- [ ] **Step 2: 打包本地代码**

Run: `git archive --format=tar.gz -o /workspace/zhixiang-function-shell.tar.gz HEAD`

Expected: 生成 `/workspace/zhixiang-function-shell.tar.gz`。

- [ ] **Step 3: 通过 OrcaTerm 进入服务器**

进入 `root@VM-0-5-ubuntu`，定位：

```bash
cd /opt/zhixiang/liquor-inventory-system
```

- [ ] **Step 4: 同步文件并部署**

在服务器执行：

```bash
npm --workspace admin-web run build
npm --workspace store-terminal run build
SKIP_GIT_PULL=true bash deploy/03-deploy.sh
```

Expected: 部署脚本成功，QA 回归通过。

- [ ] **Step 5: 线上验证**

Run:

```bash
curl -fsS https://api.onepan.cn/health
npm run test:production-deploy
API_BASE=https://api.onepan.cn/api npm run test:acceptance:admin
API_BASE=https://api.onepan.cn/api npm run test:acceptance:store
```

Expected:

```text
PRODUCTION_DEPLOY_CONTRACT_PASS
ACCEPTANCE_ADMIN_MVP_PASS
ACCEPTANCE_STORE_MVP_PASS
```

- [ ] **Step 6: 浏览器人工验收**

打开：

- `https://admin.onepan.cn`
- `https://store.onepan.cn`

验证：

- 后台 `admin / admin123` 登录成功。
- 门店 `store_operator / admin123` 登录成功。
- 两端左侧菜单可切换。
- 关键按钮点击有反馈，不再“像没反应”。

- [ ] **Step 7: 最终提交或标记**

如果服务器补丁与本地一致：

```bash
git status --short
git log --oneline -5
```

记录最终提交号和线上验收结果。

---

## 自查结果

- Spec coverage: 计划覆盖登录页、菜单切换、后台模块、门店模块、错误反馈、验收脚本和线上部署。
- Placeholder scan: 未使用未完成占位语。
- Type consistency: `activeNav`、`runAdminAction`、`runStoreAction`、`handleLogout` 在静态契约和实现步骤中命名一致。
