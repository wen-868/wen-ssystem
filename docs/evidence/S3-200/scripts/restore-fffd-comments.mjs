// S3-200 · 第 61 项：把 6 个路由文件里被历史编码事故破坏的注释行，按 git 历史里的原文逐行还原。
//
// 原则：
//   1) 只改「含 U+FFFD 的那一行」，且目标文本**只能来自 git 历史**（不重写、不意译）；
//   2) 不改动任何其它行 ⇒ 行尾（CRLF）与代码语义不动；
//   3) 逐文件打印改前/改后 sha256 与被替换行的原文（含码点），便于复核。
// 用法：node restore-fffd-comments.mjs <repoRoot> [--check]
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.argv[2];
const checkOnly = process.argv.includes("--check");

// 目标文本的来源（逐处给出 commit + 行号，见回执 §二 表）：
//   · 「路由自动发现配置」横幅：ba7b2aa7（且与现存完好件 payment.routes.ts:24 逐字相同）
//   · stock-check 的 Store 段标题：ba7b2aa7:21（同文件 82e8f347 已按同款口径修好 Admin 段标题，可作先例）
//   · 订单同步日志标题：b33ffaaf:8
const JOBS = [
  {
    file: "backend/src/routes/alert.routes.ts",
    targets: ["// ========== 路由自动发现配置 =========="],
  },
  {
    file: "backend/src/routes/customer-merge.routes.ts",
    targets: ["// ========== 路由自动发现配置 =========="],
  },
  {
    file: "backend/src/routes/export.routes.ts",
    targets: ["// ========== 路由自动发现配置 =========="],
  },
  {
    file: "backend/src/routes/sys-config.routes.ts",
    targets: ["// ========== 路由自动发现配置 =========="],
  },
  {
    file: "backend/src/routes/stock-check.routes.ts",
    targets: [
      "// ==================== Store 盘点路由 ====================",
      "// ========== 路由自动发现配置 ==========",
    ],
  },
  {
    file: "backend/src/routes/miniapp-order-sync.routes.ts",
    targets: ["// ========== 订单同步日志列表（分页+筛选） =========="],
  },
];

const sha = (b) => createHash("sha256").update(b).digest("hex");
const cps = (s) => [...s].map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")).join(" ");

let bad = 0;
for (const job of JOBS) {
  const abs = path.join(repoRoot, job.file);
  const before = fs.readFileSync(abs);
  const beforeSha = sha(before);
  const text = before.toString("utf8");
  const lines = text.split("\n");
  const idx = [];
  lines.forEach((L, i) => {
    if (L.includes("\uFFFD")) idx.push(i);
  });
  if (idx.length !== job.targets.length) {
    console.log(`✗ ${job.file}：含 U+FFFD 的行数 ${idx.length} ≠ 预期 ${job.targets.length} ⇒ 拒绝改动`);
    bad++;
    continue;
  }
  console.log(`### ${job.file}  命中行 = [${idx.map((i) => i + 1).join(", ")}]`);
  idx.forEach((li, k) => {
    const raw = lines[li];
    const cr = raw.endsWith("\r") ? "\r" : "";
    const body = cr ? raw.slice(0, -1) : raw;
    console.log(`  L${li + 1} 改前 码点: ${cps(body)}`);
    console.log(`  L${li + 1} 改前 文本: ${JSON.stringify(body)}`);
    console.log(`  L${li + 1} 改后 文本: ${JSON.stringify(job.targets[k])}`);
    if (!checkOnly) lines[li] = job.targets[k] + cr;
  });
  if (!checkOnly) {
    const after = Buffer.from(lines.join("\n"), "utf8");
    fs.writeFileSync(abs, after);
    console.log(`  sha256 改前 = ${beforeSha}`);
    console.log(`  sha256 改后 = ${sha(after)}`);
  }
}
console.log(bad === 0 ? "RESTORE_OK" : `RESTORE_ABORT(files=${bad})`);
