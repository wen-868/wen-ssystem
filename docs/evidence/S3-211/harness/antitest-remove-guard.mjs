/**
 * S3-211 证据装置 · **反测矩阵**（对应派单卡 §二.3「去掉 `startsWith` 校验 ⇒ 必须能穿越」）。
 *
 * 做法：不改最终产物——在工作树上**机械地**注入变体，跑承重性探针
 * （`backend/src/__tests__/security/path-sanitize-rootfix-s3-211.test.ts` 的 "S3-211 ②" 组），
 * 记录每个探针的红/绿，然后把文件按字节还原并**校验 SHA256 与原值一致**（不一致直接非零退出）。
 *
 * 变体：
 *   M0 基线            —— 修复后的最终形态
 *   M1 只摘 startsWith —— 四个落点各自 `if (!x.startsWith(...))` ⇒ `if (false)`
 *   M2 摘校验 + 摘前置净化 —— 再把 `safeSegment(...)`/`safeName(...)` 换成原值
 *   M3 只摘前置净化     —— 校验留着，喂原始分隔符段
 *
 * 期望（= 校验是否"承重"的判据）：
 *   M1：头像/商品主图 **红**（该段没有前置净化，校验是唯一防线）；密钥/代码包绿（前置净化还在拦）
 *   M2：四个全 **红**（校验 + 前置净化一起摘掉后，载荷真的穿越到根目录外）
 *   M3：四个全绿（只留校验时，原始穿越段被拒或被压回根目录内）
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../.."); // wt-agents/S3-211
const backend = path.join(repo, "backend");
const TEST_REL = "src/__tests__/security/path-sanitize-rootfix-s3-211.test.ts";

/** 站点：告警文件 → 校验片段 / 前置净化片段 / 对应探针 */
const SITES = [
  {
    file: "backend/src/controllers/admin/avatar.controller.ts",
    guards: [["if (!target.startsWith(avatarBaseDir + path.sep)) {", "if (false) {"]],
    sanitizers: [],
    probes: ["头像：tenantId 携带分隔符"],
  },
  {
    file: "backend/src/controllers/admin/product-image.controller.ts",
    guards: [["if (!target.startsWith(imageBaseDir + path.sep)) {", "if (false) {"]],
    sanitizers: [],
    probes: ["商品主图：tenantId 携带分隔符"],
  },
  {
    file: "backend/src/services/admin/miniapp-upload.service.ts",
    guards: [
      ["if (!keyPath.startsWith(keyDir + path.sep)) {", "if (false) {"],
      ["if (!metaPath.startsWith(keyDir + path.sep)) {", "if (false) {"],
    ],
    sanitizers: [
      ["safeSegment(tenantId)", '(tenantId || "WECHAT")'],
      ["safeSegment(platform)", '(platform || "WECHAT")'],
    ],
    probes: ["密钥：分隔符段"],
  },
  {
    file: "backend/src/services/admin/miniapp-package.service.ts",
    guards: [["if (!zipPath.startsWith(storageDir + path.sep)) {", "if (false) {"]],
    sanitizers: [["safeName(tenantId)", '(tenantId || "")']],
    probes: ["代码包：tenantId 携带分隔符"],
  },
];

const ALL_PROBES = SITES.flatMap((site) => site.probes);

function sha256(abs) {
  return createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

/** 只清理本单探针产物（前缀固定，避免误删） */
function cleanProbeArtifacts() {
  const storage = path.join(backend, "storage");
  const packages = path.join(storage, "miniapp-packages");
  for (const dir of [storage, packages]) {
    if (!fs.existsSync(dir)) continue;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.startsWith("s3-211-evil") || ent.name.startsWith("s3-211-escaped") || ent.name === "miniapp-a-..") {
        fs.rmSync(path.join(dir, ent.name), { recursive: true, force: true });
      }
    }
  }
  const tmp = process.env.TEMP || process.env.TMP || "/tmp";
  if (fs.existsSync(tmp)) {
    for (const ent of fs.readdirSync(tmp, { withFileTypes: true })) {
      if (ent.isFile() && (ent.name.startsWith("s3-211-escaped") || ent.name.startsWith("s3-211-evil"))) {
        fs.rmSync(path.join(tmp, ent.name), { force: true });
      }
    }
  }
}

function applyVariant({ guardOff, sanitizerOff }) {
  const touched = [];
  for (const site of SITES) {
    const abs = path.join(repo, site.file);
    const original = fs.readFileSync(abs, "utf8");
    let next = original;
    if (guardOff) {
      for (const [needle, replacement] of site.guards) {
        if (!next.includes(needle)) throw new Error(`校验片段未找到（判据与代码不同步）：${site.file} :: ${needle}`);
        next = next.split(needle).join(replacement);
      }
    }
    if (sanitizerOff) {
      for (const [needle, replacement] of site.sanitizers) {
        if (!next.includes(needle)) throw new Error(`净化片段未找到（判据与代码不同步）：${site.file} :: ${needle}`);
        next = next.split(needle).join(replacement);
      }
    }
    if (next !== original) {
      fs.writeFileSync(abs, next, "utf8");
      touched.push(site);
    }
  }
  return touched;
}

function restoreAll(backups) {
  const mismatched = [];
  for (const [file, { abs, bytes, hash }] of backups) {
    fs.writeFileSync(abs, bytes);
    if (sha256(abs) !== hash) mismatched.push(file);
  }
  if (mismatched.length > 0) {
    throw new Error(`还原失败，SHA256 不一致：${mismatched.join(", ")}（请立即人工恢复）`);
  }
}

function runProbes(label) {
  const jsonOut = path.join(here, `.tmp-probe-${label}.json`);
  const args = [path.join(repo, "node_modules", "vitest", "vitest.mjs"), "run", TEST_REL, "--reporter=json", `--outputFile=${jsonOut}`];
  let exitCode = 0;
  try {
    execFileSync(process.execPath, args, { cwd: backend, encoding: "utf8", stdio: "pipe" });
  } catch (err) {
    exitCode = err.status ?? 1;
  }
  const raw = fs.readFileSync(jsonOut, "utf8");
  fs.rmSync(jsonOut, { force: true });
  const parsed = JSON.parse(raw);
  const results = new Map();
  const otherFailures = [];
  for (const file of parsed.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      const name = assertion.fullName ?? assertion.title ?? "";
      const isProbe = name.includes("承重性");
      if (assertion.status === "failed" && !isProbe) otherFailures.push(name);
      for (const probe of ALL_PROBES) {
        if (isProbe && name.includes(probe)) {
          results.set(probe, { status: assertion.status, failures: (assertion.failureMessages ?? []).join(" ").slice(0, 300) });
        }
      }
    }
  }
  return { exitCode, results, otherFailures };
}

const backups = new Map();
for (const site of SITES) {
  const abs = path.join(repo, site.file);
  backups.set(site.file, { abs, bytes: fs.readFileSync(abs), hash: sha256(abs) });
}
console.log("[S3-211 反测] 备份完成（SHA256 已记录）：");
for (const [file, { hash }] of backups) console.log(`  ${hash.slice(0, 16)}  ${file}`);

const VARIANTS = [
  { label: "M0", desc: "基线（修复后最终形态）", guardOff: false, sanitizerOff: false },
  { label: "M1", desc: "只摘 startsWith 校验", guardOff: true, sanitizerOff: false },
  { label: "M2", desc: "摘校验 + 摘前置净化", guardOff: true, sanitizerOff: true },
  { label: "M3", desc: "只摘前置净化（校验留着）", guardOff: false, sanitizerOff: true },
];

const matrix = [];
try {
  for (const variant of VARIANTS) {
    restoreAll(backups);
    const touched = applyVariant(variant);
    console.log(`\n[S3-211 反测] ${variant.label} · ${variant.desc}（改动文件 ${touched.length} 个）`);
    const { exitCode, results, otherFailures } = runProbes(variant.label);
    const row = { label: variant.label, desc: variant.desc, exitCode, cells: {}, otherFailures };
    for (const probe of ALL_PROBES) {
      const hit = results.get(probe);
      row.cells[probe] = hit ? hit.status : "missing";
      if (hit?.status === "failed") console.log(`  RED  ${probe} :: ${hit.failures.replace(/\s+/g, " ").slice(0, 160)}`);
    }
    console.log(`  vitest EXIT=${exitCode}；探针状态：${ALL_PROBES.map((p) => `${p.split("：")[0]}=${row.cells[p]}`).join(" / ")}`);
    if (otherFailures.length > 0) {
      console.log(`  非探针组（①行为对照）失败 ${otherFailures.length} 条（变体把"前置净化"摘掉了 ⇒ 属于预期，见矩阵脚注）：`);
      for (const name of otherFailures) console.log(`    - ${name}`);
    }
    matrix.push(row);
  }
} finally {
  restoreAll(backups);
  cleanProbeArtifacts();
  console.log("\n[S3-211 反测] 已按字节还原并清理探针产物。");
  for (const [file, { abs, hash }] of backups) {
    const now = sha256(abs);
    console.log(`  ${now === hash ? "OK  " : "FAIL"} ${hash.slice(0, 16)} == ${now.slice(0, 16)}  ${file}`);
  }
}

console.log("\n[S3-211 反测] 矩阵（探针 = 承重性用例）：");
console.log(`| 变体 | 说明 | ${ALL_PROBES.map((p) => p.split("：")[0]).join(" | ")} |`);
console.log(`|:--|:--|${ALL_PROBES.map(() => ":--:").join("|")}|`);
for (const row of matrix) {
  console.log(`| ${row.label} | ${row.desc} | ${ALL_PROBES.map((p) => (row.cells[p] === "failed" ? "**红**" : row.cells[p] === "passed" ? "绿" : "缺失")).join(" | ")} |`);
}
console.log(
  `\n[S3-211 反测] 脚注：M3 会同时让「① 行为对照」组变红（前置净化被摘掉 ⇒ 落盘名与改造前不再一致），` +
    `那是变体本身破坏了"行为不变"，**不是**校验失效；判据只看 ② 组探针。`
);

const m1 = matrix.find((r) => r.label === "M1");
const m2 = matrix.find((r) => r.label === "M2");
const expected = {
  M1: ["头像：tenantId 携带分隔符", "商品主图：tenantId 携带分隔符"],
};
const m1ok =
  expected.M1.every((p) => m1.cells[p] === "failed") &&
  ALL_PROBES.filter((p) => !expected.M1.includes(p)).every((p) => m1.cells[p] === "passed");
const m2ok = ALL_PROBES.every((p) => m2.cells[p] === "failed");
console.log(`\n[S3-211 反测] 判据：M1 ${m1ok ? "PASS" : "FAIL"}（该红的红、该绿的绿）、M2 ${m2ok ? "PASS" : "FAIL"}（全红 = 校验与前置净化一起摘掉后确实穿越）`);
process.exit(m1ok && m2ok ? 0 : 1);
