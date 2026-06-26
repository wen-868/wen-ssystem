import { readFileSync, readdirSync } from "node:fs";
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

// Task 6: 批发订货和确认收货检查
function assertFileIncludes(filePath, keyword) {
  const content = readFileSync(filePath, "utf8");
  if (!content.includes(keyword)) throw new Error(`${filePath} 缺少 ${keyword}`);
}
assertFileIncludes("miniapp/pages/order-detail/index.wxml", "确认收货");
assertFileIncludes("miniapp/pages/order-detail/index.js", "confirmReceipt");
assertFileIncludes("miniapp/pages/order/index.js", "WAIT_DELIVERY");

console.log("MINIAPP_RELEASE_CHECK_PASS");
