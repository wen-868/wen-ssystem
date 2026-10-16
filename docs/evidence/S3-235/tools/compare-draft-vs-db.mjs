#!/usr/bin/env node
/**
 * S3-235 证据装置：把「生产底稿 §一」与「跑完迁移链的库」逐角色对比，输出差异表
 *
 * 为什么要它（诚实性要求）：卡面 R2 要求"12 个角色的 permissions 与底稿逐条一致"，
 * 而 205 的非破坏语义（非空行一个字节都不改）意味着：**由既有迁移先落地的角色不会被动过**。
 * 因此必须把"哪些角色与底稿不同、差在哪、为什么会差"逐条列出来交给凌舟裁定，不能只报"12/12 非空"。
 *
 * 用法（仓库根执行）：
 *   DB_HOST=127.0.0.1 DB_PORT=3421 DB_USER=root DB_NAME=liq235_green \
 *     node docs/evidence/S3-235/tools/compare-draft-vs-db.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(resolve(process.cwd(), "package.json"));
const mysql = require("mysql2/promise");

const draftText = readFileSync(resolve(process.cwd(), "docs/evidence/_shared/prod-roles-20261016.txt"), "utf-8");
const start = draftText.indexOf("## 一、");
const fenceStart = draftText.indexOf("```", start);
const fenceEnd = draftText.indexOf("```", fenceStart + 3);
const draft = new Map();
for (const raw of draftText.slice(fenceStart + 3, fenceEnd).split("\n")) {
  const line = raw.trim();
  if (!line) continue;
  const [code, name, json] = line.split("\t").map((s) => s.trim());
  draft.set(code, { name, codes: JSON.parse(json) });
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3421),
  user: process.env.DB_USER ?? "root",
  database: process.env.DB_NAME ?? "liq235_green",
});

try {
  const [rows] = await conn.query(
    "SELECT role_code, role_name, permissions FROM t_sys_role WHERE tenant_id='default'"
  );
  const db = new Map(rows.map((r) => [r.role_code, r]));
  console.log("role_code\t底稿码数\t库中码数\t完全一致\t差集（库中多出）\t差集（库里少）\t角色行是否存在");
  for (const [code, d] of [...draft.entries()].sort()) {
    const row = db.get(code);
    // mysql2 对 JSON 列会自动反序列化（返回数组）；老库/文本列则返回字符串 ⇒ 两种都要吃
    const rawPermissions = row?.permissions ?? null;
    let dbCodes = [];
    if (Array.isArray(rawPermissions)) dbCodes = rawPermissions;
    else if (typeof rawPermissions === "string" && rawPermissions) {
      try {
        const parsed = JSON.parse(rawPermissions);
        dbCodes = Array.isArray(parsed) ? parsed : [];
      } catch {
        dbCodes = []; // 非法 JSON（历史上确实存在这种行）：按"空"处理并在差异列里体现为"库里少"
      }
    }
    const extra = dbCodes.filter((c) => !d.codes.includes(c));
    const missing = d.codes.filter((c) => !dbCodes.includes(c));
    console.log(
      [
        code,
        d.codes.length,
        dbCodes.length,
        extra.length === 0 && missing.length === 0 ? "是" : "否",
        extra.join(" ") || "-",
        missing.join(" ") || "-",
        row ? "有" : "**缺**",
      ].join("\t")
    );
  }
} finally {
  await conn.end();
}
