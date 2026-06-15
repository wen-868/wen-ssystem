import { readFileSync } from "node:fs";

const files = [
  "admin-web/src/styles.css",
  "admin-web/src/styles/tokens.css",
  "store-terminal/src/styles.css",
  "store-terminal/src/styles/tokens.css",
  "miniapp/app.wxss",
  "miniapp/styles/tokens.wxss",
  "admin-web/src/App.vue",
  "store-terminal/src/App.vue",
  "admin-web/src/api.ts",
  "store-terminal/src/api.ts",
  "admin-web/src/utils/format.ts",
  "store-terminal/src/utils/format.ts",
  "miniapp/pages/share-collection/index.wxml",
  "miniapp/pages/share-collection/index.wxss",
  "docs/ui-style-guide.md",
  "package.json",
  "merchant-mobile/package.json",
  "merchant-mobile/src/App.vue",
  "merchant-mobile/src/api.ts",
  "merchant-mobile/src/styles/tokens.css"
];

const contents = Object.fromEntries(files.map((file) => [file, readFileSync(file, "utf8")]));

function assertIncludes(file, text) {
  if (!contents[file].includes(text)) {
    throw new Error(`${file} 缺少 ${text}`);
  }
}

function assertNotIncludes(file, text) {
  if (contents[file].includes(text)) {
    throw new Error(`${file} 仍包含 ${text}`);
  }
}

for (const file of ["admin-web/src/styles.css", "store-terminal/src/styles.css"]) {
  assertIncludes(file, "@import");
  assertIncludes(file, "--color-primary");
  assertIncludes(file, "--bg-page");
  assertIncludes(file, "--text-primary");
}

for (const file of ["miniapp/app.wxss"]) {
  assertIncludes(file, "#1677FF");
  assertIncludes(file, "#FFFFFF");
  assertIncludes(file, "#E5E7EB");
}

for (const file of ["admin-web/src/styles/tokens.css", "store-terminal/src/styles/tokens.css", "miniapp/styles/tokens.wxss", "docs/ui-style-guide.md"]) {
  assertIncludes(file, "#1677FF");
  assertIncludes(file, "#10B981");
  assertIncludes(file, "#F59E0B");
  assertIncludes(file, "#EF4444");
}

for (const file of ["admin-web/src/styles.css", "store-terminal/src/styles.css", "miniapp/app.wxss", "miniapp/pages/share-collection/index.wxss"]) {
  for (const legacyColor of ["#8B1A2B", "#C9A96E", "#F5F3EF", "#4A121E", "#A72A3E"]) {
    if (contents[file].includes(legacyColor)) {
      throw new Error(`${file} 仍包含旧红金色 ${legacyColor}`);
    }
  }
}

assertIncludes("admin-web/src/App.vue", "dashboard-hero");
assertIncludes("admin-web/src/App.vue", "activeNav");
assertIncludes("admin-web/src/App.vue", "admin-login-page");
assertIncludes("admin-web/src/App.vue", "handleLogout");
assertIncludes("admin-web/src/App.vue", "系统管理员");
assertIncludes("admin-web/src/App.vue", "退出登录");
for (const text of ["activeNav === \"商品\"", "activeNav === \"订单\"", "activeNav === \"销售单\"", "activeNav === \"库存\"", "activeNav === \"客户\"", "activeNav === \"门店\"", "activeNav === \"收款\"", "activeNav === \"报表\""]) {
  assertIncludes("admin-web/src/App.vue", text);
}
assertIncludes("admin-web/src/App.vue", "runAdminAction");
assertIncludes("store-terminal/src/App.vue", "cashier-panel");
assertIncludes("store-terminal/src/App.vue", "activeNav");
assertIncludes("store-terminal/src/App.vue", "store-login-page");
assertIncludes("store-terminal/src/App.vue", "handleLogout");
assertIncludes("store-terminal/src/App.vue", "门店操作员");
assertIncludes("store-terminal/src/App.vue", "退出登录");
for (const text of ["activeNav === \"快速收银\"", "activeNav === \"销售单\"", "activeNav === \"接单履约\"", "activeNav === \"库存查询\"", "activeNav === \"分享收款\""]) {
  assertIncludes("store-terminal/src/App.vue", text);
}
assertIncludes("store-terminal/src/App.vue", "runStoreAction");
assertIncludes("miniapp/pages/share-collection/index.wxml", "payment-hero");
assertIncludes("miniapp/pages/share-collection/index.wxss", ".payment-hero");

// === Phase 2 polish: Task 1 - 401 自动登出 ===
assertIncludes("admin-web/src/api.ts", "interceptors.response");
assertIncludes("admin-web/src/api.ts", "auth:logout");
assertIncludes("store-terminal/src/api.ts", "interceptors.response");
assertIncludes("store-terminal/src/api.ts", "auth:logout");
assertIncludes("admin-web/src/App.vue", "auth:logout");
assertIncludes("store-terminal/src/App.vue", "auth:logout");

// === Phase 2 polish: Task 2 - 去除演示文案 ===
for (const phrase of ["新增演示商品", "演示新品白酒", "演示新门店", "演示新客户", "演示客户", "示例地址"]) {
  assertNotIncludes("admin-web/src/App.vue", phrase);
}
for (const phrase of ["演示客户", "13900000000"]) {
  assertNotIncludes("store-terminal/src/App.vue", phrase);
}

// === Phase 2 polish: Task 3 - 表单校验 ===
assertIncludes("admin-web/src/App.vue", "productFormRef");
assertIncludes("admin-web/src/App.vue", "productRules");
assertIncludes("admin-web/src/App.vue", "storeFormRef");
assertIncludes("admin-web/src/App.vue", "memberFormRef");
assertIncludes("admin-web/src/App.vue", "/^1[3-9]\\d{9}$/");
assertIncludes("store-terminal/src/App.vue", "invFormRef");

// === Phase 2 polish: Task 4 - 高风险操作二次确认 ===
assertIncludes("admin-web/src/App.vue", "ElMessageBox");
assertIncludes("admin-web/src/App.vue", "确认退出");
assertIncludes("admin-web/src/App.vue", "确认调整");
assertIncludes("store-terminal/src/App.vue", "ElMessageBox");
assertIncludes("store-terminal/src/App.vue", "确认退出");

// === Phase 2 polish: Task 5 - 金额格式化 ===
assertIncludes("admin-web/src/utils/format.ts", "formatYuan");
assertIncludes("store-terminal/src/utils/format.ts", "formatYuan");
assertIncludes("admin-web/src/App.vue", "formatYuan");
assertIncludes("store-terminal/src/App.vue", "formatYuan");

// === Phase 2 polish: Task 6 - 商品/客户搜索 ===
assertIncludes("admin-web/src/App.vue", "productsKeyword");
assertIncludes("admin-web/src/App.vue", "membersKeyword");
assertIncludes("admin-web/src/App.vue", "searchProducts");
assertIncludes("admin-web/src/App.vue", "searchMembers");

// === merchant-mobile workspace ===
assertIncludes("package.json", "\"merchant-mobile\"");
assertIncludes("merchant-mobile/package.json", "\"@vitejs/plugin-vue\"");
assertIncludes("merchant-mobile/src/App.vue", "van-tabbar");
assertIncludes("merchant-mobile/src/api.ts", "merchant_token");
assertIncludes("merchant-mobile/src/styles/tokens.css", "#1677FF");

console.log("UI_CONTRACT_PASS");
