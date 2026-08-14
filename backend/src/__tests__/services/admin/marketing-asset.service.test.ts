import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

import {
  getMarketingAssets,
  createMarketingAsset,
  updateMarketingAsset,
  deleteMarketingAsset,
} from "../../../services/admin/marketing-asset.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("marketing-asset.service - 营销资产", () => {
  it("getMarketingAssets 无筛选返回分页", async () => {
    mocks.query.mockResolvedValue([{ id: 1, name: "横幅" }]);
    mocks.queryOne.mockResolvedValue({ cnt: 1 });
    const res = await getMarketingAssets("t1");
    expect(res.total).toBe(1);
    expect(res.records[0].name).toBe("横幅");
  });

  it("getMarketingAssets 带类型/分类/状态筛选", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.queryOne.mockResolvedValue({ cnt: 0 });
    await getMarketingAssets("t1", { type: "IMAGE", category: "节日", status: "ACTIVE" });
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("type = ?");
    expect(sql).toContain("category = ?");
    expect(sql).toContain("status = ?");
  });

  it("createMarketingAsset 返回新 id（数组归一化）", async () => {
    mocks.query.mockResolvedValue([{ insertId: 9 }]);
    const res = await createMarketingAsset({ name: "海报", type: "IMAGE", tags: ["a"] });
    expect(res).toEqual({ id: 9 });
  });

  it("updateMarketingAsset 更新并返回成功", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateMarketingAsset(1, { name: "新名", status: "ARCHIVED" });
    expect(res).toEqual({ success: true });
    expect(String(mocks.query.mock.calls[0][0])).toContain("UPDATE t_marketing_asset");
  });

  it("deleteMarketingAsset 删除并返回成功", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await deleteMarketingAsset(3);
    expect(res).toEqual({ success: true });
    expect(mocks.query).toHaveBeenCalledWith("DELETE FROM t_marketing_asset WHERE id=?", [3]);
  });
});
