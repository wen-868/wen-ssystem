import { readFileSync } from "node:fs";

const files = [
  "admin-web/src/styles.css",
  "store-terminal/src/styles.css",
  "miniapp/app.wxss",
  "admin-web/src/App.vue",
  "store-terminal/src/App.vue",
  "miniapp/pages/share-collection/index.wxml",
  "miniapp/pages/share-collection/index.wxss"
];

const contents = Object.fromEntries(files.map((file) => [file, readFileSync(file, "utf8")]));

function assertIncludes(file, text) {
  if (!contents[file].includes(text)) {
    throw new Error(`${file} 缺少 ${text}`);
  }
}

for (const file of ["admin-web/src/styles.css", "store-terminal/src/styles.css", "miniapp/app.wxss"]) {
  assertIncludes(file, "#8B1A2B");
  assertIncludes(file, "#C9A96E");
  assertIncludes(file, "#F5F3EF");
}

assertIncludes("admin-web/src/App.vue", "dashboard-hero");
assertIncludes("store-terminal/src/App.vue", "cashier-panel");
assertIncludes("miniapp/pages/share-collection/index.wxml", "payment-hero");
assertIncludes("miniapp/pages/share-collection/index.wxss", ".payment-hero");

console.log("UI_CONTRACT_PASS");
