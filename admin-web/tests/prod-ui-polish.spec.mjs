import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const shell = readFileSync(join(root, "src/layouts/WorkbenchShell.vue"), "utf8");
const panel = readFileSync(join(root, "src/components/workbench/AiChatPanel.vue"), "utf8");

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}

check("AI 聊天主面使用白色工作区画布", () => {
  assert.match(shell, /\.wb-view\[data-view="chat"\]\s*\{[^}]*background:\s*var\(--wb-bg,\s*#ffffff\)/s);
});

check("归档缺失按空会话恢复，不抛红条", () => {
  assert.match(panel, /loadConversation\?\.\(conversationId,\s*\{\s*silentEmpty:\s*true\s*\}\)/);
});

check("工作台位顶栏改称经营总览，避免与模式胶囊重名", () => {
  assert.match(shell, /selectedGroupLabel\.value\s*===\s*"工作台"\s*\?\s*"经营总览"/);
});

console.log(`prod-ui-polish: ${checks.length} passed / 0 failed`);
for (const name of checks) console.log(`PASS  ${name}`);
