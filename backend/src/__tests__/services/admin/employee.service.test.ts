/**
 * 管理端员工/门店 service 单元测试
 * 被测文件：src/services/admin/employee.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
  bcryptHash: vi.fn(),
}));

vi.mock("../../../shared/db.js", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../shared/id.js", () => ({
  makeBizNo: mocks.makeBizNo,
}));

vi.mock("bcryptjs", () => ({
  default: { hash: mocks.bcryptHash },
}));

import {
  listStaff,
  createStaff,
  updateStaff,
  disableStaff,
  listStores,
  createStore,
  getStore,
  updateStore,
  getStoreWechatInfo,
} from "../../../services/admin/employee.service.js";

describe("employee.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("listStaff", () => {
    it("返回员工列表含 total", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ staffId: 1, username: "u1" }]);
      const res = await listStaff("t1");
      expect(res.total).toBe(1);
      expect(res.records.length).toBe(1);
    });
  });

  describe("createStaff", () => {
    it("传入密码时使用传入密码 hash", async () => {
      mocks.bcryptHash.mockResolvedValue("hash_pwd");
      mocks.queryWithTenant.mockResolvedValue({ insertId: 8 });
      const res = await createStaff({ username: "u", realName: "r", password: "secret" }, "t1");
      expect(res.staffId).toBe(8);
      expect(mocks.bcryptHash).toHaveBeenCalledWith("secret", 10);
      const [, params] = mocks.queryWithTenant.mock.calls[0];
      expect(params).toEqual(["u", "r", null, 1, 1, "hash_pwd"]);
    });

    it("未传密码时使用默认 123456", async () => {
      mocks.bcryptHash.mockResolvedValue("hash_default");
      mocks.queryWithTenant.mockResolvedValue({ insertId: 9 });
      await createStaff({ username: "u", realName: "r" }, "t1");
      expect(mocks.bcryptHash).toHaveBeenCalledWith("123456", 10);
    });
  });

  describe("updateStaff", () => {
    it("无字段更新时返回空对象", async () => {
      const res = await updateStaff(1, {}, "t1");
      expect(res).toEqual({});
      expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });

    it("更新字段时执行 UPDATE", async () => {
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await updateStaff(2, { realName: "新名", status: 0 }, "t1");
      expect(res).toEqual({ staffId: 2 });
      const [sql, params] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("real_name = ?");
      expect(sql).toContain("status = ?");
      expect(params).toEqual(["新名", 0, 2]);
    });
  });

  describe("disableStaff", () => {
    it("员工不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(disableStaff(1, "t1")).rejects.toMatchObject({
        message: "员工不存在",
        statusCode: 404,
      });
    });

    it("员工已停用时抛 400", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, username: "u", status: 0 });
      await expect(disableStaff(1, "t1")).rejects.toMatchObject({
        message: "员工已停用",
        statusCode: 400,
      });
    });

    it("正常停用返回 staffId 和 username", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, username: "u", status: 1 });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await disableStaff(1, "t1");
      expect(res).toEqual({ staffId: 1, username: "u" });
      const [sql] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("status = 0");
    });
  });

  describe("listStores", () => {
    it("返回分页数据与 total", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ id: 1, name: "店1" }]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 5 });
      const res = await listStores(1, 10, "t1");
      expect(res.total).toBe(5);
      expect(res.records.length).toBe(1);
    });

    it("total 为 null 时返回 0", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue(null);
      const res = await listStores(2, 20, "t1", "keyword");
      expect(res.total).toBe(0);
    });
  });

  describe("createStore", () => {
    it("创建门店并回查返回", async () => {
      mocks.makeBizNo.mockReturnValue("MD001");
      mocks.queryWithTenant.mockResolvedValue(undefined);
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, storeCode: "MD001", name: "n" });
      const res = await createStore({ name: "n", address: "a" }, "t1");
      expect(res).toEqual({ id: 1, storeCode: "MD001", name: "n" });
      expect(mocks.makeBizNo).toHaveBeenCalledWith("MD");
    });
  });

  describe("getStore", () => {
    it("门店不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(getStore(1, "t1")).rejects.toMatchObject({
        message: "门店不存在",
        statusCode: 404,
      });
    });

    it("返回门店信息", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "店" });
      const res = await getStore(1, "t1");
      expect(res.id).toBe(1);
    });
  });

  describe("updateStore", () => {
    it("门店不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(updateStore(1, { name: "x" }, "t1")).rejects.toMatchObject({
        message: "门店不存在",
        statusCode: 404,
      });
    });

    it("有字段更新时执行 UPDATE 并回查", async () => {
      mocks.queryOneWithTenant
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 1, name: "新名" });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await updateStore(1, { name: "新名", status: 0 }, "t1");
      expect(res.name).toBe("新名");
      const [sql] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("UPDATE store SET");
    });
  });

  describe("getStoreWechatInfo", () => {
    it("门店不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);
      await expect(getStoreWechatInfo(1, "t1")).rejects.toMatchObject({
        message: "门店不存在",
        statusCode: 404,
      });
    });

    it("未设置 AppID 时抛 400", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, miniappAppid: null });
      await expect(getStoreWechatInfo(1, "t1")).rejects.toMatchObject({
        message: "请先设置小程序 AppID",
        statusCode: 400,
      });
    });

    it("有 AppID 时返回微信信息并更新数据库", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "店", phone: "123", miniappAppid: "wx123" });
      mocks.queryWithTenant.mockResolvedValue(undefined);
      const res = await getStoreWechatInfo(1, "t1");
      expect(res.miniappAppid).toBe("wx123");
      expect(res.wxMerchantName).toBe("店");
      expect(mocks.queryWithTenant).toHaveBeenCalled();
    });
  });
});
