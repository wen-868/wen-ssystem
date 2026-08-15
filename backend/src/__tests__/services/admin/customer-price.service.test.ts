import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { listCustomerPrices, createCustomerPrice, deleteCustomerPrice, getCustomerPrice } from "../../../services/admin/customer-price.service";

describe("admin/customer-price.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("listCustomerPrices：分页客户协议价列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, customerName: "张三", customPrice: 95 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listCustomerPrices({ page: 1, pageSize: 20, tenantId: "t1" });
    expect(result.total).toBe(1);
    expect(result.records[0].customerName).toBe("张三");
  });

  it("createCustomerPrice：创建客户协议价", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ insertId: 3 });
    const result = await createCustomerPrice({ customerId: 1, skuId: 10, customPrice: 95, tenantId: "t1" });
    expect(result.id).toBe(3);
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO t_customer_price"),
      expect.arrayContaining([1, 10, 95]),
      "t1"
    );
  });

  it("deleteCustomerPrice：删除客户协议价", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 5 });
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    await deleteCustomerPrice(5, "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM t_customer_price"),
      [5, "t1"],
      "t1"
    );
  });

  it("getCustomerPrice：查询客户-SKU 协议价", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ custom_price: 95, status: "ACTIVE" });
    const result = await getCustomerPrice(1, 10, "t1");
    expect(result?.custom_price).toBe(95);
  });
});
