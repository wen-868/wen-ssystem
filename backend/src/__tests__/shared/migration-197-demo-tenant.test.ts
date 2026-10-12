/**
 * R101-S3-174-F1 迁移形状约束：197（演示租户隔离 · 判红后重做版）
 *
 * 依据：docs/tasks/cards/R101-派单-20261007-S3-174.md 一① / 二 / 三
 *       docs/tasks/cards/R101-S3-174-凌舟验收-判红.md 三（①~⑤ 逐条修复要求）
 *       docs/tasks/cards/R101-S3-174-F1-凌舟验收-判红-v2.md 四（S3-174-F2 第 1/2 项）
 *
 * 判红的三处生产同构硬伤，本测试各钉一条硬断言（谁改回去谁就红）：
 *   ① t_tenant 四个 NOT NULL 无默认值列（company_name / contact_person / contact_mobile /
 *      tenant_code）必须在**显式列清单**里，且**全文不得出现 INSERT IGNORE** ——
 *      IGNORE 会把 1364（该列无默认值）退化成 warning 并静默跳行，演示租户就建不出来。
 *   ② t_sys_user_role 唯一键是 uk_sys_user_role (user_id, role_id)（不含 tenant_id），
 *      故绑定必须"原地 UPDATE 改租户"，**禁止先插后删**（插被跳过、删照做 ⇒ 绑定归零）。
 *      本测试断言存在 UPDATE 语句、且**全文没有 DELETE**。
 *   ③ demo 菜单必须从 default 克隆（且子菜单 parent_id 要重指向 demo 自己的父行），
 *      否则演示租户 0 菜单。
 *   ④（S3-174-F2）t_sys_role 的角色行是"租户内实体"（uk_role_code_tenant），必须先从 default
 *      克隆到 demo（含 permissions —— 读路径真正取值的那一列），再把绑定行按 role_code 重指向
 *      demo 自己的角色行，否则 getUserPermissions（r.tenant_id = ur.tenant_id）与
 *      getUserMenus（r.tenant_id = ?）双双命中 0 行 ⇒ 手机端功能中心整屏空白。
 *
 * 另两条形状纪律（与 190/191/196 同口径）：
 *   · 可执行语句顶格写在注释块**之前**（规避踩坑日志[63]：以注释开头的整块语句被 runner 丢弃）
 *   · 注释文字内不得出现 ASCII 分号（否则注释块会被 splitSqlStatements 切成两半）
 * 切块/分类/加前缀直接复用生产代码（splitSqlStatements / addTablePrefix / isDataWriteStatement），
 * 与运行时第 8 步同管线，不另写复刻逻辑。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { addTablePrefix, splitSqlStatements, isDataWriteStatement, firstKeyword } from "../../shared/migration";

const MIGRATIONS_DIR = resolve(__dirname, "../../../../docs/migrations");
const FILE_197 = "197_演示租户隔离.sql";

/** 归一 CRLF：本仓 core.autocrlf=true，工作区检出为 CRLF（踩坑[153]/S3-133-F1） */
const raw = readFileSync(resolve(MIGRATIONS_DIR, FILE_197), "utf-8").replace(/\r\n/g, "\n");
const statements = splitSqlStatements(
  raw
    .split("\n")
    .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
    .join("\n")
);
const prepared = statements.map((s) => addTablePrefix(s));
const joined = prepared.join("\n");
/** 可执行语句流（不含注释块文本）：红线断言只针对真正会被执行的 SQL */
const sqlOnly = statements.join("\n");
const writes = statements.filter((s) => isDataWriteStatement(s));

describe("迁移 197 文件形状", () => {
  it("文件存在，且首行是可执行语句（不是注释块）", () => {
    expect(existsSync(resolve(MIGRATIONS_DIR, FILE_197))).toBe(true);
    const firstLine = raw.split("\n").find((line) => line.trim().length > 0) ?? "";
    expect(firstLine.trim().toUpperCase().startsWith("INSERT")).toBe(true);
  });

  it("切块后 9 条语句：7 条写语句 + 2 条跑后核对 SELECT", () => {
    expect(statements).toHaveLength(9);
    expect(writes).toHaveLength(7);
    expect(statements.filter((s) => firstKeyword(s) === "SELECT")).toHaveLength(2);
  });

  it("红线：全文不得出现 INSERT IGNORE（判红 ① 的根因就是它把 NOT NULL 违规静默吞掉）", () => {
    expect(/INSERT\s+IGNORE/i.test(sqlOnly)).toBe(false);
    expect(/INSERT\s+IGNORE/i.test(joined)).toBe(false);
  });

  it("判红①：建演示租户显式写齐四个 NOT NULL 无默认值列，存在性用 WHERE NOT EXISTS 判定", () => {
    expect(statements[0]).toMatch(/^INSERT INTO t_tenant \(/);
    for (const column of ["company_name", "contact_person", "contact_mobile", "tenant_code"]) {
      expect(statements[0]).toContain(column);
    }
    expect(statements[0]).toContain("'DEMO'");
    expect(statements[0]).toContain("WHERE NOT EXISTS (SELECT 1 FROM t_tenant WHERE id = 'demo')");
    // 迁移执行器 addTablePrefix 会把 `FROM DUAL` 改写成 `FROM t_DUAL`，故不得用 DUAL 取行
    expect(/FROM\s+DUAL/i.test(sqlOnly)).toBe(false);
    expect(/t_DUAL/i.test(joined)).toBe(false);
  });

  it("判红②：角色绑定是 UPDATE 原地改租户，且全文没有 DELETE（禁止先插后删）", () => {
    const bindingUpdate = writes.find(
      (s) => firstKeyword(s) === "UPDATE" && /UPDATE t_sys_user_role/i.test(s)
    );
    expect(bindingUpdate, "缺少 UPDATE t_sys_user_role 语句").toBeTruthy();
    // S3-174-F2：不再是"只改 tenant_id"，而是 role_id + tenant_id 一条 UPDATE 改完，防止迁移后
    // 绑定仍指向 default 的角色行（读路径按角色租户匹配 ⇒ 权限/菜单解析为空）
    expect(bindingUpdate!).toContain("SET ur.role_id = d.id, ur.tenant_id = 'demo'");
    expect(bindingUpdate!).toContain("username = 'demo'");
    expect(writes.filter((s) => firstKeyword(s) === "DELETE")).toHaveLength(0);
    expect(/DELETE\s+(FROM|src)/i.test(sqlOnly)).toBe(false);
    // 重指向按 role_code 对齐，且只搬"角色行还在别租户"的绑定（第二遍天然 0 行）
    expect(bindingUpdate!).toContain("d.role_code = s.role_code");
    expect(bindingUpdate!).toContain("WHERE s.tenant_id <> 'demo'");
    // 兜底补绑定必须在搬绑定之后，且用 LEFT JOIN ... IS NULL 表达"缺失才补"
    const fallback = writes.findIndex(
      (s) => firstKeyword(s) === "INSERT" && /INSERT INTO t_sys_user_role/i.test(s)
    );
    expect(fallback).toBeGreaterThan(writes.indexOf(bindingUpdate!));
    expect(writes[fallback]).toContain("LEFT JOIN t_sys_user_role ur ON ur.user_id = u.id");
    expect(writes[fallback]).toContain("ur.id IS NULL");
    // S3-174-F2：兜底句的角色查询必须限定 demo 租户 —— 克隆后 SUPER_ADMIN 在 default 与 demo
    // 各有一行，不限定就会补出指向 default 角色 id 的跨租户绑定
    expect(writes[fallback]).toContain("r.role_code = 'SUPER_ADMIN' AND r.tenant_id = 'demo'");
  });

  it("S3-174-F2：角色行先从 default 克隆到 demo（含 permissions），且顺序在建绑定之前", () => {
    const roleClone = statements.find(
      (s) => firstKeyword(s) === "INSERT" && /INSERT INTO t_sys_role/i.test(s)
    );
    expect(roleClone, "缺少“克隆角色行”语句").toBeTruthy();
    for (const column of ["role_code", "role_name", "description", "data_scope", "permissions", "status", "tenant_id"]) {
      expect(roleClone!).toContain(column);
    }
    expect(roleClone!).toContain("WHERE s.tenant_id = 'default'");
    expect(roleClone!).toContain("'demo'");
    expect(roleClone!).toContain(
      "NOT EXISTS (SELECT 1 FROM t_sys_role d WHERE d.tenant_id = 'demo' AND d.role_code = s.role_code)"
    );
    // 顺序铁律：先建 demo 的角色行，绑定行才可能重指向它（否则 JOIN 命中不到、绑定原地不动）
    const bindingUpdate = statements.find((s) => /UPDATE t_sys_user_role/i.test(s))!;
    expect(statements.indexOf(roleClone!)).toBeLessThan(statements.indexOf(bindingUpdate));
  });

  it("判红③：菜单从 default 克隆到 demo（顶级 + 子级各一条），子菜单 parent_id 重指向 demo 父行", () => {
    const menuClones = writes.filter(
      (s) => firstKeyword(s) === "INSERT" && /INSERT INTO t_sys_menu/i.test(s)
    );
    expect(menuClones).toHaveLength(2);
    expect(menuClones[0]).toContain("m.parent_id IS NULL");
    expect(menuClones[1]).toContain("m.parent_id IS NOT NULL");
    expect(menuClones[1]).toContain("p.menu_code = sp.menu_code");
    for (const clone of menuClones) {
      expect(clone).toContain("WHERE m.tenant_id = 'default'");
      expect(clone).toContain("'demo'");
      expect(clone).toContain("NOT EXISTS (SELECT 1 FROM t_sys_menu d WHERE d.tenant_id = 'demo' AND d.menu_code = m.menu_code)");
    }
  });

  it("零业务数据搬迁（判红⑤）：语句流里不出现任何业务表", () => {
    for (const table of [
      "t_sale_bill",
      "t_sale_bill_item",
      "t_member",
      "t_product_spu",
      "t_purchase_order",
      "t_store",
    ]) {
      expect(joined).not.toContain(table);
    }
    // 只允许这四张系统表（只取"表位"上的名字：FROM / JOIN / INTO / UPDATE / TABLE 之后，
    // 避免把 tenant_id 这类列名误当表名）
    const tables = [...joined.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+(t_[a-z0-9_]+)/gi)].map(
      (m) => m[1]
    );
    expect([...new Set(tables)].sort()).toEqual([
      "t_sys_menu",
      "t_sys_role",
      "t_sys_user",
      "t_sys_user_role",
      "t_tenant",
    ]);
  });

  it("addTablePrefix 不产生 t_t_ 前缀污染，表名保持 t_ 前缀", () => {
    expect(joined).not.toContain("t_t_");
    expect(joined).toContain("t_tenant");
    expect(joined).toContain("t_sys_user_role");
    expect(joined).toContain("t_sys_menu");
  });

  it("末两条是跑后核对 SELECT（demo_tenant_rows）与 result 摘要（run-migration.mjs 的完成标志）", () => {
    expect(firstKeyword(statements[7])).toBe("SELECT");
    expect(statements[7]).toContain("demo_tenant_rows");
    // S3-174-F2：核对输出必须能看出"角色行是否克隆到 demo"与"绑定是否命中本租户角色行"
    expect(statements[7]).toContain("demo_role_rows");
    expect(statements[7]).toContain("demo_bindings_on_own_role");
    expect(firstKeyword(statements[8])).toBe("SELECT");
    expect(statements[8]).toContain("AS result");
  });

  it("注释块给出回滚口径与写闸门警告，且注释文字内无 ASCII 分号（踩坑[63]）", () => {
    const commentLines = raw.split("\n").filter((line) => line.trim().startsWith("--"));
    expect(commentLines.length).toBeGreaterThan(20);
    for (const line of commentLines) {
      expect(line.includes(";")).toBe(false);
    }
    expect(raw).toContain("回滚");
    expect(raw).toContain("MIGRATION_WRITE_GATE");
    expect(raw).toContain("run-migration.mjs");
  });
});

describe("迁移编号不变量（197 唯一）", () => {
  it("docs/migrations 下 197 只对应本文件", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
    expect(files.filter((name) => name.startsWith("197_"))).toEqual([FILE_197]);
  });
});
