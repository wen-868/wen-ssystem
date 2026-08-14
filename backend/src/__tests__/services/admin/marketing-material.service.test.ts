import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  query: vi.fn(),
  queryOne: vi.fn(),
}));
vi.mock("../../../shared/id", () => ({
  makeBizNo: () => "SC2026081500001",
}));

import {
  createMaterial,
  listMaterials,
  getMaterialDetail,
  deleteMaterial,
} from "../../../services/admin/marketing-material.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("marketing-material.service - 营销素材", () => {
  it("createMaterial 插入并返回 id 与编码", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ insertId: 5 }]); // 数组归一化
    const res = await createMaterial({ name: "海报", materialType: "IMAGE", url: "u", tags: ["a"] }, tenantId, 9);
    expect(res).toEqual({ id: 5, material_code: "SC2026081500001" });
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("INSERT INTO t_marketing_material");
    expect(params[0]).toBe("SC2026081500001");
  });

  it("listMaterials 全量分页", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ cnt: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, material_name: "海报" }]);
    const res = await listMaterials({ tenantId, page: 1, pageSize: 20 });
    expect(res.total).toBe(1);
    expect(res.list[0].material_name).toBe("海报");
  });

  it("listMaterials 带类型/状态/分类筛选", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ cnt: 0 });
    mocks.queryWithTenant.mockResolvedValue([]);
    await listMaterials({ tenantId, material_type: "IMAGE", status: "PUBLISHED", category_id: 3 });
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("material_type = ?");
    expect(sql).toContain("status = ?");
    expect(sql).toContain("category_id = ?");
  });

  it("getMaterialDetail 存在时返回并累加浏览量，不存在返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, material_name: "海报" });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const material = await getMaterialDetail(1, tenantId);
    expect(material?.material_name).toBe("海报");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("view_count = view_count + 1");

    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    expect(await getMaterialDetail(99, tenantId)).toBeNull();
  });

  it("deleteMaterial 按租户删除", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await deleteMaterial(1, tenantId);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("DELETE FROM t_marketing_material");
  });
});
