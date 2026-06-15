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
  "miniapp/pages/share-collection/index.wxml",
  "miniapp/pages/share-collection/index.wxss",
  "docs/ui-style-guide.md"
];

const contents = Object.fromEntries(files.map((file) => [file, readFileSync(file, "utf8")]));

function assertIncludes(file, text) {
  if (!contents[file].includes(text)) {
    throw new Error(`${file} 缺少 ${text}`);
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
assertIncludes("store-terminal/src/App.vue", "cashier-panel");
assertIncludes("miniapp/pages/share-collection/index.wxml", "payment-hero");
assertIncludes("miniapp/pages/share-collection/index.wxss", ".payment-hero");

console.log("UI_CONTRACT_PASS");
