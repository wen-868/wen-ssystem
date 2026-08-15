/**
 * 管理端溯源配置 service 单元测试
 * 被测文件：src/services/admin/trace-config.service.ts
 * 覆盖：listConfigs / createConfig / updateConfig / deleteConfig / checkSkuTrace
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as service from "../../../services/admin/trace-config.service";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));
vi.mock("../../../shared/id", () => ({ makeBizNo: mocks.makeBizNo }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("TC202608160001");
});

describe("trace-config.service", () => {
  describe("listConfigs", () => {
    it("带过滤条件返回分页配置列表", async () => {
      mocks.queryWithTenant.mockResolvedValue([
        { id: 1, configNo: "TC1", configLevel: "GLOBAL", traceEnabled: 1 },
      ]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });

      const res = await service.listConfigs(1, 10, "GLOBAL", 1, "t1");

      expect(res.total).toBe(1);
      expect(res.records).toHaveLength(1);
      expect(mocks.queryWithTenant).toHaveBeenCalled();
    });

    it("无过滤条件也能正常返回", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });

      const res = await service.listConfigs(1, 10, undefined, undefined, "t1");

      expect(res.total).toBe(0);
      expect(res.records).toEqual([]);
    });
  });

  describe("createConfig", () => {
    it("插入并返回新建记录，生成业务单号", async () => {
      mocks.queryWithTenant.mockResolvedValue(undefined);
      mocks.queryOneWithTenant.mockResolvedValue({
        id: 1,
        configNo: "TC202608160001",
        configLevel: "GLOBAL",
        traceEnabled: 1,
      });

      const res = await service.createConfig(
        {
          configLevel: "GLOBAL",
          targetId: 0,
          targetName: "全局",
          traceEnabled: 1,
          forceEnabled: 0,
          codeMode: "ONE_PER_ITEM",
          codePrefix: "TC",
          autoGenerate: 1,
          shelfLifeDays: 365,
          remark: "",
        },
        "t1",
      );

      expect(res?.configNo).toBe("TC202608160001");
      expect(mocks.makeBizNo).toHaveBeenCalledWith("TC");
      expect(mocks.queryWithTenant).toHaveBeenCalled();
    });
  });

  describe("updateConfig", () => {
    it("配置不存在时返回 null", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(undefined);

      const res = await service.updateConfig(99, { traceEnabled: 0 }, "t1");

      expect(res).toBeNull();
    });

    it("更新指定字段并返回最新记录", async () => {
      mocks.queryOneWithTenant
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 1, configNo: "TC1", traceEnabled: 0 });

      const res = await service.updateConfig(1, { traceEnabled: 0, remark: "x" }, "t1");

      expect(res?.traceEnabled).toBe(0);
      expect(mocks.queryWithTenant).toHaveBeenCalled();
    });
  });

  describe("deleteConfig", () => {
    it("配置不存在时返回 false", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(undefined);

      expect(await service.deleteConfig(99, "t1")).toBe(false);
    });

    it("存在时删除并返回 true", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
      mocks.queryWithTenant.mockResolvedValue(undefined);

      expect(await service.deleteConfig(1, "t1")).toBe(true);
    });
  });

  describe("checkSkuTrace", () => {
    it("命中商品级配置直接返回", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({
        id: 1,
        traceEnabled: 1,
        forceEnabled: 0,
        configNo: "TC1",
      });

      const res = await service.checkSkuTrace(10, 5, "t1");

      expect(res.required).toBe(true);
      expect(res.config?.configNo).toBe("TC1");
    });

    it("商品/分类无配置时回退到全局配置", async () => {
      mocks.queryOneWithTenant
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ id: 3, traceEnabled: 0, forceEnabled: 1, configNo: "TCG" });

      const res = await service.checkSkuTrace(10, 5, "t1");

      expect(res.required).toBe(true);
      expect(res.config?.configNo).toBe("TCG");
    });

    it("全部未命中时返回未启用", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(undefined);

      const res = await service.checkSkuTrace(10, 5, "t1");

      expect(res.required).toBe(false);
      expect(res.config).toBeNull();
    });
  });
});
