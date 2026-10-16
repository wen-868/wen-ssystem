#!/usr/bin/env node
/**
 * 重建 rbac-g0-wiring.test.ts 的合并结果（v2：以 theirs 为基，按精确串插入 ours 的三处增补）
 *
 * 为什么不用 git merge-file：本机环境返回 status=3（工具层失败），且不需要通用三方合并
 *   —— 两侧改动都是**纯追加**（常量块 / it 描述 / 和式常量 / spread 项），用精确串插入更可控、可审计。
 *
 * 目标态：两侧常量块都在；it 描述含两批；和式含全部批常量；裸数字 = 215 + 11 + 65 = 291；spread 为并集。
 * 用法：`node docs/evidence/S3-226/tools/rebuild-g0-test-v2.cjs`
 */
const { execFileSync } = require("child_process");
const fs = require("fs");

const REL = "backend/src/__tests__/routes/rbac-g0-wiring.test.ts";
const read = (rev) => execFileSync("git", ["show", `${rev}:${REL}`], { maxBuffer: 1e8 }).toString();

const ours = read("HEAD"); // S3-226 营销域分支
const theirs = read("MERGE_HEAD"); // origin/main（含 S3-225 员工/账号域）
let s = theirs;

// 1) 抽出 ours 的 S3-226 常量块
const start = ours.indexOf("  // S3-226 追加说明");
const totalMarker = "  const S3_226_WIRED_TOTAL = [...S3_226_WIRED_FILES.values()].reduce((a, b) => a + b, 0);";
const totalIdx = ours.indexOf(totalMarker);
if (start < 0 || totalIdx < 0) throw new Error("S3-226 constant block not found in ours");
const block = ours.slice(start, totalIdx + totalMarker.length);

// 2) 插到 theirs 的 it( 行之前
const itLineStart = s.indexOf('  it("backend/src/routes 下 `requirePermission(` 出现次数');
if (itLineStart < 0) throw new Error("it( line not found in theirs");
if (s.includes("S3_226_WIRED_FILES")) throw new Error("theirs already has S3_226 block");
s = s.slice(0, itLineStart) + block + "\n\n" + s.slice(itLineStart);

// 3) it 描述追加 + S3-226 新增 65
const itBefore = s.slice(s.indexOf('  it("backend/src/routes 下 `requirePermission(`'), s.indexOf("() => {", itLineStart));
if (!itBefore.includes("+ S3-225 新增 11")) throw new Error("it description unexpected");
s = s.replace("+ S3-225 新增 11\"", "+ S3-225 新增 11 + S3-226 新增 65\"");

// 4) 和式追加 + 裸数字 226 → 291
if (!s.includes("+ S3_225_WIRED_TOTAL);")) throw new Error("sum line unexpected");
s = s.replace("+ S3_225_WIRED_TOTAL);", "+ S3_225_WIRED_TOTAL + S3_226_WIRED_TOTAL);");
if (!s.includes("expect(total).toBe(226);")) throw new Error("bare number 226 not found");
s = s.replace("expect(total).toBe(226);", "expect(total).toBe(291);");

// 5) spread 并集
if (!s.includes("...S3_225_WIRED_FILES])")) throw new Error("spread line unexpected");
s = s.replace("...S3_225_WIRED_FILES])", "...S3_225_WIRED_FILES, ...S3_226_WIRED_FILES])");

if (s.includes("<<<<<<<") || s.includes(">>>>>>>")) throw new Error("markers left");
fs.writeFileSync(REL, s);

const checks = {
  "两块常量": s.includes("S3_225_WIRED_FILES") && s.includes("S3_226_WIRED_FILES"),
  "it 描述": /S3-225 新增 11 \+ S3-226 新增 65/.test(s),
  "和式含两批": s.includes("+ S3_225_WIRED_TOTAL + S3_226_WIRED_TOTAL);"),
  "裸数字 291": s.includes("expect(total).toBe(291);"),
  "spread 并集": s.includes("...S3_225_WIRED_FILES, ...S3_226_WIRED_FILES])"),
};
console.log(JSON.stringify(checks, null, 1));
