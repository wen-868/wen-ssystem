import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/purchase-contract.service", () => ({
  listPurchaseContracts: vi.fn(),
  createPurchaseContract: vi.fn(),
  updatePurchaseContract: vi.fn(),
  deletePurchaseContract: vi.fn(),
  uploadContractFile: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as purchaseContractService from "../../../services/admin/purchase-contract.service";
import { ok } from "../../../shared/response";
import {
  listPurchaseContracts,
  createPurchaseContract,
  updatePurchaseContract,
  deletePurchaseContract,
  uploadContractFile,
} from "../../../controllers/admin/purchase-contract.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
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

describe("purchase-contract.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listPurchaseContracts - 应返回采购合同列表", async () => {
    (purchaseContractService.listPurchaseContracts as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listPurchaseContracts(req as any, res as any);
    expect(purchaseContractService.listPurchaseContracts).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("listPurchaseContracts - 应传递筛选参数", async () => {
    (purchaseContractService.listPurchaseContracts as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: "2", pageSize: "10", supplierId: "3", status: "ACTIVE" } });
    const res = mockRes();
    await listPurchaseContracts(req as any, res as any);
    expect(purchaseContractService.listPurchaseContracts).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 10,
        supplierId: 3,
        status: "ACTIVE",
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("createPurchaseContract - 应创建采购合同", async () => {
    (purchaseContractService.createPurchaseContract as any).mockResolvedValue({ contractNo: "PC001" });
    const req = mockReq({
      body: {
        supplierId: 1,
        contractName: "年度采购合同",
        contractType: "YEARLY",
        totalAmount: 100000,
        signDate: "2026-01-01",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        remark: "备注",
      },
    });
    const res = mockRes();
    await createPurchaseContract(req as any, res as any);
    expect(purchaseContractService.createPurchaseContract).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: 1,
        contractName: "年度采购合同",
        contractType: "YEARLY",
        totalAmount: 100000,
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("createPurchaseContract - 参数校验失败应抛错", async () => {
    const req = mockReq({ body: { contractName: "测试" } });
    const res = mockRes();
    await expect(createPurchaseContract(req as any, res as any)).rejects.toThrow();
    expect(purchaseContractService.createPurchaseContract).not.toHaveBeenCalled();
  });

  it("updatePurchaseContract - 应更新采购合同", async () => {
    (purchaseContractService.updatePurchaseContract as any).mockResolvedValue({ contractNo: "PC001" });
    const req = mockReq({
      params: { contractNo: "PC001" },
      body: {
        contractName: "更新后的合同",
        totalAmount: 200000,
        status: "ACTIVE",
      },
    });
    const res = mockRes();
    await updatePurchaseContract(req as any, res as any);
    expect(purchaseContractService.updatePurchaseContract).toHaveBeenCalledWith(
      "PC001",
      expect.objectContaining({
        contractName: "更新后的合同",
        totalAmount: 200000,
        status: "ACTIVE",
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("updatePurchaseContract - 参数校验失败应抛错", async () => {
    const req = mockReq({ params: { contractNo: "PC001" }, body: { totalAmount: -1 } });
    const res = mockRes();
    await expect(updatePurchaseContract(req as any, res as any)).rejects.toThrow();
    expect(purchaseContractService.updatePurchaseContract).not.toHaveBeenCalled();
  });

  it("deletePurchaseContract - 应删除采购合同", async () => {
    (purchaseContractService.deletePurchaseContract as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { contractNo: "PC001" } });
    const res = mockRes();
    await deletePurchaseContract(req as any, res as any);
    expect(purchaseContractService.deletePurchaseContract).toHaveBeenCalledWith("PC001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("uploadContractFile - 应上传合同文件", async () => {
    (purchaseContractService.uploadContractFile as any).mockResolvedValue({ fileUrl: "http://example.com/file.pdf" });
    const req = mockReq({
      params: { contractNo: "PC001" },
      body: { fileUrl: "http://example.com/file.pdf" },
    });
    const res = mockRes();
    await uploadContractFile(req as any, res as any);
    expect(purchaseContractService.uploadContractFile).toHaveBeenCalledWith(
      "PC001",
      "http://example.com/file.pdf",
      "t1"
    );
    expect(ok).toHaveBeenCalled();
  });

  it("uploadContractFile - 参数校验失败应抛错", async () => {
    const req = mockReq({ params: { contractNo: "PC001" }, body: {} });
    const res = mockRes();
    await expect(uploadContractFile(req as any, res as any)).rejects.toThrow();
    expect(purchaseContractService.uploadContractFile).not.toHaveBeenCalled();
  });
});
