// S3-202 第 24 项复核：历史口令字面量「数量不变、只多了指路注释」
// 做法：把 HEAD 版与工作区版同文件分别计数；并要求「新增行全部是 -- 注释行」+「删除行数=0」
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2];
const files = [
  "docs/migrations/002_phase1_seed.sql",
  "docs/migrations/075_reset_admin_password_bcrypt.sql",
  "docs/migrations/081_platform_admin_seed_and_fix.sql",
  "docs/migrations/099_seed_data.sql",
  "docs/migrations/127_fix_demo_accounts.sql",
];
const LITERALS = ["admin123", "123456 -> bcrypt hash", "默认密码", "默认平台超级管理员"];

const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const count = (text, needle) => text.split(needle).length - 1;

console.log("文件 | 字面量 | HEAD 次数 | 工作区次数 | 判定");
let ok = true;
for (const file of files) {
  const head = git("show", `HEAD:${file}`);
  const work = readFileSync(join(repo, file), "utf8");
  for (const literal of LITERALS) {
    const a = count(head, literal);
    const b = count(work, literal);
    if (a === 0 && b === 0) continue;
    const pass = a === b;
    if (!pass) ok = false;
    console.log(`${file} | ${literal} | ${a} | ${b} | ${pass ? "不变 ✔" : "变化 ✘"}`);
  }
}

console.log("\n=== 新增/删除行审计（应：全部新增行以「+-- 」开头；无删除行）===");
const numstat = git("diff", "--numstat", "--", ...files).trim().split("\n");
let added = 0;
let deleted = 0;
for (const line of numstat) {
  const [a, d] = line.split("\t");
  added += Number(a);
  deleted += Number(d);
}
console.log(`新增行=${added} 删除行=${deleted}`);
if (deleted !== 0) ok = false;

const diffLines = git("diff", "-U0", "--", ...files).split("\n");
const badAdds = diffLines.filter((l) => l.startsWith("+") && !l.startsWith("+++") && !l.startsWith("+-- "));
console.log(`非注释新增行数=${badAdds.length}${badAdds.length ? " -> " + JSON.stringify(badAdds) : ""}`);
if (badAdds.length !== 0) ok = false;

console.log(`\n总判定：${ok ? "PASS" : "FAIL"}`);
process.exitCode = ok ? 0 : 1;
