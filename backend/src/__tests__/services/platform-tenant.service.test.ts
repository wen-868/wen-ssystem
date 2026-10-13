import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  connExecute: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  connExecute: mocks.connExecute,
  transaction: mocks.transaction,
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed_password") },
}));

import {
  listTenants,
  getTenantById,
  checkTenantNameExists,
  updateTenant,
  toggleTenantStatus,
  createTenant,
  toTenantStatus,
  toTenantStatusValue,
} from "../../services/platform-tenant.service";

/** t_tenant.id 是 VARCHAR(36)：存量有 'default' 与 UUID 两种值 */
const UUID_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue({ insertId: 0 });
});

describe("platform-tenant.service - 平台租户管理", () => {
  it("listTenants 无关键词返回全量分页，且出口 status 统一为字符串口径", async () => {
    mocks.queryOne.mockResolvedValue({ total: 1 });
    mocks.query.mockResolvedValue([{ id: UUID_ID, tenantName: "酒行A", status: 1 }]);
    const res = await listTenants(1, 20);
    expect(res.total).toBe(1);
    expect(res.records[0].tenantName).toBe("酒行A");
    expect(res.records[0].id).toBe(UUID_ID);
    expect(res.records[0].status).toBe("ACTIVE");
    expect(mocks.query.mock.calls[0][0]).toContain("LIMIT ? OFFSET ?");
  });

  it("listTenants 带关键词时拼接 LIKE 条件", async () => {
    mocks.queryOne.mockResolvedValue({ total: 0 });
    mocks.query.mockResolvedValue([]);
    await listTenants(2, 10, "酒");
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("tenant_name LIKE ?");
    expect(mocks.query.mock.calls[0][1]).toEqual(["%酒%", 10, 10]);
  });

  it("getTenantById 按字符串主键查询（UUID 不再被 Number() 成 NaN），并映射 status", async () => {
    mocks.queryOne.mockResolvedValue({ id: UUID_ID, tenantName: "酒行A", status: 0 });
    const res = await getTenantById(UUID_ID);
    expect(mocks.queryOne.mock.calls[0][1]).toEqual([UUID_ID]);
    expect(res?.tenantName).toBe("酒行A");
    expect(res?.status).toBe("DISABLED");
  });

  it("getTenantById 未命中返回 null（调用方按 404 处理）", async () => {
    mocks.queryOne.mockResolvedValue(null);
    expect(await getTenantById("not-exist")).toBeNull();
  });

  it("checkTenantNameExists 命中返回 true，未命中 false", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: "default" });
    expect(await checkTenantNameExists("酒行A")).toBe(true);
    mocks.queryOne.mockResolvedValueOnce(null);
    expect(await checkTenantNameExists("不存在")).toBe(false);
  });

  it("updateTenant 未知 id ⇒ 业务级 404（不静默成功）", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(updateTenant("not-exist", { tenantName: "改名" })).rejects.toMatchObject({
      statusCode: 404,
      message: "租户不存在",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  describe("toggleTenantStatus - 对外字符串 / 对库 TINYINT（S3-150）", () => {
    it("ACTIVE ⇒ 落库 1，回读返回 'ACTIVE'（主键原样字符串传参）", async () => {
      mocks.query.mockResolvedValue({ affectedRows: 1 });
      mocks.queryOne.mockResolvedValue({ status: 1 });

      const applied = await toggleTenantStatus(UUID_ID, "ACTIVE");

      expect(applied).toBe("ACTIVE");
      expect(mocks.query.mock.calls[0][0]).toContain("UPDATE t_tenant SET status = ?");
      expect(mocks.query.mock.calls[0][1]).toEqual([1, UUID_ID]);
      expect(mocks.queryOne.mock.calls[0][1]).toEqual([UUID_ID]);
    });

    it("DISABLED ⇒ 落库 0，回读返回 'DISABLED'", async () => {
      mocks.query.mockResolvedValue({ affectedRows: 1 });
      mocks.queryOne.mockResolvedValue({ status: 0 });

      const applied = await toggleTenantStatus(UUID_ID, "DISABLED");

      expect(applied).toBe("DISABLED");
      expect(mocks.query.mock.calls[0][1]).toEqual([0, UUID_ID]);
    });

    it("兼容 mock 模式把写结果包成数组的归一化形态", async () => {
      mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
      mocks.queryOne.mockResolvedValue({ status: 1 });
      expect(await toggleTenantStatus(UUID_ID, "ACTIVE")).toBe("ACTIVE");
    });

    it("未知 id（affectedRows=0）⇒ 404，不当成功返回（S3-65 教训）", async () => {
      mocks.query.mockResolvedValue({ affectedRows: 0 });

      await expect(toggleTenantStatus("not-exist", "ACTIVE")).rejects.toMatchObject({
        statusCode: 404,
        message: "租户不存在",
      });
      expect(mocks.queryOne).not.toHaveBeenCalled();
    });

    it("非法 status 取值 ⇒ 400 且不落库（不静默兜底）", async () => {
      await expect(toggleTenantStatus(UUID_ID, "SUSPENDED" as never)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(mocks.query).not.toHaveBeenCalled();
    });
  });

  describe("createTenant（S3-144 A 项真缺陷修复）", () => {
    const input = {
      tenantName: "测试租户",
      contactName: "张三",
      contactMobile: "13800000000",
      adminUsername: "admin",
      adminPassword: "Pass@1234",
    };

    /** S3-183：createTenant 改为事务内执行（租户 + 管理员 + 角色/菜单 + 绑定必须原子产出） */
    let connCalls: { sql: string; params: unknown[] }[];
    beforeEach(() => {
      connCalls = [];
      const conn = {
        query: vi.fn(async (sql: string, params: unknown[] = []) => {
          connCalls.push({ sql: String(sql), params });
          return [{ affectedRows: 1 }];
        }),
        execute: vi.fn(),
      };
      mocks.transaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) => cb(conn));
      mocks.connExecute.mockResolvedValue([{ insertId: 77 }]);
    });

    const tenantInsertCalls = () => connCalls.filter((c) => /INSERT INTO t_tenant \(/i.test(c.sql));

    it("返回真实 UUID（非 0 insertId）且补齐 NOT NULL 列", async () => {
      const tenantId = await createTenant(input);

      // 真实 tenant_id 由应用层生成，绝不是 MySQL insertId（VARCHAR 主键下恒 0）
      expect(tenantId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(tenantId).not.toBe("0");

      const [{ sql, params }] = tenantInsertCalls();
      expect(String(sql)).toContain("INSERT INTO t_tenant");
      for (const column of [
        "id",
        "tenant_code",
        "name",
        "company_name",
        "contact_person",
        "contact_mobile",
        "source",
      ]) {
        expect(String(sql)).toContain(column);
      }
      // 数值状态（t_tenant.status 是 TINYINT），来源固定 MANUAL（平台侧开租户不是归因宿主）
      expect(String(sql)).toContain("'MANUAL', 1");
      expect(params[0]).toBe(tenantId);
      expect(params[1]).toMatch(/^T\d{8}\d{5}$/);
    });

    it("租户编码按 T+日期+随机 生成且同批两次不同", async () => {
      await createTenant(input);
      await createTenant({ ...input, tenantName: "测试租户2" });
      const [first, second] = tenantInsertCalls();
      const code1 = first.params[1];
      const code2 = second.params[1];
      expect(code1).not.toBe(code2);
    });

    it("管理员账号落在新租户下（tenant_id 用同一个 UUID）", async () => {
      const tenantId = await createTenant(input);
      const userInsert = mocks.connExecute.mock.calls[0];
      // connExecute(conn, sql, params)
      expect(String(userInsert[1])).toContain("INSERT INTO t_sys_user");
      expect((userInsert[2] as unknown[])[0]).toBe(tenantId);
    });

    it("S3-183：同事务内克隆角色/菜单并把首管绑到本租户 SUPER_ADMIN（否则新租户功能中心空白）", async () => {
      const tenantId = await createTenant(input);

      const roleClone = connCalls.find((c) => /^INSERT INTO t_sys_role/i.test(c.sql.trim()));
      const menuClones = connCalls.filter((c) => /^INSERT INTO t_sys_menu/i.test(c.sql.trim()));
      const bind = connCalls.find((c) => /^INSERT INTO t_sys_user_role/i.test(c.sql.trim()));

      expect(roleClone, "缺少角色克隆语句").toBeTruthy();
      expect(menuClones).toHaveLength(2);
      expect(bind, "缺少管理员绑定语句").toBeTruthy();
      // 三条供给语句都必须落在**新租户**上，且绑定的角色查询限定本租户
      expect(roleClone!.params).toContain(tenantId);
      expect(bind!.sql).toContain("r.tenant_id = ? AND r.role_code = ?");
      expect(bind!.params[1]).toBe(tenantId);
      // 次序：先建租户与管理员，再克隆角色/菜单，最后绑定
      expect(connCalls.map((c) => c.sql.trim().split(/\s+/).slice(0, 3).join(" "))).toEqual([
        "INSERT INTO t_tenant",
        "INSERT INTO t_sys_role",
        "INSERT INTO t_sys_menu",
        "INSERT INTO t_sys_menu",
        "INSERT INTO t_sys_user_role",
      ]);
    });
  });

  it("映射函数：DB 值 ↔ 对外字符串（与 S3-138 平台管理员同口径）", () => {
    expect(toTenantStatus(1)).toBe("ACTIVE");
    expect(toTenantStatus("1")).toBe("ACTIVE");
    expect(toTenantStatus("ACTIVE")).toBe("ACTIVE");
    expect(toTenantStatus(0)).toBe("DISABLED");
    expect(toTenantStatus("0")).toBe("DISABLED");
    expect(toTenantStatus("DISABLED")).toBe("DISABLED");
    expect(toTenantStatus(null)).toBe("ACTIVE");

    expect(toTenantStatusValue("ACTIVE")).toBe(1);
    expect(toTenantStatusValue("1")).toBe(1);
    expect(toTenantStatusValue("DISABLED")).toBe(0);
    expect(toTenantStatusValue("0")).toBe(0);
    expect(toTenantStatusValue("SUSPENDED")).toBeNull();
  });
});
