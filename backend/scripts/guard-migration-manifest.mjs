#!/usr/bin/env node
/**
 * G38 门禁 · guard:migration-manifest（S3-234，收口总清单第 74 项；**v2 = R1 返工后的三通道判据**）
 *
 * 防的是什么（根因）：
 *   `deploy/auto-deploy.sh` 的迁移段原先是**硬编码 3 条**文件名（126 / 127 / 196），
 *   之后新增的每一个迁移都**不会随部署执行**，只能靠人工补跑。
 *   实证（2026-10-16）：main 合入 `204_系统设置域权限点立码.sql` 后部署，日志里只跑了那 3 个文件，
 *   生产只读复核店长权限串仍是 9 项、14 个新菜单码 0 行 ⇒ 「改了不生效」。
 *   这与踩坑 [63]／[71]／[78] 同形：**改动没有出口 + 没有判据 = 静默失效**。
 *
 * 处置（R1 返工后：**三通道**，每条通道都有具名登记 + 可审理由）：
 *   ① 活动段（`deploy/migrations-manifest.txt`，**A 类实测幂等**）⇒ 部署通道会跑它；
 *   ② 豁免段（同文件，**C 类只初始化**）⇒ 具名 + 非空理由，"仅新库初始化通道执行、部署通道不执行"；
 *   ③ 登记册（`deploy/migrations-nonidempotent-registry.txt`，**B 类已知非幂等**）⇒ 部署通道不跑，
 *      部署段据此把失败判为「已知」而不判红；每行必须带 `owner 单号`（技术债台账）。
 *   本门禁断言：`docs/migrations/**` 里**每一个 .sql** 必须落在这三条通道的**恰好一条**上。
 *   新增迁移若三条都不登记 ⇒ 判红并点名。
 *
 * 判据（五条，各自可单独判红）：
 *   ① 正向覆盖：`docs/migrations/*.sql` 每个文件必须在活动段 / 豁免段 / 登记册中出现；
 *   ② 反向存在：活动段列出的文件必须在 `docs/migrations/` 里真实存在（防手滑写错名/防文件被误删）；
 *   ③ 登记合规与唯一归属：豁免行必须「具名 + 非空理由」；登记册行必须是
 *      `文件 | 失败形态 | 理由 | owner 单号` 四列且四列非空；任何文件不得重复出现
 *      （含段内重复、以及与另两条通道的交叉重复——同一文件既在活动段又在登记册是**自相矛盾**）；
 *   ④ 顺序一致：活动段的**行序**必须等于运行时迁移段的跑序
 *      （`readdirSync(docs/migrations).filter(f => f.endsWith(".sql") && f !== "add_tenant_id.sql").sort()`
 *      —— 见 `backend/src/shared/migration.ts` 第 8 步），**扣掉**豁免段与登记册里的文件；
 *      部署段若与运行时跑序不一致，「同一批迁移在两条通道里的先后」就会漂移，依赖顺序可能只在其中一条通道里成立；
 *   ⑤ 登记册指向的文件必须真实存在（防登记册写着不存在的文件 ⇒ 部署段永远查不到表、把新失败当"已知"）。
 *
 * ⚠️ 已知边界（写在明处）：
 *   · 本脚本是**静态清单比对**，只证明「文件落在这三条通道的哪一条」，
 *     **不**证明迁移 SQL 自身幂等/正确；幂等与副作用由 `docs/evidence/S3-234/README.md` 的真库两遍读数单独取证。
 *   · 范围是 `docs/migrations/` 下**全部** `.sql`（不限于三位数命名）——比卡面写的
 *     `[0-9]+_*.sql` 更严：`120a_*.sql`、`20260720_*.sql` 这类历史命名同样受管。
 *   · 本脚本**未接 CI**：`.github/**` 属派单红线（不得改），接线由凌舟做。
 *
 * 用法：
 *   node backend/scripts/guard-migration-manifest.mjs                          # 人类可读；退出码 0=绿 / 1=红
 *   node backend/scripts/guard-migration-manifest.mjs --json                   # 机读 JSON（仍按退出码判红绿）
 *   node backend/scripts/guard-migration-manifest.mjs --root <dir>             # 换仓库根（反测夹具用）
 *   node backend/scripts/guard-migration-manifest.mjs --manifest <相对路径>     # 换清单文件（默认 deploy/migrations-manifest.txt）
 *   node backend/scripts/guard-migration-manifest.mjs --registry <相对路径>     # 换登记册文件（默认 deploy/migrations-nonidempotent-registry.txt）
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
const registryRel = argValue("--registry") ?? "deploy/migrations-nonidempotent-registry.txt";

const MIGRATIONS_REL = "docs/migrations";
/** 运行时迁移段显式排除的文件（见 backend/src/shared/migration.ts 第 8 步的 filter） */
const RUNTIME_EXCLUDED = new Set(["add_tenant_id.sql"]);

/** 豁免行格式：`# EXEMPT: <文件名>.sql —— 理由：<非空文本>`（分隔符 `——` 或 `--` 均可） */
const EXEMPT_RE = /^#\s*EXEMPT\s*[:：]\s*(\S+?\.sql)\s*(?:—{2,}|-{2,})\s*理由\s*[:：]\s*(.*)$/;
/** 疑似豁免行但格式不合法（缺文件名/缺分隔符/缺「理由：」）——同样判红，避免"以为写了豁免其实没写" */
const EXEMPT_HINT_RE = /^#\s*EXEMPT\b/i;
/** 登记册数据行格式：`<文件> | <失败形态> | <理由> | <owner 单号>`（4 列，列内不得含 `|`） */
const REGISTRY_COLUMNS = ["文件", "失败形态", "理由", "owner 单号"];

const problems = {
  manifestMissing: false,
  registryMissing: false,
  missingFromManifest: [],
  missingFiles: [],
  exemptWithoutReason: [],
  badExemptLines: [],
  duplicates: [],
  orderMismatch: null,
  maxMigrationMismatch: null,
  badActiveLines: [],
  badRegistryLines: [],
  registryMissingFiles: [],
};

const migrationsAbs = path.join(root, MIGRATIONS_REL);
const manifestAbs = path.join(root, manifestRel);
const registryAbs = path.join(root, registryRel);

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
const registry = []; // { file, form, reason, owner, line }

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

if (!fs.existsSync(registryAbs)) {
  problems.registryMissing = true;
} else {
  const lines = fs.readFileSync(registryAbs, "utf-8").split(/\r?\n/);
  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length !== REGISTRY_COLUMNS.length || cells.some((c) => !c)) {
      problems.badRegistryLines.push({
        line: lineNo,
        text: line,
        reason: `登记册行必须是 4 列且列列非空：${REGISTRY_COLUMNS.join(" | ")}（当前 ${cells.length} 列）`,
      });
      return;
    }
    registry.push({ file: cells[0], form: cells[1], reason: cells[2], owner: cells[3], line: lineNo });
  });
}

// 判据③：重复与自相矛盾（三条通道一起查）
const seen = new Map();
for (const item of [
  ...active.map((a) => ({ ...a, kind: "活动段" })),
  ...exempt.map((e) => ({ ...e, kind: "豁免段" })),
  ...registry.map((r) => ({ ...r, kind: "登记册" })),
]) {
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
const registrySet = new Set(registry.map((r) => r.file));
for (const a of active) {
  if (!allMigrationFiles.includes(a.file)) {
    problems.missingFiles.push({ file: a.file, line: a.line });
  }
}

// 判据⑤：登记册指向的文件必须存在
for (const r of registry) {
  if (!allMigrationFiles.includes(r.file)) {
    problems.registryMissingFiles.push({ file: r.file, line: r.line });
  }
}

// 判据①：目录里的每个 .sql 必须在活动段 / 豁免段 / 登记册中的**至少一处**
for (const f of allMigrationFiles) {
  if (!activeSet.has(f) && !exemptSet.has(f) && !registrySet.has(f)) {
    problems.missingFromManifest.push(f);
  }
}

// 判据④：活动段行序 == 运行时跑序（扣掉豁免段与登记册的文件）
const expectedOrder = runtimeOrder.filter((f) => !exemptSet.has(f) && !registrySet.has(f));
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
    hint: "活动段行序必须等于运行时迁移段跑序（migration.ts 第 8 步 readdirSync().filter().sort()，扣掉豁免段与登记册）",
    firstDiffs: orderDiff,
    activeCount: actualOrder.length,
    expectedCount: expectedOrder.length,
  };
}

// ── 判据⑥（2026-10-16 事故后新增）：**最大迁移编号 ↔ 断言常量** 必须一致 ──
//   事故：新增 `206_角色权限回补.sql` 时漏改 `EXPECTED_MAX_MIGRATION`（205）
//   ⇒ `migration-c6-4-1.test.ts` 在 main 上红了 3 次（build-and-test failure），而**没有任何门禁**发现。
//   本判据把它变成门禁：常量落后/超前、或断言文件/常量缺失 ⇒ 红。
//   ⚠️ 必须放在 `if (orderDiff.length > 0)` **之外**（首版误嵌进去 ⇒ 无行序偏差时整条判据被跳过，反测当场证伪）。
// 只认本项目迁移编号约定 `NNN_`（1~3 位数字前缀）——目录里还有 `20260720_*.sql` 这类**日期前缀**文件，
// 用 `^(\d+)` 会把它们算成"最大编号 20260720"（首版即被反测抓出这个假读数）。
const maxNumber = allMigrationFiles
  .map((f) => Number((f.match(/^(\d{1,3})_/) ?? [])[1] ?? NaN))
  .filter((n) => Number.isFinite(n))
  .reduce((a, b) => Math.max(a, b), 0);
const assertFile = path.join(root, "backend", "src", "__tests__", "shared", "migration-c6-4-1.test.ts");
let declaredMax = null;
if (fs.existsSync(assertFile)) {
  const m = fs.readFileSync(assertFile, "utf8").match(/EXPECTED_MAX_MIGRATION\s*=\s*(\d+)/);
  if (m) declaredMax = Number(m[1]);
}
if (declaredMax === null) {
  problems.maxMigrationMismatch = { declared: null, actual: maxNumber, reason: "断言文件或常量缺失" };
} else if (declaredMax !== maxNumber) {
  problems.maxMigrationMismatch = { declared: declaredMax, actual: maxNumber, reason: "常量与迁移最大编号不一致" };
}

const hasProblem =
  problems.manifestMissing ||
  problems.registryMissing ||
  problems.missingFromManifest.length > 0 ||
  problems.missingFiles.length > 0 ||
  problems.registryMissingFiles.length > 0 ||
  problems.exemptWithoutReason.length > 0 ||
  problems.badExemptLines.length > 0 ||
  problems.duplicates.length > 0 ||
  problems.badActiveLines.length > 0 ||
  problems.badRegistryLines.length > 0 ||
  problems.orderMismatch !== null ||
  problems.maxMigrationMismatch !== null;

const result = {
  ok: !hasProblem,
  root,
  manifest: manifestRel,
  registry: registryRel,
  counts: {
    migrationsInDir: allMigrationFiles.length,
    active: active.length,
    exempt: exempt.length,
    registry: registry.length,
  },
  problems,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(
    `[guard:migration-manifest] 根目录 ${root}｜迁移目录 ${MIGRATIONS_REL}：${allMigrationFiles.length} 个 .sql｜` +
      `A 活动段 ${active.length} 个 / C 豁免段 ${exempt.length} 个 / B 登记册 ${registry.length} 个（合计 ${
        active.length + exempt.length + registry.length
      }）`,
  );
  if (problems.manifestMissing) {
    console.log(`✗ 找不到迁移清单：${manifestAbs}（部署段将无从执行任何迁移）`);
  }
  if (problems.registryMissing) {
    console.log(
      `✗ 找不到非幂等登记册：${registryAbs}（部署段无法把「已知非幂等」与「新失败」区分开 ⇒ 判红）`,
    );
  }
  if (problems.maxMigrationMismatch) {
    const m = problems.maxMigrationMismatch;
    console.log(
      `✗ 最大迁移编号与断言常量不一致：断言 EXPECTED_MAX_MIGRATION=${m.declared ?? "(缺)"} ，` +
        `实际最大编号=${m.actual}（${m.reason}）` +
        `\n   ⇒ 处置：把 backend/src/__tests__/shared/migration-c6-4-1.test.ts 的 EXPECTED_MAX_MIGRATION 改成 ${m.actual}` +
        `（新增迁移时**必须同步**；2026-10-16 漏改导致 main 红了 3 次）`,
    );
  }
  if (problems.missingFromManifest.length) {
    console.log(`✗ 未登记（既不在活动段、也不在豁免段、也不在登记册）共 ${problems.missingFromManifest.length} 个：`);
    for (const f of problems.missingFromManifest) {
      console.log(
        `   - ${f}（⇒ 部署不会跑它；请登记到 ${manifestRel} 活动段，或写「# EXEMPT: ${f} —— 理由：…」，` +
          `或（已知非幂等）写进 ${registryRel} 并给失败形态/理由/owner）`,
      );
    }
  }
  if (problems.missingFiles.length) {
    console.log(`✗ 清单活动段指向的文件不存在 共 ${problems.missingFiles.length} 个：`);
    for (const m of problems.missingFiles) {
      console.log(`   - ${manifestRel}:${m.line} → ${m.file}（${MIGRATIONS_REL}/ 下没有这个文件）`);
    }
  }
  if (problems.registryMissingFiles.length) {
    console.log(`✗ 登记册指向的文件不存在 共 ${problems.registryMissingFiles.length} 个：`);
    for (const m of problems.registryMissingFiles) {
      console.log(`   - ${registryRel}:${m.line} → ${m.file}（${MIGRATIONS_REL}/ 下没有这个文件）`);
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
  if (problems.badRegistryLines.length) {
    console.log(`✗ 登记册行格式不合法 共 ${problems.badRegistryLines.length} 处：`);
    for (const b of problems.badRegistryLines) {
      console.log(`   - ${registryRel}:${b.line} → ${b.text}（${b.reason}）`);
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
      ? "[guard:migration-manifest] FAIL（三条通道没把「部署出口」说全）"
      : "[guard:migration-manifest] PASS（每个 .sql 恰好在 A 活动段 / C 豁免段 / B 登记册之一；活动段行序与运行时跑序一致）",
  );
}

process.exit(hasProblem ? 1 : 0);
