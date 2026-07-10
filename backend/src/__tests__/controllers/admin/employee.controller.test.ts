/**
 * 管理端员工与门店 controller 单元测试
 * 被测文件：src/controllers/admin/employee.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  listStaff: vi.fn(),
  createStaff: vi.fn(),
  updateStaff: vi.fn(),
  disableStaff: vi.fn(),
  listStores: vi.fn(),
  createStore: vi.fn(),
  getStore: vi.fn(),
  updateStore: vi.fn(),
  getStoreWechatInfo: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/employee.service.js", () => ({
  listStaff: mocks.listStaff,
  createStaff: mocks.createStaff,
  updateStaff: mocks.updateStaff,
  disableStaff: mocks.disableStaff,
  listStores: mocks.listStores,
  createStore: mocks.createStore,
  getStore: mocks.getStore,
  updateStore: mocks.updateStore,
  getStoreWechatInfo: mocks.getStoreWechatInfo,
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
} from "../../../controllers/admin/employee.controller.js";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin", tenantId: "t1" },
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

describe("admin employee.controller", () => {
  it("listStaff 调用 service 并返回结果", async () => {
    mocks.listStaff.mockResolvedValue([{ id: 1, realName: "张三" }]);
    const req = mockReq();
    const res = mockRes();
    await listStaff(req, res);
    expect(mocks.listStaff).toHaveBeenCalledWith("t1");
    expect(mocks.ok).toHaveBeenCalledWith([{ id: 1, realName: "张三" }]);
  });

  it("createStaff 成功创建员工", async () => {
    mocks.createStaff.mockResolvedValue({ id: 10 });
    const req = mockReq({ body: { username: "u1", realName: "李四", mobile: "13800000000", storeId: 2 } });
    const res = mockRes();
    await createStaff(req, res);
    expect(mocks.createStaff).toHaveBeenCalledWith(expect.objectContaining({
      username: "u1", realName: "李四", status: 1,
    }), "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ id: 10 });
  });

  it("createStaff 未传 status 时默认 1", async () => {
    mocks.createStaff.mockResolvedValue({ id: 11 });
    const req = mockReq({ body: { username: "u2", realName: "王五" } });
    const res = mockRes();
    await createStaff(req, res);
    expect(mocks.createStaff).toHaveBeenCalledWith(expect.objectContaining({ status: 1 }), "t1");
  });

  it("updateStaff 传入 staffId 转换为数字", async () => {
    mocks.updateStaff.mockResolvedValue({ success: true });
    const req = mockReq({ params: { staffId: "5" }, body: { realName: "赵六" } });
    const res = mockRes();
    await updateStaff(req, res);
    expect(mocks.updateStaff).toHaveBeenCalledWith(5, expect.objectContaining({ realName: "赵六" }), "t1");
  });

  it("disableStaff 传入 id 转换为数字", async () => {
    mocks.disableStaff.mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "8" } });
    const res = mockRes();
    await disableStaff(req, res);
    expect(mocks.disableStaff).toHaveBeenCalledWith(8, "t1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { success: true } });
  });

  it("listStores 默认分页和 keyword", async () => {
    mocks.listStores.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listStores(req, res);
    expect(mocks.listStores).toHaveBeenCalledWith(1, 20, "t1", "");
  });

  it("listStores 传入 keyword 和自定义分页", async () => {
    mocks.listStores.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({ query: { keyword: "门店", page: "2", pageSize: "10" } });
    const res = mockRes();
    await listStores(req, res);
    expect(mocks.listStores).toHaveBeenCalledWith(2, 10, "t1", "门店");
  });

  it("createStore 成功创建门店并默认 deliveryRadius 为 3", async () => {
    mocks.createStore.mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { name: "门店A", address: "地址" } });
    const res = mockRes();
    await createStore(req, res);
    expect(mocks.createStore).toHaveBeenCalledWith(expect.objectContaining({
      name: "门店A", address: "地址", deliveryRadius: 3,
    }), "t1");
  });

  it("getStore 传入 id 转换为数字", async () => {
    mocks.getStore.mockResolvedValue({ id: 3, name: "门店B" });
    const req = mockReq({ params: { id: "3" } });
    const res = mockRes();
    await getStore(req, res);
    expect(mocks.getStore).toHaveBeenCalledWith(3, "t1");
  });

  it("getStoreWechatInfo 传入 id 转换为数字", async () => {
    mocks.getStoreWechatInfo.mockResolvedValue({ appId: "wx123" });
    const req = mockReq({ params: { id: "3" } });
    const res = mockRes();
    await getStoreWechatInfo(req, res);
    expect(mocks.getStoreWechatInfo).toHaveBeenCalledWith(3, "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ appId: "wx123" });
  });
});
