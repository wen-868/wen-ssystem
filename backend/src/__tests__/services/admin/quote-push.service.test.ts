/**
 * 管理端报价推送 service 单元测试
 * 被测文件：src/services/admin/quote-push.service.ts
 * 覆盖：previewQuote / createQuote / listQuotes / getQuoteDetail /
 *       pushQuote / viewQuoteByToken / cancelQuote
 *
 * 约定：事务内 conn.query 返回 [rows]；SELECT const [rows]= 故传入 [[...rows]]，
 *       INSERT const [header]= 故传入 [{...header}]。
 *       独立 query(...) 直接返回 rows 数组（无外层包裹）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as service from "../../../services/admin/quote-push.service";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
}));
vi.mock("../../../shared/id", () => ({ makeBizNo: mocks.makeBizNo }));

let conn = { query: vi.fn(), execute: vi.fn() };
const queryQueue: any[][] = [];

/** 按调用次序为 conn.query 设定返回值（传入 [rows] 形态）；beforeEach 清空队列避免跨用例泄漏 */
function setConnQuery(responses: any[][]) {
  queryQueue.push(...responses);
}

beforeEach(() => {
  queryQueue.length = 0;
  vi.resetAllMocks();
  mocks.makeBizNo.mockReturnValue("QT202608160001");
  conn = {
    query: vi.fn(async () => queryQueue.shift() ?? [[]]),
    execute: vi.fn().mockResolvedValue({}),
  };
  mocks.transaction.mockImplementation(async (fn: any) => fn(conn));
});

const sampleSku = {
  skuId: 1,
  skuName: "测试商品",
  skuCode: "C001",
  barcode: null,
  unit: "个",
  imageUrl: null,
  retailPrice: 100,
  wholesalePrice: 80,
  costPrice: 50,
};

describe("quote-push.service", () => {
  describe("previewQuote", () => {
    it("无客户时按零售价报价", async () => {
      mocks.queryWithTenant.mockResolvedValue([sampleSku]);

      const res = await service.previewQuote({ skuIds: [1] }, "t1");

      expect(res.items).toHaveLength(1);
      expect(res.items[0].quotePrice).toBe(100);
      expect(res.items[0].discountRate).toBe(0);
    });

    it("有客户与价格等级时按等级价报价并计算折扣", async () => {
      mocks.queryOneWithTenant
        .mockResolvedValueOnce({ name: "客户A", price_level_id: 2, level_name: "VIP" })
        .mockResolvedValueOnce({ price: 90 });
      mocks.queryWithTenant.mockResolvedValue([sampleSku]);

      const res = await service.previewQuote({ skuIds: [1], customerId: 7 }, "t1");

      expect(res.items[0].quotePrice).toBe(90);
      expect(res.items[0].discountRate).toBe(10);
    });
  });

  describe("createQuote", () => {
    it("创建报价单并返回单号与分享链接", async () => {
      // 客户(SELECT) / SKU(SELECT) / 插入报价单(INSERT) / 插入明细(INSERT) / 令牌(SELECT)
      setConnQuery([
        [[{ name: "客户A", phone: "13800000000" }]],
        [[{ sku_name: "测试商品" }]],
        [{ insertId: 10 }],
        [{}],
        [[{ shareToken: "TOK123" }]],
      ]);
      conn.execute.mockResolvedValue({});

      const res = await service.createQuote(
        {
          customerId: 7,
          validDays: 7,
          title: "报价单",
          remark: "报价",
          items: [{ skuId: 1, quotePrice: 90, minQty: 2 }],
        },
        1,
        "t1",
      );

      expect(res.quoteId).toBe(10);
      expect(res.quoteNo).toBe("QT202608160001");
      expect(res.shareUrl).toBe("/quote/share/TOK123");
      expect(mocks.makeBizNo).toHaveBeenCalledWith("QT");
    });
  });

  describe("listQuotes", () => {
    it("返回分页报价列表", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ id: 1, quote_no: "Q1" }]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });

      const res = await service.listQuotes(1, 10, "t1", {});

      expect(res.total).toBe(1);
      expect(res.records).toHaveLength(1);
    });
  });

  describe("getQuoteDetail", () => {
    it("返回报价详情与分享链接", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({
        id: 1,
        quoteNo: "Q1",
        shareToken: "TOK123",
        status: "ACTIVE",
      });
      mocks.queryWithTenant.mockResolvedValue([
        { id: 1, skuId: 1, skuName: "测试商品", quotePrice: 90, minQty: 1, barcode: null, skuCode: null, unit: null, imageUrl: null },
      ]);

      const res = await service.getQuoteDetail(1, "t1");

      expect(res.quoteNo).toBe("Q1");
      expect(res.shareUrl).toBe("/quote/share/TOK123");
      expect(res.items).toHaveLength(1);
    });
  });

  describe("pushQuote", () => {
    it("报价不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(undefined);
      let err: any;
      try {
        await service.pushQuote(1, { channels: ["sms"] }, "t1");
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(404);
    });

    it("状态非 ACTIVE 时抛 400", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "CANCELLED", share_token: "T" });
      let err: any;
      try {
        await service.pushQuote(1, { channels: ["sms"] }, "t1");
      } catch (e) {
        err = e;
      }
      expect(err.statusCode).toBe(400);
    });

    it("短信渠道推送成功", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({
        id: 1,
        status: "ACTIVE",
        share_token: "TOK123",
        customer_phone: "13800000000",
        customer_name: "客户A",
        quote_no: "Q1",
      });
      mocks.queryOne.mockResolvedValue({ configValue: "aliyun" });

      const res = await service.pushQuote(1, { channels: ["sms"] }, "t1");

      expect(res.success).toBe(true);
      expect(res.channels).toContain("sms");
      expect(res.shareUrl).toBe("/quote/share/TOK123");
    });
  });

  describe("viewQuoteByToken", () => {
    it("令牌无效时返回 null", async () => {
      mocks.query.mockResolvedValue([]);
      expect(await service.viewQuoteByToken("bad")).toBeNull();
    });

    it("返回报价详情并累加浏览量", async () => {
      // 独立 query 直接返回 rows 数组
      mocks.query.mockResolvedValue([
        {
          id: 1,
          quoteNo: "Q1",
          status: "ACTIVE",
          tenantId: "t1",
          viewCount: 5,
          shareToken: "TOK123",
        },
      ]);
      mocks.queryWithTenant.mockResolvedValue([]);

      const res = await service.viewQuoteByToken("TOK123");

      expect(res?.quoteNo).toBe("Q1");
      expect(res?.viewCount).toBe(6);
    });
  });

  describe("cancelQuote", () => {
    it("报价不存在时抛 404", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(undefined);
      let err: any;
      try {
        await service.cancelQuote(1, "t1");
      } catch (e) {
        err = e;
      }
      expect(err.statusCode).toBe(404);
    });

    it("已取消时直接返回已取消", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "CANCELLED" });

      const res = await service.cancelQuote(1, "t1");

      expect(res.cancelled).toBe(true);
    });

    it("ACTIVE 时取消成功", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "ACTIVE" });
      mocks.queryWithTenant.mockResolvedValue(undefined);

      const res = await service.cancelQuote(1, "t1");

      expect(res.cancelled).toBe(true);
      expect(res.quoteId).toBe(1);
    });
  });
});
