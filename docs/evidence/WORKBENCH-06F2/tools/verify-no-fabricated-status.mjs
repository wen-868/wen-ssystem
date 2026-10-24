/** 独立核验：产品代码与测试夹具是否仍残留虚构计划状态（WORKBENCH-06F2 §三.2） */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// tools/ → WORKBENCH-06F2/ → docs/evidence/ → docs/ → 工作树根 → admin-web/src
const SRC = path.join(here, "..", "..", "..", "..", "admin-web", "src");
const FAKE = ["done", "completed", "succeeded", "cancelled", "canceled", "rejected", "aborted"];
const REAL = ["pending", "running", "success", "failed", "suspended", "skipped"];

function codeOnly(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:'"`])\/\/.*$/gm, "$1");
}

const target = path.join(SRC, "shared", "workbench", "agent-metrics.ts");
const code = codeOnly(readFileSync(target, "utf8"));

let bad = 0;
console.log("== 产品代码 agent-metrics.ts（代码区）==");
for (const fake of FAKE) {
  const hit = new RegExp(`["'\`]${fake}["'\`]`).test(code);
  if (hit) bad += 1;
  console.log(`  ${fake.padEnd(12)} ${hit ? "FOUND(BAD)" : "absent(OK)"}`);
}
console.log("== 真实六态必须齐备 ==");
for (const real of REAL) {
  const hit = code.includes(`"${real}"`);
  if (!hit) bad += 1;
  console.log(`  ${real.padEnd(12)} ${hit ? "present(OK)" : "MISSING(BAD)"}`);
}

console.log(`\n结论：${bad === 0 ? "PASS —— 零虚构状态、真实六态齐备" : `FAIL —— ${bad} 处问题`}`);
process.exitCode = bad === 0 ? 0 : 1;
