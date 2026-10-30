/**
 * TOTAL-MEMBER-STATUS-CONTRACT-01 · updateMemberManage 状态开关持久化契约（service 层）
 *
 * 派单卡：`ZXQL-WORK/projects/ms/tasks/inbox/ACTIVE-TOTAL-MEMBER-STATUS-CONTRACT-01.md`
 * 缺口（MOBILE-32F4F1 实证）：UPDATE 白名单无 status 列 ⇒ PUT {status} 静默不落库（200 伪成功）。
 *
 * 本文件证明（service 层口径）：
 *  a) UPDATE 白名单含 `status = COALESCE(?, status)`，值 ? 参数绑定，列名为字面白名单（无动态拼接）；
 *  b) WHERE 同时含会员 id 与 tenant_id（tenant-scope 值谓词）；
 *  c) 会员不存在 / 跨租户 ⇒ 404 且不执行 UPDATE（不伪成功）；
 *  d) 返回 { affectedRows }（真实 UPDATE ResultSetHeader）；status 回读复核失败 ⇒ 500 不伪成功；
 *
 * 反测（mutation 铁律）：摘掉 status 白名单（mutation①）/ 摘掉 tenant_id 条件（mutation②）
 *   ⇒ 对应用例必红；原始输出见 projects/ms/evidence/TOTAL-MEMBER-STATUS-CONTRACT-01/raw/2x-*。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  executeWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  executeWithTenant: mocks.executeWithTenant,
}));

import { updateMemberManage } from "../../../services/store/member.service";

const statusCodeOf = (e: unknown): number => (e as { statusCode?: number })?.statusCode ?? NaN;

describe("store/member.service · updateMemberManage 状态开关契约（TOTAL-MEMBER-STATUS-CONTRACT-01）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("1→0：UPDATE 白名单含 status、值 ? 绑定、WHERE 含 id+tenant_id，返回 affectedRows=1", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 9010 }) // ① exists（id+tenant 命中）
      .mockResolvedValueOnce({ status: 0 }); // ② 回读复核（库值=目标值）
    mocks.queryWithTenant.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE ResultSetHeader

    const ret = await updateMemberManage("t1", 9010, { status: 0 });

    expect(ret).toEqual({ affectedRows: 1 });
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("UPDATE t_member");
    expect(sql).toContain("status = COALESCE(?, status)");
    expect(sql).toContain("WHERE id = ? AND tenant_id = ?");
    expect(params).toContain(0); // status 目标值参数绑定（合法值仅 0/1，controller zod 收口）
    expect(params[params.length - 2]).toBe(9010); // id 条件绑定
    expect(params[params.length - 1]).toBe("t1"); // tenantId 条件绑定
    // 回读复核确实发生（成功=落库事实，非返回值伪造）
    expect(mocks.queryOneWithTenant).toHaveBeenCalledTimes(2);
    expect(mocks.queryOneWithTenant.mock.calls[1][0]).toContain("SELECT status FROM t_member WHERE id = ? AND tenant_id = ?");
  });

  it("0→1：参数绑定 1，回读复核=1，affectedRows=1", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 9010 })
      .mockResolvedValueOnce({ status: 1 });
    mocks.queryWithTenant.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const ret = await updateMemberManage("t1", 9010, { status: 1 });

    expect(ret).toEqual({ affectedRows: 1 });
    const [, params] = mocks.queryWithTenant.mock.calls[0];
    expect(params).toContain(1);
  });

  it("SET 列名为字面白名单：SQL 中不允许出现模板插值的动态列名", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 9010 })
      .mockResolvedValueOnce({ status: 0 });
    mocks.queryWithTenant.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await updateMemberManage("t1", 9010, { status: 0 });
    const [sql] = mocks.queryWithTenant.mock.calls[0];
    // 全部 SET 赋值均为「列 = COALESCE(?, 列)」形状；无 ${} 插值痕迹
    expect(sql).not.toMatch(/\$\{/);
    const setClause = sql.slice(sql.indexOf("SET") + 3, sql.indexOf("WHERE"));
    const cols = [...setClause.matchAll(/([a-z_]+)\s*=\s*COALESCE\(\?,\s*[a-z_]+\)/g)].map((m) => m[1]);
    expect(cols).toEqual([
      "name", "mobile", "customer_type", "status", "address", "card_no", "contact",
      "gender", "birthday", "province", "city", "district", "tags", "remark",
    ]);
    // SET 子句内除上述 14 个「列 = COALESCE(?, 列)」外不得有其他赋值（无动态拼接位）
    const stripped = setClause.replace(/[a-z_]+\s*=\s*COALESCE\(\?,\s*[a-z_]+\)/g, "").replace(/,/g, "").trim();
    expect(stripped).toBe("");
  });

  it("会员不存在：404，且不执行 UPDATE、不回读", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null); // exists 未命中

    let caught: unknown;
    try {
      await updateMemberManage("t1", 999999999, { status: 0 });
    } catch (e) {
      caught = e;
    }
    expect(statusCodeOf(caught)).toBe(404);
    expect((caught as Error)?.message).toBe("会员不存在");
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });

  it("跨租户：exists 按 id+tenant_id 查不到 ⇒ 404（不伪成功），UPDATE 不执行", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null); // 他租户行对本租户不可见

    let caught: unknown;
    try {
      await updateMemberManage("t1", 9011, { status: 0 });
    } catch (e) {
      caught = e;
    }
    expect(statusCodeOf(caught)).toBe(404);
    expect((caught as Error)?.message).toBe("会员不存在");
    const [sql, params] = mocks.queryOneWithTenant.mock.calls[0];
    expect(sql).toContain("WHERE id = ? AND tenant_id = ?");
    expect(params[0]).toBe(9011);
    expect(params[1]).toBe("t1");
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });

  it("UPDATE 静默未生效（回读≠目标）⇒ 500，不得伪成功", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 9010 })
      .mockResolvedValueOnce({ status: 1 }); // 回读仍是旧值 ⇒ 未落库
    mocks.queryWithTenant.mockResolvedValueOnce([{ affectedRows: 0 }]);

    let caught: unknown;
    try {
      await updateMemberManage("t1", 9010, { status: 0 });
    } catch (e) {
      caught = e;
    }
    expect(statusCodeOf(caught)).toBe(500);
    expect((caught as Error)?.message).toBe("会员状态更新未落库");
  });
});
