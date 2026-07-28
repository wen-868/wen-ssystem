/**
 * 商品营销标签 controller 单元测试
 * 被测文件：src/controllers/admin/product-marketing-tag.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../services/admin/product-marketing-tag.service", () => ({
  listTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as tagService from "../../../services/admin/product-marketing-tag.service";
import { ok, fail } from "../../../shared/response";
import {
  listTags,
  createTag,
  updateTag,
  deleteTag,
} from "../../../controllers/admin/product-marketing-tag.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1 },
  headers: {},
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

describe("admin/product-marketing-tag.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("listTags", () => {
    it("无 status 参数时返回标签列表", async () => {
      (tagService.listTags as any).mockResolvedValue([{ id: 1, tagName: "热销", tagCode: "hot" }]);
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listTags(req as any, res as any, vi.fn());
      expect(tagService.listTags).toHaveBeenCalledWith("t1", undefined);
      expect(ok).toHaveBeenCalled();
    });

    it("有 status 参数时传递给 service", async () => {
      (tagService.listTags as any).mockResolvedValue([]);
      const req = mockReq({ query: { status: "1" } });
      const res = mockRes();
      await listTags(req as any, res as any, vi.fn());
      expect(tagService.listTags).toHaveBeenCalledWith("t1", 1);
    });
  });

  describe("createTag", () => {
    it("创建标签成功", async () => {
      (tagService.createTag as any).mockResolvedValue({ id: 1, tagName: "新品", tagCode: "new" });
      const req = mockReq({
        body: { tagCode: "new", tagName: "新品", color: "#ff0000", sortNo: 1 },
      });
      const res = mockRes();
      await createTag(req as any, res as any, vi.fn());
      expect(tagService.createTag).toHaveBeenCalledWith(expect.objectContaining({
        tagCode: "new",
        tagName: "新品",
        color: "#ff0000",
        sortNo: 1,
        tenantId: "t1",
      }));
      expect(ok).toHaveBeenCalled();
    });

    it("不传 sortNo 时使用默认值 0", async () => {
      (tagService.createTag as any).mockResolvedValue({ id: 1, tagName: "推荐", tagCode: "recommend" });
      const req = mockReq({
        body: { tagCode: "recommend", tagName: "推荐" },
      });
      const res = mockRes();
      await createTag(req as any, res as any, vi.fn());
      expect(tagService.createTag).toHaveBeenCalledWith(expect.objectContaining({
        sortNo: 0,
      }));
    });
  });

  describe("updateTag", () => {
    it("更新标签成功", async () => {
      (tagService.updateTag as any).mockResolvedValue({ id: 1, tagName: "新名称" });
      const req = mockReq({
        params: { id: "1" },
        body: { tagName: "新名称", status: 1 },
      });
      const res = mockRes();
      await updateTag(req as any, res as any, vi.fn());
      expect(tagService.updateTag).toHaveBeenCalledWith(1, { tagName: "新名称", status: 1 }, "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("标签不存在返回 404", async () => {
      (tagService.updateTag as any).mockResolvedValue(null);
      const req = mockReq({
        params: { id: "999" },
        body: { tagName: "不存在" },
      });
      const res = mockRes();
      await updateTag(req as any, res as any, vi.fn());
      expect(fail).toHaveBeenCalledWith("标签不存在", "404");
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("deleteTag", () => {
    it("删除标签成功", async () => {
      (tagService.deleteTag as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deleteTag(req as any, res as any, vi.fn());
      expect(tagService.deleteTag).toHaveBeenCalledWith(1, "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("标签不存在返回 404", async () => {
      (tagService.deleteTag as any).mockResolvedValue(null);
      const req = mockReq({ params: { id: "999" } });
      const res = mockRes();
      await deleteTag(req as any, res as any, vi.fn());
      expect(fail).toHaveBeenCalledWith("标签不存在", "404");
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
