/**
 * 库存扣减原语单元测试 —— 守住「不得扣成负数」这条业务红线
 *
 * 业主提醒（2026-09-22）：「要扣减库存，库存就变成负数，这是业务逻辑，要谨慎」
 * 因此本测试**不只验返回值**，还要验：
 *   ① 扣减 SQL 必须把 `stock >= ?` 放进 WHERE（结构上不可能为负）
 *   ② 数量非法时**根本不发 SQL**
 *   ③ 批量扣减走事务，任一项失败 ⇒ 整体回滚（不留部分扣减）
 *   ④ 回退用 GREATEST 兜底，销量不会变负
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));

import {
  deductStock,
  restoreStock,
  batchDeductStock,
} from "../../../services/instant-retail/inventory-deduction.service";

describe("instant-retail/inventory-deduction（不得扣成负数）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (runner: (conn: unknown) => Promise<unknown>) => runner({}));
  });

  describe("deductStock", () => {
    it("SQL 把「库存是否足够」放进 WHERE（结构上不可能为负）", async () => {
      mocks.query.mockResolvedValue({ affectedRows: 1 });
      await deductStock(5, 2, "t1");
      const [sql, params] = mocks.query.mock.calls[0];
      expect(String(sql)).toContain("stock = stock - ?");
      expect(String(sql)).toContain("stock >= ?");
      // 参数顺序：扣减量、销量增量、id、租户、比较值 —— 比较值与扣减量相同
      expect(params).toEqual([2, 2, 5, "t1", 2]);
    });

    it("命中 1 行 → true", async () => {
      mocks.query.mockResolvedValue({ affectedRows: 1 });
      expect(await deductStock(5, 2, "t1")).toBe(true);
    });

    it("命中 0 行（库存不足）→ false，且不重试、不抛错", async () => {
      mocks.query.mockResolvedValue({ affectedRows: 0 });
      expect(await deductStock(5, 999, "t1")).toBe(false);
      expect(mocks.query).toHaveBeenCalledTimes(1);
    });

    it("归一化为数组的返回形状也能正确判定", async () => {
      mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
      expect(await deductStock(5, 1, "t1")).toBe(true);
    });

    it("非法数量（0 / 负 / 小数）→ 直接拒绝，**不发 SQL**", async () => {
      expect(await deductStock(5, 0, "t1")).toBe(false);
      expect(await deductStock(5, -3, "t1")).toBe(false);
      expect(await deductStock(5, 1.5, "t1")).toBe(false);
      expect(mocks.query).not.toHaveBeenCalled();
    });
  });

  describe("batchDeductStock（同一事务，失败整体回滚）", () => {
    it("全部命中 → success，且每项都在事务连接里执行", async () => {
      mocks.connExecute.mockResolvedValue([{ affectedRows: 1 }]);
      const r = await batchDeductStock([{ productId: 1, quantity: 1 }, { productId: 2, quantity: 2 }], "t1");
      expect(r).toEqual({ success: true });
      expect(mocks.transaction).toHaveBeenCalledTimes(1);
      expect(mocks.connExecute).toHaveBeenCalledTimes(2);
    });

    it("任一项库存不足 → success=false + failedProductId（事务内抛错即回滚）", async () => {
      mocks.connExecute
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 0 }]);
      const r = await batchDeductStock([{ productId: 1, quantity: 1 }, { productId: 2, quantity: 99 }], "t1");
      expect(r).toEqual({ success: false, failedProductId: 2 });
      // 第 3 项不该被执行（一旦失败立刻中止）
      expect(mocks.connExecute).toHaveBeenCalledTimes(2);
    });

    it("非法数量也按库存不足处理（触发回滚）", async () => {
      const r = await batchDeductStock([{ productId: 7, quantity: 0 }], "t1");
      expect(r).toEqual({ success: false, failedProductId: 7 });
      expect(mocks.connExecute).not.toHaveBeenCalled();
    });
  });

  describe("restoreStock", () => {
    it("回退 SQL 用 GREATEST 兜底，sales_count 不会变负", async () => {
      mocks.query.mockResolvedValue({ affectedRows: 1 });
      await restoreStock(5, 2, "t1");
      const [sql] = mocks.query.mock.calls[0];
      expect(String(sql)).toContain("stock = stock + ?");
      expect(String(sql)).toContain("GREATEST(sales_count - ?, 0)");
    });

    it("非法数量不发 SQL", async () => {
      await restoreStock(5, 0, "t1");
      expect(mocks.query).not.toHaveBeenCalled();
    });
  });
});
