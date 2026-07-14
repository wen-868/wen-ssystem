import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

import {
  listProductReviews,
  getProductReview,
  createProductReview,
  approveProductReview,
  rejectProductReview,
  batchApproveProductReviews,
} from "../../../services/admin/product-review.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("product-review.service - listProductReviews", () => {
  it("无筛选条件", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, productName: "茅台酒" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listProductReviews(tenantId, { page: 1, pageSize: 10 });
    expect(res.total).toBe(1);
    expect(res.records.length).toBe(1);
  });

  it("有 keyword 筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    const res = await listProductReviews(tenantId, { page: 1, pageSize: 10, keyword: "茅台" });
    expect(res.total).toBe(0);
  });

  it("有 status 筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    const res = await listProductReviews(tenantId, { page: 1, pageSize: 10, status: "PENDING" });
    expect(res.total).toBe(0);
  });

  it("有 reviewType 筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    const res = await listProductReviews(tenantId, { page: 1, pageSize: 10, reviewType: "CREATE" });
    expect(res.total).toBe(0);
  });

  it("有 submitterId 筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    const res = await listProductReviews(tenantId, { page: 1, pageSize: 10, submitterId: 1 });
    expect(res.total).toBe(0);
  });

  it("total 为 null 时返回 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listProductReviews(tenantId, { page: 1, pageSize: 10 });
    expect(res.total).toBe(0);
  });
});

describe("product-review.service - getProductReview", () => {
  it("审核记录存在", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, productName: "茅台酒" });
    const res = await getProductReview(tenantId, 1);
    expect(res.id).toBe(1);
  });

  it("审核记录不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getProductReview(tenantId, 99))
      .rejects.toMatchObject({ statusCode: 404, message: "审核记录不存在" });
  });
});

describe("product-review.service - createProductReview", () => {
  it("创建审核记录成功", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 1 });
    const res = await createProductReview(tenantId, {
      productId: 100,
      productName: "茅台酒",
      reviewType: "CREATE",
      changeContent: { name: "茅台酒" },
    }, 1, "管理员");
    expect(res.id).toBe(1);
    expect(res.reviewNo).toMatch(/^PR/);
  });

  it("创建审核记录不带提交人姓名", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 2 });
    const res = await createProductReview(tenantId, {
      productId: 200,
      productName: "五粮液",
      reviewType: "UPDATE",
    }, 2);
    expect(res.id).toBe(2);
  });
});

describe("product-review.service - approveProductReview", () => {
  it("审核记录不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(approveProductReview(tenantId, 99, 1, "管理员"))
      .rejects.toMatchObject({ statusCode: 404, message: "审核记录不存在" });
  });

  it("非待审核状态不能通过", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "APPROVED" });
    await expect(approveProductReview(tenantId, 1, 1, "管理员"))
      .rejects.toMatchObject({ statusCode: 400, message: "仅待审核状态的记录可审核" });
  });

  it("审核通过成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING" });
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
    const res = await approveProductReview(tenantId, 1, 1, "管理员", { reviewComment: "同意" });
    expect(res.id).toBe(1);
    expect(res.status).toBe("APPROVED");
  });

  it("审核通过不带意见", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 2, status: "PENDING" });
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
    const res = await approveProductReview(tenantId, 2, 1, "管理员");
    expect(res.status).toBe("APPROVED");
  });
});

describe("product-review.service - rejectProductReview", () => {
  it("审核记录不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(rejectProductReview(tenantId, 99, 1, "管理员", { reviewComment: "原因" }))
      .rejects.toMatchObject({ statusCode: 404, message: "审核记录不存在" });
  });

  it("非待审核状态不能驳回", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "APPROVED" });
    await expect(rejectProductReview(tenantId, 1, 1, "管理员", { reviewComment: "原因" }))
      .rejects.toMatchObject({ statusCode: 400, message: "仅待审核状态的记录可审核" });
  });

  it("驳回原因不能为空", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING" });
    await expect(rejectProductReview(tenantId, 1, 1, "管理员", { reviewComment: "" }))
      .rejects.toMatchObject({ statusCode: 400, message: "驳回原因不能为空" });
  });

  it("驳回原因只有空格也不行", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING" });
    await expect(rejectProductReview(tenantId, 1, 1, "管理员", { reviewComment: "   " }))
      .rejects.toMatchObject({ statusCode: 400, message: "驳回原因不能为空" });
  });

  it("审核驳回成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING" });
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
    const res = await rejectProductReview(tenantId, 1, 1, "管理员", { reviewComment: "信息不全" });
    expect(res.id).toBe(1);
    expect(res.status).toBe("REJECTED");
  });
});

describe("product-review.service - batchApproveProductReviews", () => {
  it("ID列表为空抛错", async () => {
    await expect(batchApproveProductReviews(tenantId, [], 1, "管理员"))
      .rejects.toMatchObject({ statusCode: 400, message: "审核ID列表不能为空" });
  });

  it("ID列表超过100条抛错", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => i + 1);
    await expect(batchApproveProductReviews(tenantId, ids, 1, "管理员"))
      .rejects.toMatchObject({ statusCode: 400, message: "批量审核不能超过100条" });
  });

  it("批量审核通过成功", async () => {
    mocks.queryWithTenant.mockResolvedValue({ affectedRows: 5 });
    const res = await batchApproveProductReviews(tenantId, [1, 2, 3, 4, 5], 1, "管理员", "批量通过");
    expect(res.successCount).toBe(5);
    expect(res.totalCount).toBe(5);
  });

  it("批量审核 affectedRows 为 undefined 时返回 0", async () => {
    mocks.queryWithTenant.mockResolvedValue({});
    const res = await batchApproveProductReviews(tenantId, [1, 2, 3], 1, "管理员");
    expect(res.successCount).toBe(0);
  });
});
