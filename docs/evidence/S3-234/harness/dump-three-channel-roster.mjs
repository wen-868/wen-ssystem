#!/usr/bin/env node
/**
 * S3-234 R1 证据装置：把 `docs/migrations/*.sql` **逐条**落到三条通道上，输出「三分类花名册」。
 *
 * 为什么单独一个装置：R1 卡面要求回传里给"三个数字 + **逐条文件表**"（只给汇总数不算）。
 * 逐条表若手抄必然出错，故由本装置从**真件**（活动段/豁免段 = `deploy/migrations-manifest.txt`，
 * 登记册 = `deploy/migrations-nonidempotent-registry.txt`）现算现打，并**当场断言守恒**
 * （A + B + C 必须等于目录内 .sql 总数；任一条不在三通道里立即以退出码 2 报错）。
 *
 * 用法（仓库根执行）：
 *   node docs/evidence/S3-234/harness/dump-three-channel-roster.mjs            # 打印花名册
 *   node docs/evidence/S3-234/harness/dump-three-channel-roster.mjs > docs/evidence/S3-234/raw/75-three-channel-roster.txt
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const migDir = path.join(repoRoot, "docs/migrations");
const manifestRel = "deploy/migrations-manifest.txt";
const registryRel = "deploy/migrations-nonidempotent-registry.txt";
const RUNTIME_EXCLUDED = new Set(["add_tenant_id.sql"]);
const EXEMPT_RE = /^#\s*EXEMPT\s*[:：]\s*(\S+?\.sql)/;

const readLines = (rel) =>
  fs.existsSync(path.join(repoRoot, rel))
    ? fs.readFileSync(path.join(repoRoot, rel), "utf-8").split(/\r?\n/)
    : [];

const active = [];
const exempt = [];
for (const raw of readLines(manifestRel)) {
  const line = raw.trim();
  if (!line) continue;
  if (line.startsWith("#")) {
    const m = line.match(EXEMPT_RE);
    if (m) exempt.push(m[1]);
    continue;
  }
  active.push(line);
}
const registry = [];
for (const raw of readLines(registryRel)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const cells = line.split("|").map((c) => c.trim());
  if (cells[0]) registry.push(cells[0]);
}

const all = fs
  .readdirSync(migDir)
  .filter((f) => f.endsWith(".sql") && !RUNTIME_EXCLUDED.has(f))
  .sort();

const channelOf = new Map();
for (const f of active) channelOf.set(f, "A 活动段（部署通道会跑）");
for (const f of registry) channelOf.set(f, "B 登记册（部署通道不跑；失败按「已知非幂等」放行但打印）");
for (const f of exempt) channelOf.set(f, "C 豁免段（部署通道不跑；仅新库初始化通道执行）");

const unregistered = all.filter((f) => !channelOf.has(f));
const sum = active.length + registry.length + exempt.length;

console.log(`# 三分类花名册（S3-234 R1）｜生成：node docs/evidence/S3-234/harness/dump-three-channel-roster.mjs`);
console.log(`# 真件：${manifestRel}（A/C）+ ${registryRel}（B）｜目录：${migDir}`);
console.log(`# 计数：A 活动段 ${active.length} / B 登记册 ${registry.length} / C 豁免段 ${exempt.length} ｜ 合计 ${sum} ｜ 目录 .sql ${all.length}`);
console.log(`# 守恒：${active.length} + ${registry.length} + ${exempt.length} = ${sum}${sum === all.length ? " == " : " != "}${all.length}（${sum === all.length ? "成立" : "**不成立**"}）`);
console.log("");
console.log("# 序号\t文件\t通道");
all.forEach((f, i) => {
  console.log(`${i + 1}\t${f}\t${channelOf.get(f) ?? "未登记（异常）"}`);
});
console.log("");
console.log(`# 汇总：A=${active.length}｜B=${registry.length}｜C=${exempt.length}｜合计=${sum}｜目录=${all.length}｜未登记=${unregistered.length}`);

if (unregistered.length > 0 || sum !== all.length) {
  console.error(`✗ 守恒不成立：未登记 ${unregistered.length} 条：${unregistered.join("、")}`);
  process.exit(2);
}
