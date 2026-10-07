/**
 * R101-C6-4-1 迁移形状约束：190（t_library_call_log）/ 191（t_tenant_library_copy）
 *
 * 依据：docs/tasks/cards/R101-派单-20261001-C6-4-1.md 三、硬口径①
 *   · CREATE TABLE IF NOT EXISTS + 文本列**显式** COLLATE utf8mb4_0900_ai_ci + 零预置 + 不建物理外键
 *   · 可执行语句顶格写在注释块之前（规避踩坑日志 [63]：以注释开头的整块语句会被 runner 丢弃）
 *   · 注释文字内不得出现 ASCII 分号（否则注释块会被 splitSqlStatements 切成两半）
 * 切块与加前缀直接复用生产代码（splitSqlStatements / addTablePrefix），与运行时第 8 步同管线，不另写复刻逻辑。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { addTablePrefix, splitSqlStatements } from "../../shared/migration";

const MIGRATIONS_DIR = resolve(__dirname, "../../../../docs/migrations");

/** 归一 CRLF：本仓 core.autocrlf=true，工作区检出为 CRLF（踩坑 [153]/S3-133-F1） */
function readSql(file: string) {
  const abs = resolve(MIGRATIONS_DIR, file);
  expect(existsSync(abs), `缺少迁移文件 ${file}`).toBe(true);
  const raw = readFileSync(abs, "utf-8").replace(/\r\n/g, "\n");
  const cleaned = raw
    .split("\n")
    .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
    .join("\n");
  const statements = splitSqlStatements(cleaned);
  return { raw, statements, migrated: statements.map((s) => addTablePrefix(s)), joined: statements.map((s) => addTablePrefix(s)).join("\n") };
}

const MIG_190 = "190_商品库调取流水.sql";
const MIG_191 = "租户商品库调取映射.sql";
const FILE_191 = `191_${MIG_191}`;

/**
 * 当前最高迁移编号快照：196 = S3-58-F1-F1（平台管理员 t_platform_admin 补 MFA 两列）。
 * 190 = C6-4-1（商品库调取流水）、191 = C6-4-1（租户商品库调取映射）、192 = S3-144（租户建租户与
 * 归因落点补列）；193 = S3-147（租户班次类型）、194 = S3-151（条码唯一键改 `(tenant_id, barcode)`，见下）、
 * 195 = C6-3-2b（老带新台账 `t_referral_ledger`）、196 = S3-58-F1-F1（平台管理员 `t_platform_admin`
 * 补 `mfa_secret` VARCHAR(128) NULL ＋ `mfa_enabled` TINYINT NOT NULL DEFAULT 0）。本快照取**当时最高编号**（并行单若取更高号，以最高者为准）。
 * 本快照随每批迁移**显式同步**（同 C6-4-1-F2 口径：新增迁移必须被人显式承认），
 * 不得改为"只断言不重复"或删除"最高编号"断言。
 * 编号沿革：192 = S3-144（租户建租户与归因落点补列）；193 = S3-147 预留（只加 t_shift.shift_type 列，
 * 尚未合入 main，故本分支上按文件实算的最高编号就是 194）。
 */
const EXPECTED_MAX_MIGRATION = 196;

const mig190 = readSql(MIG_190);
const mig191 = readSql(FILE_191);

describe.each([
  { file: MIG_190, mig: mig190, table: "t_library_call_log", createCount: 1, selectCount: 3 },
  { file: FILE_191, mig: mig191, table: "t_tenant_library_copy", createCount: 1, selectCount: 4 },
])("迁移 $file 形状约束", ({ mig, table, selectCount }) => {
  it("文件头是可执行语句（不是注释块），首条为 CREATE TABLE IF NOT EXISTS", () => {
    const firstLine = mig.raw.split("\n").find((line) => line.trim().length > 0) ?? "";
    expect(firstLine.trim().toUpperCase().startsWith("CREATE TABLE IF NOT EXISTS")).toBe(true);
    expect(mig.statements[0]).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
  });

  it(`切块后共 ${selectCount + 1} 条可执行语句：1 条 CREATE TABLE + ${selectCount} 条跑后核对 SELECT`, () => {
    expect(mig.statements).toHaveLength(selectCount + 1);
    const selects = mig.migrated.filter((s) => /^SELECT/.test(s));
    expect(selects).toHaveLength(selectCount);
    expect(mig.migrated.filter((s) => s.includes("FROM information_schema")).length).toBeGreaterThanOrEqual(1);
  });

  it("零预置数据：无 INSERT / UPDATE / DELETE / REPLACE / CALL（写闸门 block 下也能整篇执行）", () => {
    for (const statement of mig.statements) {
      expect(statement).not.toMatch(/^\s*(INSERT|UPDATE|DELETE|REPLACE|CALL)\b/i);
    }
  });

  it("不建物理外键、不建反引号（MIG-2）、不 DROP、不 ALTER 既有表", () => {
    expect(mig.joined).not.toMatch(/FOREIGN\s+KEY/i);
    expect(mig.joined).not.toMatch(/REFERENCES/i);
    expect(mig.joined).not.toContain("`");
    expect(mig.joined).not.toMatch(/DROP\s+TABLE/i);
    expect(mig.joined).not.toMatch(/ALTER\s+TABLE/i);
    expect(mig.joined).not.toContain(`t_${table}`);
  });

  it("文本列显式 COLLATE utf8mb4_0900_ai_ci，且不得出现 utf8mb4_unicode_ci", () => {
    const create = mig.migrated[0];
    const textColumns = create.match(/CHARACTER SET utf8mb4/g) ?? [];
    const explicitCollate = create.match(/CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci/g) ?? [];
    expect(textColumns.length).toBeGreaterThan(0);
    // 每个文本列都必须紧跟显式 collate（不依赖库默认）
    expect(explicitCollate.length).toBe(textColumns.length);
    expect(mig.joined).not.toContain("utf8mb4_unicode_ci");
    expect(create).toContain("ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");
  });

  it("注释块全部位于可执行语句之后，且注释文字内无 ASCII 分号（踩坑 [63]）", () => {
    const lines = mig.raw.split("\n");
    const firstComment = lines.findIndex((line) => line.trim().startsWith("--"));
    const lastExecutable = lines.reduce(
      (last, line, index) => (line.trim().length > 0 && !line.trim().startsWith("--") ? index : last),
      0
    );
    expect(firstComment).toBeGreaterThan(lastExecutable);
    expect(lines.filter((line) => line.trim().startsWith("--")).join("\n")).not.toContain(";");
  });
});

describe("C6-4-1 两表的列/索引口径", () => {
  it("190：主键 + 三个查询索引 + 快照列 + call_type 默认 COPY + 只记成功的时间列", () => {
    const create = mig190.migrated[0];
    expect(create).toContain("PRIMARY KEY (id)");
    expect(create).toContain("KEY idx_call_created_tenant (created_at, tenant_id)");
    expect(create).toContain("KEY idx_call_tenant_created (tenant_id, created_at)");
    expect(create).toContain("KEY idx_call_spu_tenant (library_spu_id, tenant_id)");
    expect(create).toContain("library_spu_code VARCHAR(32)");
    expect(create).toContain("library_spu_name VARCHAR(256)");
    expect(create).toContain("call_type VARCHAR(16)");
    expect(create).toContain("DEFAULT 'COPY'");
    expect(create).toContain("created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    // 逻辑引用对齐被引用列类型（184 口径）：t_sys_user.id 是 INT UNSIGNED
    expect(create).toContain("operator_id INT UNSIGNED");
    expect(create).not.toContain("result");
  });

  it("191：幂等唯一键 (tenant_id, library_spu_id) + spu_id 反查索引（Q7 方案 B）", () => {
    const create = mig191.migrated[0];
    expect(create).toContain("UNIQUE KEY uk_tenant_library (tenant_id, library_spu_id)");
    expect(create).toContain("KEY idx_copy_spu (spu_id)");
    expect(create).toContain("copied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  });
});

describe("迁移编号不变量（190/191 各一号，最高编号唯一）", () => {
  it("190/191 各只对应一个文件，且最高编号 = 声明的 EXPECTED_MAX_MIGRATION（唯一）", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
    expect(files.filter((name) => name.startsWith("190_"))).toEqual([MIG_190]);
    expect(files.filter((name) => name.startsWith("191_"))).toEqual([FILE_191]);

    const numbered = files
      .map((name) => (/^(\d{3})_/.exec(name) ?? [])[1])
      .filter((value): value is string => !!value)
      .map(Number);
    const max = Math.max(...numbered);
    expect(max).toBe(EXPECTED_MAX_MIGRATION);
    expect(numbered.filter((value) => value === max)).toHaveLength(1);
  });
});
