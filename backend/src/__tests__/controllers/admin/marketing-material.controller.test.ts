import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  createMaterial: vi.fn(),
  listMaterials: vi.fn(),
  getMaterialDetail: vi.fn(),
  updateMaterial: vi.fn(),
  deleteMaterial: vi.fn(),
  publishMaterial: vi.fn(),
  archiveMaterial: vi.fn(),
  getMaterialCategories: vi.fn(),
  createMaterialCategory: vi.fn(),
  updateMaterialCategory: vi.fn(),
  deleteMaterialCategory: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/marketing-material.service", () => ({
  createMaterial: mocks.createMaterial,
  listMaterials: mocks.listMaterials,
  getMaterialDetail: mocks.getMaterialDetail,
  updateMaterial: mocks.updateMaterial,
  deleteMaterial: mocks.deleteMaterial,
  publishMaterial: mocks.publishMaterial,
  archiveMaterial: mocks.archiveMaterial,
  getMaterialCategories: mocks.getMaterialCategories,
  createMaterialCategory: mocks.createMaterialCategory,
  updateMaterialCategory: mocks.updateMaterialCategory,
  deleteMaterialCategory: mocks.deleteMaterialCategory,
}));

import {
  createMaterial,
  listMaterials,
  getMaterialDetail,
  updateMaterial,
  deleteMaterial,
  publishMaterial,
  archiveMaterial,
  getMaterialCategories,
  createMaterialCategory,
  updateMaterialCategory,
  deleteMaterialCategory,
} from "../../../controllers/admin/marketing-material.controller";

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

describe("admin marketing-material.controller", () => {
  describe("素材管理", () => {
    it("createMaterial - 应创建素材", async () => {
      const body = { name: "banner图", materialType: "IMAGE", url: "https://example.com/img.jpg" };
      mocks.createMaterial.mockResolvedValue({ id: 1 });
      const req = mockReq({ body });
      const res = mockRes();
      await createMaterial(req, res, vi.fn());
      expect(mocks.createMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ name: "banner图", materialType: "IMAGE" }),
        "t1",
        1
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("createMaterial - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ body: { name: "测试" } });
      const res = mockRes();
      await expect(createMaterial(req, res, vi.fn())).rejects.toThrow();
      expect(mocks.createMaterial).not.toHaveBeenCalled();
    });

    it("listMaterials - 应返回素材列表", async () => {
      mocks.listMaterials.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { material_type: "IMAGE", category_id: "1", status: "PUBLISHED", page: "1", pageSize: "10" } });
      const res = mockRes();
      await listMaterials(req, res, vi.fn());
      expect(mocks.listMaterials).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "t1", material_type: "IMAGE", category_id: 1, status: "PUBLISHED", page: 1, pageSize: 10 })
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("listMaterials - 使用默认分页参数", async () => {
      mocks.listMaterials.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq();
      const res = mockRes();
      await listMaterials(req, res, vi.fn());
      expect(mocks.listMaterials).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 })
      );
    });

    it("getMaterialDetail - 应返回素材详情", async () => {
      mocks.getMaterialDetail.mockResolvedValue({ id: 1, name: "素材1" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await getMaterialDetail(req, res, vi.fn());
      expect(mocks.getMaterialDetail).toHaveBeenCalledWith(1, "t1");
      expect(res.json).toHaveBeenCalled();
    });

    it("updateMaterial - 应更新素材", async () => {
      const body = { name: "新名称", status: "PUBLISHED" };
      mocks.updateMaterial.mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" }, body });
      const res = mockRes();
      await updateMaterial(req, res, vi.fn());
      expect(mocks.updateMaterial).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: "新名称" }),
        "t1"
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("deleteMaterial - 应删除素材", async () => {
      mocks.deleteMaterial.mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deleteMaterial(req, res, vi.fn());
      expect(mocks.deleteMaterial).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith(null);
    });

    it("publishMaterial - 应发布素材", async () => {
      mocks.publishMaterial.mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await publishMaterial(req, res, vi.fn());
      expect(mocks.publishMaterial).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith(null);
    });

    it("archiveMaterial - 应归档素材", async () => {
      mocks.archiveMaterial.mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await archiveMaterial(req, res, vi.fn());
      expect(mocks.archiveMaterial).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith(null);
    });
  });

  describe("素材分类", () => {
    it("getMaterialCategories - 应返回素材分类列表", async () => {
      mocks.getMaterialCategories.mockResolvedValue([]);
      const req = mockReq();
      const res = mockRes();
      await getMaterialCategories(req, res, vi.fn());
      expect(mocks.getMaterialCategories).toHaveBeenCalledWith("t1");
      expect(res.json).toHaveBeenCalled();
    });

    it("createMaterialCategory - 应创建素材分类", async () => {
      const body = { name: "海报素材" };
      mocks.createMaterialCategory.mockResolvedValue({ id: 1 });
      const req = mockReq({ body });
      const res = mockRes();
      await createMaterialCategory(req, res, vi.fn());
      expect(mocks.createMaterialCategory).toHaveBeenCalledWith(
        expect.objectContaining({ name: "海报素材" }),
        "t1"
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("createMaterialCategory - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      await expect(createMaterialCategory(req, res, vi.fn())).rejects.toThrow();
      expect(mocks.createMaterialCategory).not.toHaveBeenCalled();
    });

    it("updateMaterialCategory - 应更新素材分类", async () => {
      const body = { name: "新分类名" };
      mocks.updateMaterialCategory.mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" }, body });
      const res = mockRes();
      await updateMaterialCategory(req, res, vi.fn());
      expect(mocks.updateMaterialCategory).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: "新分类名" }),
        "t1"
      );
      expect(mocks.ok).toHaveBeenCalledWith(null);
    });

    it("deleteMaterialCategory - 应删除素材分类", async () => {
      mocks.deleteMaterialCategory.mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deleteMaterialCategory(req, res, vi.fn());
      expect(mocks.deleteMaterialCategory).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith(null);
    });
  });
});
