#!/usr/bin/env node
/**
 * G37 门禁 · guard:utf8-encoding（S3-200，收口总清单第 61 项）
 *
 * 防的是什么（根因）：本仓历史上发生过**编码事故**——源码里的中文注释被
 *   "非法字节 ⇒ 容错替换（U+FFFD）⇒ 写回" 之后，文件本身变成**合法 UTF-8**，
 *   于是 `git`/`node`/编辑器**全都不报错**，只有人眼看到乱码才可能发现。
 *   实测（S3-200 开工前）：`backend/src/**` 残留 **6 个文件 65 处 U+FFFD**，
 *   自 2026-07-13 `b33ffaaf` 起躺了 3 个月无人发现 —— 因为**没有任何机械判据**。
 *   与踩坑 [63]「注释开头的语句被 runner 丢弃」同形：**静默损坏 + 无判据 = 长期存续**。
 *
 * 判据（两条，各自可单独判红）：
 *   ① **非法字节**：按 `TextDecoder("utf-8", { fatal: true })` 严格解码，抛异常即红
 *      （覆盖 S3-177/S3-191 那一类"工具读不了"的 GBK 混编）；
 *   ② **U+FFFD 残留**：严格解码虽通过，但文本里含 U+FFFD ⇒ 内容已残缺（数据已丢，不可自恢复），
 *      必须先从 git 历史/同款完好文件找回原文再还原（S3-200 已按此口径还原 65 处）。
 *
 * ⚠️ 已知边界（写在明处，不藏着）：
 *   · 本脚本是**静态源码扫描**，只覆盖 `--dirs` 指定的目录（默认见 DEFAULT_ROOTS），
 *     不是全仓全类型；非源码后缀（图片/二进制）不检。
 *   · 判据②对"测试夹具里故意塞 U+FFFD"会误报。当前全仓实测 0 处此类内容；
 *     若将来确需，应在本脚本加**具名白名单**（写明理由），不得整体关检。
 *   · 本脚本**未接 CI**：`.github/**` 属本次派单红线（不得改），接线与否待凌舟裁定。
 *
 * 用法：
 *   node backend/scripts/guard-utf8-encoding.mjs                    # 人类可读，退出码 0=绿 / 1=红
 *   node backend/scripts/guard-utf8-encoding.mjs --json             # 机读 JSON（仍按退出码判红绿）
 *   node backend/scripts/guard-utf8-encoding.mjs --dirs=a,b         # 只扫指定目录（仓库根相对路径）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const dirsArg = argv.find((a) => a.startsWith("--dirs="));

const DEFAULT_ROOTS = [
  "backend/src",
  "admin-web/src",
  "saas-admin/src",
  "app-mobile/src",
  "miniapp/src",
  "platform-miniapp/src",
  "website/src",
  "scripts",
  "e2e",
];
const roots = (dirsArg ? dirsArg.slice("--dirs=".length).split(",") : DEFAULT_ROOTS)
  .map((s) => s.trim())
  .filter(Boolean);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".vite",
  "test-results",
  "storage",
  "logs",
  "archive",
]);
const EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".json",
  ".css",
  ".scss",
  ".less",
  ".html",
  ".sql",
]);

const fatalDecoder = new TextDecoder("utf-8", { fatal: true });
const illegal = [];
const residue = [];
const scannedRoots = [];
let scannedFiles = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(p);
      continue;
    }
    if (!entry.isFile() || !EXTS.has(path.extname(entry.name).toLowerCase())) continue;
    const rel = path.relative(repoRoot, p).split(path.sep).join("/");
    const buf = fs.readFileSync(p);
    scannedFiles++;
    let text;
    try {
      text = fatalDecoder.decode(buf);
    } catch {
      illegal.push({ file: rel, reason: "严格 UTF-8 解码失败（含非法字节）" });
      continue;
    }
    const hits = [];
    text.split("\n").forEach((line, i) => {
      if (line.includes("\uFFFD")) {
        hits.push({ line: i + 1, text: line.replace(/\uFFFD/g, "<U+FFFD>").trim() });
      }
    });
    if (hits.length) {
      const count = [...text].filter((c) => c === "\uFFFD").length;
      residue.push({ file: rel, count, lines: hits });
    }
  }
}

for (const root of roots) {
  const abs = path.join(repoRoot, root);
  if (!fs.existsSync(abs)) continue;
  scannedRoots.push(root);
  walk(abs);
}

const ok = illegal.length === 0 && residue.length === 0;
const total = residue.reduce((s, r) => s + r.count, 0);

if (asJson) {
  console.log(JSON.stringify({ ok, scannedRoots, scannedFiles, illegal, residue, totalResidue: total }, null, 2));
} else {
  console.log(`[guard:utf8-encoding] 扫描目录 ${scannedRoots.length} 个 / 文件 ${scannedFiles} 个`);
  if (illegal.length) {
    console.log(`✗ 非法字节 ${illegal.length} 个文件：`);
    for (const h of illegal) console.log(`   - ${h.file}：${h.reason}`);
  }
  if (residue.length) {
    console.log(`✗ U+FFFD 残留 ${residue.length} 个文件 / 共 ${total} 处：`);
    for (const h of residue) {
      console.log(`   - ${h.file}（${h.count} 处）`);
      for (const l of h.lines) console.log(`       ${h.file}:${l.line}: ${l.text}`);
    }
  }
  console.log(
    ok
      ? "[guard:utf8-encoding] PASS（0 个非法字节、0 处 U+FFFD 残留）"
      : `[guard:utf8-encoding] FAIL（非法字节文件 ${illegal.length} / U+FFFD ${total} 处）`,
  );
}

process.exit(ok ? 0 : 1);
