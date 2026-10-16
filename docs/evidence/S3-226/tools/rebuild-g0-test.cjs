#!/usr/bin/env node
/**
 * 重建 rbac-g0-wiring.test.ts 的合并结果（修正版；凌舟 2026-10-16）
 *
 * 背景：上一版 resolve-merge-conflicts.cjs 的占位符编号错位（push 后 length 从 1 起 ⇒ @@H1..3，
 * 而替换却写 @@H0..2），导致 g0 用例被写坏（残留占位符 + 段落错位）。
 * 本脚本不再"就地解冲突"，而是：用 `git merge-file` 从 HEAD / MERGE_HEAD / merge-base 三份重建冲突，
 * 再用确定规则合成：
 *   - 保留**两侧常量块**（S3-225 与 S3-226 各一份）
 *   - `it(...)` 描述 = "… + S3-225 新增 11 + S3-226 新增 65"
 *   - 和式断言含**全部**批常量；裸数字 = 291（= 215 + 11 + 65）
 *   - perFile 的 spread 列表 = 两侧并集
 * 用法：`node docs/evidence/S3-226/tools/rebuild-g0-test.cjs`
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REL = "backend/src/__tests__/routes/rbac-g0-wiring.test.ts";
const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "s3226-g0-"));
const show = (rev, out) => {
  const buf = execFileSync("git", ["show", `${rev}:${REL}`], { maxBuffer: 1e8 });
  fs.writeFileSync(out, buf);
};

const base = path.join(tmp, "base.ts");
const ours = path.join(tmp, "ours.ts");
const theirs = path.join(tmp, "theirs.ts");
const merged = path.join(tmp, "merged.ts");
const mergeBase = execFileSync("git", ["merge-base", "HEAD", "MERGE_HEAD"]).toString().trim();
show(mergeBase, base);
show("HEAD", ours); // 我们的分支（S3-226 营销域）
show("MERGE_HEAD", theirs); // origin/main（含 S3-225 员工/账号域）

// 生成带冲突标记的版本（失败退出码 1 = 有冲突，属预期）
try {
  execFileSync("git", ["merge-file", "-p", ours, base, theirs], { stdio: ["ignore", fs.openSync(merged, "w"), "ignore"] });
} catch (e) {
  if (e.status !== 1) throw e;
}

const CONFLICT = /<<<<<<< .*?\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> .*?\r?\n/g;
let s = fs.readFileSync(merged, "utf8");
const hunks = [];
const PLACEHOLDER_PREFIX = "@@HUNK_";
s = s.replace(CONFLICT, (m, o, t) => {
  hunks.push({ o, t });
  return `${PLACEHOLDER_PREFIX}${hunks.length - 1}@@\n`;
});
if (hunks.length !== 3) throw new Error("expect 3 hunks, got " + hunks.length);

// hunk 1：常量块 + it 描述
const o0 = hunks[0].o.split(/\r?\n/);
const t0 = hunks[0].t.split(/\r?\n/);
const oIt = o0.find((l) => l.trim().startsWith("it("));
const tIt = t0.find((l) => l.trim().startsWith("it("));
if (!oIt || !tIt) throw new Error("it line missing");
const mergedIt = oIt.replace(" + S3-226 新增 65", " + S3-225 新增 11 + S3-226 新增 65");
const hunk0 = [...o0.filter((l) => l !== oIt), ...t0.filter((l) => l !== tIt), mergedIt].join("\n");

// hunk 2：和式 + 裸数字
const sumLine = hunks[1].o.split(/\r?\n/)[0];
if (!sumLine.includes("S3_226_WIRED_TOTAL);")) throw new Error("sum line unexpected: " + sumLine);
const mergedSum = sumLine.replace(" + S3_226_WIRED_TOTAL);", " + S3_225_WIRED_TOTAL + S3_226_WIRED_TOTAL);");
const hunk1 = [mergedSum, "    expect(total).toBe(291);"].join("\n");

// hunk 3：spread 并集（以 theirs 为基，追加 ours 独有的批常量）
const tSpread = hunks[2].t.split(/\r?\n/)[0];
const oSpread = hunks[2].o.split(/\r?\n/)[0];
if (!tSpread.includes("...S3_225_WIRED_FILES]") || !oSpread.includes("...S3_226_WIRED_FILES]")) {
  throw new Error("spread lines unexpected");
}
const hunk2 = tSpread.replace("...S3_225_WIRED_FILES]", "...S3_225_WIRED_FILES, ...S3_226_WIRED_FILES]");

s = s
  .replace(`${PLACEHOLDER_PREFIX}0@@`, hunk0)
  .replace(`${PLACEHOLDER_PREFIX}1@@`, hunk1)
  .replace(`${PLACEHOLDER_PREFIX}2@@`, hunk2);

if (s.includes(PLACEHOLDER_PREFIX) || s.includes("<<<<<<<")) throw new Error("placeholders/markers left");
fs.writeFileSync(REL, s);
console.log("g0 rebuilt: total=291 / both constant blocks kept / spread union / markers=0");
