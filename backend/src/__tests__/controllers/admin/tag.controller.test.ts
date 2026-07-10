/**
 * 管理端标签管理 controller 单元测试
 * 被测文件：src/controllers/admin/tag.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  listTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  getProductTags: vi.fn(),
  setProductTags: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/tag.service.js", () => ({
  listGroups: mocks.listGroups,
  createGroup: mocks.createGroup,
  updateGroup: mocks.updateGroup,
  deleteGroup: mocks.deleteGroup,
  listTags: mocks.listTags,
  createTag: mocks.createTag,
  updateTag: mocks.updateTag,
  deleteTag: mocks.deleteTag,
  getProductTags: mocks.getProductTags,
  setProductTags: mocks.setProductTags,
}));

import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  listTags,
  createTag,
  updateTag,
  deleteTag,
  getProductTags,
  setProductTags,
} from "../../../controllers/admin/tag.controller.js";

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

describe("admin tag.controller", () => {
  it("listGroups 调用 service 并返回结果", async () => {
    mocks.listGroups.mockResolvedValue([{ id: 1, name: "组A" }]);
    const req = mockReq();
    const res = mockRes();
    await listGroups(req, res);
    expect(mocks.listGroups).toHaveBeenCalledWith("t1");
    expect(mocks.ok).toHaveBeenCalledWith([{ id: 1, name: "组A" }]);
  });

  it("createGroup 成功创建并使用默认值", async () => {
    mocks.createGroup.mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { name: "组A", code: "GROUP_A" } });
    const res = mockRes();
    await createGroup(req, res);
    expect(mocks.createGroup).toHaveBeenCalledWith(expect.objectContaining({
      name: "组A", code: "GROUP_A", sortNo: 0, isMultiple: true,
    }), "t1");
  });

  it("createGroup 传入自定义 sortNo 和 isMultiple", async () => {
    mocks.createGroup.mockResolvedValue({ id: 2 });
    const req = mockReq({ body: { name: "组B", code: "GROUP_B", sortNo: 5, isMultiple: false } });
    const res = mockRes();
    await createGroup(req, res);
    expect(mocks.createGroup).toHaveBeenCalledWith(expect.objectContaining({
      sortNo: 5, isMultiple: false,
    }), "t1");
  });

  it("updateGroup 传入 id 转换为数字", async () => {
    mocks.updateGroup.mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "3" }, body: { name: "新名" } });
    const res = mockRes();
    await updateGroup(req, res);
    expect(mocks.updateGroup).toHaveBeenCalledWith(3, expect.objectContaining({ name: "新名" }), "t1");
  });

  it("deleteGroup 传入 id 转换为数字", async () => {
    mocks.deleteGroup.mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "4" } });
    const res = mockRes();
    await deleteGroup(req, res);
    expect(mocks.deleteGroup).toHaveBeenCalledWith(4, "t1");
  });

  it("listTags 传入 groupId 转换为数字", async () => {
    mocks.listTags.mockResolvedValue([{ id: 1, name: "标签1" }]);
    const req = mockReq({ query: { groupId: "2" } });
    const res = mockRes();
    await listTags(req, res);
    expect(mocks.listTags).toHaveBeenCalledWith(2, "t1");
  });

  it("listTags 不传 groupId 时为 undefined", async () => {
    mocks.listTags.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listTags(req, res);
    expect(mocks.listTags).toHaveBeenCalledWith(undefined, "t1");
  });

  it("createTag 成功创建标签", async () => {
    mocks.createTag.mockResolvedValue({ id: 10 });
    const req = mockReq({ body: { groupId: 1, name: "标签A" } });
    const res = mockRes();
    await createTag(req, res);
    expect(mocks.createTag).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 1, name: "标签A", sortNo: 0,
    }), "t1");
  });

  it("deleteTag 传入 id 转换为数字", async () => {
    mocks.deleteTag.mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "7" } });
    const res = mockRes();
    await deleteTag(req, res);
    expect(mocks.deleteTag).toHaveBeenCalledWith(7, "t1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { success: true } });
  });

  it("getProductTags 传入 spuId 转换为数字", async () => {
    mocks.getProductTags.mockResolvedValue([{ id: 1, name: "标签" }]);
    const req = mockReq({ params: { spuId: "100" } });
    const res = mockRes();
    await getProductTags(req, res);
    expect(mocks.getProductTags).toHaveBeenCalledWith(100, "t1");
    expect(mocks.ok).toHaveBeenCalledWith([{ id: 1, name: "标签" }]);
  });

  it("setProductTags 传入 tagIds 数组", async () => {
    mocks.setProductTags.mockResolvedValue({ success: true });
    const req = mockReq({ params: { spuId: "100" }, body: { tagIds: [1, 2, 3] } });
    const res = mockRes();
    await setProductTags(req, res);
    expect(mocks.setProductTags).toHaveBeenCalledWith(100, [1, 2, 3], "t1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { success: true } });
  });
});
