/**
 * 缺货处理（仅告警）单元测试 —— S3-79
 *
 * 政策（业主 2026-09-22 裁定）：平台订单缺货时 **仅告警**，不拒单、不扣库存。
 * 覆盖：① 平台原始报文 → 商品项提取（跨平台字段）② 库存充足不告警 ③ 缺货必告警且**订单不受影响**
 *       ④ 通知链路异常时仍返回缺货明细 ⑤ 报文不可解析时静默跳过
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryOneWithTenant: vi.fn(),
  queryOne: vi.fn(),
  sendNotificationWithPush: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: mocks.queryOneWithTenant,
  queryOne: mocks.queryOne,
}));

vi.mock("../../../services/admin/notification-sender.service", () => ({
  sendNotificationWithPush: mocks.sendNotificationWithPush,
}));

import {
  extractOrderItems,
  checkStock,
  warnIfStockShortage,
} from "../../../services/instant-retail/shortage-handler.service";

describe("instant-retail/shortage-handler（仅告警）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendNotificationWithPush.mockResolvedValue({ notificationId: 1, pushResults: [] });
  });

  describe("extractOrderItems - 跨平台商品项提取", () => {
    it("从 items 提取 localSkuId + quantity", () => {
      const items = extractOrderItems("MEITUAN", JSON.stringify({ items: [{ skuId: "12", quantity: 3 }, { skuId: "13", qty: 2 }] }));
      expect(items).toEqual([{ product_id: 12, quantity: 3 }, { product_id: 13, quantity: 2 }]);
    });

    it("兼容 products / orderItems / detail 字段名", () => {
      expect(extractOrderItems("ELEME", JSON.stringify({ products: [{ skuId: 7, num: 1 }] }))).toEqual([{ product_id: 7, quantity: 1 }]);
      expect(extractOrderItems("JD", JSON.stringify({ orderItems: [{ skuId: 8, count: 4 }] }))).toEqual([{ product_id: 8, quantity: 4 }]);
    });

    it("平台未给本地商品 id（localSkuId=0）时跳过，避免误报缺货", () => {
      expect(extractOrderItems("MEITUAN", JSON.stringify({ items: [{ name: "未知商品", quantity: 1 }] }))).toEqual([]);
    });

    it("报文不可解析时返回空数组（不抛错）", () => {
      expect(extractOrderItems("MEITUAN", "{not-json")).toEqual([]);
      expect(extractOrderItems("MEITUAN", null)).toEqual([]);
    });
  });

  describe("checkStock", () => {
    it("库存充足 → ok=true 且无缺货项", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 5, stock: 10 });
      const r = await checkStock(1, [{ product_id: 5, quantity: 3 }], "t1");
      expect(r.ok).toBe(true);
      expect(r.shortages).toEqual([]);
    });

    it("商品不存在或库存不足 → 记为缺货（库存缺失按 0）", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 6, stock: 1 });
      const r = await checkStock(1, [{ product_id: 5, quantity: 1 }, { product_id: 6, quantity: 2 }], "t1");
      expect(r.ok).toBe(false);
      expect(r.shortages).toEqual([{ productId: 5, stock: 0 }, { productId: 6, stock: 1 }]);
    });
  });

  describe("warnIfStockShortage - 仅告警，不拒单", () => {
    it("库存充足：不发通知", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 5, stock: 99 });
      const r = await warnIfStockShortage({
        orderNo: "PO-1", platform: "MEITUAN", storeId: 1,
        orderDataJson: JSON.stringify({ items: [{ skuId: "5", quantity: 2 }] }), tenantId: "t1",
      });
      expect(r.shortages).toEqual([]);
      expect(mocks.sendNotificationWithPush).not.toHaveBeenCalled();
    });

    it("缺货：必发 ALERT 通知，且**不取消订单**（本函数无任何写库调用）", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 5, stock: 0 });
      mocks.queryOne.mockResolvedValue({ id: 77 });
      const r = await warnIfStockShortage({
        orderNo: "PO-2", platform: "MEITUAN", storeId: 1,
        orderDataJson: JSON.stringify({ items: [{ skuId: "5", quantity: 2 }] }), tenantId: "t1",
      });
      expect(r.shortages).toEqual([{ productId: 5, stock: 0 }]);
      expect(mocks.sendNotificationWithPush).toHaveBeenCalledTimes(1);
      const arg = mocks.sendNotificationWithPush.mock.calls[0][0];
      expect(arg.type).toBe("ALERT");
      expect(arg.recipientId).toBe(77);
      expect(arg.content).toContain("PO-2");
      // 只读了库存、只发了通知：没有任何 UPDATE/取消
      expect(mocks.queryOneWithTenant).toHaveBeenCalledTimes(1);
    });

    it("通知链路异常：不抛错，且仍返回缺货明细（前端照样能看到）", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 5, stock: 0 });
      mocks.queryOne.mockResolvedValue({ id: 77 });
      mocks.sendNotificationWithPush.mockRejectedValue(new Error("push down"));
      const r = await warnIfStockShortage({
        orderNo: "PO-3", platform: "MEITUAN", storeId: 1,
        orderDataJson: JSON.stringify({ items: [{ skuId: "5", quantity: 9 }] }), tenantId: "t1",
      });
      expect(r.shortages).toEqual([{ productId: 5, stock: 0 }]);
    });

    it("租户无管理员：不报错，跳过通知", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 5, stock: 0 });
      mocks.queryOne.mockResolvedValue(null);
      const r = await warnIfStockShortage({
        orderNo: "PO-4", platform: "MEITUAN", storeId: 1,
        orderDataJson: JSON.stringify({ items: [{ skuId: "5", quantity: 1 }] }), tenantId: "t1",
      });
      expect(r.shortages).toEqual([{ productId: 5, stock: 0 }]);
      expect(mocks.sendNotificationWithPush).not.toHaveBeenCalled();
    });
  });
});
