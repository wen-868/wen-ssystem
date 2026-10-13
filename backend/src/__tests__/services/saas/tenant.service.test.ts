import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), queryOne: vi.fn(), transaction: vi.fn(), makeBizNo: vi.fn() }));
vi.mock("../../../shared/db", () => ({ query: mocks.query, queryOne: mocks.queryOne, transaction: mocks.transaction }));
vi.mock("../../../shared/id", () => ({ makeBizNo: mocks.makeBizNo }));
import { listTenants, getTenantDetail, createTenant, updateTenant, auditTenant, toggleTenantStatus, getTenantStatistics } from "../../../services/saas/tenant.service";

describe("saas tenant.service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("listTenants", () => {
    it("无筛选条件返回分页", async () => {
      mocks.query.mockResolvedValue([]);
      mocks.queryOne.mockResolvedValue({ total: 0 });
      const res = await listTenants({ page: 1, pageSize: 10 });
      expect(res.total).toBe(0);
      expect(res.page).toBe(1);
      expect(res.pageSize).toBe(10);
      expect(res.records).toEqual([]);
    });

    it("带keyword筛选", async () => {
      mocks.query.mockResolvedValue([{ id: 1, companyName: "测试公司", tenantCode: "T001" }]);
      mocks.queryOne.mockResolvedValue({ total: 1 });
      const res = await listTenants({ page: 1, pageSize: 10, keyword: "测试" });
      expect(res.total).toBe(1);
      expect(res.records[0].companyName).toBe("测试公司");
    });

    it("带status筛选", async () => {
      mocks.query.mockResolvedValue([{ id: 1, status: "ACTIVE", companyName: "活跃公司" }]);
      mocks.queryOne.mockResolvedValue({ total: 1 });
      const res = await listTenants({ page: 1, pageSize: 10, status: "ACTIVE" });
      expect(res.total).toBe(1);
      expect(res.records[0].status).toBe("ACTIVE");
    });

    it("带keyword和status组合筛选", async () => {
      mocks.query.mockResolvedValue([{ id: 1, companyName: "测试公司", status: "ACTIVE" }]);
      mocks.queryOne.mockResolvedValue({ total: 1 });
      const res = await listTenants({ page: 1, pageSize: 10, keyword: "测试", status: "ACTIVE" });
      expect(res.total).toBe(1);
    });
  });

  describe("getTenantDetail", () => {
    it("租户不存在返回null", async () => {
      mocks.queryOne.mockResolvedValue(null);
      const res = await getTenantDetail(999);
      expect(res).toBeNull();
    });

    it("租户存在返回详情含stats", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1, tenantCode: "T001", companyName: "测试公司", status: "ACTIVE" })
        .mockResolvedValueOnce({ totalUsers: 5, totalStores: 2, totalProducts: 100, totalMembers: 500, recentOrders: 10 });
      const res = await getTenantDetail(1);
      expect(res).not.toBeNull();
      expect(res!.tenantCode).toBe("T001");
      expect(res!.stats).toBeDefined();
      expect(res!.stats!.totalUsers).toBe(5);
    });
  });

  describe("createTenant", () => {
    it("创建租户成功", async () => {
      mocks.makeBizNo.mockReturnValue("T20260101001");
      mocks.query.mockResolvedValue({ insertId: 1 });
      mocks.queryOne.mockResolvedValue({ id: 1, tenantCode: "T20260101001", companyName: "测试公司", status: "ACTIVE" });
      const res = await createTenant({
        companyName: "测试公司",
        contactPerson: "张三",
        contactMobile: "13800138000",
        source: "MANUAL",
      });
      expect(res.tenantCode).toBe("T20260101001");
      expect(res.status).toBe("ACTIVE");
    });

    it("创建租户带可选字段", async () => {
      mocks.makeBizNo.mockReturnValue("T20260101002");
      mocks.query.mockResolvedValue({ insertId: 2 });
      mocks.queryOne.mockResolvedValue({ id: 2, tenantCode: "T20260101002", companyName: "完整公司", companyShortName: "完整", contactEmail: "test@test.com" });
      const res = await createTenant({
        companyName: "完整公司",
        companyShortName: "完整",
        contactPerson: "李四",
        contactMobile: "13900139000",
        contactEmail: "test@test.com",
        province: "广东省",
        city: "深圳市",
        district: "南山区",
        address: "科技园",
        businessLicense: "123456",
        legalPerson: "王五",
        industry: "IT",
        companyScale: "10-50人",
        source: "WEB",
        remark: "测试备注",
      });
      expect(res.companyShortName).toBe("完整");
      expect(res.contactEmail).toBe("test@test.com");
    });

    it("建租户必须显式写 id（varchar(36) 主键无默认值）且状态按数字落库（S3-183-F1 / 收口总清单第 48 项）", async () => {
      mocks.makeBizNo.mockReturnValue("T20260101003");
      // 真实驱动对 varchar 主键返回的 insertId 恒为 0 —— 用它当主键取行会取不到
      mocks.query.mockResolvedValue({ insertId: 0 });
      mocks.queryOne.mockResolvedValue({ id: "x", tenantCode: "T20260101003" });

      await createTenant({
        companyName: "测试公司",
        contactPerson: "张三",
        contactMobile: "13800138000",
      });

      const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
      // ① 显式列清单第一列必须是 id（原实现漏写 ⇒ 1364 ⇒ 400「缺少必填参数：id」）
      //    紧随其后的 name 是**第二个** NOT NULL 无默认列（补上 id 后实测报「缺少必填参数：name」）
      expect(sql).toMatch(/INSERT INTO t_tenant \(\s*id,\s*tenant_code,\s*name,/);
      // ② 主键由应用层生成（UUID 类，口径同 platform-tenant.service.ts 的 randomUUID）
      const tenantId = params[0] as string;
      expect(tenantId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      // ③ t_tenant.status 是 TINYINT：不得再往数字列写字符串字面量 'ACTIVE'（严格模式 1366）
      expect(sql).not.toContain("'ACTIVE'");
      // ④ 取回真实落库行按生成的 uuid，而不是 insertId
      expect(mocks.queryOne.mock.calls[0][1]).toEqual([tenantId]);
    });
  });

  describe("updateTenant", () => {
    it("租户不存在返回null", async () => {
      mocks.queryOne.mockResolvedValue(null);
      const res = await updateTenant(999, { companyName: "新名" });
      expect(res).toBeNull();
    });

    it("有字段更新时执行UPDATE", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 1, tenantCode: "T001", companyName: "更新名" });
      mocks.query.mockResolvedValue({ affectedRows: 1 });
      const res = await updateTenant(1, { companyName: "更新名" });
      expect(res).not.toBeNull();
      expect(res!.companyName).toBe("更新名");
    });

    it("无字段更新时不执行UPDATE", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 1, tenantCode: "T001" });
      const res = await updateTenant(1, {});
      expect(res).not.toBeNull();
      expect(mocks.query).not.toHaveBeenCalled();
    });
  });

  describe("auditTenant", () => {
    it("租户不存在返回null", async () => {
      mocks.queryOne.mockResolvedValue(null);
      const res = await auditTenant(999, { status: "ACTIVE" });
      expect(res).toBeNull();
    });

    it("审核通过设置为ACTIVE", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1, status: "PENDING" })
        .mockResolvedValueOnce({ id: 1, status: "ACTIVE", suspendReason: null, suspendedAt: null });
      mocks.query.mockResolvedValue({ affectedRows: 1 });
      const res = await auditTenant(1, { status: "ACTIVE" });
      expect(res!.status).toBe("ACTIVE");
      expect(res!.suspendReason).toBeNull();
    });

    // S3-192（收口总清单第 59 项）护栏：唯一可写值域 = ACTIVE / DISABLED；
    // "暂停/停用"的原因由 suspend_reason + suspended_at 表达，status 一律落 DISABLED（库值 0）。
    it("审核停用落 DISABLED 的库值 0，并把原因/时间写进 suspend_reason / suspended_at", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1, status: 1 })
        .mockResolvedValueOnce({ id: 1, status: 0, suspendReason: "资料不全", suspendedAt: new Date() });
      mocks.query.mockResolvedValue({ affectedRows: 1 });
      const res = await auditTenant(1, { status: "DISABLED", remark: "资料不全" });
      expect(res!.suspendReason).toBe("资料不全");
      const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("suspend_reason = ?");
      expect(sql).toContain("suspended_at = NOW()");
      // 落库值必须是数字 0（TINYINT），不是字符串 'DISABLED'（严格模式 1366）
      expect(params).toEqual([0, "资料不全", 1]);
    });

    it("越界入参（SUSPENDED / EXPIRED / PENDING / CLOSED）一律 400，且不写库", async () => {
      for (const bad of ["SUSPENDED", "EXPIRED", "PENDING", "CLOSED"]) {
        mocks.query.mockClear();
        mocks.queryOne.mockClear();
        await expect(auditTenant(1, { status: bad })).rejects.toMatchObject({
          name: "AppError",
          statusCode: 400,
        });
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.queryOne).not.toHaveBeenCalled();
      }
    });
  });

  describe("toggleTenantStatus", () => {
    it("租户不存在返回null", async () => {
      mocks.queryOne.mockResolvedValue(null);
      const res = await toggleTenantStatus(999, "ACTIVE");
      expect(res).toBeNull();
    });

    it("切换状态写入库值（DISABLED ⇒ 0 / ACTIVE ⇒ 1），不写字符串", async () => {
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1, status: 1 })
        .mockResolvedValueOnce({ id: 1, status: 0 });
      mocks.query.mockResolvedValue({ affectedRows: 1 });
      await toggleTenantStatus(1, "DISABLED");
      expect(mocks.query.mock.calls[0][1]).toEqual([0, 1]);

      mocks.query.mockClear();
      mocks.queryOne
        .mockResolvedValueOnce({ id: 1, status: 0 })
        .mockResolvedValueOnce({ id: 1, status: 1 });
      await toggleTenantStatus(1, "ACTIVE");
      expect(mocks.query.mock.calls[0][1]).toEqual([1, 1]);
    });

    it("越界入参（SUSPENDED / EXPIRED）一律 400，且不写库", async () => {
      for (const bad of ["SUSPENDED", "EXPIRED"]) {
        mocks.query.mockClear();
        mocks.queryOne.mockClear();
        await expect(toggleTenantStatus(1, bad)).rejects.toMatchObject({
          name: "AppError",
          statusCode: 400,
        });
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.queryOne).not.toHaveBeenCalled();
      }
    });
  });

  describe("getTenantStatistics", () => {
    it("返回统计数据", async () => {
      mocks.queryOne.mockResolvedValue({
        totalTenants: 100,
        activeTenants: 80,
        suspendedTenants: 10,
        expiredTenants: 5,
        todayNewTenants: 3,
      });
      const res = await getTenantStatistics();
      expect(res.totalTenants).toBe(100);
      expect(res.activeTenants).toBe(80);
      expect(res.suspendedTenants).toBe(10);
      expect(res.expiredTenants).toBe(5);
      expect(res.todayNewTenants).toBe(3);
    });
  });
});
