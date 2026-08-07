/**
 * 即时零售管理扩展 service 单元测试（ajian_retail_fix_01）
 * 被测文件：src/services/instant-retail/retail-ops-ext.service.ts
 * 覆盖：货架/支付/配送/接单看板/购物车分析 五类接口的映射与 SQL 条件。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import {
  listShelfProducts,
  addShelfProduct,
  updateShelfProduct,
  removeShelfProduct,
  listPayments,
  getPaymentDetail,
  listDeliveries,
  assignDeliveryRider,
  updateDeliveryStatus,
  getOrderBoard,
  getRetailCartAnalysis,
} from "../../../services/instant-retail/retail-ops-ext.service";

describe("instant-retail/retail-ops-ext.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("listShelfProducts - 货架列表", () => {
    it("JOIN 商品表并映射 camelCase + tags", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
      mocks.queryWithTenant.mockResolvedValue([
        {
          id: 1,
          productId: 11,
          skuId: 11,
          categoryId: 2,
          retailPrice: "88.00",
          originalPrice: "99.00",
          stock: 20,
          salesCount: 5,
          sortOrder: 3,
          shelfStatus: "ON",
          isRecommended: 1,
          isHot: 0,
          isNew: 1,
          sku: "SKU001",
          barcode: "690123",
          productName: "五粮液",
          productImage: "https://img/1.png",
          unit: "瓶",
        },
      ]);

      const res = await listShelfProducts({ tenantId: "t1", page: 1, pageSize: 20 });

      expect(res.total).toBe(1);
      expect(res.records[0]).toMatchObject({
        id: 1,
        productId: 11,
        productName: "五粮液",
        sku: "SKU001",
        retailPrice: 88,
        stock: 20,
        sales: 5,
        sort: 3,
        shelfStatus: "ON",
        tags: ["RECOMMEND", "NEW"],
      });
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("spu.name AS productName"),
        [ "t1", 20, 0 ],
        "t1"
      );
    });

    it("keyword/category/status/tag 筛选条件正确拼接", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      mocks.queryWithTenant.mockResolvedValue([]);

      await listShelfProducts({
        tenantId: "t1",
        keyword: "酒",
        category: 2,
        status: "ON",
        tag: "HOT",
        page: 1,
        pageSize: 20,
      });

      expect(mocks.queryOneWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("rp.category_id = ?"),
        ["t1", 2, "ON", "%酒%", "%酒%", "%酒%"],
        "t1"
      );
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("rp.is_hot = 1"),
        ["t1", 2, "ON", "%酒%", "%酒%", "%酒%", 20, 0],
        "t1"
      );
    });
  });

  describe("addShelfProduct - 上架", () => {
    it("SKU 存在时插入并返回 id", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 11 });
      mocks.queryWithTenant.mockResolvedValue({ insertId: 9 });

      const res = await addShelfProduct(
        { skuId: 11, retailPrice: 88, tags: ["RECOMMEND", "HOT"], sort: 1 },
        "t1"
      );

      expect(res.id).toBe(9);
      expect(mocks.queryOneWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("t_product_sku"),
        [11, "t1"],
        "t1"
      );
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO t_retail_product"),
        [11, 11, null, 88, null, 0, 1, 1, 0, 1, "ON", "t1"],
        "t1"
      );
    });

    it("SKU 不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(undefined);
      await expect(addShelfProduct({ skuId: 99, retailPrice: 10 }, "t1")).rejects.toThrow("商品(SKU)不存在");
    });
  });

  describe("updateShelfProduct - 编辑", () => {
    it("动态 SET 字段 + tags 展开为三个标记位", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });

      await updateShelfProduct(1, { retailPrice: 90, tags: ["HOT"] }, "t1");

      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("retail_price = ?"),
        [90, 0, 1, 0, 1, "t1"],
        "t1"
      );
    });

    it("无字段时不执行 SQL", async () => {
      const res = await updateShelfProduct(1, {}, "t1");
      expect(res).toEqual({ id: 1 });
      expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    });
  });

  describe("removeShelfProduct - 移除", () => {
    it("按 id + tenant 删除", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
      await removeShelfProduct(1, "t1");
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM t_retail_product"),
        [1, "t1"],
        "t1"
      );
    });
  });

  describe("listPayments - 支付记录", () => {
    it("仅查 MINIAPP_ORDER 来源并映射状态", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
      mocks.queryWithTenant.mockResolvedValue([
        {
          paymentNo: "ZF001",
          orderNo: "MO001",
          amount: "100.00",
          method: "WECHAT",
          status: "SUCCESS",
          transactionNo: "tx1",
          paidAt: new Date("2026-08-08T00:00:00Z"),
          createdAt: new Date("2026-08-08T00:00:00Z"),
        },
      ]);

      const res = await listPayments({ tenantId: "t1", page: 1, pageSize: 20 });

      expect(res.records[0]).toMatchObject({
        paymentNo: "ZF001",
        orderNo: "MO001",
        amount: 100,
        method: "WECHAT",
        status: "PAID",
      });
      expect(mocks.queryOneWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("source_type = 'MINIAPP_ORDER'"),
        ["t1"],
        "t1"
      );
    });

    it("status=PAID 映射为 SUCCESS 条件", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      mocks.queryWithTenant.mockResolvedValue([]);

      await listPayments({ tenantId: "t1", status: "PAID", page: 1, pageSize: 20 });

      expect(mocks.queryOneWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("status = 'SUCCESS'"),
        ["t1"],
        "t1"
      );
    });
  });

  describe("getPaymentDetail - 支付详情", () => {
    it("按 paymentNo 查询并映射", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({
        paymentNo: "ZF001",
        orderNo: "MO001",
        amount: "100.00",
        method: "WECHAT",
        status: "REFUNDED",
        transactionNo: "tx1",
        paidAt: new Date("2026-08-08T00:00:00Z"),
        createdAt: new Date("2026-08-08T00:00:00Z"),
      });

      const res = await getPaymentDetail("ZF001", "t1");
      expect(res?.status).toBe("REFUNDED");
      expect(mocks.queryOneWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("pay_no = ? AND tenant_id = ?"),
        ["ZF001", "t1"],
        "t1"
      );
    });

    it("不存在时返回 null", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(undefined);
      const res = await getPaymentDetail("NOPE", "t1");
      expect(res).toBeNull();
    });
  });

  describe("listDeliveries - 配送列表", () => {
    it("JOIN 订单并映射 PICKED_UP→PICKING", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
      mocks.queryWithTenant.mockResolvedValue([
        {
          id: 3,
          deliveryNo: "PS001",
          deliveryStatus: "PICKED_UP",
          rider: "张师傅",
          riderPhone: "138",
          riderId: 7,
          createdAt: new Date("2026-08-08T00:00:00Z"),
          updatedAt: new Date("2026-08-08T00:00:00Z"),
          orderNo: "MO001",
          customer: "张三",
          address: "测试路1号",
          amount: "100.00",
        },
      ]);

      const res = await listDeliveries({ tenantId: "t1", page: 1, pageSize: 20 });

      expect(res.records[0]).toMatchObject({
        id: 3,
        deliveryNo: "PS001",
        orderNo: "MO001",
        customer: "张三",
        address: "测试路1号",
        deliveryStatus: "PICKING",
        rider: "张师傅",
      });
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("LEFT JOIN t_retail_order ro"),
        ["t1", 20, 0],
        "t1"
      );
    });

    it("前端 PICKING 筛选反查为 PICKED_UP", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      mocks.queryWithTenant.mockResolvedValue([]);

      await listDeliveries({ tenantId: "t1", deliveryStatus: "PICKING", page: 1, pageSize: 20 });

      expect(mocks.queryOneWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("dr.status = ?"),
        ["t1", "PICKED_UP"],
        "t1"
      );
    });
  });

  describe("assignDeliveryRider - 分配骑手", () => {
    it("更新骑手并置 ASSIGNED", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
      const res = await assignDeliveryRider(3, { riderId: 7, riderName: "张师傅" }, "t1");
      expect(res).toEqual({ id: 3, deliveryStatus: "ASSIGNED" });
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("SET rider_id = ?, rider_name = ?, status = 'ASSIGNED'"),
        [7, "张师傅", 3, "t1"],
        "t1"
      );
    });

    it("配送单不存在时抛 404", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 0 });
      await expect(assignDeliveryRider(99, { riderId: 1, riderName: "x" }, "t1")).rejects.toThrow("配送单不存在");
    });
  });

  describe("updateDeliveryStatus - 配送状态流转", () => {
    it("PICKING → PICKED_UP 并写 picked_up_at", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
      const res = await updateDeliveryStatus(3, "PICKING", "t1");
      expect(res).toEqual({ id: 3, deliveryStatus: "PICKING" });
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("picked_up_at = NOW()"),
        ["PICKED_UP", 3, "t1"],
        "t1"
      );
    });

    it("COMPLETED 写 delivered_at", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
      await updateDeliveryStatus(3, "COMPLETED", "t1");
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("delivered_at = NOW()"),
        ["COMPLETED", 3, "t1"],
        "t1"
      );
    });

    it("配送单不存在时抛 404", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 0 });
      await expect(updateDeliveryStatus(99, "COMPLETED", "t1")).rejects.toThrow("配送单不存在");
    });
  });

  describe("getOrderBoard - 60 秒接单看板", () => {
    it("按状态分组并解析 order_data_json", async () => {
      mocks.queryWithTenant.mockResolvedValue([
        {
          id: 1,
          platformOrderId: "JD001",
          platform: "JD",
          status: "PENDING",
          orderDataJson: JSON.stringify({
            customerName: "张先生",
            payAmount: 89.5,
            items: [{ id: "i1", name: "啤酒", qty: 2, price: 3 }],
            remark: "快送",
          }),
          createdAt: new Date(Date.now() - 10_000),
        },
        {
          id: 2,
          platformOrderId: "MT002",
          platform: "MEITUAN",
          status: "DELIVERING",
          orderDataJson: "{}",
          createdAt: new Date(Date.now() - 60_000),
        },
        {
          id: 3,
          platformOrderId: "EL003",
          platform: "ELEME",
          status: "COMPLETED",
          orderDataJson: null,
          createdAt: new Date(Date.now() - 120_000),
        },
      ]);

      const res = await getOrderBoard("t1");

      expect(res.pending).toHaveLength(1);
      expect(res.pending[0]).toMatchObject({
        orderNo: "JD001",
        platform: "jd",
        customer: "张先生",
        amount: 89.5,
        itemCount: 1,
        status: "pending",
        remark: "快送",
      });
      expect(res.processing).toHaveLength(1);
      expect(res.processing[0].statusText).toBe("配送中");
      expect(res.completed).toHaveLength(1);
      expect(res.stats).toEqual({ pendingCount: 1, processingCount: 1, completedCount: 1, urgentCount: 0 });
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("t_platform_order"),
        ["t1"],
        "t1"
      );
    });
  });

  describe("getRetailCartAnalysis - 购物车分析", () => {
    it("聚合总览 + 商品分布 + 最近购物车", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ totalCarts: 3, totalItems: 10, checkedItems: 8, totalAmount: "200.00" });
      mocks.queryWithTenant
        .mockResolvedValueOnce([
          { skuId: 1, skuName: "五粮液", sku: "SKU1", quantity: 6, amount: "120.00", count: 2 },
        ])
        .mockResolvedValueOnce([
          { id: 1, userId: 9, storeId: 2, skuId: 1, boxQty: 1, bottleQty: 0, checked: 1, skuName: "五粮液", sku: "SKU1", createdAt: new Date("2026-08-08T00:00:00Z") },
        ]);

      const res = await getRetailCartAnalysis("t1");

      expect(res).toMatchObject({
        totalCarts: 3,
        totalItems: 10,
        checkedItems: 8,
        totalAmount: 200,
      });
      expect(res.productDistribution[0]).toMatchObject({ skuId: 1, skuName: "五粮液", quantity: 6, amount: 120, count: 2 });
      expect(res.recentCarts[0]).toMatchObject({ id: 1, userId: 9, storeId: 2, checked: true });
      expect(res.topProducts).toEqual(res.productDistribution);
    });
  });
});
