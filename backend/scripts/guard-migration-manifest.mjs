#!/usr/bin/env node
/**
 * G38 门禁 · guard:migration-manifest（S3-234，收口总清单第 74 项）
 *
 * 防的是什么（根因）：
 *   `deploy/auto-deploy.sh` 的迁移段原先是**硬编码 3 条**文件名（126 / 127 / 196），
 *   之后新增的每一个迁移都**不会随部署执行**，只能靠人工补跑。
 *   实证（2026-10-16）：main 合入 `204_系统设置域权限点立码.sql` 后部署，日志里只跑了那 3 个文件，
 *   生产只读复核店长权限串仍是 9 项、14 个新菜单码 0 行 ⇒ 「改了不生效」。
 *   这与踩坑 [63]／[71]／[78] 同形：**改动没有出口 + 没有判据 = 静默失效**。
 *
 * 处置（本门禁守的就是这条出口）：
 *   `deploy/migrations-manifest.txt` 是「部署必须执行的迁移」的**唯一真相源**；
 *   本门禁断言：`docs/migrations/**` 里**每一个 .sql**，要么在清单活动段（⇒ 部署会跑它），
 *   要么在豁免段**具名 + 带非空理由**（⇒ 有意不跑，理由可审）。
 *   新增迁移若两处都没登记 ⇒ 本门禁判红并点名；清单写了不存在的文件 ⇒ 也判红。
 *
 * 判据（四条，各自可单独判红）：
 *   ① 正向覆盖：`docs/migrations/*.sql` 每个文件必须在活动段或豁免段中出现；
 *   ② 反向存在：活动段列出的文件必须在 `docs/migrations/` 里真实存在（防手滑写错名/防文件被误删）；
 *   ③ 豁免合规：豁免行必须「具名 + 非空理由」；且任何文件不得重复出现（含活动段重复、豁免段重复、
 *      以及同时出现在活动段与豁免段这种自相矛盾）；
 *   ④ 顺序一致：活动段的**行序**必须等于运行时迁移段的跑序
 *      （`readdirSync(docs/migrations).filter(f => f.endsWith(".sql") && f !== "add_tenant_id.sql").sort()`
 *      —— 见 `backend/src/shared/migration.ts` 第 8 步）。部署段若与运行时跑序不一致，
 *      「同一批迁移在两条通道里的先后」就会漂移，依赖顺序可能只在其中一条通道里成立。
 *
 * ⚠️ 已知边界（写在明处）：
 *   · 本脚本是**静态清单比对**，只证明「文件在不在出口上」，**不**证明迁移 SQL 自身幂等/正确；
 *     幂等与副作用由 `docs/evidence/S3-234/README.md` 的真库两遍读数单独取证。
 *   · 范围是 `docs/migrations/` 下**全部** `.sql`（不限于三位数命名）——比卡面写的
 *     `[0-9]+_*.sql` 更严：`120a_*.sql`、`20260720_*.sql` 这类历史命名同样受管（卡面口径见回传卡「待裁定项」）。
 *   · 本脚本**未接 CI**：`.github/**` 属本次派单红线（不得改），接线由凌舟做。
 *
 * 用法：
 *   node backend/scripts/guard-migration-manifest.mjs                          # 人类可读；退出码 0=绿 / 1=红
 *   node backend/scripts/guard-migration-manifest.mjs --json                   # 机读 JSON（仍按退出码判红绿）
 *   node backend/scripts/guard-migration-manifest.mjs --root <dir>             # 换仓库根（反测夹具用）
 *   node backend/scripts/guard-migration-manifest.mjs --manifest <相对路径>     # 换清单文件（默认 deploy/migrations-manifest.txt）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const asJson = argv.includes("--json");

function argValue(flag) {
  const withEq = argv.find((a) => a.startsWith(`${flag}=`));
  if (withEq) return withEq.slice(flag.length + 1);
  const idx = argv.indexOf(flag);
  if (idx >= 0 && idx + 1 < argv.length) return argv[idx + 1];
  return null;
}

const root = path.resolve(argValue("--root") ?? path.resolve(scriptDir, "..", ".."));
const manifestRel = argValue("--manifest") ?? "deploy/migrations-manifest.txt";

const MIGRATIONS_REL = "docs/migrations";
/** 运行时迁移段显式排除的文件（见 backend/src/shared/migration.ts 第 8 步的 filter） */
const RUNTIME_EXCLUDED = new Set(["add_tenant_id.sql"]);

/** 豁免行格式：`# EXEMPT: <文件名>.sql —— 理由：<非空文本>`（分隔符 `——` 或 `--` 均可） */
const EXEMPT_RE = /^#\s*EXEMPT\s*[:：]\s*(\S+?\.sql)\s*(?:—{2,}|-{2,})\s*理由\s*[:：]\s*(.*)$/;
/** 疑似豁免行但格式不合法（缺文件名/缺分隔符/缺「理由：」）——同样判红，避免"以为写了豁免其实没写" */
const EXEMPT_HINT_RE = /^#\s*EXEMPT\b/i;

const problems = {
  manifestMissing: false,
  missingFromManifest: [],
  missingFiles: [],
  exemptWithoutReason: [],
  badExemptLines: [],
  duplicates: [],
  orderMismatch: null,
  badActiveLines: [],
};

const migrationsAbs = path.join(root, MIGRATIONS_REL);
const manifestAbs = path.join(root, manifestRel);

if (!fs.existsSync(migrationsAbs)) {
  console.error(`[guard:migration-manifest] 找不到迁移目录：${migrationsAbs}`);
  process.exit(1);
}

// 运行时跑序（判据④的基准），与 migration.ts 第 8 步逐字同形
const runtimeOrder = fs
  .readdirSync(migrationsAbs)
  .filter((f) => f.endsWith(".sql") && !RUNTIME_EXCLUDED.has(f))
  .sort();
const allMigrationFiles = fs.readdirSync(migrationsAbs).filter((f) => f.endsWith(".sql"));

const active = []; // { file, line }
const exempt = []; // { file, reason, line }

if (!fs.existsSync(manifestAbs)) {
  problems.manifestMissing = true;
} else {
  const lines = fs.readFileSync(manifestAbs, "utf-8").split(/\r?\n/);
  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith("#")) {
      const m = line.match(EXEMPT_RE);
      if (m) {
        exempt.push({ file: m[1].trim(), reason: m[2].trim(), line: lineNo });
        return;
      }
      if (EXEMPT_HINT_RE.test(line)) {
        problems.badExemptLines.push({
          line: lineNo,
          text: line,
          reason: "豁免行格式不合法（应为 `# EXEMPT: <文件名>.sql —— 理由：<非空理由>`）",
        });
      }
      return; // 普通注释行
    }
    if (!line.endsWith(".sql") || line.includes("/") || line.includes("\\")) {
      problems.badActiveLines.push({
        line: lineNo,
        text: line,
        reason: "活动行必须是 `docs/migrations/` 下的**裸文件名**（形如 `204_系统设置域权限点立码.sql`，不得带路径）",
      });
      return;
    }
    active.push({ file: line, line: lineNo });
  });
}

// 判据③：重复与自相矛盾
const seen = new Map();
for (const item of [...active.map((a) => ({ ...a, kind: "活动段" })), ...exempt.map((e) => ({ ...e, kind: "豁免段" }))]) {
  if (seen.has(item.file)) {
    const prev = seen.get(item.file);
    problems.duplicates.push({
      file: item.file,
      first: `${prev.kind} 第 ${prev.line} 行`,
      second: `${item.kind} 第 ${item.line} 行`,
    });
  } else {
    seen.set(item.file, item);
  }
}

// 判据③：豁免必须带非空理由
for (const e of exempt) {
  if (!e.reason) {
    problems.exemptWithoutReason.push({ file: e.file, line: e.line });
  }
}

// 判据②：活动段列出的文件必须存在
const activeSet = new Set(active.map((a) => a.file));
const exemptSet = new Set(exempt.map((e) => e.file));
for (const a of active) {
  if (!allMigrationFiles.includes(a.file)) {
    problems.missingFiles.push({ file: a.file, line: a.line });
  }
}

// 判据①：目录里的每个 .sql 必须在活动段或豁免段
for (const f of allMigrationFiles) {
  if (!activeSet.has(f) && !exemptSet.has(f)) {
    problems.missingFromManifest.push(f);
  }
}

// 判据④：活动段行序 == 运行时跑序（豁免文件不在活动段，故比对"过滤掉豁免后的运行时跑序"）
const expectedOrder = runtimeOrder.filter((f) => !exemptSet.has(f));
const actualOrder = active.map((a) => a.file);
const orderDiff = [];
for (let i = 0; i < Math.max(expectedOrder.length, actualOrder.length); i++) {
  if (expectedOrder[i] !== actualOrder[i]) {
    orderDiff.push({ index: i + 1, expected: expectedOrder[i] ?? null, actual: actualOrder[i] ?? null });
    if (orderDiff.length >= 5) break;
  }
}
if (orderDiff.length > 0) {
  problems.orderMismatch = {
    hint: "活动段行序必须等于运行时迁移段跑序（migration.ts 第 8 步 readdirSync().filter().sort()）",
    firstDiffs: orderDiff,
    activeCount: actualOrder.length,
    expectedCount: expectedOrder.length,
  };
}

const hasProblem =
  problems.manifestMissing ||
  problems.missingFromManifest.length > 0 ||
  problems.missingFiles.length > 0 ||
  problems.exemptWithoutReason.length > 0 ||
  problems.badExemptLines.length > 0 ||
  problems.duplicates.length > 0 ||
  problems.badActiveLines.length > 0 ||
  problems.orderMismatch !== null;

const result = {
  ok: !hasProblem,
  root,
  manifest: manifestRel,
  counts: {
    migrationsInDir: allMigrationFiles.length,
    active: active.length,
    exempt: exempt.length,
  },
  problems,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(
    `[guard:migration-manifest] 根目录 ${root}｜迁移目录 ${MIGRATIONS_REL}：${allMigrationFiles.length} 个 .sql｜` +
      `清单活动段 ${active.length} 个 / 豁免段 ${exempt.length} 个`,
  );
  if (problems.manifestMissing) {
    console.log(`✗ 找不到迁移清单：${manifestAbs}（部署段将无从执行任何迁移）`);
  }
  if (problems.missingFromManifest.length) {
    console.log(`✗ 未登记（既不在活动段也不在豁免段）共 ${problems.missingFromManifest.length} 个：`);
    for (const f of problems.missingFromManifest) {
      console.log(
        `   - ${f}（⇒ 部署不会跑它；请在 ${manifestRel} 登记，或写「# EXEMPT: ${f} —— 理由：…」）`,
      );
    }
  }
  if (problems.missingFiles.length) {
    console.log(`✗ 清单活动段指向的文件不存在 共 ${problems.missingFiles.length} 个：`);
    for (const m of problems.missingFiles) {
      console.log(`   - ${manifestRel}:${m.line} → ${m.file}（${MIGRATIONS_REL}/ 下没有这个文件）`);
    }
  }
  if (problems.exemptWithoutReason.length) {
    console.log(`✗ 豁免行缺理由 共 ${problems.exemptWithoutReason.length} 个：`);
    for (const e of problems.exemptWithoutReason) {
      console.log(`   - ${manifestRel}:${e.line} → ${e.file}`);
    }
  }
  if (problems.badExemptLines.length) {
    console.log(`✗ 豁免行格式不合法 共 ${problems.badExemptLines.length} 处：`);
    for (const b of problems.badExemptLines) {
      console.log(`   - ${manifestRel}:${b.line} → ${b.text}（${b.reason}）`);
    }
  }
  if (problems.badActiveLines.length) {
    console.log(`✗ 活动行格式不合法 共 ${problems.badActiveLines.length} 处：`);
    for (const b of problems.badActiveLines) {
      console.log(`   - ${manifestRel}:${b.line} → ${b.text}（${b.reason}）`);
    }
  }
  if (problems.duplicates.length) {
    console.log(`✗ 同一文件重复登记 共 ${problems.duplicates.length} 处：`);
    for (const d of problems.duplicates) {
      console.log(`   - ${d.file}：${d.first} 与 ${d.second}`);
    }
  }
  if (problems.orderMismatch) {
    console.log(`✗ 活动段行序与运行时跑序不一致（${problems.orderMismatch.hint}）：`);
    for (const d of problems.orderMismatch.firstDiffs) {
      console.log(`   - 第 ${d.index} 行：清单=${d.actual ?? "(缺)"}｜运行时跑序=${d.expected ?? "(缺)"}`);
    }
  }
  console.log(
    hasProblem
      ? "[guard:migration-manifest] FAIL（清单不是「部署出口」的完整真相源）"
      : "[guard:migration-manifest] PASS（每个 .sql 都在活动段或具名豁免段；活动段行序与运行时跑序一致）",
  );
}

process.exit(hasProblem ? 1 : 0);
