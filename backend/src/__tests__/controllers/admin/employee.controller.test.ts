import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/employee.service", () => ({
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

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as employeeService from "../../../services/admin/employee.service";
import { ok } from "../../../shared/response";
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
} from "../../../controllers/admin/employee.controller";

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

describe("employee.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listStaff - 应返回员工列表", async () => {
    (employeeService.listStaff as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listStaff(req as any, res as any);
    expect(employeeService.listStaff).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createStaff - 应创建员工", async () => {
    (employeeService.createStaff as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { username: "testuser", realName: "测试用户" } });
    const res = mockRes();
    await createStaff(req as any, res as any);
    expect(employeeService.createStaff).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateStaff - 应更新员工", async () => {
    (employeeService.updateStaff as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { staffId: "1" }, body: { realName: "新名称" } });
    const res = mockRes();
    await updateStaff(req as any, res as any);
    expect(employeeService.updateStaff).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("disableStaff - 应禁用员工", async () => {
    (employeeService.disableStaff as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await disableStaff(req as any, res as any);
    expect(employeeService.disableStaff).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listStores - 应返回门店列表", async () => {
    (employeeService.listStores as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20, keyword: "" } });
    const res = mockRes();
    await listStores(req as any, res as any);
    expect(employeeService.listStores).toHaveBeenCalledWith(1, 20, "t1", "");
    expect(ok).toHaveBeenCalled();
  });

  it("createStore - 应创建门店", async () => {
    (employeeService.createStore as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { name: "测试店", address: "测试地址" } });
    const res = mockRes();
    await createStore(req as any, res as any);
    expect(employeeService.createStore).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getStore - 应返回门店详情", async () => {
    (employeeService.getStore as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getStore(req as any, res as any);
    expect(employeeService.getStore).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("updateStore - 应更新门店", async () => {
    (employeeService.updateStore as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: { name: "新店名" } });
    const res = mockRes();
    await updateStore(req as any, res as any);
    expect(employeeService.updateStore).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getStoreWechatInfo - 应返回门店微信信息", async () => {
    (employeeService.getStoreWechatInfo as any).mockResolvedValue({});
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getStoreWechatInfo(req as any, res as any);
    expect(employeeService.getStoreWechatInfo).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });
});
