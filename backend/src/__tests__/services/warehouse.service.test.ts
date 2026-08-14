import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));
vi.mock("../../shared/id", () => ({
  makeBizNo: () => "WH2026081500001",
}));

import {
  listWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "../../services/warehouse.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("warehouse.service - 仓库管理", () => {
  it("listWarehouses 按租户与仓库类型查询", async () => {
    mocks.query.mockResolvedValue([{ id: 1, storeCode: "WH1", name: "主仓" }]);
    const res = await listWarehouses(tenantId);
    expect(res).toHaveLength(1);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("store_type = 'WAREHOUSE'"),
      [tenantId]
    );
  });

  it("createWarehouse 名称为空抛 400", async () => {
    await expect(createWarehouse({ name: "" }, tenantId))
      .rejects.toMatchObject({ statusCode: 400, message: "仓库名称不能为空" });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("createWarehouse 成功返回新 id", async () => {
    mocks.query.mockResolvedValue({ insertId: 7 });
    const res = await createWarehouse({ name: "南区仓", address: "A路1号", phone: "138" }, tenantId);
    expect(res).toEqual({ id: 7 });
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("INSERT INTO t_store");
    expect(params[0]).toBe(tenantId);
    expect(params[2]).toBe("南区仓");
  });

  it("updateWarehouse 仓库不存在抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(updateWarehouse(99, { name: "X" }, tenantId))
      .rejects.toMatchObject({ statusCode: 404, message: "仓库不存在" });
  });

  it("updateWarehouse 仅更新传入字段并带租户条件", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1 });
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    await updateWarehouse(1, { name: "新仓名", phone: "139" }, tenantId);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("SET name = ?, store_name = ?, phone = ?");
    expect(sql).toContain("WHERE id = ? AND tenant_id = ?");
    expect(params).toEqual(["新仓名", "新仓名", "139", 1, tenantId]);
  });

  it("updateWarehouse 无字段更新时不执行 SQL", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1 });
    await updateWarehouse(1, {}, tenantId);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("deleteWarehouse 按租户+类型删除", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    await deleteWarehouse(3, tenantId);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("DELETE FROM t_store");
    expect(sql).toContain("store_type = 'WAREHOUSE'");
    expect(params).toEqual([3, tenantId]);
  });
});
