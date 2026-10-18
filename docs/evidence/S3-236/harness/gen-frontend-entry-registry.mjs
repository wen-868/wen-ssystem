#!/usr/bin/env node
/**
 * S3-236 落地面 4：由实测命中（`raw/12-frontend-entry-hits.json`）生成
 * **前端入口登记表**（`docs/evidence/S3-236/frontend-entry-registry.md`）。
 *
 * 为什么单独一个装置：登记表若手抄，就会与"实测扫描"两份读数漂移（正是本单要防的形态）。
 *
 * 用法（仓库根执行）：
 *   ① node docs/evidence/S3-236/harness/scan-frontend-entries.mjs
 *   ② node docs/evidence/S3-236/harness/gen-frontend-entry-registry.mjs
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const hits = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "docs/evidence/S3-236/raw/12-frontend-entry-hits.json"), "utf-8"),
);

/** 逐域读出目录（顺序 = 迁移 sort_no 顺序） */
const DOMAIN_FILES = [
  ["报表域", "backend/src/shared/report-permission-codes.ts"],
  ["硬件 / 打印域", "backend/src/shared/hardware-permission-codes.ts"],
  ["小程序 / 移动端域", "backend/src/shared/miniapp-permission-codes.ts"],
  ["工作台 / 待办消息域", "backend/src/shared/dashboard-permission-codes.ts"],
];

const rows = [];
for (const [domain, file] of DOMAIN_FILES) {
  const src = fs.readFileSync(path.join(repoRoot, file), "utf-8");
  const re = /code: "([^"]+)",[\s\S]*?endpoints: \[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const endpoints = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    const callSites = hits.codes[m[1]] ?? [];
    rows.push({
      domain,
      code: m[1],
      endpoints,
      callSites,
      verdict:
        callSites.length > 0
          ? `✅ 有调用点：${callSites.join(" / ")}`
          : "❌ 暂无前端入口，仅后端授权位",
    });
  }
}

if (rows.length !== 38) {
  console.error(`✗ 登记表生成失败：码数 ${rows.length} ≠ 38`);
  process.exit(2);
}

const withCallSites = rows.filter((r) => r.callSites.length > 0).length;

const md = `# S3-236 · 前端入口登记表（落地面 4）

> 生成装置：\`docs/evidence/S3-236/harness/gen-frontend-entry-registry.mjs\`（**禁止手抄**）
> 实测读数：\`docs/evidence/S3-236/raw/12-frontend-entry-hits.json\`（扫描 \`${hits.scanned_files}\` 个前端文件：
> ${hits.scanned_dirs.join(" / ")}）
> 逐条原始输出（含命中源码行）：\`docs/evidence/S3-236/raw/10-frontend-entry-scan.txt\`、\`raw/11-frontend-entry-scan-debug.txt\`

## 一、口径（先读，否则会误读下表）

1. 本仓**前端不引用商家权限码**（页面可见性由 \`meta.roles\` + 菜单授予决定，同 S3-232 §三）
   ⇒ 落地面 4 是**登记表**，不是前端代码改动（\`admin-web/src\` 零改动）。
2. 表中"调用点"= **前端代码里真实调用该端点**的位置（\`文件:行号\`），由扫描装置按
   "HTTP 方法 + 路径字面量（含去掉 \`/api\` 的相对写法）+ 排除注释行"三条判据实测得出。
3. 有调用点 ≠ 页面有权限门：\`admin-web\` 的页面门由 \`meta.roles\` 决定，
   **接线（\`requirePermission\`）留给后续批次**，本批只立码。

## 二、汇总读数

- 有前端调用点的码：**${withCallSites} / 38**
- 暂无前端入口（仅后端授权位）：**${38 - withCallSites} / 38**

## 三、逐码登记表

| # | 域 | 码 | 端点 | 前端入口判定 |
|--:|:--|:--|:--|:--|
${rows
  .map(
    (r, i) =>
      `| ${i + 1} | ${r.domain} | \`${r.code}\` | ${r.endpoints.map((e) => `\`${e}\``).join("<br>")} | ${r.verdict} |`,
  )
  .join("\n")}

## 四、复跑命令（任何人可自行核对）

\`\`\`bash
node docs/evidence/S3-236/harness/scan-frontend-entries.mjs            # 逐码命中（+ 落盘 JSON）
node docs/evidence/S3-236/harness/scan-frontend-entries.mjs --debug    # 附命中源码行原文
node docs/evidence/S3-236/harness/gen-frontend-entry-registry.mjs      # 重新生成本表
\`\`\`
`;

fs.writeFileSync(
  path.join(repoRoot, "docs/evidence/S3-236/frontend-entry-registry.md"),
  md,
  "utf-8",
);
console.log(`已写入 docs/evidence/S3-236/frontend-entry-registry.md（${rows.length} 码；有调用点 ${withCallSites}）`);
