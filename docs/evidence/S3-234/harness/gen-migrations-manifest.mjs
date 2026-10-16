#!/usr/bin/env node
/**
 * S3-234 证据装置 / 生成器：由 `docs/migrations/` 生成 `deploy/migrations-manifest.txt`。
 *
 * 为什么用生成器（禁止手抄）：
 *   清单是「部署必须执行的迁移」的唯一真相源，204 行手写必然错行、错序；而 guard 的判据④
 *   要求**活动段行序 == 运行时跑序**（`migration.ts` 第 8 步 readdirSync().filter().sort()），
 *   人工维护不可能可靠。生成器把"顺序"这一项交给机器，人只负责"哪些要豁免 + 理由"。
 *
 * 豁免的唯一机械判据（本单只用这一条）：
 *   文件里出现**行首无守卫的破坏性语句**（`DROP TABLE` / `TRUNCATE` / `DELETE FROM` / `DROP DATABASE`）
 *   ⇒ 进豁免段。理由：部署通道（`run-migration.mjs` 整文件下发）在**生产库**上执行 DROP TABLE
 *   是**真删数据**（本机夹具实测：跑完一遍，`t_product_spu` 上的 FK/索引/tenant_id 全没了 —— 见
 *   `docs/evidence/S3-234/raw/30-deploy-section-pass1.txt` 与 `31-069-two-pass-branches.txt` 用例 C）。
 *   ⚠️ 生成器**不**凭"跑失败"来豁免：那会把"历史语料必然失败"也一起洗掉，属于为转绿而降级检查。
 *   失败的那些文件照旧留在活动段，由部署日志点名（见回传卡「未完成与阻塞 / 风险」）。
 *
 * 用法（仓库根执行）：
 *   node docs/evidence/S3-234/harness/gen-migrations-manifest.mjs            # 写入
 *   node docs/evidence/S3-234/harness/gen-migrations-manifest.mjs --check     # 只比对，不写（guard 之外的自检）
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const migDir = path.join(repoRoot, "docs/migrations");
const manifestRel = "deploy/migrations-manifest.txt";
const manifestAbs = path.join(repoRoot, manifestRel);

const RUNTIME_EXCLUDED = new Set(["add_tenant_id.sql"]);
/** 行首即破坏性语句（不区分大小写）；本单的豁免判据就是这一条 */
const DESTRUCTIVE_RE = /^[ \t]*(DROP\s+TABLE|TRUNCATE|DELETE\s+FROM|DROP\s+DATABASE)\b/i;

const files = fs
  .readdirSync(migDir)
  .filter((f) => f.endsWith(".sql") && !RUNTIME_EXCLUDED.has(f))
  .sort();

const exempt = [];
const active = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(migDir, f), "utf-8");
  const hits = text
    .split(/\r?\n/)
    .map((line, i) => ({ line: line.trim(), no: i + 1 }))
    .filter((x) => DESTRUCTIVE_RE.test(x.line));
  if (hits.length > 0) {
    exempt.push({ file: f, hits });
  } else {
    active.push(f);
  }
}

const HEADER = `# deploy/migrations-manifest.txt —— 「部署必须执行的迁移」唯一真相源
# 归属：S3-234（收口总清单第 74 项：部署迁移段硬编码 3 条 ⇒ 新迁移永不随部署执行）
# 生成：docs/evidence/S3-234/harness/gen-migrations-manifest.mjs（**禁止手抄**，204 行手写必错行错序）
#
# 为什么有这份清单（根因）：
#   \`deploy/auto-deploy.sh\` 的迁移段原先**硬编码 3 条**文件名（126 / 127 / 196）⇒ 之后新增的每一个
#   迁移都不会随部署执行，只能靠人工补跑。实证（2026-10-16）：main 合入 \`204_系统设置域权限点立码.sql\`
#   后部署，日志里只跑了那 3 个文件；生产只读复核「店长权限串仍 9 项、14 个新菜单码 0 行」⇒ 改了不生效。
#   本清单把「部署要跑哪些迁移」变成**可审、可守**的一条出口。
#
# 格式（由 \`backend/scripts/guard-migration-manifest.mjs\` 强制，四条判据见该脚本头部注释）：
#   · 活动行 = \`docs/migrations/\` 下的**裸文件名**；**行序即部署跑序**，必须等于运行时迁移段跑序。
#   · 豁免行 = 以 \`#\` 开头、以 EXEMPT 为第一个词的行（必须「具名 + 非空理由」）。
#   · 其余 \`#\` 行是普通注释；空行忽略。
#
# 当前状态（2026-10-16，S3-234 交付时）：\`docs/migrations/\` 下 204 个 .sql ⇒ 活动段 ${active.length} 个 / 豁免段 ${exempt.length} 个。
#
# 维护方式（新增迁移时）：
#   ① 跑一次生成器（或手工把文件名追加到活动段**末尾**）；
#   ② 跑 \`node backend/scripts/guard-migration-manifest.mjs\`，必须 EXIT=0；
#   ③ 若不该随部署跑，必须有具名豁免 + 理由，并在回传里报备凌舟（豁免 = 有意留缺口，不是"忘了"）。
#
# ⚠️ 以下为活动段：部署段按**行序**逐个文件执行 \`node scripts/run-migration.mjs <file>\`。
`;

const EXEMPT_HEADER = `
# ⚠️ 以下为豁免段（**有意不随部署执行**，每条必须具名 + 写明理由）。
#   唯一机械判据：文件内出现行首的破坏性语句（DROP TABLE / TRUNCATE / DELETE FROM / DROP DATABASE）
#   ⇒ 部署通道在生产库上执行它就是**真删数据**。豁免不等于"这文件不重要"：
#   它是**结构性重建/初始化脚本**，语义由"空库建库 + 启动期迁移通道"负责，不是"随每次部署重放"。
`;

const out =
  HEADER +
  active.join("\n") +
  "\n" +
  EXEMPT_HEADER +
  exempt
    .map(
      (e) =>
        `# EXEMPT: ${e.file} —— 理由：含行首无守卫的破坏性语句（${e.hits
          .slice(0, 3)
          .map((h) => `第 ${h.no} 行 \`${h.line.slice(0, 40)}\``)
          .join("；")}${e.hits.length > 3 ? ` 等 ${e.hits.length} 处` : ""}）⇒ 部署通道执行会清空生产表，属结构性重建脚本，由空库建库/启动期通道负责\n`,
    )
    .join("");

if (process.argv.includes("--check")) {
  const cur = fs.existsSync(manifestAbs) ? fs.readFileSync(manifestAbs, "utf-8") : "";
  const same = cur.replace(/\r\n/g, "\n") === out.replace(/\r\n/g, "\n");
  console.log(`--check：清单与生成结果${same ? "一致" : "**不一致**"}（活动 ${active.length} / 豁免 ${exempt.length}）`);
  process.exit(same ? 0 : 1);
}

fs.writeFileSync(manifestAbs, out, "utf-8");
console.log(`已写入 ${manifestRel}：活动 ${active.length} 个 / 豁免 ${exempt.length} 个`);
exempt.forEach((e) => console.log(`  豁免 · ${e.file}（破坏性语句 ${e.hits.length} 处）`));
