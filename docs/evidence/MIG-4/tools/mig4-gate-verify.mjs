/**
 * MIG-4 写闸门：断言复跑 + 反测（本环境 vitest 不可运行，见 outputs/03-vitest-blocked.txt）。
 *
 * 口径：
 *   正常版 = 工作区真实源码 `backend/src/shared/migration.ts`（转译 + 桩依赖后进程内加载）
 *   反测版 = 同一份源码，只把 `resolveWriteGate` 改回"永远 allow"（＝闸门不挡）
 *   **被测函数一律取自真实源码文本，不复刻**（见 tools/mig4-lib.mjs 顶部说明）。
 *
 * 断言与 `backend/src/__tests__/shared/migration-write-gate.test.ts` 同源：假迁移语句表由 X1 断言逐条核对。
 *
 * 用法：node docs/evidence/MIG-4/tools/mig4-gate-verify.mjs
 * 退出码：0 = 正常版全绿 且 反测位在反测版全红 且 非反测位在反测版全绿；1 = 否则。
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  REPO_ROOT,
  MIGRATION_TS,
  readMigrationSource,
  sha256,
  loadMigrationModule,
  makeGateDisabledSource,
} from "./mig4-lib.mjs";

const OUTDIR = resolve(REPO_ROOT, "docs", "evidence", "MIG-4");
const TEST_FILE = join(REPO_ROOT, "backend", "src", "__tests__", "shared", "migration-write-gate.test.ts");
const FIXTURE_FILE = "001_gate_fixture.sql";

// ── 假迁移文件（与 vitest 用例表同源；X1 断言逐条核对） ────────────────────────────
const FIXTURE_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS `t_gate_demo` (id INT)",
  "INSERT INTO `t_gate_demo` (id) VALUES (1)",
  "/* 块注释在前：丢块缺陷修复后这类语句会进入执行路径 */ INSERT INTO `t_gate_demo` (id) VALUES (2)",
  "INSERT INTO `t_gate_demo` (id) SELECT id FROM `t_gate_demo`",
  "UPDATE `t_gate_demo` SET id = 5 WHERE id = 1",
  "DELETE FROM `t_gate_demo` WHERE id = 3",
  "REPLACE INTO `t_gate_demo` (id) VALUES (4)",
  "CALL `sync_gate_demo`()",
  "ALTER TABLE `t_gate_demo` ADD COLUMN name VARCHAR(50)",
  "CREATE INDEX idx_gate_demo ON `t_gate_demo` (id)",
  "SELECT COUNT(*) FROM `t_gate_demo`",
];
const FIXTURE_SQL = FIXTURE_STATEMENTS.join(";\n") + ";";

/** block 下应照常执行的结构/非写语句 */
const EXPECTED_STRUCTURE = [
  FIXTURE_STATEMENTS[0],
  FIXTURE_STATEMENTS[8],
  FIXTURE_STATEMENTS[9],
  FIXTURE_STATEMENTS[10],
];

/** block 下应被跳过、且必须各有一条日志的写语句 / CALL */
const EXPECTED_SKIPPED = [
  { type: "INSERT", marker: "VALUES (1)", target: "t_gate_demo" },
  { type: "INSERT", marker: "VALUES (2)", target: "t_gate_demo" },
  { type: "INSERT", marker: "SELECT id FROM", target: "t_gate_demo" },
  { type: "UPDATE", marker: "SET id = 5", target: "t_gate_demo" },
  { type: "DELETE", marker: "WHERE id = 3", target: "t_gate_demo" },
  { type: "REPLACE", marker: "VALUES (4)", target: "t_gate_demo" },
  { type: "CALL", marker: "sync_gate_demo", target: "sync_gate_demo" },
];

// ── 场景执行：驱动真实 runMigrations，记录"真的发给连接的语句"与日志 ──────────────────
async function runScenario(mod, stubs, gate) {
  stubs.fsState.fixture = FIXTURE_SQL;
  stubs.fsState.fixtureName = FIXTURE_FILE;
  stubs.fsState.files = [FIXTURE_FILE];
  stubs.fsState.exists = true;
  stubs.dbState.queries.length = 0;
  for (const key of Object.keys(stubs.logs)) stubs.logs[key].length = 0;

  const previous = process.env.MIGRATION_WRITE_GATE;
  if (gate === undefined) delete process.env.MIGRATION_WRITE_GATE;
  else process.env.MIGRATION_WRITE_GATE = gate;
  try {
    await mod.runMigrations();
  } finally {
    if (previous === undefined) delete process.env.MIGRATION_WRITE_GATE;
    else process.env.MIGRATION_WRITE_GATE = previous;
  }

  const executed = stubs.dbState.queries.filter(
    (sql) => typeof sql === "string" && (sql.includes("t_gate_demo") || sql.includes("sync_gate_demo"))
  );
  const warns = [...stubs.logs.warn];
  return {
    executed,
    warns,
    infos: [...stubs.logs.info],
    errors: [...stubs.logs.error],
    gateLogs: warns.filter((m) => m.includes("写闸门 block 跳过")),
  };
}

function equalList(actual, expected) {
  const ok = actual.length === expected.length && actual.every((v, i) => v === expected[i]);
  return {
    pass: ok,
    detail: ok
      ? `${actual.length} 条且顺序一致`
      : `实际 ${actual.length} 条 / 期望 ${expected.length} 条；实际首条=${JSON.stringify(actual[0] ?? null)}`,
  };
}

function checkSkipLogs(result) {
  const missing = EXPECTED_SKIPPED.filter(
    (item) =>
      !result.gateLogs.some(
        (m) => m.includes(FIXTURE_FILE) && m.includes(`${item.type} 语句`) && m.includes(`目标 ${item.target}`)
      )
  );
  const pass = result.gateLogs.length === EXPECTED_SKIPPED.length && missing.length === 0;
  return {
    pass,
    detail: pass
      ? `跳过日志 ${result.gateLogs.length} 条，文件/类型/目标齐全`
      : `日志 ${result.gateLogs.length} 条（期望 ${EXPECTED_SKIPPED.length}），缺：${missing
          .map((m) => `${m.type}(${m.target})`)
          .join("、") || "无"}`,
  };
}

function checkWritesNotExecuted(result) {
  const leaked = EXPECTED_SKIPPED.filter((item) => result.executed.some((sql) => sql.includes(item.marker)));
  return {
    pass: leaked.length === 0,
    detail: leaked.length === 0 ? "7 条写语句/CALL 均未下发" : `仍被下发：${leaked.map((l) => l.marker).join("、")}`,
  };
}

/** 从 vitest 用例文件里抽取字面量数组，用于 X1 同源核对（允许尾逗号，故用 JSON5 风格求值） */
function extractStringArray(text, name) {
  const head = new RegExp(`const\\s+${name}\\s*=\\s*\\[`).exec(text);
  if (!head) throw new Error(`用例文件里找不到 ${name}`);
  const start = head.index + head[0].length;
  const end = text.indexOf("];", start);
  if (end < 0) throw new Error(`${name} 数组未闭合`);
  const body = text.slice(start, end).replace(/,\s*$/, "");
  return new Function(`return [${body}];`)();
}

/** 断言表：redUnderRevert=true 即"反测位"（闸门改回不挡后必须变红） */
const ASSERTIONS = [
  {
    id: "X1",
    title: "harness 假迁移语句表与 vitest 用例逐条一致（同源）",
    redUnderRevert: false,
    check: () => {
      const fromTest = extractStringArray(readFileSync(TEST_FILE, "utf8"), "FIXTURE_STATEMENTS");
      return equalList(fromTest, FIXTURE_STATEMENTS);
    },
  },
  {
    id: "P1",
    title: "DATA_WRITE_KEYWORDS = INSERT/UPDATE/DELETE/REPLACE/CALL",
    redUnderRevert: false,
    check: (v) => equalList([...v.mod.DATA_WRITE_KEYWORDS], ["INSERT", "UPDATE", "DELETE", "REPLACE", "CALL"]),
  },
  {
    id: "P2",
    title: "firstKeyword 剥离前导空白/注释后取首关键字",
    redUnderRevert: false,
    check: (v) => {
      const cases = [
        ["INSERT INTO x (id) VALUES (1)", "INSERT"],
        ["   \n\tUPDATE x SET a = 1", "UPDATE"],
        ["-- 行注释\nINSERT INTO x (id) VALUES (1)", "INSERT"],
        ["# 井号注释\nDELETE FROM x WHERE id = 1", "DELETE"],
        ["/* 块注释 */\nREPLACE INTO x (id) VALUES (1)", "REPLACE"],
        ["\n\n-- 注释一\n-- 注释二\nCALL p()", "CALL"],
        ["-- 只有注释，没有语句", ""],
        ["/* 未闭合块注释", ""],
      ];
      const bad = cases.filter(([sql, expected]) => v.mod.firstKeyword(sql) !== expected);
      return { pass: bad.length === 0, detail: bad.length ? `不符 ${bad.length} 条：${JSON.stringify(bad[0])}` : `${cases.length} 条全符` };
    },
  },
  {
    id: "P3",
    title: "isDataWriteStatement 判真集合（含注释前缀与 INSERT ... SELECT）",
    redUnderRevert: false,
    check: (v) => {
      const cases = [
        "INSERT INTO `t_x` (id) VALUES (1)",
        "INSERT IGNORE INTO `t_x` (id) VALUES (1)",
        "UPDATE `t_x` SET id = 1",
        "DELETE FROM `t_x` WHERE id = 1",
        "REPLACE INTO `t_x` (id) VALUES (1)",
        "CALL `p_gate`()",
        "  /* 注释 */ insert into t_x (id) values (1)",
      ];
      const bad = cases.filter((sql) => v.mod.isDataWriteStatement(sql) !== true);
      return { pass: bad.length === 0, detail: bad.length ? `未判真：${bad.join(" | ")}` : `${cases.length} 条全判真` };
    },
  },
  {
    id: "P4",
    title: "结构/非写语句不得被误判（CREATE / ALTER / CREATE INDEX / SELECT / 纯注释）",
    redUnderRevert: false,
    check: (v) => {
      const cases = [
        "CREATE TABLE IF NOT EXISTS `t_x` (id INT)",
        "ALTER TABLE `t_x` ADD COLUMN name VARCHAR(50)",
        "CREATE INDEX idx_x ON `t_x` (id)",
        "SELECT COUNT(*) FROM `t_x`",
        "-- 注释里提到 INSERT 但整块只有注释",
        "/* 注释 */ SELECT 1",
      ];
      const bad = cases.filter((sql) => v.mod.isDataWriteStatement(sql) !== false);
      return { pass: bad.length === 0, detail: bad.length ? `被误判为写语句：${bad.join(" | ")}` : `${cases.length} 条全判假` };
    },
  },
  {
    id: "P5",
    title: "statementTarget 取表名/过程名（日志目标列）",
    redUnderRevert: false,
    check: (v) => {
      const cases = [
        ["INSERT INTO `t_x` (id) VALUES (1)", "t_x"],
        ["INSERT IGNORE INTO t_x (id) VALUES (1)", "t_x"],
        ["REPLACE INTO `t_x` (id) VALUES (1)", "t_x"],
        ["UPDATE `t_x` SET id = 1", "t_x"],
        ["DELETE FROM `t_x` WHERE id = 1", "t_x"],
        ["CALL `p_gate`()", "p_gate"],
        ["-- 注释\nINSERT INTO `t_x` (id) VALUES (1)", "t_x"],
        ["CREATE TABLE `t_x` (id INT)", ""],
      ];
      const bad = cases.filter(([sql, expected]) => v.mod.statementTarget(sql) !== expected);
      return { pass: bad.length === 0, detail: bad.length ? `不符：${JSON.stringify(bad[0])}` : `${cases.length} 条全符` };
    },
  },
  {
    id: "P6",
    title: "resolveWriteGate：默认（未设置 env）必须是 block，只有显式 allow 才放行",
    redUnderRevert: true,
    check: (v) => {
      const previous = process.env.MIGRATION_WRITE_GATE;
      const cases = [
        ["", "block"],
        [" ", "block"],
        ["block", "block"],
        ["BLOCK", "block"],
        ["yes", "block"],
        ["1", "block"],
        ["allow", "allow"],
        ["ALLOW", "allow"],
        [" allow ", "allow"],
      ];
      const bad = [];
      try {
        delete process.env.MIGRATION_WRITE_GATE;
        if (v.mod.resolveWriteGate() !== "block") bad.push(["<未设置 env>", v.mod.resolveWriteGate(), "block"]);
        process.env.MIGRATION_WRITE_GATE = "allow";
        if (v.mod.resolveWriteGate() !== "allow") bad.push(["<env=allow>", v.mod.resolveWriteGate(), "allow"]);
        for (const [raw, expected] of cases) {
          if (v.mod.resolveWriteGate(raw) !== expected) bad.push([raw, v.mod.resolveWriteGate(raw), expected]);
        }
      } finally {
        if (previous === undefined) delete process.env.MIGRATION_WRITE_GATE;
        else process.env.MIGRATION_WRITE_GATE = previous;
      }
      return { pass: bad.length === 0, detail: bad.length ? `不符 ${bad.length} 条：${JSON.stringify(bad[0])}` : "缺省/未设置/非法值/allow 全部符合" };
    },
  },
  {
    id: "B1",
    title: "默认挡：只有 4 条结构语句被执行（顺序一致）",
    redUnderRevert: true,
    check: (v) => equalList(v.scenarios.default.executed, EXPECTED_STRUCTURE),
  },
  {
    id: "B2",
    title: "默认挡：7 条写语句/CALL 一条都没下发",
    redUnderRevert: true,
    check: (v) => checkWritesNotExecuted(v.scenarios.default),
  },
  {
    id: "B3",
    title: "默认挡：每条被跳过的语句都有 文件+语句类型+目标表 日志",
    redUnderRevert: true,
    check: (v) => checkSkipLogs(v.scenarios.default),
  },
  {
    id: "B4",
    title: "默认挡：跳过日志给出放行方式 MIGRATION_WRITE_GATE=allow",
    redUnderRevert: true,
    check: (v) => {
      const logs = v.scenarios.default.gateLogs;
      const pass = logs.length === EXPECTED_SKIPPED.length && logs.every((m) => m.includes("MIGRATION_WRITE_GATE=allow"));
      return { pass, detail: `${logs.length} 条日志${pass ? "均含放行方式" : "未全部含放行方式"}` };
    },
  },
  {
    id: "B5",
    title: "默认挡：info 日志声明「外部迁移写闸门=block（默认）」",
    redUnderRevert: true,
    check: (v) => {
      const pass = v.scenarios.default.infos.some((m) => m.includes("外部迁移写闸门=block（默认）"));
      return { pass, detail: pass ? "已声明 block" : "缺 block 声明" };
    },
  },
  {
    id: "B6",
    title: "非法取值 MIGRATION_WRITE_GATE=yes 按 fail-safe 视同挡",
    redUnderRevert: true,
    check: (v) => {
      const list = equalList(v.scenarios.illegal.executed, EXPECTED_STRUCTURE);
      const logs = checkSkipLogs(v.scenarios.illegal);
      return { pass: list.pass && logs.pass, detail: `执行列表：${list.detail}；日志：${logs.detail}` };
    },
  },
  {
    id: "A1",
    title: "显式放行（allow）：11 条语句全部执行（顺序一致）",
    redUnderRevert: false,
    check: (v) => equalList(v.scenarios.allow.executed, FIXTURE_STATEMENTS),
  },
  {
    id: "A2",
    title: "显式放行（allow）：没有写闸门跳过日志",
    redUnderRevert: false,
    check: (v) => {
      const logs = v.scenarios.allow.gateLogs;
      return { pass: logs.length === 0, detail: `${logs.length} 条跳过日志（期望 0）` };
    },
  },
  {
    id: "A3",
    title: "显式放行（allow）：info 日志声明「=allow（显式配置）」",
    redUnderRevert: false,
    check: (v) => {
      const pass = v.scenarios.allow.infos.some((m) => m.includes("外部迁移写闸门=allow（显式配置）"));
      return { pass, detail: pass ? "已声明 allow" : "缺 allow 声明" };
    },
  },
];

function gateFunctionsLineRange(source) {
  const names = ["DATA_WRITE_KEYWORDS", "resolveWriteGate", "stripLeadingComments", "firstKeyword", "isDataWriteStatement", "statementTarget"];
  const lines = source.split("\n");
  const hits = [];
  names.forEach((name) => {
    const i = lines.findIndex((l) => new RegExp(`export (const|function|type) ${name}\\b`).test(l));
    if (i >= 0) hits.push(`${name}@${i + 1}`);
  });
  return hits.join(" / ");
}

async function main() {
  const workDir = mkdtempSync(join(tmpdir(), "mig4-gate-"));
  const L = [];
  const json = { generatedAt: new Date().toISOString(), assertions: [] };

  const source = readMigrationSource();
  const reverted = makeGateDisabledSource(source);
  const newVariant = await loadMigrationModule(join(workDir, "new"), source, "new");
  const revertedVariant = await loadMigrationModule(join(workDir, "reverted"), reverted.source, "reverted");

  newVariant.scenarios = {
    default: await runScenario(newVariant.mod, newVariant.stubs, undefined),
    illegal: await runScenario(newVariant.mod, newVariant.stubs, "yes"),
    allow: await runScenario(newVariant.mod, newVariant.stubs, "allow"),
  };
  revertedVariant.scenarios = {
    default: await runScenario(revertedVariant.mod, revertedVariant.stubs, undefined),
    illegal: await runScenario(revertedVariant.mod, revertedVariant.stubs, "yes"),
    allow: await runScenario(revertedVariant.mod, revertedVariant.stubs, "allow"),
  };

  L.push("[MIG-4/gate-verify] 外部迁移写闸门（默认挡）：断言复跑 + 反测");
  L.push("  仓库根：" + REPO_ROOT);
  L.push("  被测源码：" + MIGRATION_TS);
  L.push("    源码 SHA256：" + sha256(source));
  L.push("    闸门定义行号：" + gateFunctionsLineRange(source));
  L.push("  同源用例文件：" + TEST_FILE);
  L.push("  反测版（把 resolveWriteGate 改回「永远 allow」）：");
  L.push("    替换块 " + JSON.stringify(reverted.matched[0].split("\n").join(" ⏎ ")));
  L.push("    替换为 " + JSON.stringify(reverted.revertedBlock.split("\n").join(" ⏎ ")));
  L.push("    反测版 SHA256：" + sha256(reverted.source));
  L.push("  临时模块目录：" + workDir);
  L.push("");
  L.push("== 逐条断言（正常版 / 反测版） ==");

  let newPass = 0;
  const redSlots = ASSERTIONS.filter((a) => a.redUnderRevert);
  let revertedRed = 0;
  let revertedGreen = 0;
  let revertedViolation = 0;

  for (const a of ASSERTIONS) {
    const normal = a.check(newVariant);
    let back;
    try {
      back = a.check(revertedVariant);
    } catch (e) {
      back = { pass: false, detail: "反测版执行异常：" + String(e && e.message ? e.message : e) };
    }
    if (normal.pass) newPass += 1;
    if (a.redUnderRevert) {
      if (!back.pass) revertedRed += 1;
      else revertedViolation += 1;
    } else if (back.pass) {
      revertedGreen += 1;
    } else {
      revertedViolation += 1;
    }
    L.push(
      "  [" + a.id + "] 正常版 " + (normal.pass ? "绿" : "红") + " / 反测版 " + (back.pass ? "绿" : "红") +
        "  " + a.title + (a.redUnderRevert ? "（反测位）" : "")
    );
    L.push("        正常版：" + normal.detail);
    if (!a.redUnderRevert || !back.pass) L.push("        反测版：" + back.detail);
    json.assertions.push({
      id: a.id,
      title: a.title,
      redUnderRevert: a.redUnderRevert,
      normalPass: normal.pass,
      normalDetail: normal.detail,
      revertedPass: back.pass,
      revertedDetail: back.detail,
    });
  }

  const ok = newPass === ASSERTIONS.length && revertedRed === redSlots.length && revertedViolation === 0;
  L.push("");
  L.push("== 汇总 ==");
  L.push("  断言总数 " + ASSERTIONS.length + "：反测位 " + redSlots.length + " 条 / 非反测位 " + (ASSERTIONS.length - redSlots.length) + " 条");
  L.push("  正常版（工作区真实源码）全绿：" + newPass + "/" + ASSERTIONS.length);
  L.push("  反测位在反测版（闸门改回不挡）变红：" + revertedRed + "/" + redSlots.length + "（要求全部为红）");
  L.push("  非反测位在反测版保持绿：" + revertedGreen + "/" + (ASSERTIONS.length - redSlots.length) + "（要求全部为绿）");
  L.push("  反测结果违反预期条数：" + revertedViolation + "（要求 0）");
  L.push("");
  L.push("RESULT: " + (ok ? "ALL PASS" : "FAILURES"));
  L.push("EXIT=" + (ok ? 0 : 1));

  json.summary = {
    assertions: ASSERTIONS.length,
    redSlots: redSlots.length,
    normalPassed: newPass,
    revertedRed,
    revertedGreen,
    revertedViolation,
    sourceSha256: sha256(source),
    revertedSha256: sha256(reverted.source),
    ok,
  };

  const text = L.join("\n") + "\n";
  writeFileSync(join(OUTDIR, "outputs", "04-gate-verify.txt"), text, "utf8");
  writeFileSync(join(OUTDIR, "outputs", "04-gate-verify.json"), JSON.stringify(json, null, 2), "utf8");
  writeFileSync(join(OUTDIR, "outputs", "04-reverted-gate.txt"), reverted.matched[0] + "\n\n→ 反测替换为：\n\n" + reverted.revertedBlock + "\n", "utf8");
  process.stdout.write(text);

  // 清理临时模块目录（只删本脚本自己创建的 tmpdir 子目录）
  const resolvedWorkDir = resolve(workDir);
  if (resolvedWorkDir.startsWith(resolve(tmpdir()))) rmSync(resolvedWorkDir, { recursive: true, force: true });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write("[MIG-4/gate-verify] 异常：" + String(e && e.stack ? e.stack : e) + "\n");
  process.exit(1);
});
