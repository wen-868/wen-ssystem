#!/usr/bin/env node
/**
 * S3-233 · 生成「本单已接线且仍在机读台账 gaps 里的端点」映射（只读输出，不写任何文件）
 *
 * 用途：给 `docs/evidence/S3-233/tools/update-baseline.mjs` 的移除名单提供**可复算**来源
 *   （避免手抄 57 条端点路径出错）。判据 = 门端点 ∩ 机读台账 gaps ∩ 扫描 `hasPermission=true`。
 *
 * 用法：node docs/evidence/S3-233/tools/s3238-wired-map.mjs
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..", "..");

const scope = JSON.parse(
  execFileSync(process.execPath, [resolve(HERE, "s3238-gate-scope.mjs"), "--json"], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
);
const baseline = JSON.parse(readFileSync(resolve(REPO, "backend/scripts/rbac-wiring-baseline.json"), "utf8"));

const inGaps = new Set();
for (const [file, list] of Object.entries(baseline.gaps)) for (const p of list) inGaps.add(`${file}|${p}`);

const map = new Map();
let n = 0;
for (const g of scope) {
  if (g.status !== "gated") continue;
  for (const e of g.endpoints) {
    if (!e.hasPermission) continue;
    if (!inGaps.has(`${e.file}|${e.endpoint}`)) continue;
    if (!map.has(e.file)) map.set(e.file, []);
    if (!map.get(e.file).includes(e.endpoint)) {
      map.get(e.file).push(e.endpoint);
      n++;
    }
  }
}

const sorted = Object.fromEntries([...map.entries()].sort());
console.log(JSON.stringify({ count: n, byFile: sorted }, null, 2));
