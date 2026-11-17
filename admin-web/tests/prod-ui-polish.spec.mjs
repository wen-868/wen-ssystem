import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const shell = readFileSync(join(root, "src/layouts/WorkbenchShell.vue"), "utf8");
const panel = readFileSync(join(root, "src/components/workbench/AiChatPanel.vue"), "utf8");
const subnav = readFileSync(join(root, "src/layouts/WorkbenchSubnav.vue"), "utf8");
const messageCard = readFileSync(join(root, "src/components/AiChat/AiMessageCard.vue"), "utf8");
const feed = readFileSync(join(root, "src/components/workbench/AiFeedView.vue"), "utf8");
const composer = readFileSync(join(root, "src/components/workbench/AiChatComposer.vue"), "utf8");

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}

check("AI 聊天主面使用白色工作区画布", () => {
  assert.match(shell, /\.wb-view\[data-view="chat"\]\s*\{[^}]*background:\s*var\(--wb-bg,\s*#ffffff\)/s);
});

check("AI 信息流主面使用白色工作区画布", () => {
  assert.match(shell, /\.wb-view\[data-view="feed"\]\s*\{[^}]*background:\s*var\(--wb-bg,\s*#ffffff\)/s);
});

check("人工层顶栏跟随一级模块，不重复业务页标题", () => {
  assert.match(shell, /effectiveMode\.value\s*===\s*"human"\)\s*return\s+selectedGroupLabel\.value/);
});

check("归档缺失按空会话恢复，不抛红条", () => {
  assert.match(panel, /loadConversation\?\.\(conversationId,\s*\{\s*silentEmpty:\s*true\s*\}\)/);
});

check("工作台位顶栏改称经营总览，避免与模式胶囊重名", () => {
  assert.match(shell, /selectedGroupLabel\.value\s*===\s*"工作台"\s*\?\s*"经营总览"/);
});

check("二级栏真实入口排除已展示的 productionCards（同路由不重复）", () => {
  assert.match(subnav, /dedupedRealEntries/);
  assert.match(subnav, /new Set\(productionCards\.value\.map\(\(entry\) => entry\.routeName\)\)/);
});

check("二级栏模块态单一平铺网格", () => {
  assert.match(subnav, /二级栏平铺/);
  assert.match(subnav, /if \(props\.mode === "module"\) \{[\s\S]*?return \[\];/);
});

check("对话消息显示双方姓名", () => {
  assert.match(messageCard, /msg-sender/);
  assert.match(messageCard, /message\.role === "user" \? userName : employeeName/);
});

check("业务动态查看单据时打开销售单详情", () => {
  assert.match(feed, /router\.push\(`\/sale-bills\/\$\{encodeURIComponent\(billNo\)\}`\)/);
});

check("输入框不再有大范围投影背景条", () => {
  assert.doesNotMatch(composer, /box-shadow:\s*0 8px 30px/);
  assert.match(composer, /\.cmp-form[\s\S]*?box-shadow:\s*none/);
});

check("员工选择无下拉箭头，点击姓名弹出真实员工列表", () => {
  assert.doesNotMatch(composer, /<el-select/);
  assert.match(composer, /class="cmp-employee-btn"/);
  assert.match(composer, /v-for="group in employeeGroups"/);
  assert.match(composer, /暂无真实数字员工/);
});

console.log(`prod-ui-polish: ${checks.length} passed / 0 failed`);
for (const name of checks) console.log(`PASS  ${name}`);
