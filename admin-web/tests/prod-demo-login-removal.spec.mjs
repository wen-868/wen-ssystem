import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const common = readFileSync(join(root, "src/api/common.ts"), "utf8");
const login = readFileSync(join(root, "src/views/LoginView.vue"), "utf8");

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}

check("源码不存在演示账号/口令与初始化调用", () => {
  assert.equal(/DEMO_(ACCOUNT|PASSWORD|LOGIN_ENABLED)/.test(common), false);
  assert.equal(/seedDemoData/.test(common), false);
  assert.equal(common.includes("admin@2026"), false);
});

check("登录页不存在演示入口与演示处理器", () => {
  assert.equal(/演示登录/.test(login), false);
  assert.equal(/handleDemoLogin/.test(login), false);
  assert.equal(/DEMO_/.test(login), false);
});

console.log(`prod-demo-login-removal: ${checks.length} passed / 0 failed`);
for (const name of checks) console.log(`PASS  ${name}`);
