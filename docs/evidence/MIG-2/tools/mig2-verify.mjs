/**
 * MIG-2 函数级行为验证 + 反测（本环境 vitest 不可运行，见派工卡 §六 E7）。
 *
 * 口径：
 *   A 列「新」  = 工作区 `backend/src/shared/migration.ts` 里的 addTablePrefix（文本抽取 + typescript 转译）
 *   B 列「旧」  = `docs/evidence/MIG-2/outputs/00-old-migration.ts.txt`（= `git show HEAD:backend/src/shared/migration.ts`）
 *                 里的 addTablePrefix —— 即**修复前版本**，等价于"把修复回退成修复前的模式"
 *   同时把"工作区文本 + 旧函数块"拼出的回退版源码落盘为 `outputs/00b-reverted-migration.ts.txt` 供人工核对。
 *
 * 用例断言与 `backend/src/__tests__/shared/migration.test.ts` 内新增的 `MIG-2:` 用例**同源同断言**
 * （vitest 跑不了，只能在本 harness 里以同一组断言复跑；harness 只复刻用例，不复刻被测函数）。
 *
 * 用法：node docs/evidence/MIG-2/tools/mig2-verify.mjs
 * 退出码：0 = 新全绿 且 反测位在旧版全红 且 冻结位在旧版全绿；1 = 否则。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAddTablePrefix, extractFunctionBlock } from "./mig2-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");
const OUTDIR = join(REPO_ROOT, "docs", "evidence", "MIG-2");
const NEW_FILE = join(REPO_ROOT, "backend", "src", "shared", "migration.ts");
const OLD_FILE = join(OUTDIR, "outputs", "00-old-migration.ts.txt");

/**
 * 用例表。oldMustFail=true 即"反测位"（修复前的模式必须让该用例变红）。
 * 期望值口径与测试文件一致：contains / notContains / exact。
 */
const CASES = [
  {
    id: "H01",
    title: "CREATE TABLE IF NOT EXISTS 反引号表名（缺陷复现位）",
    sql: "CREATE TABLE IF NOT EXISTS `open_webhook` (id INT);",
    exact: "CREATE TABLE IF NOT EXISTS `t_open_webhook` (id INT);",
    oldMustFail: true,
  },
  {
    id: "H02",
    title: "CREATE TABLE 反引号表名（无 IF NOT EXISTS）",
    sql: "CREATE TABLE `open_webhook` (id INT);",
    exact: "CREATE TABLE `t_open_webhook` (id INT);",
    oldMustFail: true,
  },
  {
    id: "H03",
    title: "CREATE TABLE IF NOT EXISTS 裸表名（回归位）",
    sql: "CREATE TABLE IF NOT EXISTS sys_user (id INT);",
    exact: "CREATE TABLE IF NOT EXISTS t_sys_user (id INT);",
    oldMustFail: false,
  },
  {
    id: "H04",
    title: "ALTER TABLE 反引号表名",
    sql: "ALTER TABLE `sys_user` ADD COLUMN name VARCHAR(50);",
    exact: "ALTER TABLE `t_sys_user` ADD COLUMN name VARCHAR(50);",
    oldMustFail: true,
  },
  {
    id: "H05",
    title: "INSERT INTO 反引号表名",
    sql: "INSERT INTO `open_webhook` (id) VALUES (1);",
    exact: "INSERT INTO `t_open_webhook` (id) VALUES (1);",
    oldMustFail: true,
  },
  {
    id: "H06",
    title: "语句首 UPDATE 反引号表名",
    sql: "UPDATE `open_webhook` SET status = 1;",
    exact: "UPDATE `t_open_webhook` SET status = 1;",
    oldMustFail: true,
  },
  {
    id: "H07",
    title: "DELETE FROM 反引号表名",
    sql: "DELETE FROM `open_webhook` WHERE id = 1;",
    exact: "DELETE FROM `t_open_webhook` WHERE id = 1;",
    oldMustFail: true,
  },
  {
    id: "H08",
    title: "FROM 子句反引号表名",
    sql: "SELECT * FROM `open_webhook` WHERE id = 1;",
    exact: "SELECT * FROM `t_open_webhook` WHERE id = 1;",
    oldMustFail: true,
  },
  {
    id: "H09",
    title: "JOIN 反引号表名",
    sql: "SELECT * FROM sys_user JOIN `sys_role` ON sys_user.role_id = sys_role.id;",
    contains: ["JOIN `t_sys_role`"],
    oldMustFail: true,
  },
  {
    id: "H10",
    title: "INSERT IGNORE INTO 反引号表名（走 INTO 模式）",
    sql: "INSERT IGNORE INTO `open_webhook` (id) VALUES (1);",
    exact: "INSERT IGNORE INTO `t_open_webhook` (id) VALUES (1);",
    oldMustFail: true,
  },
  {
    id: "H11",
    title: "RENAME TABLE 反引号表名",
    sql: "RENAME TABLE `open_webhook` TO open_webhook_old;",
    contains: ["RENAME TABLE `t_open_webhook`"],
    oldMustFail: true,
  },
  {
    id: "H12",
    title: "DROP TABLE IF EXISTS 反引号表名",
    sql: "DROP TABLE IF EXISTS `open_webhook`;",
    exact: "DROP TABLE IF EXISTS `t_open_webhook`;",
    oldMustFail: true,
  },
  {
    id: "H13",
    title: "反引号形态已带 t_ 前缀不重复加",
    sql: "CREATE TABLE `t_open_webhook` (id INT);",
    exact: "CREATE TABLE `t_open_webhook` (id INT);",
    oldMustFail: false,
  },
  {
    id: "H14",
    title: "反引号 + t_ 前缀的 INSERT/FROM 不重复加",
    sql: "INSERT INTO `t_open_webhook` (id) SELECT id FROM `t_open_webhook`;",
    notContains: ["t_t_open_webhook"],
    oldMustFail: false,
  },
  {
    id: "H15",
    title: "裸表名已带 t_ 前缀不重复加（回归位）",
    sql: "SELECT * FROM t_x;",
    exact: "SELECT * FROM t_x;",
    oldMustFail: false,
  },
  {
    id: "H16",
    title: "反引号包裹的 mysql 系统库不加前缀",
    sql: "SELECT * FROM `mysql`.`user`;",
    exact: "SELECT * FROM `mysql`.`user`;",
    oldMustFail: false,
  },
  {
    id: "H17",
    title: "关键字 IF / NOT / EXISTS 不得被当成表名",
    sql: "CREATE TABLE IF NOT EXISTS `open_webhook` (id INT);",
    notContains: ["t_IF", "t_NOT", "t_EXISTS"],
    oldMustFail: true,
  },
  {
    id: "H18",
    title: "字面量中已是 t_ 前缀的名字不被改写（回归位）",
    sql: "SELECT id FROM t_orders WHERE remark = 'JOIN t_x';",
    exact: "SELECT id FROM t_orders WHERE remark = 'JOIN t_x';",
    oldMustFail: false,
  },
  {
    id: "H19",
    title: "存量行为冻结：字面量 'FROM y' 的改写修复前后逐字节一致",
    sql: "INSERT INTO t_x (name) VALUES ('FROM y');",
    exact: "INSERT INTO t_x (name) VALUES ('FROM t_y');",
    oldMustFail: false,
  },
  {
    id: "H20",
    title: "非反引号输入零差异：已有 t_ 前缀的 UPDATE 原样返回",
    sql: "UPDATE t_x SET a = 1 WHERE id = 1;",
    exact: "UPDATE t_x SET a = 1 WHERE id = 1;",
    oldMustFail: false,
  },
];

/** 断言求值：返回 { pass, detail } */
function check(out, c) {
  const fails = [];
  if (c.exact !== undefined && out !== c.exact) fails.push(`exact 期望 ${JSON.stringify(c.exact)}`);
  for (const s of c.contains ?? []) if (!out.includes(s)) fails.push(`contains 期望含 ${JSON.stringify(s)}`);
  for (const s of c.notContains ?? []) if (out.includes(s)) fails.push(`notContains 期望不含 ${JSON.stringify(s)}`);
  return { pass: fails.length === 0, detail: fails.join("；") };
}

/** 把工作区源码里的函数块替换成旧函数块，产出"回退版"源码（不改工作区文件） */
function makeRevertedSource(newSrc, oldBlock) {
  const { block, startLine, endLine } = extractFunctionBlock(newSrc, "addTablePrefix");
  if (!newSrc.includes(block)) throw new Error("新函数块定位失败");
  return { text: newSrc.replace(block, oldBlock), oldStartLine: startLine, oldEndLine: endLine };
}

function main() {
  mkdirSync(join(OUTDIR, "outputs"), { recursive: true });
  const newSrc = readFileSync(NEW_FILE, "utf8");
  const oldSrc = readFileSync(OLD_FILE, "utf8");
  const n = loadAddTablePrefix(newSrc);
  const o = loadAddTablePrefix(oldSrc);

  const reverted = makeRevertedSource(newSrc, o.block);
  writeFileSync(join(OUTDIR, "outputs", "00b-reverted-migration.ts.txt"), reverted.text, "utf8");
  const r = loadAddTablePrefix(reverted.text);

  const L = [];
  const json = {
    generatedAt: new Date().toISOString(),
    newFile: "backend/src/shared/migration.ts",
    oldFile: "docs/evidence/MIG-2/outputs/00-old-migration.ts.txt (= git show HEAD:backend/src/shared/migration.ts)",
    sha256: { newBlock: n.sha256, oldBlock: o.sha256, revertedBlock: r.sha256 },
    lineRange: { newBlock: [n.startLine, n.endLine], oldBlock: [o.startLine, o.endLine] },
    cases: [],
  };
  L.push("[MIG-2/verify] addTablePrefix 函数级行为验证（真实源码抽取 + typescript.transpileModule 转译）");
  L.push("  新（工作区）：" + NEW_FILE);
  L.push("    函数块行号 " + n.startLine + "-" + n.endLine + "  SHA256 " + n.sha256);
  L.push("  旧（修复前）：" + OLD_FILE);
  L.push("    函数块行号 " + o.startLine + "-" + o.endLine + "  SHA256 " + o.sha256);
  L.push("  回退版（工作区文本 + 旧函数块，落盘 outputs/00b-reverted-migration.ts.txt）");
  L.push("    函数块 SHA256 " + r.sha256 + "（与「旧」一致=" + (r.sha256 === o.sha256) + "）");
  L.push("");
  L.push("== 逐用例 ==");
  L.push("  [id] 期望类型            新   旧   标题");
  let newPass = 0;
  let oldRed = 0;
  let oldGreen = 0;
  let frozenViolation = 0;
  let revertMismatch = 0;
  for (const c of CASES) {
    const outNew = n.fn(c.sql);
    const outOld = o.fn(c.sql);
    const outRev = r.fn(c.sql);
    const cn = check(outNew, c);
    const co = check(outOld, c);
    if (cn.pass) newPass += 1;
    if (c.oldMustFail) {
      if (!co.pass) oldRed += 1;
    } else if (co.pass) {
      oldGreen += 1;
    } else {
      frozenViolation += 1;
    }
    if (outRev !== outOld) revertMismatch += 1;
    const kind = c.exact !== undefined ? "exact" : c.contains ? "contains" : "notContains";
    L.push(
      "  [" + c.id + "] " + kind.padEnd(20, " ") + (cn.pass ? "绿" : "红") + "   " + (co.pass ? "绿" : "红") +
        "   " + c.title + (c.oldMustFail ? "（反测位）" : "")
    );
    if (!cn.pass) L.push("        新版本失败原因：" + cn.detail);
    if (!co.pass && !c.oldMustFail) L.push("        旧版本失败原因：" + co.detail);
    if (c.oldMustFail) {
      L.push("        修复前输出：" + JSON.stringify(outOld));
      L.push("        修复后输出：" + JSON.stringify(outNew));
    }
    json.cases.push({
      id: c.id,
      title: c.title,
      sql: c.sql,
      oldMustFail: c.oldMustFail,
      newPass: cn.pass,
      oldPass: co.pass,
      newDetail: cn.detail,
      oldDetail: co.detail,
      outputNew: outNew,
      outputOld: outOld,
    });
  }
  const redTotal = CASES.filter((c) => c.oldMustFail).length;
  const frozenTotal = CASES.filter((c) => !c.oldMustFail).length;
  L.push("");
  L.push("== 汇总 ==");
  L.push("  用例总数 " + CASES.length + "：反测位 " + redTotal + " 条 / 冻结（零新增差异）位 " + frozenTotal + " 条");
  L.push("  新版本（工作区）全绿：" + newPass + "/" + CASES.length);
  L.push("  旧版本（修复前）反测位变红：" + oldRed + "/" + redTotal + "（要求全部为红）");
  L.push("  旧版本（修复前）冻结位保持绿：" + oldGreen + "/" + frozenTotal + "（要求全部为绿＝零新增差异）");
  L.push("  回退版与旧版逐用例输出不一致条数：" + revertMismatch + "（要求 0）");
  L.push("");
  const ok = newPass === CASES.length && oldRed === redTotal && oldGreen === frozenTotal && revertMismatch === 0;
  L.push("RESULT: " + (ok ? "ALL PASS" : "FAILURES"));
  L.push("EXIT=" + (ok ? 0 : 1));
  json.ok = ok;
  json.summary = {
    cases: CASES.length,
    redSlots: redTotal,
    frozenSlots: frozenTotal,
    newPassed: newPass,
    oldRed,
    oldGreen,
    frozenViolation,
    revertMismatch,
  };

  const text = L.join("\n") + "\n";
  writeFileSync(join(OUTDIR, "outputs", "02-verify.txt"), text, "utf8");
  writeFileSync(join(OUTDIR, "outputs", "02-verify.json"), JSON.stringify(json, null, 2), "utf8");
  process.stdout.write(text);
  process.exit(ok ? 0 : 1);
}

main();
