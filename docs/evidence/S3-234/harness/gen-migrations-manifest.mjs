#!/usr/bin/env node
/**
 * S3-234 证据装置 / 生成器 **v2（R1 返工：部署通道三分类）**。
 *
 * 生成两件（**禁止手抄**，204 行手写必然错行错序）：
 *   ① `deploy/migrations-manifest.txt` —— 部署通道的**唯一真相源**：
 *      活动段 = **A 类「实测幂等」**（部署会跑它）；豁免段 = **C 类「只初始化」**（具名 + 理由，部署不跑）。
 *   ② `deploy/migrations-nonidempotent-registry.txt` —— **B 类「已知非幂等」登记册**，
 *      逐行 `<文件> | <失败形态> | <理由> | <owner 单号>`；部署通道**不跑** B 类，
 *      部署段把 registry 当作「已知失败形态」的分类依据（见 `deploy/auto-deploy.sh` 迁移段）与**技术债台账**。
 *
 * 三分类判据（R1 卡面 §一；**A + B + C 必须 = `docs/migrations/*.sql` 总数**）：
 *   A 实测幂等 —— 真库连跑两遍均 EXIT=0 且第二遍无数据变更（结构面增量 0 + changedRows=0）⇒ 活动段；
 *   B 已知非幂等 —— 实测「第二遍必红」的 11 条，或「重复跑仍真实写行」的 201 ⇒ registry；
 *   C 只初始化 —— 含**行首无守卫的破坏性语句**（机械判据）或**口令类种子**（人工判定）⇒ 豁免段。
 *
 * ⚠️ 生成器**不**凭「跑失败」自动豁免：B 类 12 条**不是**从清单里删掉了事，而是进 registry 逐条登记
 *   （失败形态 + 理由 + owner）⇒ 缺口是**显式**的、可审的；「第二遍会红」这件事不再每天刷屏，
 *   但它也没有被洗绿（`guard:migration-manifest` 与部署段都认这份 registry）。
 *
 * 用法（仓库根执行）：
 *   node docs/evidence/S3-234/harness/gen-migrations-manifest.mjs            # 写入两件
 *   node docs/evidence/S3-234/harness/gen-migrations-manifest.mjs --check     # 只比对，不写
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const migDir = path.join(repoRoot, "docs/migrations");
const manifestRel = "deploy/migrations-manifest.txt";
const registryRel = "deploy/migrations-nonidempotent-registry.txt";
const manifestAbs = path.join(repoRoot, manifestRel);
const registryAbs = path.join(repoRoot, registryRel);

const RUNTIME_EXCLUDED = new Set(["add_tenant_id.sql"]);
/** C 类的机械判据：行首即破坏性语句（不区分大小写） */
const DESTRUCTIVE_RE = /^[ \t]*(DROP\s+TABLE|TRUNCATE|DELETE\s+FROM|DROP\s+DATABASE)\b/i;

/**
 * B 类数据（**唯一登记处**；部署通道不跑，登记在案）。
 * 数据来源：`docs/evidence/S3-234/README.md` §五 5.1／5.2 的真库两遍读数
 * （原始输出 `raw/33-…`、`raw/34-…`、`raw/50-…`、`raw/51-…`）。
 * 字段顺序 = registry 列顺序：`[文件, 失败形态, 理由, owner 单号]`。
 * ⚠️ 字段内**不得**含 `|`（分隔符）或换行。
 */
const REGISTRY = [
  [
    "002_phase1_seed.sql",
    "ERR_NO_DEFAULT_FOR_FIELD：Field 'tenant_id' doesn't have a default value",
    "老 seed 依赖列默认值 ⇒ 第二遍必红（两遍失败清单逐条一致）",
    "待派（S3-234 发现并登记 2026-10-16）",
  ],
  [
    "008_phase6_schema.sql",
    "ER_NO_SUCH_TABLE：Table 'liquor_inventory.sys_role' doesn't exist",
    "引用无前缀表名；addTablePrefix 只在启动期通道生效，部署通道没有（源级特征，与环境无关）",
    "待派（S3-234 发现并登记 2026-10-16）",
  ],
  [
    "016_phase9_tenant_subscription.sql",
    "ER_DUP_ENTRY：Duplicate entry（第二遍）",
    "非幂等 INSERT：无 ON DUPLICATE KEY / 无存在性守卫",
    "待派（S3-234 发现并登记 2026-10-16）",
  ],
  [
    "020_migrate_v3_payment_miniapp.sql",
    "ER_DUP_ENTRY：Duplicate entry（第二遍）",
    "非幂等 INSERT：无 ON DUPLICATE KEY / 无存在性守卫",
    "待派（S3-234 发现并登记 2026-10-16）",
  ],
  [
    "078_性能索引.sql",
    "ER_DUP_KEYNAME：Duplicate key name（第二遍）",
    "非幂等 CREATE INDEX：无 information_schema 存在性守卫",
    "待派（S3-234 发现并登记 2026-10-16）",
  ],
  [
    "092_租户ID.sql",
    "ER_PARSE_ERROR（第二遍）",
    "源级缺陷：文件带 UTF-8 BOM ⇒ 解析错（与环境无关）",
    "待派（S3-234 发现并登记 2026-10-16）",
  ],
  [
    "099_seed_data.sql",
    "ER_NO_SUCH_TABLE：Table 'liquor_inventory.sys_user' doesn't exist",
    "引用无前缀表名；部署通道没有 addTablePrefix（源级特征，与环境无关）",
    "待派（S3-234 发现并登记 2026-10-16）",
  ],
  [
    "105_product_marketing_tag.sql",
    "ER_DUP_ENTRY：Duplicate entry（第二遍）",
    "非幂等 INSERT：无 ON DUPLICATE KEY / 无存在性守卫",
    "待派（S3-234 发现并登记 2026-10-16）",
  ],
  [
    "106_data_permission.sql",
    "ER_DUP_ENTRY：Duplicate entry（第二遍）",
    "非幂等 INSERT：无 ON DUPLICATE KEY / 无存在性守卫",
    "待派（S3-234 发现并登记 2026-10-16）",
  ],
  [
    "120c_performance_indexes.sql",
    "ER_DUP_KEYNAME：Duplicate key name（第二遍）",
    "非幂等 CREATE INDEX：无 information_schema 存在性守卫",
    "待派（S3-234 发现并登记 2026-10-16）",
  ],
  [
    "170_platform_announcement_status_enum.sql",
    "ER_PARSE_ERROR（第二遍）",
    "源级缺陷：语句里「注释 + 分号」写法导致语法错",
    "待派（S3-234 发现并登记 2026-10-16）",
  ],
  [
    "201_账号口径统一.sql",
    "NON_IDEMPOTENT_WRITE：第二遍 changedRows=4（不报错，但每遍真实改行）",
    "与该文件头注释「第二遍命中 0 行、affectedRows=0」矛盾（两遍均 4，可复现）⇒ 需改幂等（待派）",
    "待派（需改幂等；S3-234 发现并登记 2026-10-16）",
  ],
];

/**
 * C 类的**人工判定**补充（机械判据看不见的那些）。
 * `075` 不含破坏性语句、本身也「跑得成」，但它每跑一次就重置演示口令哈希（bcrypt 随机盐）——
 * 在部署通道里等于**每次部署偷偷改口令**，故按 C 类处理（只初始化 / 人工通道）。
 */
const EXEMPT_EXTRA = [
  [
    "075_reset_admin_password_bcrypt.sql",
    "口令类种子：bcrypt 随机盐 ⇒ 每遍重写管理员口令哈希（部署通道里等于每次部署偷偷改口令），修法需先补守卫（待派）",
  ],
];

const files = fs
  .readdirSync(migDir)
  .filter((f) => f.endsWith(".sql") && !RUNTIME_EXCLUDED.has(f))
  .sort();

const registryMap = new Map(REGISTRY.map((r) => [r[0], r]));
const exemptExtraMap = new Map(EXEMPT_EXTRA.map((e) => [e[0], e[1]]));

const active = [];
const exempt = [];
const registry = [];
for (const f of files) {
  if (registryMap.has(f)) {
    registry.push(registryMap.get(f));
    continue;
  }
  const extraReason = exemptExtraMap.get(f);
  if (extraReason) {
    exempt.push({ file: f, reason: `人工判定（非破坏性语句）：${extraReason}` });
    continue;
  }
  const text = fs.readFileSync(path.join(migDir, f), "utf-8");
  const hits = text
    .split(/\r?\n/)
    .map((line, i) => ({ line: line.trim(), no: i + 1 }))
    .filter((x) => DESTRUCTIVE_RE.test(x.line));
  if (hits.length > 0) {
    exempt.push({
      file: f,
      reason: `含行首无守卫的破坏性语句（${hits
        .slice(0, 3)
        .map((h) => `第 ${h.no} 行 \`${h.line.slice(0, 40)}\``)
        .join("；")}${hits.length > 3 ? ` 等 ${hits.length} 处` : ""}）`,
    });
  } else {
    active.push(f);
  }
}

// 清单里写了的文件必须真实存在；三分类必须覆盖全部（任一不成立即生成失败，不产半成品）
for (const f of [...active, ...exempt.map((e) => e.file), ...registry.map((r) => r[0])]) {
  if (!files.includes(f)) {
    console.error(`✗ 生成失败：${f} 在 docs/migrations/ 下不存在（registry/清单写错名字了）`);
    process.exit(2);
  }
}
const total = active.length + exempt.length + registry.length;
if (total !== files.length) {
  console.error(
    `✗ 生成失败：三分类合计 ${total} ≠ 目录内 .sql 数 ${files.length}（A ${active.length} / B ${registry.length} / C ${exempt.length}）`,
  );
  process.exit(2);
}

const HEADER = `# deploy/migrations-manifest.txt —— 「部署通道必须执行的迁移」唯一真相源
# 归属：S3-234（收口总清单第 74 项：部署迁移段硬编码 3 条 ⇒ 新迁移永不随部署执行）
# 生成：docs/evidence/S3-234/harness/gen-migrations-manifest.mjs（v2 三分类，**禁止手抄**，204 行手写必错行错序）
#
# 为什么有这份清单（根因）：
#   \`deploy/auto-deploy.sh\` 的迁移段原先**硬编码 3 条**文件名（126 / 127 / 196）⇒ 之后新增的每一个
#   迁移都不会随部署执行，只能靠人工补跑。实证（2026-10-16）：main 合入 \`204_系统设置域权限点立码.sql\`
#   后部署，日志里只跑了那 3 个文件；生产只读复核「店长权限串仍 9 项、14 个新菜单码 0 行」⇒ 改了不生效。
#
# ★ R1 返工口径（2026-10-16，凌舟裁定）：部署通道**只跑实测幂等的 A 类**。三分类（合计 = \`docs/migrations/*.sql\` 总数）：
#   A 实测幂等（本清单**活动段**，${active.length} 个）—— 真库连跑两遍 EXIT=0 且第二遍无数据变更，部署会跑它；
#   B 已知非幂等（\`deploy/migrations-nonidempotent-registry.txt\`，${registry.length} 个）—— **不进本清单**，部署通道不跑；
#       若部署段跑到的文件失败且登记在 registry ⇒ 打印「⏭️ 已知非幂等（登记在案）」、**不判红**；
#       **不在 registry 的失败 ⇒ 新失败 ⇒ 计入部署末端失败项汇总并判红**（与 AI 底座/冒烟同机制）。
#   C 只初始化（本清单**豁免段**，${exempt.length} 个）—— 具名 + 理由，部署通道不跑。
#   ⚠️ 代价（写在明处）：B 类 12 条**长期**以「登记在案」的形态存在，不再每天在日志里刷 ❌；
#      它们的修复由 registry 的 \`owner 单号\` 列跟踪（当前均「待派」）——**登记 ≠ 已修**。
#
# 格式（由 \`backend/scripts/guard-migration-manifest.mjs\` 强制，判据见该脚本头部注释）：
#   · 活动行 = \`docs/migrations/\` 下的**裸文件名**；**行序即部署跑序**，必须等于运行时迁移段跑序（扣掉 B/C 两类）；
#   · 豁免行 = 以 \`#\` 开头、以 EXEMPT 为第一个词的行（必须「具名 + 非空理由」）；
#   · 其余 \`#\` 行是普通注释；空行忽略。
#
# 维护方式（新增迁移时）：
#   ① 跑一次生成器（或手工把文件名追加到活动段**末尾**）；
#   ② 跑 \`node backend/scripts/guard-migration-manifest.mjs\`，必须 EXIT=0；
#   ③ 若不该随部署跑，必须有具名豁免 + 理由（C 类）**或**进 registry + 失败形态 + 理由 + owner（B 类），
#      并在回传里报备凌舟（豁免/登记 = 有意留缺口，不是「忘了」）。
#
# ⚠️ 以下为活动段（**A 类实测幂等**）：部署段按**行序**逐个文件执行 \`node scripts/run-migration.mjs <file>\`。
`;

const EXEMPT_HEADER = `
# ⚠️ 以下为豁免段（**C 类 · 有意不随部署执行**，每条必须具名 + 写明理由）。
#   语义（R1 卡面 §二.1）：**仅「新库初始化」通道执行**（启动期迁移通道 \`backend/src/shared/migration.ts\`
#   第 8 步遍历 \`docs/migrations/\`；空库建库/灾备走该通道）；**部署通道不执行**（防每次部署删表重建）。
#   机械判据：文件内出现行首的破坏性语句（DROP TABLE / TRUNCATE / DELETE FROM / DROP DATABASE）⇒
#   部署通道在**生产库**上执行它就是**真删数据**（本机夹具实测：跑完一遍 \`t_product_spu\` 的 FK/索引读数
#   从 1/1 掉到 0/0，见 \`docs/evidence/S3-234/raw/30-deploy-section-pass1.txt\`）；
#   另有 1 条为人工判定（口令类种子，见下）。
#   豁免 ≠ 「这文件不重要」：它是**结构性重建/初始化脚本**，语义由「空库建库 + 启动期迁移通道」负责。
`;

const manifestOut =
  HEADER +
  active.join("\n") +
  "\n" +
  EXEMPT_HEADER +
  exempt.map((e) => `# EXEMPT: ${e.file} —— 理由：${e.reason}\n`).join("");

const REGISTRY_HEADER = `# deploy/migrations-nonidempotent-registry.txt —— B 类「已知非幂等」登记册（部署通道**不跑**）
# 归属：S3-234 **R1 返工**（凌舟裁定：部署通道三分类 + 新失败阻断）
# 生成：docs/evidence/S3-234/harness/gen-migrations-manifest.mjs（**禁止手抄**）
#
# 这是什么（两个用途，一个文件）：
#   ① **分类依据**：\`deploy/auto-deploy.sh\` 迁移段先跑 \`deploy/migrations-manifest.txt\` 活动段（A 类）；
#      某个文件失败时**用它查表**：在册 ⇒ 打印「⏭️ 已知非幂等（登记在案）」且**不判红**；
#      不在册 ⇒ 计为**新失败**，进部署末端失败项汇总并**判红**（与 AI 底座/冒烟同机制）。
#   ② **技术债台账**：每行必须带 \`owner 单号\`——「登记在案」不等于「已修」，没有 owner 的行就是欠账。
#
# 格式（\`|\` 分隔 4 列，由 \`backend/scripts/guard-migration-manifest.mjs\` 强制）：
#   <文件> | <失败形态> | <理由> | <owner 单号>
#   字段内不得再出现 \`|\`；空行与 \`#\` 行忽略。
#
# 判据与由来（**实测**，不是猜的）：真库连跑两遍的原始输出见 \`docs/evidence/S3-234/raw/\`——
#   11 条「第二遍必红」：\`33-deploy-section-full-postfix.txt\`、\`34-…-pass2.txt\`（两遍失败清单逐条一致）；
#   1 条「重复跑仍真实写行」（\`201\`，changedRows=4）：\`50-sideeffects-pass1.*\`、\`51-sideeffects-pass2.*\`。
#   ⚠️ 本册**没有**「跑失败就自动豁免」这种机制：B 类每一条都写明失败形态与理由，改幂等后由生成器移出本册。
#
# 当前状态（2026-10-16，R1 返工交付时）：${registry.length} 条，全部 owner=待派（修复单未派；其中 201 标「需改幂等」）。
#
# 文件 | 失败形态 | 理由 | owner 单号
`;

const registryOut =
  REGISTRY_HEADER + registry.map((r) => `${r[0]} | ${r[1]} | ${r[2]} | ${r[3]}`).join("\n") + "\n";

const normalize = (s) => s.replace(/\r\n/g, "\n");

if (process.argv.includes("--check")) {
  const curManifest = fs.existsSync(manifestAbs) ? fs.readFileSync(manifestAbs, "utf-8") : "";
  const curRegistry = fs.existsSync(registryAbs) ? fs.readFileSync(registryAbs, "utf-8") : "";
  const manifestSame = normalize(curManifest) === normalize(manifestOut);
  const registrySame = normalize(curRegistry) === normalize(registryOut);
  console.log(
    `--check：清单${manifestSame ? "一致" : "**不一致**"}（A ${active.length} / C ${exempt.length}）｜` +
      `registry${registrySame ? "一致" : "**不一致**"}（B ${registry.length}）｜合计 ${total} / 目录 ${files.length}`,
  );
  process.exit(manifestSame && registrySame ? 0 : 1);
}

fs.writeFileSync(manifestAbs, manifestOut, "utf-8");
fs.writeFileSync(registryAbs, registryOut, "utf-8");
console.log(
  `已写入 ${manifestRel}：活动 A ${active.length} / 豁免 C ${exempt.length}｜已写入 ${registryRel}：登记 B ${registry.length}｜` +
    `合计 ${total} = docs/migrations/*.sql ${files.length}`,
);
exempt.forEach((e) => console.log(`  C · ${e.file}`));
registry.forEach((r) => console.log(`  B · ${r[0]}（${r[1].split("：")[0]}）`));
