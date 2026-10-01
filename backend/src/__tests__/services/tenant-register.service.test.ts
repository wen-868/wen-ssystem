import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
  hashPassword: vi.fn(),
  validatePassword: vi.fn(),
  isSmsVerifyEnabled: vi.fn(),
  sendSms: vi.fn(),
  resolveAttributionTarget: vi.fn(),
  writeTenantAttribution: vi.fn(),
}));

// S3-150-F1：判定"插入 t_tenant 本表"。表名后必须紧跟 `(`，
// 以排除 `t_tenant_admin (...)`、`t_tenant_register_application (...)` 等同前缀表。
const isTenantInsert = (sql: string) => /INSERT\s+INTO\s+t_tenant\s*\(/i.test(sql);

vi.mock("../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
  connQueryOne: vi.fn(),
}));

vi.mock("../../shared/password", () => ({
  hashPassword: mocks.hashPassword,
  validatePassword: mocks.validatePassword,
}));

vi.mock("../../shared/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../services/platform/platform-tenant-attribution.service", () => ({
  resolveAttributionTarget: mocks.resolveAttributionTarget,
  writeTenantAttribution: mocks.writeTenantAttribution,
}));

vi.mock("../../services/sms.service", () => ({
  verifySmsCode: vi.fn().mockResolvedValue(undefined),
  isSmsVerifyEnabled: mocks.isSmsVerifyEnabled,
  sendSms: mocks.sendSms,
}));

import {
  applyTenantRegister,
  approveTenantApplication,
  rejectTenantApplication,
  listTenantApplications,
  getTenantApplication,
} from "../../services/tenant-register.service";

describe("tenant-register.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validatePassword.mockReturnValue({ valid: true, errors: [] });
    mocks.hashPassword.mockResolvedValue("hashed_password");
    mocks.query.mockResolvedValue({ insertId: 1 });
    mocks.isSmsVerifyEnabled.mockResolvedValue(false);
    // S3-144：默认未携带邀请码/代理商（官网自注册，不写归因）
    mocks.resolveAttributionTarget.mockResolvedValue(null);
    mocks.writeTenantAttribution.mockResolvedValue({ id: 1 });
  });

  describe("applyTenantRegister", () => {
    const validInput = {
      company_name: "测试公司",
      contact_person: "张三",
      contact_mobile: "13800000000",
      admin_username: "admin",
      admin_password: "Pass@1234",
      admin_real_name: "张三",
    };

    it("密码强度不足应拒绝", async () => {
      mocks.validatePassword.mockReturnValue({ valid: false, errors: ["密码长度不足"] });
      await expect(applyTenantRegister(validInput)).rejects.toThrow("密码不符合要求");
    });

    it("公司名称已存在应拒绝", async () => {
      mocks.queryOne.mockResolvedValueOnce({ id: 1 });
      await expect(applyTenantRegister(validInput)).rejects.toThrow("该公司名称已提交过注册申请");
    });

    it("手机号已存在应拒绝", async () => {
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.queryOne.mockResolvedValueOnce({ id: 1 });
      await expect(applyTenantRegister(validInput)).rejects.toThrow("该手机号已提交过注册申请");
    });

    it("管理员账号已被使用（申请表）应拒绝", async () => {
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.queryOne.mockResolvedValueOnce({ id: 1 });
      await expect(applyTenantRegister(validInput)).rejects.toThrow("该管理员账号已被使用");
    });

    it("管理员账号已被使用（用户表）应拒绝", async () => {
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.queryOne.mockResolvedValueOnce(null);
      mocks.queryOne.mockResolvedValueOnce({ id: 1 });
      await expect(applyTenantRegister(validInput)).rejects.toThrow("该管理员账号已被使用");
    });

    it("短信开关开启时验证码必填", async () => {
      mocks.isSmsVerifyEnabled.mockResolvedValue(true);
      await expect(applyTenantRegister(validInput)).rejects.toThrow("请输入短信验证码");
    });

    it("短信开关开启且验证码正确时提交成功", async () => {
      mocks.isSmsVerifyEnabled.mockResolvedValue(true);
      mocks.queryOne.mockResolvedValue(null);
      mocks.query.mockResolvedValue({ insertId: 123 });

      const result = await applyTenantRegister({ ...validInput, sms_code: "123456" });

      expect(result).toEqual({ applicationId: 123 });
      expect(mocks.hashPassword).toHaveBeenCalledWith("Pass@1234");
      expect(mocks.query).toHaveBeenCalled();
    });

    it("注册申请提交成功", async () => {
      mocks.queryOne.mockResolvedValue(null);
      mocks.query.mockResolvedValue({ insertId: 123 });

      const result = await applyTenantRegister(validInput);

      expect(result).toEqual({ applicationId: 123 });
      expect(mocks.hashPassword).toHaveBeenCalledWith("Pass@1234");
      expect(mocks.query).toHaveBeenCalled();
    });

    it("S3-144：带推广码/代理商注册时随申请落库（camelCase 也受理）", async () => {
      mocks.queryOne.mockResolvedValue(null);
      mocks.query.mockResolvedValue({ insertId: 321 });

      await applyTenantRegister({
        ...validInput,
        promoCode: "PCABCDEFGH",
        agentId: 7,
      } as any);

      const [sql, params] = mocks.query.mock.calls[0];
      expect(String(sql)).toContain("promo_code, agent_id");
      // 列顺序 = company_name, company_short_name, contact_person, contact_mobile, contact_email（原实现传反，随本单修正）
      expect(params[2]).toBe("张三");
      expect(params[3]).toBe("13800000000");
      expect(params.slice(-2)).toEqual(["PCABCDEFGH", 7]);
    });

    it("S3-144：推广码超长（>32）⇒ 400", async () => {
      await expect(
        applyTenantRegister({ ...validInput, promo_code: "P".repeat(33) })
      ).rejects.toThrow("推广码格式不正确");
    });

    it("S3-144：代理商ID非法 ⇒ 400", async () => {
      await expect(
        applyTenantRegister({ ...validInput, agent_id: "abc" })
      ).rejects.toThrow("代理商ID不合法");
    });
  });

  describe("approveTenantApplication", () => {
    const applicationRow = {
      id: 1,
      company_name: "测试公司",
      company_short_name: "测试",
      contact_person: "张三",
      contact_mobile: "13800000000",
      contact_email: "test@test.com",
      admin_username: "admin",
      admin_password_hash: "hashed",
      admin_real_name: "张三",
      status: "PENDING",
      promo_code: null,
      agent_id: null,
    };

    it("申请不存在应拒绝", async () => {
      mocks.queryOne.mockResolvedValue(null);
      await expect(approveTenantApplication(999, 1)).rejects.toThrow("申请不存在或已处理");
    });

    it("申请审核通过并初始化门店/价格等级/支付方式", async () => {
      mocks.queryOne.mockResolvedValue(applicationRow);
      const sqlCalls: string[] = [];
      const tenantInsertCalls: { sql: string; params: unknown[] }[] = [];
      mocks.connExecute.mockImplementation(async (_conn: any, sql: string, params: unknown[] = []) => {
        sqlCalls.push(sql);
        if (isTenantInsert(sql)) {
          tenantInsertCalls.push({ sql, params });
          return [{ insertId: 100 }];
        }
        return [{ insertId: 1 }];
      });
      mocks.transaction.mockImplementation(async (cb: any) => {
        const mockConn = {};
        await cb(mockConn);
      });

      const result = await approveTenantApplication(1, 99);

      expect(result.applicationId).toBe(1);
      expect(result.tenantId).toBeTruthy();
      expect(sqlCalls.some((s) => s.includes("INSERT INTO t_store"))).toBe(true);
      expect(sqlCalls.some((s) => s.includes("INSERT INTO t_price_level"))).toBe(true);
      expect(sqlCalls.some((s) => s.includes("INSERT INTO t_payment_method"))).toBe(true);
      expect(sqlCalls.some((s) => s.includes("UPDATE t_tenant_register_application"))).toBe(true);
      // 未携带邀请码/代理商 ⇒ 官网自注册，不写归因
      expect(mocks.writeTenantAttribution).not.toHaveBeenCalled();

      // S3-150：审批建租户必须写 tenant_name（此前漏写 ⇒ 平台租户列表名称为空）
      expect(tenantInsertCalls.length).toBe(1);
      expect(tenantInsertCalls[0].sql).toContain("tenant_name");
      expect(tenantInsertCalls[0].params[2]).toBe("测试"); // name
      expect(tenantInsertCalls[0].params[3]).toBe("测试"); // tenant_name（与 name 同源）
    });

    it("S3-144：带推广码注册，审批通过写归因且 source=INVITATION", async () => {
      mocks.queryOne.mockResolvedValue({ ...applicationRow, promo_code: "PCABCDEFGH" });
      mocks.resolveAttributionTarget.mockResolvedValue({
        attributionType: "PROMO",
        promoCodeId: 12,
        agentId: null,
      });
      const calls: Array<{ sql: string; params: unknown[] }> = [];
      mocks.connExecute.mockImplementation(async (_conn: any, sql: string, params: unknown[]) => {
        calls.push({ sql, params });
        return [{ insertId: 1 }];
      });
      mocks.transaction.mockImplementation(async (cb: any) => {
        await cb({});
      });

      const result = await approveTenantApplication(1, 99);

      expect(mocks.resolveAttributionTarget).toHaveBeenCalledWith({
        promoCode: "PCABCDEFGH",
        agentId: null,
      });
      expect(mocks.writeTenantAttribution).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: result.tenantId,
          attributionType: "PROMO",
          promoCodeId: 12,
          agentId: null,
        }),
        expect.anything()
      );
      const tenantInsert = calls.find((c) => isTenantInsert(c.sql));
      expect(tenantInsert?.params).toContain("INVITATION");
    });

    it("S3-144：邀请码非法 ⇒ 400 且不建租户（不产生半成品）", async () => {
      mocks.queryOne.mockResolvedValue({ ...applicationRow, promo_code: "PCNOTEXIST" });
      mocks.resolveAttributionTarget.mockRejectedValue(
        Object.assign(new Error("推广码不存在：PCNOTEXIST"), { statusCode: 400 })
      );

      await expect(approveTenantApplication(1, 99)).rejects.toThrow("推广码不存在");
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("company_short_name 为空时 tenant_name 回退 company_name（S3-150）", async () => {
      mocks.queryOne.mockResolvedValue({ ...applicationRow, company_short_name: "" });
      const tenantInsertCalls: { sql: string; params: unknown[] }[] = [];
      mocks.connExecute.mockImplementation(async (_conn: any, sql: string, params: unknown[] = []) => {
        if (isTenantInsert(sql)) {
          tenantInsertCalls.push({ sql, params });
        }
        return [{ insertId: 1 }];
      });
      mocks.transaction.mockImplementation(async (cb: any) => {
        await cb({});
      });

      await approveTenantApplication(1, 99);

      expect(tenantInsertCalls.length).toBe(1);
      expect(tenantInsertCalls[0].sql).toContain("tenant_name");
      expect(tenantInsertCalls[0].params[2]).toBe("测试公司");
      expect(tenantInsertCalls[0].params[3]).toBe("测试公司");
    });

    it("短信开关开启时发送审核通过通知", async () => {
      mocks.queryOne
        .mockResolvedValueOnce(applicationRow) // 申请查询
        .mockResolvedValueOnce({ code: "SMS_TENANT_REGISTER_RESULT" }); // 模板查询
      mocks.isSmsVerifyEnabled.mockResolvedValue(true);
      mocks.connExecute.mockResolvedValue([{ insertId: 1 }]);
      mocks.transaction.mockImplementation(async (cb: any) => {
        const mockConn = {};
        await cb(mockConn);
      });

      await approveTenantApplication(1, 99);

      expect(mocks.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          mobile: "13800000000",
          templateCode: "SMS_TENANT_REGISTER_RESULT",
          tenantId: "default",
        })
      );
    });
  });

  describe("rejectTenantApplication", () => {
    it("申请不存在应拒绝", async () => {
      mocks.queryOne.mockResolvedValue(null);
      await expect(rejectTenantApplication(999, 1, "理由")).rejects.toThrow("申请不存在或已处理");
    });

    it("申请驳回成功", async () => {
      mocks.queryOne.mockResolvedValue({ id: 1 });
      mocks.query.mockResolvedValue({ affectedRows: 1 });

      const result = await rejectTenantApplication(1, 99, "资料不全");

      expect(result).toEqual({ applicationId: 1 });
      expect(mocks.query).toHaveBeenCalled();
    });
  });

  describe("listTenantApplications", () => {
    it("查询申请列表", async () => {
      mocks.queryOne.mockResolvedValue({ total: 5 });
      mocks.query.mockResolvedValue([
        { id: 1, company_name: "公司A", contact_person: "张三", contact_mobile: "13800000001", admin_username: "admin1", status: "PENDING", created_at: "2026-07-12" },
      ]);

      const result = await listTenantApplications({});

      expect(result.total).toBe(5);
      expect(result.items.length).toBe(1);
      expect(result.items[0].company_name).toBe("公司A");
    });

    it("按状态筛选申请列表", async () => {
      mocks.queryOne.mockResolvedValue({ total: 2 });
      mocks.query.mockResolvedValue([]);

      const result = await listTenantApplications({ status: "APPROVED", page: 2, pageSize: 10 });

      expect(result.total).toBe(2);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });
  });

  describe("getTenantApplication", () => {
    it("查询申请详情", async () => {
      mocks.queryOne.mockResolvedValue({
        id: 1,
        company_name: "公司A",
        contact_person: "张三",
        contact_mobile: "13800000001",
        admin_username: "admin1",
        status: "PENDING",
        created_at: "2026-07-12",
      });

      const result = await getTenantApplication(1);

      expect(result).not.toBeNull();
      expect(result?.company_name).toBe("公司A");
    });

    it("申请不存在返回null", async () => {
      mocks.queryOne.mockResolvedValue(null);

      const result = await getTenantApplication(999);

      expect(result).toBeNull();
    });
  });
});
