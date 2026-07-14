import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/product-review.service", () => ({
  listProductReviews: vi.fn(),
  getProductReview: vi.fn(),
  createProductReview: vi.fn(),
  approveProductReview: vi.fn(),
  rejectProductReview: vi.fn(),
  batchApproveProductReviews: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as productReviewService from "../../../services/admin/product-review.service";
import { ok, fail } from "../../../shared/response";
import {
  listProductReviews,
  getProductReview,
  createProductReview,
  approveProductReview,
  rejectProductReview,
  batchApproveProductReviews,
} from "../../../controllers/admin/product-review.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin", name: "管理员" },
  query: {},
  params: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  res.send = vi.fn();
  return res;
};

describe("product-review.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("createProductReview", () => {
    it("应成功提交商品审核", async () => {
      (productReviewService.createProductReview as any).mockResolvedValue({
        id: 1,
        reviewNo: "PR202607140001",
      });
      const req = mockReq({
        body: {
          productId: 100,
          productName: "测试商品",
          reviewType: "PRICE_CHANGE",
          changeContent: { price: 100 },
        },
      });
      const res = mockRes();
      await createProductReview(req as any, res as any);
      expect(productReviewService.createProductReview).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({
          productId: 100,
          productName: "测试商品",
          reviewType: "PRICE_CHANGE",
        }),
        1,
        "管理员"
      );
      expect(ok).toHaveBeenCalled();
    });

    it("缺少productId应抛出参数校验错误", async () => {
      const req = mockReq({
        body: { productName: "测试商品", reviewType: "PRICE_CHANGE" },
      });
      const res = mockRes();
      await expect(createProductReview(req as any, res as any)).rejects.toThrow();
      expect(productReviewService.createProductReview).not.toHaveBeenCalled();
    });

    it("productId为负数应抛出参数校验错误", async () => {
      const req = mockReq({
        body: { productId: -1, productName: "测试商品", reviewType: "PRICE_CHANGE" },
      });
      const res = mockRes();
      await expect(createProductReview(req as any, res as any)).rejects.toThrow();
      expect(productReviewService.createProductReview).not.toHaveBeenCalled();
    });

    it("productName为空应抛出参数校验错误", async () => {
      const req = mockReq({
        body: { productId: 100, productName: "", reviewType: "PRICE_CHANGE" },
      });
      const res = mockRes();
      await expect(createProductReview(req as any, res as any)).rejects.toThrow();
      expect(productReviewService.createProductReview).not.toHaveBeenCalled();
    });

    it("缺少reviewType应抛出参数校验错误", async () => {
      const req = mockReq({
        body: { productId: 100, productName: "测试商品" },
      });
      const res = mockRes();
      await expect(createProductReview(req as any, res as any)).rejects.toThrow();
      expect(productReviewService.createProductReview).not.toHaveBeenCalled();
    });

    it("无submitterName时使用username", async () => {
      (productReviewService.createProductReview as any).mockResolvedValue({
        id: 1,
        reviewNo: "PR202607140001",
      });
      const req = mockReq({
        user: { id: 1, username: "admin" },
        body: {
          productId: 100,
          productName: "测试商品",
          reviewType: "PRICE_CHANGE",
        },
      });
      const res = mockRes();
      await createProductReview(req as any, res as any);
      expect(productReviewService.createProductReview).toHaveBeenCalledWith(
        "t1",
        expect.anything(),
        1,
        "admin"
      );
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("listProductReviews", () => {
    it("应返回审核列表", async () => {
      (productReviewService.listProductReviews as any).mockResolvedValue({
        total: 1,
        records: [{ id: 1, reviewNo: "PR202607140001" }],
      });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await listProductReviews(req as any, res as any);
      expect(productReviewService.listProductReviews).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("应传递筛选参数", async () => {
      (productReviewService.listProductReviews as any).mockResolvedValue({
        total: 0,
        records: [],
      });
      const req = mockReq({
        query: {
          page: "2",
          pageSize: "10",
          keyword: "测试",
          status: "PENDING",
          reviewType: "PRICE_CHANGE",
          submitterId: "5",
        },
      });
      const res = mockRes();
      await listProductReviews(req as any, res as any);
      expect(productReviewService.listProductReviews).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({
          page: 2,
          pageSize: 10,
          keyword: "测试",
          status: "PENDING",
          reviewType: "PRICE_CHANGE",
          submitterId: 5,
        })
      );
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("getProductReview", () => {
    it("应返回审核详情", async () => {
      (productReviewService.getProductReview as any).mockResolvedValue({
        id: 1,
        reviewNo: "PR202607140001",
        status: "PENDING",
      });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await getProductReview(req as any, res as any);
      expect(productReviewService.getProductReview).toHaveBeenCalledWith("t1", 1);
      expect(ok).toHaveBeenCalled();
    });

    it("id非数字应抛出参数校验错误", async () => {
      const req = mockReq({ params: { id: "abc" } });
      const res = mockRes();
      await expect(getProductReview(req as any, res as any)).rejects.toThrow();
      expect(productReviewService.getProductReview).not.toHaveBeenCalled();
    });
  });

  describe("approveProductReview", () => {
    it("应审核通过", async () => {
      (productReviewService.approveProductReview as any).mockResolvedValue({
        id: 1,
        status: "APPROVED",
      });
      const req = mockReq({
        params: { id: "1" },
        body: { reviewComment: "同意" },
      });
      const res = mockRes();
      await approveProductReview(req as any, res as any);
      expect(productReviewService.approveProductReview).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("无reviewComment也能审核通过", async () => {
      (productReviewService.approveProductReview as any).mockResolvedValue({
        id: 1,
        status: "APPROVED",
      });
      const req = mockReq({ params: { id: "1" }, body: {} });
      const res = mockRes();
      await approveProductReview(req as any, res as any);
      expect(productReviewService.approveProductReview).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("rejectProductReview", () => {
    it("应审核驳回", async () => {
      (productReviewService.rejectProductReview as any).mockResolvedValue({
        id: 1,
        status: "REJECTED",
      });
      const req = mockReq({
        params: { id: "1" },
        body: { reviewComment: "信息不完整" },
      });
      const res = mockRes();
      await rejectProductReview(req as any, res as any);
      expect(productReviewService.rejectProductReview).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("缺少reviewComment应抛出参数校验错误", async () => {
      const req = mockReq({ params: { id: "1" }, body: {} });
      const res = mockRes();
      await expect(rejectProductReview(req as any, res as any)).rejects.toThrow();
      expect(productReviewService.rejectProductReview).not.toHaveBeenCalled();
    });
  });

  describe("batchApproveProductReviews", () => {
    it("应批量审核通过", async () => {
      (productReviewService.batchApproveProductReviews as any).mockResolvedValue({
        successCount: 3,
        totalCount: 3,
      });
      const req = mockReq({
        body: { ids: [1, 2, 3], reviewComment: "批量通过" },
      });
      const res = mockRes();
      await batchApproveProductReviews(req as any, res as any);
      expect(productReviewService.batchApproveProductReviews).toHaveBeenCalledWith(
        "t1",
        [1, 2, 3],
        1,
        "管理员",
        "批量通过"
      );
      expect(ok).toHaveBeenCalled();
    });

    it("ids为空应抛出参数校验错误", async () => {
      const req = mockReq({ body: { ids: [] } });
      const res = mockRes();
      await expect(batchApproveProductReviews(req as any, res as any)).rejects.toThrow();
      expect(productReviewService.batchApproveProductReviews).not.toHaveBeenCalled();
    });

    it("ids超过100应抛出参数校验错误", async () => {
      const ids = Array.from({ length: 101 }, (_, i) => i + 1);
      const req = mockReq({ body: { ids } });
      const res = mockRes();
      await expect(batchApproveProductReviews(req as any, res as any)).rejects.toThrow();
      expect(productReviewService.batchApproveProductReviews).not.toHaveBeenCalled();
    });
  });
});
