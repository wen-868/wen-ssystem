/**
 * 价格等级 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/price-level.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import {
  listPriceLevels,
  createPriceLevel,
  updatePriceLevel,
  disablePriceLevel,
} from "../../../services/admin/price-level.service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("price-level.service - listPriceLevels", () => {
  it("返回 total 与 records", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, levelCode: "RETAIL" }]);
    const res = await listPriceLevels("t1");
    expect(res).toEqual({ total: 1, records: [{ id: 1, levelCode: "RETAIL" }] });
  });
});

describe("price-level.service - createPriceLevel", () => {
  it("编码已存在时返回 400 错误对象", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    const res = await createPriceLevel(
      { levelCode: "RETAIL", levelName: "零售", discountRate: 1, minOrderAmount: 0, description: "", sortOrder: 1 },
      "t1"
    );
    expect(res).toEqual({ error: { code: "400", message: "等级编码已存在" } });
  });

  it("成功创建并回查记录返回 data", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 3, levelCode: "WHOLESALE" });
    mocks.queryWithTenant.mockResolvedValue({ insertId: 3 });
    const res = await createPriceLevel(
      { levelCode: "WHOLESALE", levelName: "批发", discountRate: 0.9, minOrderAmount: 100, description: "批发价", sortOrder: 2 },
      "t1"
    );
    expect(res).toEqual({ data: { id: 3, levelCode: "WHOLESALE" } });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});

describe("price-level.service - updatePriceLevel", () => {
  it("等级不存在时返回 404 错误对象", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await updatePriceLevel(1, { levelName: "新" }, "t1");
    expect(res).toEqual({ error: { code: "404", message: "价格等级不存在" } });
  });

  it("无字段变更时仅回查返回 data", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1 });
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 1, levelCode: "A" });
    const res = await updatePriceLevel(1, {}, "t1");
    expect(res).toEqual({ data: { id: 1, levelCode: "A" } });
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });

  it("部分字段更新成功", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 1, levelCode: "A", levelName: "新名" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updatePriceLevel(1, { levelName: "新名", status: 0 }, "t1");
    expect(res).toEqual({ data: { id: 1, levelCode: "A", levelName: "新名" } });
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("SET level_name = ?, status = ?");
  });
});

describe("price-level.service - disablePriceLevel", () => {
  it("等级不存在时返回 404 错误对象", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await disablePriceLevel(1, "t1");
    expect(res).toEqual({ error: { code: "404", message: "价格等级不存在" } });
  });

  it("零售等级不可停用返回 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, level_code: "RETAIL" });
    const res = await disablePriceLevel(1, "t1");
    expect(res).toEqual({ error: { code: "400", message: "零售价等级不可停用" } });
  });

  it("成功停用返回 disabled", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, level_code: "WHOLESALE" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await disablePriceLevel(1, "t1");
    expect(res).toEqual({ data: { levelId: 1, status: "disabled" } });
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("SET status = 0");
  });
});
