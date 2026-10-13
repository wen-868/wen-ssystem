/**
 * S3-184 回归护栏：写路径业务错误必须带状态码（收口总清单第 45 项）
 *
 * 背景：这些函数原先抛裸 `new Error(<中文文案>)`（无 statusCode）⇒ 落进全局 errorHandler 的
 * "未知错误"分支一律 500。本文件把"每处错误的 statusCode"钉住，防止回归成 500。
 *
 * 被测文件：
 *   - src/services/admin/report.service.ts   （revokeCollectionLink）
 *   - src/services/store/sale-bill.service.ts（createCollectionLink / offlinePayment / paymentOnSaleBill）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
  makeToken: vi.fn(),
  updateTraceCodesBySkuList: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
  makeToken: mocks.makeToken,
}));

vi.mock("../../shared/trace-code", () => ({
  updateTraceCodesBySkuList: mocks.updateTraceCodesBySkuList,
  verifyTraceCode: vi.fn(),
}));

vi.mock("../../shared/fulfillment", () => ({
  computeSellingPrice: vi.fn(),
  getPriceType: vi.fn(),
}));

import { AppError } from "../../shared/app-error";
import { revokeCollectionLink as adminRevokeCollectionLink } from "../../services/admin/report.service";
import {
  createCollectionLink,
  offlinePayment,
  paymentOnSaleBill,
} from "../../services/store/sale-bill.service";

const mockConn = { query: vi.fn(), execute: vi.fn() };
const tenantId = "t1";

/** 断言：抛出的必须是带状态码的业务错，而不是裸 Error（裸 Error 会落进 500 分支） */
async function expectStatus(fn: () => Promise<unknown>, statusCode: number, message: string) {
  let caught: unknown;
  try {
    await fn();
  } catch (e) {
    caught = e;
  }
  expect(caught, "应当抛出错误").toBeInstanceOf(AppError);
  expect((caught as AppError).message).toBe(message);
  expect((caught as AppError).statusCode).toBe(statusCode);
  return caught as AppError;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("SK20261013000001");
  mocks.makeToken.mockReturnValue("token-s3184");
  mocks.transaction.mockImplementation(async (cb: (conn: typeof mockConn) => unknown) => cb(mockConn));
});

describe("S3-184 - admin report.service.revokeCollectionLink 状态码", () => {
  it("链接不存在 ⇒ 404（改前为裸 Error ⇒ 500）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expectStatus(
      () => adminRevokeCollectionLink("S3184-NOPE", tenantId),
      404,
      "分享链接不存在"
    );
  });

  it("链接已撤销 ⇒ 409（改前为裸 Error ⇒ 500）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ link_no: "L1", status: "REVOKED" });
    await expectStatus(
      () => adminRevokeCollectionLink("L1", tenantId),
      409,
      "链接已撤销"
    );
  });

  it("已支付链接 ⇒ 409（改前为裸 Error ⇒ 500）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ link_no: "L1", status: "PAID" });
    await expectStatus(
      () => adminRevokeCollectionLink("L1", tenantId),
      409,
      "已支付的链接不可撤销"
    );
  });

  it("正常撤销仍成功（不受状态码改造影响）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ link_no: "L1", status: "PENDING" });
    mocks.queryWithTenant.mockResolvedValue(undefined);
    await expect(adminRevokeCollectionLink("L1", tenantId)).resolves.toEqual({
      linkNo: "L1",
      status: "REVOKED",
    });
  });
});

describe("S3-184 - sale-bill.createCollectionLink 状态码", () => {
  it("销售单不存在 ⇒ 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expectStatus(
      () => createCollectionLink({
        billNo: "S3184-NOPE", shareChannel: "LINK", amount: 10,
        taxEnabled: false, taxRate: 0, expireHours: 72, userId: 1, tenantId,
      }),
      404,
      "销售单不存在"
    );
  });

  it("金额超未收金额 ⇒ 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ bill_no: "XS1", unreceived_amount: 100 });
    await expectStatus(
      () => createCollectionLink({
        billNo: "XS1", shareChannel: "LINK", amount: 999999,
        taxEnabled: false, taxRate: 0, expireHours: 72, userId: 1, tenantId,
      }),
      400,
      "收款金额必须大于0且不能超过未收金额"
    );
  });

  it("金额为 0 ⇒ 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ bill_no: "XS1", unreceived_amount: 100 });
    await expectStatus(
      () => createCollectionLink({
        billNo: "XS1", shareChannel: "LINK", amount: 0,
        taxEnabled: false, taxRate: 0, expireHours: 72, userId: 1, tenantId,
      }),
      400,
      "收款金额必须大于0且不能超过未收金额"
    );
  });
});

describe("S3-184 - sale-bill.offlinePayment 状态码", () => {
  it("销售单不存在 ⇒ 404", async () => {
    mockConn.query.mockResolvedValueOnce([[]]);
    await expectStatus(
      () => offlinePayment({
        billNo: "S3184-NOPE", amount: 10, paymentMethod: "CASH",
        userId: 1, username: "admin", tenantId,
      }),
      404,
      "销售单不存在"
    );
  });

  it("金额超未收金额 ⇒ 400", async () => {
    mockConn.query.mockResolvedValueOnce([[{ bill_no: "XS1", store_id: 1, received_amount: 0, receivable_amount: 100, collection_status: "UNPAID" }]]);
    mockConn.query.mockResolvedValueOnce([[]]);
    await expectStatus(
      () => offlinePayment({
        billNo: "XS1", amount: 999999, paymentMethod: "CASH",
        userId: 1, username: "admin", tenantId,
      }),
      400,
      "收款金额不合法"
    );
  });

  it("库存不足 ⇒ 409（此前是裸 Error ⇒ 500）", async () => {
    mockConn.query.mockResolvedValueOnce([[{ bill_no: "XS1", store_id: 1, received_amount: 0, receivable_amount: 100, collection_status: "UNPAID" }]]);
    mockConn.query.mockResolvedValueOnce([[]]);                                   // 无 SALE_OUT 流水 ⇒ 走扣减分支
    mockConn.query.mockResolvedValueOnce([[{ skuId: 1, quantity: 5 }]]);          // 待出库明细
    mockConn.query.mockResolvedValueOnce([[{ physicalQty: 0, availableQty: 0 }]]); // 可用库存 0
    await expectStatus(
      () => offlinePayment({
        billNo: "XS1", amount: 10, paymentMethod: "CASH",
        userId: 1, username: "admin", tenantId,
      }),
      409,
      "库存不足，无法完成收款出库"
    );
  });
});

describe("S3-184 - sale-bill.paymentOnSaleBill 状态码", () => {
  it("销售单不存在 ⇒ 404", async () => {
    mockConn.query.mockResolvedValueOnce([[]]);
    await expectStatus(
      () => paymentOnSaleBill({
        billNo: "S3184-NOPE", amount: 10, paymentMethod: "CASH",
        userId: 1, username: "admin", tenantId,
      }),
      404,
      "销售单不存在"
    );
  });

  it("金额超未收金额 ⇒ 400", async () => {
    mockConn.query.mockResolvedValueOnce([[{ bill_no: "XS1", store_id: 1, received_amount: 0, receivable_amount: 100, collection_status: "UNPAID" }]]);
    await expectStatus(
      () => paymentOnSaleBill({
        billNo: "XS1", amount: 999999, paymentMethod: "CASH",
        userId: 1, username: "admin", tenantId,
      }),
      400,
      "收款金额不合法"
    );
  });
});
