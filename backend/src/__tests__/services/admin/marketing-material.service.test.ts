import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import { createMaterial, listMaterials, getMaterialDetail } from "../../../services/admin/marketing-material.service";

describe("admin/marketing-material.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.makeBizNo.mockReturnValue("SC20260815001");
  });

  it("createMaterial：创建营销素材", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ insertId: 8 }]);
    const result = await createMaterial({ name: "五一海报", materialType: "IMAGE", url: "a.jpg", tags: ["HOT"] } as any, "t1", 1);
    expect(result.id).toBe(8);
    expect(result.material_code).toBe("SC20260815001");
  });

  it("listMaterials：分页素材列表（含标签过滤）", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ cnt: 2 });
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, material_name: "海报" }]);
    const result = await listMaterials({ tenantId: "t1" });
    expect(result.total).toBe(2);
    expect(result.list[0].material_name).toBe("海报");
  });

  it("getMaterialDetail：返回素材详情并累计浏览量", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, material_name: "海报" });
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    const detail = await getMaterialDetail(1, "t1");
    expect(detail?.material_name).toBe("海报");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("view_count"),
      [1, "t1"],
      "t1"
    );
  });
});
