#!/usr/bin/env node
/**
 * S3-226 收尾自检 · 末行换行一致性
 *
 * 目的：本单要「只改有问题的地方」。部分营销域路由文件在 HEAD 上**末行无换行**，
 * 若编辑后补上了换行，就会在 `git diff` 里多出 1 行 `\ No newline at end of file` 噪声。
 * 本脚本逐文件比对「HEAD 末行换行状态 vs 工作区末行换行状态」，只列出**不一致**的文件（可加 --fix 修正）。
 *
 * 用法：
 *   node docs/evidence/S3-226/tools/check-final-newline.mjs          # 仅报告
 *   node docs/evidence/S3-226/tools/check-final-newline.mjs --fix    # 把工作区末行状态改回与 HEAD 一致
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const FIX = process.argv.includes("--fix");
const files = execFileSync("git", ["diff", "--name-only"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);

let mismatched = 0;
for (const f of files) {
  let head;
  try {
    head = execFileSync("git", ["show", `HEAD:${f}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    console.log(`NEW  ${f}（HEAD 无此文件，跳过）`);
    continue;
  }
  const cur = readFileSync(f, "utf8");
  const headHasNl = /[\r\n]$/.test(head);
  const curHasNl = /[\r\n]$/.test(cur);
  if (headHasNl === curHasNl) continue;
  mismatched++;
  console.log(`DIFF ${f}：HEAD ${headHasNl ? "有" : "无"}末行换行 ／ 工作区 ${curHasNl ? "有" : "无"}`);
  if (FIX) {
    const fixed = curHasNl ? cur.replace(/[\r\n]+$/, "") : `${cur}\r\n`;
    writeFileSync(f, fixed, "utf8");
    console.log(`     已修正 ⇒ ${f}`);
  }
}
console.log(mismatched === 0 ? "✅ 末行换行状态与 HEAD 全部一致" : `⚠️ 不一致 ${mismatched} 个文件${FIX ? "（已修正）" : "（可加 --fix）"}`);
