import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

vi.mock("../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import { listWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from "../../services/warehouse.service";

describe("warehouse.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.makeBizNo.mockReturnValue("WH20260815001");
  });

  it("listWarehouses：返回仓库列表（store_type=WAREHOUSE）", async () => {
    mocks.query.mockResolvedValueOnce([{ id: 1, storeCode: "WH001", name: "总仓" }]);
    const result = await listWarehouses("t1");
    expect(result[0].name).toBe("总仓");
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("store_type = 'WAREHOUSE'"),
      ["t1"]
    );
  });

  it("createWarehouse：创建仓库", async () => {
    mocks.query.mockResolvedValueOnce({ insertId: 3 });
    const result = await createWarehouse({ name: "南仓", address: "深圳" }, "t1");
    expect(result.id).toBe(3);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO t_store"),
      expect.arrayContaining(["WH20260815001", "南仓", "t1"])
    );
  });

  it("createWarehouse：名称不能为空", async () => {
    await expect(createWarehouse({ name: "" }, "t1")).rejects.toThrow("仓库名称不能为空");
  });

  it("updateWarehouse：更新仓库字段", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5 });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });
    await updateWarehouse(5, { name: "新仓名" }, "t1");
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_store SET"),
      expect.arrayContaining(["新仓名"])
    );
  });

  // MS-SECURITY-BASELINE-01（参数化守卫）：外部输入必须走 ? 占位绑定，
  // SQL 文本不得出现值的字面插值（防 SQL 注入回归）。
  it("updateWarehouse：外部输入一律参数绑定，SQL 文本保持 ? 占位（MS-SECURITY-BASELINE-01）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5 });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });
    const evil = "x', store_type = 'STORE', status = 9 --";
    await updateWarehouse(5, { name: evil, phone: "13800000000" }, "t1");
    const [sql, params] = mocks.query.mock.calls[0];
    // SQL 文本不含任何注入值片段
    expect(String(sql)).not.toContain(evil);
    expect(String(sql)).not.toContain("13800000000");
    expect(String(sql)).toBe(
      "UPDATE t_store SET name = ?, store_name = ?, phone = ? WHERE id = ? AND tenant_id = ?"
    );
    // 值全部出现在参数数组中
    expect(params[0]).toBe(evil);
    expect(params[2]).toBe("13800000000");
  });

  it("deleteWarehouse：删除仓库", async () => {
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });
    await deleteWarehouse(5, "t1");
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM t_store"),
      [5, "t1"]
    );
  });
});
