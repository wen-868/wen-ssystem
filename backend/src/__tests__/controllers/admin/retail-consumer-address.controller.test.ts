import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  listAddresses: vi.fn(),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
  setDefault: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/miniapp/retail-consumer-address.service.js", () => ({
  listAddresses: mocks.listAddresses,
  createAddress: mocks.createAddress,
  updateAddress: mocks.updateAddress,
  deleteAddress: mocks.deleteAddress,
  setDefault: mocks.setDefault,
}));

import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefault,
} from "../../../controllers/admin/retail-consumer-address.controller.js";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  res.send = vi.fn();
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin retail-consumer-address.controller", () => {
  it("listAddresses - 应返回地址列表", async () => {
    mocks.listAddresses.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listAddresses(req, res);
    expect(mocks.listAddresses).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalled();
  });

  it("createAddress - 应创建地址", async () => {
    const body = {
      name: "张三",
      mobile: "13800138000",
      province: "广东省",
      city: "深圳市",
      district: "南山区",
      detail: "科技园路1号",
      isDefault: true,
    };
    mocks.createAddress.mockResolvedValue({ id: 1 });
    const req = mockReq({ body });
    const res = mockRes();
    await createAddress(req, res);
    expect(mocks.createAddress).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: "张三", mobile: "13800138000" })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("createAddress - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(createAddress(req, res)).rejects.toThrow();
    expect(mocks.createAddress).not.toHaveBeenCalled();
  });

  it("updateAddress - 应更新地址", async () => {
    const body = { name: "李四", detail: "新地址" };
    mocks.updateAddress.mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" }, body });
    const res = mockRes();
    await updateAddress(req, res);
    expect(mocks.updateAddress).toHaveBeenCalledWith(
      1,
      1,
      expect.objectContaining({ name: "李四" })
    );
    expect(mocks.ok).toHaveBeenCalledWith(null);
  });

  it("updateAddress - 空 body 时（所有字段可选）", async () => {
    mocks.updateAddress.mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" }, body: {} });
    const res = mockRes();
    await updateAddress(req, res);
    expect(mocks.updateAddress).toHaveBeenCalled();
  });

  it("deleteAddress - 应删除地址", async () => {
    mocks.deleteAddress.mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteAddress(req, res);
    expect(mocks.deleteAddress).toHaveBeenCalledWith(1, 1);
    expect(mocks.ok).toHaveBeenCalledWith(null);
  });

  it("setDefault - 应设置默认地址", async () => {
    mocks.setDefault.mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await setDefault(req, res);
    expect(mocks.setDefault).toHaveBeenCalledWith(1, 1);
    expect(mocks.ok).toHaveBeenCalledWith(null);
  });
});
