import { vi, describe, it, beforeEach, expect, afterAll } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/admin/inventory-batch.service", () => ({
  listBatches: vi.fn(),
  getBatchDetail: vi.fn(),
  createBatch: vi.fn(),
  updateBatch: vi.fn(),
  splitBatch: vi.fn(),
  getFifoSuggestion: vi.fn(),
  getBatchTrace: vi.fn(),
  getProductBatches: vi.fn(),
  listExpiryConfigs: vi.fn(),
  createExpiryConfig: vi.fn(),
  updateExpiryConfig: vi.fn(),
  deleteExpiryConfig: vi.fn(),
  listExpiryAlerts: vi.fn(),
  handleExpiryAlert: vi.fn(),
  getExpiryAlertStatistics: vi.fn(),
  runExpiryScan: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace" })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace" })),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuthWithTenant: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/tenant", () => ({
  tenantMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../shared/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import * as service from "../../services/admin/inventory-batch.service";
import { inventoryBatchRouter } from "../../routes/inventory-batch.routes";
import { startExpiryScanner } from "../../shared/expiry-scanner";
import logger from "../../shared/logger";

const app = createTestApp({
  prefix: "/api/admin/inventory-batch",
  router: inventoryBatchRouter,
});

describe("routes/inventory-batch 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("批次管理", () => {
    describe("GET /batches", () => {
      it("应返回批次列表", async () => {
        (service.listBatches as any).mockResolvedValue({ total: 0, records: [] });
        const res = await request(app).get("/api/admin/inventory-batch/batches");
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.listBatches).toHaveBeenCalledWith(
          "test-tenant",
          expect.objectContaining({ page: 1, pageSize: 20 })
        );
      });

      it("应传递筛选参数", async () => {
        (service.listBatches as any).mockResolvedValue({ total: 0, records: [] });
        const res = await request(app).get(
          "/api/admin/inventory-batch/batches?page=2&pageSize=10&storeId=1&skuId=2&expiryStatus=warning"
        );
        expect(res.status).toBe(200);
        expect(service.listBatches).toHaveBeenCalledWith(
          "test-tenant",
          expect.objectContaining({ page: 2, pageSize: 10, storeId: 1, skuId: 2, expiryStatus: "warning" })
        );
      });

      it("expiryStatus 非法时 zod 校验失败", async () => {
        const res = await request(app).get("/api/admin/inventory-batch/batches?expiryStatus=invalid");
        expect(res.status).toBe(500);
        expect(service.listBatches).not.toHaveBeenCalled();
      });

      it("service 抛错时返回500", async () => {
        (service.listBatches as any).mockRejectedValue(new Error("db error"));
        const res = await request(app).get("/api/admin/inventory-batch/batches");
        expect(res.status).toBe(500);
      });
    });

    describe("GET /batches/fifo-suggestion/:storeId/:skuId", () => {
      it("应返回FIFO建议", async () => {
        (service.getFifoSuggestion as any).mockResolvedValue([{ id: 1 }]);
        const res = await request(app).get("/api/admin/inventory-batch/batches/fifo-suggestion/1/2");
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.getFifoSuggestion).toHaveBeenCalledWith("test-tenant", 1, 2);
      });

      it("service 抛错时返回500", async () => {
        (service.getFifoSuggestion as any).mockRejectedValue(new Error("error"));
        const res = await request(app).get("/api/admin/inventory-batch/batches/fifo-suggestion/1/2");
        expect(res.status).toBe(500);
      });
    });

    describe("GET /batches/:id", () => {
      it("应返回批次详情", async () => {
        (service.getBatchDetail as any).mockResolvedValue({ id: 1, batchNo: "B001" });
        const res = await request(app).get("/api/admin/inventory-batch/batches/1");
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.getBatchDetail).toHaveBeenCalledWith("test-tenant", 1);
      });

      it("批次不存在时返回404", async () => {
        (service.getBatchDetail as any).mockResolvedValue(null);
        const res = await request(app).get("/api/admin/inventory-batch/batches/999");
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("1");
      });

      it("service 抛错时返回500", async () => {
        (service.getBatchDetail as any).mockRejectedValue(new Error("error"));
        const res = await request(app).get("/api/admin/inventory-batch/batches/1");
        expect(res.status).toBe(500);
      });
    });

    describe("POST /batches", () => {
      const validBody = {
        storeId: 1,
        skuId: 1,
        batchNo: "B001",
        quantity: 100,
      };

      it("应创建批次", async () => {
        (service.createBatch as any).mockResolvedValue(1);
        const res = await request(app)
          .post("/api/admin/inventory-batch/batches")
          .send(validBody);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.createBatch).toHaveBeenCalledWith(
          "test-tenant",
          expect.objectContaining({ storeId: 1, skuId: 1, batchNo: "B001", quantity: 100 })
        );
      });

      it("batchNo 缺失时 zod 校验失败", async () => {
        const res = await request(app)
          .post("/api/admin/inventory-batch/batches")
          .send({ storeId: 1, skuId: 1, quantity: 100 });
        expect(res.status).toBe(500);
        expect(service.createBatch).not.toHaveBeenCalled();
      });

      it("quantity 为0时 zod 校验失败", async () => {
        const res = await request(app)
          .post("/api/admin/inventory-batch/batches")
          .send({ ...validBody, quantity: 0 });
        expect(res.status).toBe(500);
        expect(service.createBatch).not.toHaveBeenCalled();
      });

      it("service 抛错时返回500", async () => {
        (service.createBatch as any).mockRejectedValue(new Error("create error"));
        const res = await request(app)
          .post("/api/admin/inventory-batch/batches")
          .send(validBody);
        expect(res.status).toBe(500);
      });
    });

    describe("PUT /batches/:id", () => {
      it("应更新批次", async () => {
        (service.updateBatch as any).mockResolvedValue(undefined);
        const res = await request(app)
          .put("/api/admin/inventory-batch/batches/1")
          .send({ quantity: 200 });
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.updateBatch).toHaveBeenCalledWith(
          "test-tenant", 1, expect.objectContaining({ quantity: 200 })
        );
      });

      it("quantity 为负数时 zod 校验失败", async () => {
        const res = await request(app)
          .put("/api/admin/inventory-batch/batches/1")
          .send({ quantity: -1 });
        expect(res.status).toBe(500);
        expect(service.updateBatch).not.toHaveBeenCalled();
      });

      it("service 抛错时返回500", async () => {
        (service.updateBatch as any).mockRejectedValue(new Error("update error"));
        const res = await request(app)
          .put("/api/admin/inventory-batch/batches/1")
          .send({ quantity: 100 });
        expect(res.status).toBe(500);
      });
    });

    describe("POST /batches/:id/split", () => {
      it("应拆分批次", async () => {
        (service.splitBatch as any).mockResolvedValue(2);
        const res = await request(app)
          .post("/api/admin/inventory-batch/batches/1/split")
          .send({ splitQuantity: 50, newBatchNo: "B002" });
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.splitBatch).toHaveBeenCalledWith(
          "test-tenant", 1, expect.objectContaining({ splitQuantity: 50, newBatchNo: "B002" })
        );
      });

      it("splitQuantity 缺失时 zod 校验失败", async () => {
        const res = await request(app)
          .post("/api/admin/inventory-batch/batches/1/split")
          .send({ newBatchNo: "B002" });
        expect(res.status).toBe(500);
        expect(service.splitBatch).not.toHaveBeenCalled();
      });

      it("newBatchNo 为空时 zod 校验失败", async () => {
        const res = await request(app)
          .post("/api/admin/inventory-batch/batches/1/split")
          .send({ splitQuantity: 50, newBatchNo: "" });
        expect(res.status).toBe(500);
        expect(service.splitBatch).not.toHaveBeenCalled();
      });

      it("service 抛错时返回500", async () => {
        (service.splitBatch as any).mockRejectedValue(new Error("split error"));
        const res = await request(app)
          .post("/api/admin/inventory-batch/batches/1/split")
          .send({ splitQuantity: 50, newBatchNo: "B002" });
        expect(res.status).toBe(500);
      });
    });
  });

  describe("批次追溯", () => {
    describe("GET /batches/:id/trace", () => {
      it("应返回批次追溯信息", async () => {
        (service.getBatchTrace as any).mockResolvedValue([{ type: "purchase" }]);
        const res = await request(app).get("/api/admin/inventory-batch/batches/1/trace");
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.getBatchTrace).toHaveBeenCalledWith("test-tenant", 1);
      });

      it("service 抛错时返回500", async () => {
        (service.getBatchTrace as any).mockRejectedValue(new Error("trace error"));
        const res = await request(app).get("/api/admin/inventory-batch/batches/1/trace");
        expect(res.status).toBe(500);
      });
    });

    describe("GET /products/:spuId/batches", () => {
      it("应返回商品批次列表", async () => {
        (service.getProductBatches as any).mockResolvedValue([{ id: 1 }]);
        const res = await request(app).get("/api/admin/inventory-batch/products/1/batches");
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.getProductBatches).toHaveBeenCalledWith("test-tenant", 1);
      });

      it("service 抛错时返回500", async () => {
        (service.getProductBatches as any).mockRejectedValue(new Error("error"));
        const res = await request(app).get("/api/admin/inventory-batch/products/1/batches");
        expect(res.status).toBe(500);
      });
    });
  });

  describe("效期预警配置", () => {
    describe("GET /expiry-configs", () => {
      it("应返回效期预警配置列表", async () => {
        (service.listExpiryConfigs as any).mockResolvedValue([{ id: 1 }]);
        const res = await request(app).get("/api/admin/inventory-batch/expiry-configs");
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.listExpiryConfigs).toHaveBeenCalledWith("test-tenant");
      });

      it("service 抛错时返回500", async () => {
        (service.listExpiryConfigs as any).mockRejectedValue(new Error("error"));
        const res = await request(app).get("/api/admin/inventory-batch/expiry-configs");
        expect(res.status).toBe(500);
      });
    });

    describe("POST /expiry-configs", () => {
      const validBody = {
        alertLevel: 1,
        levelName: "预警",
        daysBeforeExpiry: 30,
        action: "REMIND" as const,
        color: "#ff0000",
      };

      it("应创建效期预警配置", async () => {
        (service.createExpiryConfig as any).mockResolvedValue(1);
        const res = await request(app)
          .post("/api/admin/inventory-batch/expiry-configs")
          .send(validBody);
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.createExpiryConfig).toHaveBeenCalledWith(
          "test-tenant",
          expect.objectContaining({ alertLevel: 1, levelName: "预警", daysBeforeExpiry: 30, action: "REMIND" })
        );
      });

      it("应使用默认值", async () => {
        (service.createExpiryConfig as any).mockResolvedValue(1);
        const res = await request(app)
          .post("/api/admin/inventory-batch/expiry-configs")
          .send(validBody);
        expect(res.status).toBe(200);
        expect(service.createExpiryConfig).toHaveBeenCalledWith(
          "test-tenant",
          expect.objectContaining({ enabled: true, description: "" })
        );
      });

      it("action 非法时 zod 校验失败", async () => {
        const res = await request(app)
          .post("/api/admin/inventory-batch/expiry-configs")
          .send({ ...validBody, action: "INVALID" });
        expect(res.status).toBe(500);
        expect(service.createExpiryConfig).not.toHaveBeenCalled();
      });

      it("daysBeforeExpiry 为0时 zod 校验失败", async () => {
        const res = await request(app)
          .post("/api/admin/inventory-batch/expiry-configs")
          .send({ ...validBody, daysBeforeExpiry: 0 });
        expect(res.status).toBe(500);
        expect(service.createExpiryConfig).not.toHaveBeenCalled();
      });

      it("service 抛错时返回500", async () => {
        (service.createExpiryConfig as any).mockRejectedValue(new Error("create error"));
        const res = await request(app)
          .post("/api/admin/inventory-batch/expiry-configs")
          .send(validBody);
        expect(res.status).toBe(500);
      });
    });

    describe("PUT /expiry-configs/:id", () => {
      it("应更新效期预警配置", async () => {
        (service.updateExpiryConfig as any).mockResolvedValue(undefined);
        const res = await request(app)
          .put("/api/admin/inventory-batch/expiry-configs/1")
          .send({ levelName: "新名称" });
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.updateExpiryConfig).toHaveBeenCalledWith(
          "test-tenant", 1, expect.objectContaining({ levelName: "新名称" })
        );
      });

      it("action 非法时 zod 校验失败", async () => {
        const res = await request(app)
          .put("/api/admin/inventory-batch/expiry-configs/1")
          .send({ action: "BAD" });
        expect(res.status).toBe(500);
        expect(service.updateExpiryConfig).not.toHaveBeenCalled();
      });

      it("service 抛错时返回500", async () => {
        (service.updateExpiryConfig as any).mockRejectedValue(new Error("update error"));
        const res = await request(app)
          .put("/api/admin/inventory-batch/expiry-configs/1")
          .send({ levelName: "测试" });
        expect(res.status).toBe(500);
      });
    });

    describe("DELETE /expiry-configs/:id", () => {
      it("应删除效期预警配置", async () => {
        (service.deleteExpiryConfig as any).mockResolvedValue(undefined);
        const res = await request(app).delete("/api/admin/inventory-batch/expiry-configs/1");
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.deleteExpiryConfig).toHaveBeenCalledWith("test-tenant", 1);
      });

      it("service 抛错时返回500", async () => {
        (service.deleteExpiryConfig as any).mockRejectedValue(new Error("delete error"));
        const res = await request(app).delete("/api/admin/inventory-batch/expiry-configs/1");
        expect(res.status).toBe(500);
      });
    });
  });

  describe("效期预警记录", () => {
    describe("GET /expiry-alerts", () => {
      it("应返回效期预警记录列表", async () => {
        (service.listExpiryAlerts as any).mockResolvedValue({ total: 0, records: [] });
        const res = await request(app).get("/api/admin/inventory-batch/expiry-alerts");
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.listExpiryAlerts).toHaveBeenCalledWith(
          "test-tenant",
          expect.objectContaining({ page: 1, pageSize: 20 })
        );
      });

      it("应传递筛选参数", async () => {
        (service.listExpiryAlerts as any).mockResolvedValue({ total: 0, records: [] });
        const res = await request(app).get(
          "/api/admin/inventory-batch/expiry-alerts?page=2&pageSize=10&alertLevel=1&status=PENDING&storeId=1"
        );
        expect(res.status).toBe(200);
        expect(service.listExpiryAlerts).toHaveBeenCalledWith(
          "test-tenant",
          expect.objectContaining({ page: 2, pageSize: 10, alertLevel: 1, status: "PENDING", storeId: 1 })
        );
      });

      it("status 非法时 zod 校验失败", async () => {
        const res = await request(app).get("/api/admin/inventory-batch/expiry-alerts?status=INVALID");
        expect(res.status).toBe(500);
        expect(service.listExpiryAlerts).not.toHaveBeenCalled();
      });

      it("service 抛错时返回500", async () => {
        (service.listExpiryAlerts as any).mockRejectedValue(new Error("error"));
        const res = await request(app).get("/api/admin/inventory-batch/expiry-alerts");
        expect(res.status).toBe(500);
      });
    });

    describe("GET /expiry-alerts/statistics", () => {
      it("应返回效期预警统计", async () => {
        (service.getExpiryAlertStatistics as any).mockResolvedValue({ totalPending: 0 });
        const res = await request(app).get("/api/admin/inventory-batch/expiry-alerts/statistics");
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.getExpiryAlertStatistics).toHaveBeenCalledWith("test-tenant");
      });

      it("service 抛错时返回500", async () => {
        (service.getExpiryAlertStatistics as any).mockRejectedValue(new Error("error"));
        const res = await request(app).get("/api/admin/inventory-batch/expiry-alerts/statistics");
        expect(res.status).toBe(500);
      });
    });

    describe("PUT /expiry-alerts/:id/handle", () => {
      it("应处理效期预警", async () => {
        (service.handleExpiryAlert as any).mockResolvedValue(undefined);
        const res = await request(app).put("/api/admin/inventory-batch/expiry-alerts/1/handle");
        expect(res.status).toBe(200);
        expect(res.body.code).toBe("0");
        expect(service.handleExpiryAlert).toHaveBeenCalledWith("test-tenant", 1, 1);
      });

      it("service 抛错时返回500", async () => {
        (service.handleExpiryAlert as any).mockRejectedValue(new Error("handle error"));
        const res = await request(app).put("/api/admin/inventory-batch/expiry-alerts/1/handle");
        expect(res.status).toBe(500);
      });
    });
  });

  describe("效期扫描器 startExpiryScanner", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.clearAllMocks();
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("应启动扫描器并记录日志", () => {
      startExpiryScanner();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("效期扫描器")
      );
    });

    it("凌晨2点时应执行扫描", async () => {
      (service.runExpiryScan as any).mockResolvedValue(undefined);
      
      startExpiryScanner();
      
      const date = new Date();
      date.setHours(2, 0, 0, 0);
      vi.setSystemTime(date);
      
      await vi.advanceTimersByTimeAsync(60 * 1000);
      
      expect(service.runExpiryScan).toHaveBeenCalled();
    });

    it("非凌晨2点时不执行扫描", async () => {
      (service.runExpiryScan as any).mockResolvedValue(undefined);
      
      startExpiryScanner();
      
      const date = new Date();
      date.setHours(10, 0, 0, 0);
      vi.setSystemTime(date);
      
      await vi.advanceTimersByTimeAsync(60 * 1000);
      
      expect(service.runExpiryScan).not.toHaveBeenCalled();
    });

    it("扫描失败时应记录错误日志", async () => {
      const testError = new Error("scan failed");
      (service.runExpiryScan as any).mockRejectedValue(testError);
      
      startExpiryScanner();
      
      const date = new Date();
      date.setHours(2, 0, 0, 0);
      vi.setSystemTime(date);
      
      await vi.advanceTimersByTimeAsync(60 * 1000);
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("效期扫描器"),
        testError
      );
    });

    it("扫描成功后应记录完成日志", async () => {
      (service.runExpiryScan as any).mockResolvedValue(undefined);
      
      startExpiryScanner();
      
      const date = new Date();
      date.setHours(2, 0, 0, 0);
      vi.setSystemTime(date);
      
      await vi.advanceTimersByTimeAsync(60 * 1000);
      
      expect(service.runExpiryScan).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("扫描完成")
      );
    });

    it("扫描进行中时不重复执行", async () => {
      let scanCount = 0;
      let resolveFirstScan: () => void;
      const firstScanPromise = new Promise<void>((resolve) => {
        resolveFirstScan = resolve;
      });
      
      (service.runExpiryScan as any).mockImplementation(() => {
        scanCount++;
        return firstScanPromise;
      });
      
      startExpiryScanner();
      
      const date = new Date();
      date.setHours(2, 0, 0, 0);
      vi.setSystemTime(date);
      
      await vi.advanceTimersByTimeAsync(60 * 1000);
      expect(scanCount).toBe(1);
      
      await vi.advanceTimersByTimeAsync(60 * 1000);
      expect(scanCount).toBe(1);
      
      resolveFirstScan!();
      await firstScanPromise;
    });
  });
});
