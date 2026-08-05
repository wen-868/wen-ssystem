/**
 * 秒杀活动 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/seckill.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

import {
  getSeckillProducts,
  createSeckillProduct,
  updateSeckillProduct,
  deleteSeckillProduct,
} from "../../../services/admin/seckill.service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("seckill.service - getSeckillProducts", () => {
  it("无筛选条件时默认第一页每页20条，total 来自 cnt", async () => {
    mocks.query.mockResolvedValue([{ id: 1, productName: "商品A" }]);
    mocks.queryOne.mockResolvedValue({ cnt: 1 });
    const res = await getSeckillProducts("t1");
    expect(res).toEqual({ records: [{ id: 1, productName: "商品A" }], total: 1, page: 1, pageSize: 20 });
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.queryOne).toHaveBeenCalledOnce();
  });

  it("传入 status/page/pageSize 时拼接筛选条件与 LIMIT 偏移", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue({ cnt: 0 });
    await getSeckillProducts("t1", { status: "ACTIVE", page: 2, pageSize: 10 });
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("sp.status = ?");
    expect(sql).toContain("LIMIT 10, 10");
    expect(mocks.query.mock.calls[0][1]).toEqual(["ACTIVE"]);
  });

  it("total 行不存在时兜底 0", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue(null);
    const res = await getSeckillProducts("t1");
    expect(res.total).toBe(0);
  });
});

describe("seckill.service - createSeckillProduct", () => {
  it("limitPerUser/status 缺省时使用默认值 1/PENDING", async () => {
    mocks.query.mockResolvedValue({ insertId: 7 });
    const res = await createSeckillProduct({
      productId: 1,
      seckillPrice: 9.9,
      seckillStock: 10,
      startTime: "2026-01-01",
      endTime: "2026-12-31",
    });
    expect(res).toEqual({ id: 7 });
    const params = mocks.query.mock.calls[0][1] as unknown[];
    expect(params).toContain(1);
    expect(params).toContain("PENDING");
  });

  it("传入 limitPerUser/status 时使用传入值", async () => {
    mocks.query.mockResolvedValue({ insertId: 8 });
    await createSeckillProduct({
      productId: 2,
      seckillPrice: 5,
      seckillStock: 3,
      limitPerUser: 2,
      startTime: "2026-01-01",
      endTime: "2026-12-31",
      status: "ACTIVE",
    });
    const params = mocks.query.mock.calls[0][1] as unknown[];
    expect(params).toContain(2);
    expect(params).toContain("ACTIVE");
  });
});

describe("seckill.service - updateSeckillProduct", () => {
  it("成功更新并返回 success", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateSeckillProduct(1, {
      productId: 1,
      seckillPrice: 8,
      seckillStock: 5,
      startTime: "2026-01-01",
      endTime: "2026-12-31",
      status: "ACTIVE",
    });
    expect(res).toEqual({ success: true });
    const params = mocks.query.mock.calls[0][1] as unknown[];
    expect(params[6]).toBe("ACTIVE");
  });
});

describe("seckill.service - deleteSeckillProduct", () => {
  it("成功删除并返回 success", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await deleteSeckillProduct(3);
    expect(res).toEqual({ success: true });
    expect(mocks.query.mock.calls[0][1]).toEqual([3]);
  });
});
