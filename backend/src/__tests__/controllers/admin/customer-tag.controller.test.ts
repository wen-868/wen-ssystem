import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  listTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  addCustomerTag: vi.fn(),
  removeCustomerTag: vi.fn(),
  getCustomerProfile: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/customer-tag.service", () => ({
  listTags: mocks.listTags,
  createTag: mocks.createTag,
  updateTag: mocks.updateTag,
  deleteTag: mocks.deleteTag,
  addCustomerTag: mocks.addCustomerTag,
  removeCustomerTag: mocks.removeCustomerTag,
  getCustomerProfile: mocks.getCustomerProfile,
}));

import {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  addCustomerTag,
  removeCustomerTag,
  getCustomerProfile,
} from "../../../controllers/admin/customer-tag.controller";

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

describe("admin customer-tag.controller", () => {
  it("listTags - 应返回标签列表", async () => {
    mocks.listTags.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listTags(req, res, vi.fn());
    expect(mocks.listTags).toHaveBeenCalledWith("t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("createTag - 应创建标签", async () => {
    const body = { tagName: "VIP客户", tagType: "customer", tagGroup: "客户分层" };
    mocks.createTag.mockResolvedValue({ id: 1 });
    const req = mockReq({ body });
    const res = mockRes();
    await createTag(req, res, vi.fn());
    expect(mocks.createTag).toHaveBeenCalledWith(
      expect.objectContaining({ tagName: "VIP客户", tagType: "customer", tagGroup: "客户分层", tenantId: "t1" })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("createTag - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(createTag(req, res, vi.fn())).rejects.toThrow();
    expect(mocks.createTag).not.toHaveBeenCalled();
  });

  it("createTag - 只传 tagName 也可以（其他字段有默认值或可选）", async () => {
    const body = { tagName: "新标签" };
    mocks.createTag.mockResolvedValue({ id: 1 });
    const req = mockReq({ body });
    const res = mockRes();
    await createTag(req, res, vi.fn());
    expect(mocks.createTag).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  it("updateTag - 应更新标签", async () => {
    const body = { tagName: "新名称", tagType: "new_type" };
    mocks.updateTag.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body });
    const res = mockRes();
    await updateTag(req, res, vi.fn());
    expect(mocks.updateTag).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ tagName: "新名称", tenantId: "t1" })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("updateTag - 空 body 也可以（所有字段可选）", async () => {
    mocks.updateTag.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: {} });
    const res = mockRes();
    await updateTag(req, res, vi.fn());
    expect(mocks.updateTag).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  it("deleteTag - 应删除标签", async () => {
    mocks.deleteTag.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteTag(req, res, vi.fn());
    expect(mocks.deleteTag).toHaveBeenCalledWith(1, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("addCustomerTag - 应为客户添加标签", async () => {
    const body = { tagId: 5 };
    mocks.addCustomerTag.mockResolvedValue({ customerId: 1, tagId: 5 });
    const req = mockReq({ params: { id: "1" }, body });
    const res = mockRes();
    await addCustomerTag(req, res, vi.fn());
    expect(mocks.addCustomerTag).toHaveBeenCalledWith(1, 5, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("addCustomerTag - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ params: { id: "1" }, body: {} });
    const res = mockRes();
    await expect(addCustomerTag(req, res, vi.fn())).rejects.toThrow();
    expect(mocks.addCustomerTag).not.toHaveBeenCalled();
  });

  it("removeCustomerTag - 应移除客户标签", async () => {
    mocks.removeCustomerTag.mockResolvedValue({ customerId: 1, tagId: 5 });
    const req = mockReq({ params: { id: "1", tagId: "5" } });
    const res = mockRes();
    await removeCustomerTag(req, res, vi.fn());
    expect(mocks.removeCustomerTag).toHaveBeenCalledWith(1, 5, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("getCustomerProfile - 应返回客户档案（含标签）", async () => {
    mocks.getCustomerProfile.mockResolvedValue({ id: 1, tags: [] });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getCustomerProfile(req, res, vi.fn());
    expect(mocks.getCustomerProfile).toHaveBeenCalledWith(1, "t1");
    expect(res.json).toHaveBeenCalled();
  });
});
