﻿﻿﻿﻿﻿/**
 * 销售单 service 单元测试
 * 被测文件：src/services/store/sale-bill.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
  makeToken: vi.fn(),
  computeSellingPrice: vi.fn(),
  getPriceType: vi.fn(),
  updateTraceCodesBySkuList: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
  makeToken: mocks.makeToken,
}));

vi.mock("../../../shared/fulfillment", () => ({
  computeSellingPrice: mocks.computeSellingPrice,
  getPriceType: mocks.getPriceType,
}));

vi.mock("../../../shared/trace-code", () => ({
  updateTraceCodesBySkuList: mocks.updateTraceCodesBySkuList,
}));

import {
  listSaleBills,
  getSaleBillDetail,
  createSaleBill,
  createCollectionLink,
  offlinePayment,
  paymentOnSaleBill,
  listOverdueBills,
  checkOverdueBills,
  batchCreateCollectionLinks,
  revokeCollectionLink,
  getCollectionLinkStats,
} from "../../../services/store/sale-bill.service";

const mockConn = { query: vi.fn(), execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("XS20260709000001");
  mocks.makeToken.mockReturnValue("token-abc");
  mocks.transaction.mockImplementation(async (cb: any) => cb(mockConn));
});

// ============ listSaleBills ============
describe("sale-bill.service - listSaleBills", () => {
  it("total 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ billNo: "XS1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listSaleBills({ page: 1, pageSize: 10, storeId: null, keyword: "", collectionStatus: null, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ billNo: "XS1" }] });
  });

  it("total 为 null（?. 右 + ?? 右）+ storeId/collectionStatus 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listSaleBills({ page: 1, pageSize: 10, storeId: 1, keyword: "张", collectionStatus: "PAID", tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

// ============ getSaleBillDetail ============
describe("sale-bill.service - getSaleBillDetail", () => {
  it("销售单存在", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ billNo: "XS1" });
    mocks.queryWithTenant.mockResolvedValue([{ skuId: 1 }]);
    const res = await getSaleBillDetail("XS1", "t1");
    expect(res).toEqual({ billNo: "XS1", items: [{ skuId: 1 }] });
  });

  it("销售单不存在返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getSaleBillDetail("XS1", "t1");
    expect(res).toBeNull();
  });
});

// ============ createSaleBill ============
describe("sale-bill.service - createSaleBill", () => {
  it("全量字段（customerId 有值 + member 有值 + unitPrice 有值 + priceType 有值 + CREDIT + dueDate 有值 + remark/internalRemark 有值 + skuIds > 0）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 10, name: "张三", mobile: "13800000000", customer_type: "WHOLESALE" })
      .mockResolvedValueOnce({ sku_name: "茅台", retail_price: 100, wholesale_price: 80, store_price: 90 });
    mockConn.execute.mockResolvedValue([]);
    mocks.updateTraceCodesBySkuList.mockResolvedValue(undefined);
    const res = await createSaleBill({
      storeId: 1, customerId: 10, customerName: "张三", customerMobile: "13800000000",
      discountAmount: 10, roundingAmount: 0, remark: "备注", internalRemark: "内部备注",
      saleType: "CREDIT", dueDate: "2026-12-31",
      items: [{ skuId: 1, boxQty: 1, bottleQty: 0, totalBottleQty: 12, unitPrice: 80, priceType: "WHOLESALE" }],
      userId: 1, tenantId: "t1",
    });
    expect(res.billNo).toBe("XS20260709000001");
    expect(res.businessStatus).toBe("CREATED");
  });

  it("最小字段（customerId 无值 + member=null + unitPrice 无值->computeSellingPrice + priceType 无值->getPriceType + CASH + remark/internalRemark 无值 + customerName/Mobile 有值）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ sku_name: "五粮液", retail_price: 50, wholesale_price: 40, store_price: 45 });
    mocks.computeSellingPrice.mockReturnValue(45);
    mocks.getPriceType.mockReturnValue("RETAIL");
    mockConn.execute.mockResolvedValue([]);
    mocks.updateTraceCodesBySkuList.mockResolvedValue(undefined);
    const res = await createSaleBill({
      storeId: 1, customerId: null, customerName: "李四", customerMobile: "13900000000",
      discountAmount: 0, roundingAmount: 0, saleType: "CASH",
      items: [{ skuId: 2, boxQty: 0, bottleQty: 6, totalBottleQty: 6 }],
      userId: 1, tenantId: "t1",
    } as any);
    expect(res.billNo).toBe("XS20260709000001");
    expect(mocks.computeSellingPrice).toHaveBeenCalledOnce();
    expect(mocks.getPriceType).toHaveBeenCalledOnce();
  });

  it("price 不存在时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(createSaleBill({
      storeId: 1, customerId: null, discountAmount: 0, roundingAmount: 0, saleType: "CASH",
      items: [{ skuId: 99, boxQty: 1, bottleQty: 0, totalBottleQty: 12 }],
      userId: 1, tenantId: "t1",
    } as any)).rejects.toThrow("SKU不存在：99");
  });

  it("items 为空（skuIds.length === 0）", async () => {
    mockConn.execute.mockResolvedValue([]);
    const res = await createSaleBill({
      storeId: 1, customerId: null, discountAmount: 0, roundingAmount: 0, saleType: "CASH",
      items: [], userId: 1, tenantId: "t1",
    } as any);
    expect(res.receivableAmount).toBe(0);
    expect(mocks.updateTraceCodesBySkuList).not.toHaveBeenCalled();
  });

  it("CREDIT + dueDate 无值（dueDate ?? null 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ sku_name: "剑南春", retail_price: 30, wholesale_price: 25, store_price: 28 });
    mockConn.execute.mockResolvedValue([]);
    mocks.updateTraceCodesBySkuList.mockResolvedValue(undefined);
    const res = await createSaleBill({
      storeId: 1, customerId: null, discountAmount: 0, roundingAmount: 0, saleType: "CREDIT",
      items: [{ skuId: 3, boxQty: 1, bottleQty: 0, totalBottleQty: 12, unitPrice: 25 }],
      userId: 1, tenantId: "t1",
    } as any);
    expect(res.billNo).toBe("XS20260709000001");
  });
});

// ============ createCollectionLink ============
describe("sale-bill.service - createCollectionLink", () => {
  it("销售单不存在时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(createCollectionLink({
      billNo: "XS1", shareChannel: "WECHAT", amount: 100, taxEnabled: true, taxRate: 0.06, expireHours: 24, userId: 1, tenantId: "t1",
    })).rejects.toThrow("销售单不存在");
  });

  it("amount <= 0 时抛错（|| 左）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ bill_no: "XS1", unreceived_amount: 100 });
    await expect(createCollectionLink({
      billNo: "XS1", shareChannel: "WECHAT", amount: 0, taxEnabled: true, taxRate: 0.06, expireHours: 24, userId: 1, tenantId: "t1",
    })).rejects.toThrow("收款金额必须大于0且不能超过未收金额");
  });

  it("amount > unreceived 时抛错（|| 右）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ bill_no: "XS1", unreceived_amount: 50 });
    await expect(createCollectionLink({
      billNo: "XS1", shareChannel: "WECHAT", amount: 100, taxEnabled: true, taxRate: 0.06, expireHours: 24, userId: 1, tenantId: "t1",
    })).rejects.toThrow("收款金额必须大于0且不能超过未收金额");
  });

  it("成功创建 + taxEnabled true（taxAmount 计算 + 1）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ bill_no: "XS1", unreceived_amount: 200 });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await createCollectionLink({
      billNo: "XS1", shareChannel: "WECHAT", amount: 100, taxEnabled: true, taxRate: 0.06, expireHours: 24, userId: 1, tenantId: "t1",
    });
    expect(res.taxAmount).toBe(6);
    expect(res.token).toBe("token-abc");
  });

  it("成功创建 + taxEnabled false（taxAmount = 0 + 0）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ bill_no: "XS2", unreceived_amount: 200 });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await createCollectionLink({
      billNo: "XS2", shareChannel: "ALIPAY", amount: 50, taxEnabled: false, taxRate: 0.06, expireHours: 48, userId: 2, tenantId: "t1",
    });
    expect(res.taxAmount).toBe(0);
  });
});

// ============ offlinePayment ============
describe("sale-bill.service - offlinePayment", () => {
  it("销售单不存在时抛错", async () => {
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[], undefined]);
      return Promise.resolve([[], undefined]);
    });
    await expect(offlinePayment({ billNo: "XS1", amount: 100, paymentMethod: "CASH", userId: 1, username: "admin", tenantId: "t1" }))
      .rejects.toThrow("销售单不存在");
  });

  it("amount <= 0 时抛错（|| 左）", async () => {
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[{ bill_no: "XS1", store_id: 1, received_amount: 0, receivable_amount: 100 }], undefined]);
      if (sql.includes("inventory_ledger")) return Promise.resolve([[], undefined]);
      return Promise.resolve([[], undefined]);
    });
    await expect(offlinePayment({ billNo: "XS1", amount: 0, paymentMethod: "CASH", userId: 1, username: "admin", tenantId: "t1" }))
      .rejects.toThrow("收款金额不合法");
  });

  it("amount > max 时抛错（|| 右）", async () => {
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE")) return Promise.resolve([[{ bill_no: "XS1", store_id: 1, received_amount: 0, receivable_amount: 100 }], undefined]);
      if (sql.includes("inventory_ledger")) return Promise.resolve([[], undefined]);
      return Promise.resolve([[], undefined]);
    });
    await expect(offlinePayment({ billNo: "XS1", amount: 200, paymentMethod: "CASH", userId: 1, username: "admin", tenantId: "t1" }))
      .rejects.toThrow("收款金额不合法");
  });

  it("alreadyDeducted true -> 跳过库存扣减 + PAID + userId/remark 有值", async () => {
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE") && sql.includes("t_sale_bill")) return Promise.resolve([[{ bill_no: "XS1", store_id: 1, received_amount: 0, receivable_amount: 100 }], undefined]);
      if (sql.includes("inventory_ledger")) return Promise.resolve([[{ id: 1 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    mockConn.execute.mockResolvedValue([]);
    const res = await offlinePayment({ billNo: "XS1", amount: 100, paymentMethod: "CASH", remark: "线下", userId: 1, username: "admin", tenantId: "t1" });
    expect(res).toEqual({ billNo: "XS1", receivedAmount: 100, collectionStatus: "PAID" });
  });

  it("alreadyDeducted false + PAID + 库存充足 + inventory/quantity/store_id/userId/remark 全有值", async () => {
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE") && sql.includes("t_sale_bill")) return Promise.resolve([[{ bill_no: "XS2", store_id: 1, received_amount: 0, receivable_amount: 100 }], undefined]);
      if (sql.includes("inventory_ledger")) return Promise.resolve([[], undefined]);
      if (sql.includes("t_sale_bill_item")) return Promise.resolve([[{ skuId: 1, quantity: 5 }], undefined]);
      if (sql.includes("t_inventory_balance")) return Promise.resolve([[{ physicalQty: 10, availableQty: 10 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    mockConn.execute.mockResolvedValue([]);
    const res = await offlinePayment({ billNo: "XS2", amount: 100, paymentMethod: "CASH", remark: "线下", userId: 1, username: "admin", tenantId: "t1" });
    expect(res.collectionStatus).toBe("PAID");
  });

  it("alreadyDeducted false + PARTIAL + inventory 不存在（?. 右 + ?? 0 右）+ quantity 无值（?? 右）+ store_id 无值 storeId 有值（?? 右）+ userId null + remark 无值", async () => {
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE") && sql.includes("t_sale_bill")) return Promise.resolve([[{ bill_no: "XS3", storeId: 1, received_amount: 0, receivable_amount: 200 }], undefined]);
      if (sql.includes("inventory_ledger")) return Promise.resolve([[], undefined]);
      if (sql.includes("t_sale_bill_item")) return Promise.resolve([[{ skuId: 1, total_bottle_qty: 3 }], undefined]);
      if (sql.includes("t_inventory_balance")) return Promise.resolve([[], undefined]);
      return Promise.resolve([[], undefined]);
    });
    mockConn.execute.mockResolvedValue([]);
    const res = await offlinePayment({ billNo: "XS3", amount: 50, paymentMethod: "CASH", userId: null as any, username: "admin", tenantId: "t1" });
    expect(res.collectionStatus).toBe("PARTIAL");
  });

  it("alreadyDeducted false + 库存不足时抛错", async () => {
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("FOR UPDATE") && sql.includes("t_sale_bill")) return Promise.resolve([[{ bill_no: "XS4", store_id: 1, received_amount: 0, receivable_amount: 100 }], undefined]);
      if (sql.includes("inventory_ledger")) return Promise.resolve([[], undefined]);
      if (sql.includes("t_sale_bill_item")) return Promise.resolve([[{ skuId: 1, quantity: 10 }], undefined]);
      if (sql.includes("t_inventory_balance")) return Promise.resolve([[{ physicalQty: 2, availableQty: 2 }], undefined]);
      return Promise.resolve([[], undefined]);
    });
    await expect(offlinePayment({ billNo: "XS4", amount: 100, paymentMethod: "CASH", userId: 1, username: "admin", tenantId: "t1" }))
      .rejects.toThrow("库存不足，无法完成收款出库");
  });
});

// ============ paymentOnSaleBill ============
describe("sale-bill.service - paymentOnSaleBill", () => {
  it("销售单不存在时抛错", async () => {
    mockConn.query.mockResolvedValue([[], undefined]);
    await expect(paymentOnSaleBill({ billNo: "XS1", amount: 100, paymentMethod: "WECHAT", userId: 1, username: "admin", tenantId: "t1" }))
      .rejects.toThrow("销售单不存在");
  });

  it("amount <= 0 时抛错", async () => {
    mockConn.query.mockResolvedValue([[{ bill_no: "XS1", received_amount: 0, receivable_amount: 100 }], undefined]);
    await expect(paymentOnSaleBill({ billNo: "XS1", amount: 0, paymentMethod: "WECHAT", userId: 1, username: "admin", tenantId: "t1" }))
      .rejects.toThrow("收款金额不合法");
  });

  it("amount > max 时抛错", async () => {
    mockConn.query.mockResolvedValue([[{ bill_no: "XS1", received_amount: 0, receivable_amount: 100 }], undefined]);
    await expect(paymentOnSaleBill({ billNo: "XS1", amount: 200, paymentMethod: "WECHAT", userId: 1, username: "admin", tenantId: "t1" }))
      .rejects.toThrow("收款金额不合法");
  });

  it("PAID + userId/username 有值（?? 左）", async () => {
    mockConn.query.mockResolvedValue([[{ bill_no: "XS1", received_amount: 0, receivable_amount: 100 }], undefined]);
    mockConn.execute.mockResolvedValue([]);
    const res = await paymentOnSaleBill({ billNo: "XS1", amount: 100, paymentMethod: "WECHAT", userId: 1, username: "admin", tenantId: "t1" });
    expect(res).toEqual({ billNo: "XS1", receivedAmount: 100, collectionStatus: "PAID" });
  });

  it("PARTIAL + userId/username 无值（?? 右）", async () => {
    mockConn.query.mockResolvedValue([[{ bill_no: "XS2", received_amount: 0, receivable_amount: 200 }], undefined]);
    mockConn.execute.mockResolvedValue([]);
    const res = await paymentOnSaleBill({ billNo: "XS2", amount: 50, paymentMethod: "WECHAT", userId: null as any, username: null as any, tenantId: "t1" });
    expect(res.collectionStatus).toBe("PARTIAL");
  });
});

// ============ listOverdueBills ============
describe("sale-bill.service - listOverdueBills", () => {
  it("total 有值 + storeId 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ billNo: "XS1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listOverdueBills({ page: 1, pageSize: 10, storeId: 1, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ billNo: "XS1" }] });
  });

  it("total 为 null + storeId 无值", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listOverdueBills({ page: 1, pageSize: 10, storeId: null, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

// ============ checkOverdueBills ============
describe("sale-bill.service - checkOverdueBills", () => {
  it("storeId 有值 + 有逾期账单（overdueBills.length > 0）", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ billNo: "XS1" }, { billNo: "XS2" }])
      .mockResolvedValueOnce([]);
    const res = await checkOverdueBills(1, "t1");
    expect(res.count).toBe(2);
  });

  it("storeId 无值 + 无逾期账单（overdueBills.length === 0）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await checkOverdueBills(null, "t1");
    expect(res.count).toBe(0);
  });
});

// ============ batchCreateCollectionLinks ============
describe("sale-bill.service - batchCreateCollectionLinks", () => {
  it("bill 不存在 -> continue + amount 有值 + linkAmount > unreceived -> continue + 成功创建（taxEnabled true）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ bill_no: "XS2", unreceived_amount: 50 })
      .mockResolvedValueOnce({ bill_no: "XS3", unreceived_amount: 200 });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await batchCreateCollectionLinks({
      billNos: ["XS1", "XS2", "XS3"], shareChannel: "WECHAT", amount: 100,
      taxEnabled: true, taxRate: 0.06, expireHours: 24, userId: 1, tenantId: "t1",
    });
    expect(res.count).toBe(1);
    expect(res.links[0].billNo).toBe("XS3");
  });

  it("amount 无值 -> 用 bill.unreceived_amount + linkAmount <= 0 -> continue + taxEnabled false", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ bill_no: "XS1", unreceived_amount: 0 })
      .mockResolvedValueOnce({ bill_no: "XS2", unreceived_amount: 100 });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await batchCreateCollectionLinks({
      billNos: ["XS1", "XS2"], shareChannel: "ALIPAY",
      taxEnabled: false, taxRate: 0.06, expireHours: 48, userId: 1, tenantId: "t1",
    });
    expect(res.count).toBe(1);
    expect(res.links[0].taxAmount).toBeUndefined();
  });
});

// ============ revokeCollectionLink ============
describe("sale-bill.service - revokeCollectionLink", () => {
  it("链接不存在时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(revokeCollectionLink("SK1", "t1")).rejects.toThrow("分享链接不存在");
  });

  it("状态为 REVOKED 时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ link_no: "SK1", status: "REVOKED" });
    await expect(revokeCollectionLink("SK1", "t1")).rejects.toThrow("链接已撤销");
  });

  it("状态为 PAID 时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ link_no: "SK1", status: "PAID" });
    await expect(revokeCollectionLink("SK1", "t1")).rejects.toThrow("已支付的链接不可撤销");
  });

  it("成功撤销", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ link_no: "SK1", status: "PENDING" });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await revokeCollectionLink("SK1", "t1");
    expect(res).toEqual({ linkNo: "SK1", status: "REVOKED" });
  });
});

// ============ getCollectionLinkStats ============
describe("sale-bill.service - getCollectionLinkStats", () => {
  it("total > 0 + 各字段有值（计算 paymentRate）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 10 })
      .mockResolvedValueOnce({ cnt: 5 })
      .mockResolvedValueOnce({ cnt: 2 });
    mocks.queryWithTenant.mockResolvedValue([{ channel: "WECHAT", cnt: 3 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ amount: 500 });
    const res = await getCollectionLinkStats("t1");
    expect(res.total).toBe(10);
    expect(res.paidCount).toBe(5);
    expect(res.revokedCount).toBe(2);
    expect(res.totalPaidAmount).toBe(500);
    expect(res.paymentRate).toBe("50.0%");
  });

  it("total === 0 + 各字段为 null（?. 右 + ?? 右 + 0%）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    const res = await getCollectionLinkStats("t1");
    expect(res.total).toBe(0);
    expect(res.paidCount).toBe(0);
    expect(res.revokedCount).toBe(0);
    expect(res.totalPaidAmount).toBe(0);
    expect(res.paymentRate).toBe("0%");
  });

  it("total > 0 + paid 为 null（paid?.cnt ?? 0 右分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 5 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ cnt: 1 });
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ amount: 0 });
    const res = await getCollectionLinkStats("t1");
    expect(res.total).toBe(5);
    expect(res.paidCount).toBe(0);
    expect(res.paymentRate).toBe("0.0%");
  });
});
