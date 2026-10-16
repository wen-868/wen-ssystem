#!/usr/bin/env node
/**
 * S3-231 F3 · 「因缺码被关闭的入口」影响面清单生成器（派单卡 §F3 强制要求）
 *
 * 为什么需要：F3 把入口门改成"失败关闭"后，**取不到权限码**（`permissions` 为 null/undefined）
 * 时，**承载码的入口**（`status='gated'`）会全部不显示。派单卡要求：
 *   ① 逐条登记「入口 + 缺哪个码 + 归属单」；
 *   ② 给出影响面（哪些角色失去哪些入口）；
 *   ③ 该情况**必须**出现在"因缺码关闭"清单里，不得静默。
 *
 * 本脚本从**注册表本身**（`app-mobile/src/config/permission-gates.ts` 的 `ENTRY_GATES`）生成清单
 * —— 避免"文档一套、代码一套"，注册表加/删一行，本清单口径随之变化；配 `s3230-gate-check.mjs`
 * 的四层断言（台账↔注册表、源码引用、在用角色矩阵、反测）一起作为证据。
 *
 * 用法：node docs/evidence/S3-231/F3/tools/f3-impact.mjs
 * 退出码：0 = 生成成功（清单非空）；1 = 注册表读不到/清单为空（哨兵，防"清单静默变空"）
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..", "..", "..");
const REGISTRY = resolve(REPO, "app-mobile", "src", "config", "permission-gates.ts");

const src = readFileSync(REGISTRY, "utf8");
// 注册表是"零依赖纯常量"文件 ⇒ 直接抽出 ENTRY_GATES 的数组字面量并求值（不执行被 import 的模块）
const start = src.indexOf("export const ENTRY_GATES");
if (start === -1) {
  console.error("FAIL 找不到 ENTRY_GATES");
  process.exit(1);
}
// ⚠️ 必须从 `=` 之后找 `[`：类型注解 `EntryGate[]` 里的 `[]` 排在赋值之前，是空数组的字面量陷阱
const assign = src.indexOf("=", start);
const open = src.indexOf("[", assign);
// 括号配对找到数组结尾（忽略字符串里的括号：本文件字符串内无未转义的中括号）
let depth = 0;
let end = -1;
for (let i = open; i < src.length; i += 1) {
  const ch = src[i];
  if (ch === "[") depth += 1;
  else if (ch === "]") {
    depth -= 1;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}
if (end === -1) {
  console.error("FAIL ENTRY_GATES 数组未闭合");
  process.exit(1);
}
// eslint-disable-next-line no-new-func
const gates = new Function(`return (${src.slice(open, end)});`)();

const gated = gates.filter((g) => g.status === "gated");
const registered = gates.filter((g) => g.status === "registered");

console.log(`# S3-231 F3 · 因缺码被关闭的入口（注册表口径：${gates.length} 个入口）`);
console.log(`\n> 生成：\`node docs/evidence/S3-231/F3/tools/f3-impact.mjs\`（可复跑）`);
console.log(`> 触发条件：**入口门取不到权限码**（\`permissions\` 为 \`null\`/\`undefined\`）⇒ 失败关闭（S3-231 F3）；`);
console.log(`> 门数：\`status='gated'\` **${gated.length}** 个（全部会被关闭）｜\`status='registered'\` **${registered.length}** 个（码数组为空 ⇒ 不设门 ⇒ **不受影响**）。`);

console.log(`\n## 一、被关闭的入口（${gated.length} 个，逐条）\n`);
console.log("| # | 入口 id | 域 | 入口（页面位置） | 页面 | 缺哪个码 | 归属单（basis） |");
console.log("|--:|:--|:--|:--|:--|:--|:--|");
gated.forEach((g, i) => {
  const basisMatch = (g.basis || "").match(/(S3-\d+[A-Za-z0-9-]*)/);
  const owner = basisMatch ? basisMatch[1] : "S3-230（本注册表所在单）";
  console.log(`| ${i + 1} | \`${g.id}\` | ${g.domain} | ${g.entry} | \`${g.page}\` | \`${g.codes.join(" + ")}\` | ${owner} |`);
});

console.log(`\n## 二、不受影响的入口（${registered.length} 个，码数组为空）\n`);
console.log("| # | 入口 id | 域 | 为什么不门 |");
console.log("|--:|:--|:--|:--|");
registered.forEach((g, i) => {
  console.log(`| ${i + 1} | \`${g.id}\` | ${g.domain} | ${(g.note || g.basis || "").slice(0, 90)} |`);
});

console.log(`\n## 三、影响面（哪些角色失去哪些入口）\n`);
console.log("**关键口径**：\`null/undefined\` 不是某个角色，而是「**取不到权限码**」这一**临时态**（`/admin/auth/me` 未回 / 老版本本地缓存缺字段）。");
console.log("因此影响面**不是角色相关**的，而是：**该态持续期间，无论什么角色都看不到上述 " + gated.length + " 个入口**；");
console.log("一旦 `permissions` 以**数组**形态到达（含空数组），判定立刻回到「按码显隐」（在用角色矩阵见 `s3230-gate-check.mjs` C 节）。");
console.log("\n| 角色 | 该态下的可见入口 | 恢复后可见性 | 说明 |");
console.log("|:--|:--|:--|:--|");
console.log(`| 全部角色（含 SUPER_ADMIN / STORE_MANAGER 等在用写角色） | 仅 ${registered.length} 个 \`registered\` 入口 | 按 \`codes\` 判定的正常集合 | 临时态期间保守隐藏，**不产生 403 点击**（这正是失败关闭的目的） |`);

console.log(`\n## 四、反测（证明"该情况必须出现在清单里、不得静默"）\n`);
console.log(`- 反测 1：把某 \`gated\` 入口的码改成**不存在的码** ⇒ 该入口对非通配在用角色**不可见**（\`s3230-gate-check.mjs\` D1 节）；`);
console.log(`- 反测 2：把 \`permissions\` 置为 \`null\` ⇒ \`hasPermissionCodes(null, 非空码)\` **必须为 false**（\`s3230-gate-check.mjs\` E 节，S3-231 F3 改判后的断言）；`);
console.log(`- 反测 3：把 \`permissions\` 置为 \`[]\` ⇒ 同样 false（原本即如此，回归保护）。`);

if (gated.length === 0) {
  console.error("\nFAIL 清单为空：注册表里没有 gated 入口 ⇒ F3 的失败关闭无从体现（哨兵，防清单静默变空）");
  process.exit(1);
}
console.error(`\n[生成成功] gated=${gated.length} registered=${registered.length}`);
process.exit(0);
