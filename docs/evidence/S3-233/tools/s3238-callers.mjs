#!/usr/bin/env node
/**
 * S3-233 · 门端点「调用面」取证器（只读）
 *
 * 用途：为 §二.6「零回归论证」提供可复跑证据 —— 每个待接线端点在全仓的**页面调用点**
 *   （app-mobile / admin-web / saas-admin / miniapp / e2e / backend 用例）分别是谁，
 *   用于核对「接线后不会把某个仍在用该端点的角色打成 403」。
 *
 * 判据口径：以**端点 URL 字面量**为检索键（与 S3-224 的 B 类判定口径一致：
 *   端点 → 直接调用点，不看封装文件）——即同时列出「封装层（api/modules/*.ts）」与「页面层（*.vue/*.ts）」命中。
 *
 * 用法：node docs/evidence/S3-233/tools/s3238-callers.mjs > docs/evidence/S3-233/raw/10-callers.txt
 */
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

const SEARCH_DIRS = ["app-mobile/src", "admin-web/src", "saas-admin/src", "miniapp", "backend/src"];

function rg(pattern) {
  try {
    const out = execFileSync(
      "rg",
      ["-n", "--no-heading", "--color=never", "-F", pattern, ...SEARCH_DIRS],
      { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

// 端点路径的静态部分（去掉参数占位与 query）：用于字面量检索
function staticPath(p) {
  const segs = p.split("/").filter((s) => s && !s.startsWith(":"));
  return segs.length ? `/${segs.slice(0, Math.max(1, segs.length)).join("/")}` : p;
}

for (const g of scope) {
  if (g.status !== "gated") continue;
  console.log(`\n===== [${g.id}] ${g.domain} · 门码=${JSON.stringify(g.codes)}`);
  for (const e of g.endpoints) {
    const [method, path] = e.endpoint.split(" ");
    const probe = staticPath(path);
    const hits = rg(probe);
    console.log(`\n-- ${method} ${path}`);
    console.log(`   file=${e.file} wired=${e.hasPermission} 探针=${probe}`);
    if (!hits.length) {
      console.log("   （全仓无调用点字面量命中）");
      continue;
    }
    for (const h of hits.slice(0, 12)) console.log(`   ${h}`);
    if (hits.length > 12) console.log(`   … 另 ${hits.length - 12} 条`);
  }
}
