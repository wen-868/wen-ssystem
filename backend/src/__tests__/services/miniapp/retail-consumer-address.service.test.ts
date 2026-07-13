/**
 * 小程序收货地址 service 单元测试
 * 被测文件：src/services/miniapp/retail-consumer-address.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn((fn: any) => fn({
    query: vi.fn(),
    execute: vi.fn(),
  })),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
}));

import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefault,
} from "../../../services/miniapp/retail-consumer-address.service";

describe("miniapp/retail-consumer-address.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("listAddresses", () => {
    it("应返回用户地址列表", async () => {
      const mockAddresses = [
        { id: 1, user_id: 1, name: "张三", mobile: "13800138000", province: "广东省", city: "深圳市", district: "南山区", detail: "科技园路1号", is_default: 1, created_at: "2026-01-01", updated_at: "2026-01-02" },
        { id: 2, user_id: 1, name: "张三", mobile: "13800138000", province: "广东省", city: "广州市", district: "天河区", detail: "天河路100号", is_default: 0, created_at: "2026-01-03", updated_at: "2026-01-04" },
      ];
      mocks.query.mockResolvedValue(mockAddresses);
      const res = await listAddresses(1);
      expect(res.length).toBe(2);
      expect(res[0].is_default).toBe(1);
      expect(mocks.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT"),
        [1]
      );
    });

    it("无地址应返回空数组", async () => {
      mocks.query.mockResolvedValue([]);
      const res = await listAddresses(1);
      expect(res.length).toBe(0);
    });
  });

  describe("createAddress", () => {
    it("应创建新地址", async () => {
      mocks.query.mockResolvedValue({ insertId: 1 } as any);
      const res = await createAddress(1, {
        name: "张三",
        mobile: "13800138000",
        province: "广东省",
        city: "深圳市",
        district: "南山区",
        detail: "科技园路1号",
        is_default: 1,
      });
      expect(res.id).toBe(1);
      expect(mocks.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT"),
        [1, "张三", "13800138000", "广东省", "深圳市", "南山区", "科技园路1号", 1]
      );
    });

    it("is_default 不传时使用默认值 0", async () => {
      mocks.query.mockResolvedValue({ insertId: 2 } as any);
      const res = await createAddress(1, {
        name: "李四",
        mobile: "13900139000",
        province: "广东省",
        city: "广州市",
        district: "天河区",
        detail: "天河路100号",
      });
      expect(res.id).toBe(2);
      const callArgs = mocks.query.mock.calls[0][1];
      expect(callArgs[7]).toBe(0);
    });
  });

  describe("updateAddress", () => {
    it("应更新地址", async () => {
      mocks.query.mockResolvedValue({ affectedRows: 1 } as any);
      await updateAddress(1, 1, {
        name: "张三改",
        mobile: "13800138001",
        province: "广东省",
        city: "深圳市",
        district: "南山区",
        detail: "科技园路2号",
      });
      expect(mocks.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE"),
        ["张三改", "13800138001", "广东省", "深圳市", "南山区", "科技园路2号", 1, 1]
      );
    });
  });

  describe("deleteAddress", () => {
    it("应删除地址", async () => {
      mocks.query.mockResolvedValue({ affectedRows: 1 } as any);
      await deleteAddress(1, 1);
      expect(mocks.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE"),
        [1, 1]
      );
    });
  });

  describe("setDefault", () => {
    it("应设置默认地址（事务中先取消所有默认，再设置新默认）", async () => {
      const mockConn = { query: vi.fn().mockResolvedValue({ affectedRows: 1 }) };
      mocks.transaction.mockImplementation((fn: any) => fn(mockConn));
      await setDefault(1, 1);
      expect(mocks.transaction).toHaveBeenCalled();
      expect(mockConn.query).toHaveBeenCalledTimes(2);
      // 第一个查询：取消所有默认
      expect(mockConn.query.mock.calls[0][0]).toContain("is_default = 0");
      expect(mockConn.query.mock.calls[0][1]).toEqual([1]);
      // 第二个查询：设置新默认
      expect(mockConn.query.mock.calls[1][0]).toContain("is_default = 1");
      expect(mockConn.query.mock.calls[1][1]).toEqual([1, 1]);
    });
  });
});
