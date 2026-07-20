/**
 * 管理端品牌 service 单元测试
 * 被测文件：src/services/admin/brand.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

import { list, create, update, remove } from "../../../services/admin/brand.service";

describe("brand.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("list", () => {
    it("无 keyword 时返回全部品牌", async () => {
      const rows = [{ id: 1, name: "茅台" }, { id: 2, name: "五粮液" }];
      mocks.queryWithTenant.mockResolvedValue(rows);
      const res = await list({ tenantId: "t1" });
      expect(res).toEqual(rows);
      expect(mocks.queryWithTenant).toHaveBeenCalledTimes(1);
      const [sql, params] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("FROM t_brand WHERE tenant_id = ?");
      expect(params).toEqual(["t1"]);
    });

    it("带 keyword 时拼接 LIKE 条件", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ id: 1, name: "茅台" }]);
      await list({ keyword: "茅", tenantId: "t1" });
      const [, params] = mocks.queryWithTenant.mock.calls[0];
      expect(params).toEqual(["t1", "%茅%"]);
    });
  });

  describe("create", () => {
    it("插入品牌并返回 id（含可选字段）", async () => {
      mocks.queryWithTenant.mockResolvedValue({ insertId: 10 });
      const res = await create({ name: "剑南春", logo: "l", description: "d", sortNo: 5 }, "t1");
      expect(res).toEqual({ id: 10 });
      const [sql, params] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("INSERT INTO t_brand");
      expect(params).toEqual(["剑南春", "l", "d", 5, "t1"]);
    });

    it("未传可选字段时使用默认 null/0", async () => {
      mocks.queryWithTenant.mockResolvedValue({ insertId: 11 });
      await create({ name: "洋河" }, "t1");
      const [, params] = mocks.queryWithTenant.mock.calls[0];
      expect(params).toEqual(["洋河", null, null, 0, "t1"]);
    });
  });

  describe("update", () => {
    it("品牌不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(update(1, { name: "x" }, "t1")).rejects.toMatchObject({
        message: "品牌不存在",
        statusCode: 404,
      });
      expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });

    it("无任何字段更新时直接返回 id", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
      const res = await update(1, {}, "t1");
      expect(res).toEqual({ id: 1 });
      expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });

    it("更新多个字段时拼接 SET 子句", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await update(1, { name: "新名", sortNo: 9 }, "t1");
      expect(res).toEqual({ id: 1 });
      const [sql, params] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("name = ?");
      expect(sql).toContain("sort_no = ?");
      expect(params).toEqual(["新名", 9, 1, "t1"]);
    });
  });

  describe("remove", () => {
    it("品牌不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(remove(1, "t1")).rejects.toMatchObject({
        message: "品牌不存在",
        statusCode: 404,
      });
    });

    it("存在时执行 DELETE 并返回 id", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await remove(1, "t1");
      expect(res).toEqual({ id: 1 });
      const [sql] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("DELETE FROM t_brand");
    });
  });
});
