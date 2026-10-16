#!/usr/bin/env node
/**
 * S3-227 与 main 合并的冲突解法 · 第 1 步（凌舟 2026-10-16）
 *
 * 冲突三处：
 *  1) rbac-wiring-baseline.json：`_counts` 块两侧各写各的（ours=460 基线，theirs=main 404 基线）
 *     ⇒ 本步先取 **theirs（main）** 作为工作版（保持 JSON 合法），第 2 步再由门禁重算。
 *  2) rbac-g0-wiring.test.ts：ours = S3-227 的"和式 + 台账一致性 + 自洽"（**无裸数字**）；
 *     theirs = main 版（和式 + 裸数字 291）
 *     ⇒ 取 **ours**（保留"无裸数字"这一本单成果），并把 ours 的和式**补上 `S3_226_WIRED_TOTAL`**。
 *  3) 缺口清单：theirs（main 的 §十五/§十六）在前，ours（`## 附·S3-227`）在后。
 */
const { execFileSync } = require("child_process");
const fs = require("fs");

const CONFLICT = /<<<<<<< HEAD\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> origin\/main\r?\n/g;
const show = (rev, rel) => execFileSync("git", ["show", `${rev}:${rel}`], { maxBuffer: 1e8 }).toString();

// ── 1) baseline：先用 theirs（main）───────────────────────────────────────────
{
  const rel = "backend/scripts/rbac-wiring-baseline.json";
  const theirs = show("MERGE_HEAD", rel);
  if (theirs.includes("<<<<<<<")) throw new Error("theirs baseline has markers");
  fs.writeFileSync(rel, theirs);
  console.log("baseline step1: 取 main 版（第 2 步由门禁重算 _counts 与陈旧项）");
}

// ── 2) g0 用例：取 ours + 补 S3_226 常量到和式 ───────────────────────────────
{
  const rel = "backend/src/__tests__/routes/rbac-g0-wiring.test.ts";
  let s = fs.readFileSync(rel, "utf8");
  const hunks = [];
  s = s.replace(CONFLICT, (m, o, t) => {
    hunks.push({ o, t });
    return `@@STEP1_${hunks.length - 1}@@\n`;
  });
  if (hunks.length !== 1) throw new Error("g0 hunks=" + hunks.length);
  const ours = hunks[0].o;
  const first = ours.split(/\r?\n/)[0];
  if (!first.includes("expect(total).toBe(G0_TOTAL")) throw new Error("g0 first line unexpected");
  if (!first.includes("+ S3_225_WIRED_TOTAL);")) throw new Error("g0 sum unexpected (expect ...S3_225_WIRED_TOTAL);)");
  const patched = ours.replace("+ S3_225_WIRED_TOTAL);", "+ S3_225_WIRED_TOTAL + S3_226_WIRED_TOTAL);");
  if (patched === ours) throw new Error("g0 sum not patched");
  s = s.replace("@@STEP1_0@@", patched);
  if (s.includes("<<<<<<<")) throw new Error("g0 markers left");
  fs.writeFileSync(rel, s);
  console.log("g0 step1: 取 ours（无裸数字）+ 和式补 S3_226_WIRED_TOTAL");
}

// ── 3) 缺口清单：theirs 在前 + ours 在后 ─────────────────────────────────────
{
  const rel = "docs/tasks/R101-RBAC接线缺口清单.md";
  let s = fs.readFileSync(rel, "utf8");
  s = s.replace(CONFLICT, (m, ours, theirs) => theirs.replace(/\s*$/, "") + "\n\n" + ours.replace(/^\s*\n/, ""));
  if (s.includes("<<<<<<<")) throw new Error("ledger markers left");
  fs.writeFileSync(rel, s);
  console.log("ledger step1: main 的两节在前 + 附·S3-227 在后");
}
