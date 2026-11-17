import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "src/views/sale/SalesOrderCreate.vue"), "utf8");

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}

check("客户搜索走 /admin/members", () => {
  assert.match(source, /api\.get\("\/admin\/members"/);
  assert.doesNotMatch(source, /api\.get\("\/members"/);
});

check("商品搜索走 /admin/products", () => {
  assert.match(source, /api\.get\("\/admin\/products"/);
  assert.doesNotMatch(source, /api\.get\("\/products"/);
});

check("销售单创建走 /store/sale-bills", () => {
  assert.match(source, /api\.post\("\/store\/sale-bills"/);
  assert.doesNotMatch(source, /api\.post\("\/sale-bills"/);
});

console.log(`prod-sales-create-endpoints: ${checks.length} passed / 0 failed`);
for (const name of checks) console.log(`PASS  ${name}`);
