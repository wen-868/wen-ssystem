/**
 * 采购合同 service 单元测试
 * 被测文件：src/services/admin/purchase-contract.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db.js", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../shared/id.js", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  listPurchaseContracts,
  createPurchaseContract,
  updatePurchaseContract,
  deletePurchaseContract,
  uploadContractFile,
} from "../../../services/admin/purchase-contract.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("HT20260709000001");
});

describe("purchase-contract.service - listPurchaseContracts", () => {
  it("无可选筛选 + totalRow 有值（?. 左 + ?? 左）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ contractNo: "HT1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listPurchaseContracts({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ contractNo: "HT1" }] });
  });

  it("传入全部筛选条件（supplierId + status 均走 true）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listPurchaseContracts({ page: 1, pageSize: 10, tenantId: "t1", supplierId: 1, status: "ACTIVE" });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("totalRow 为 null（?. 右 + ?? 右）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listPurchaseContracts({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

describe("purchase-contract.service - createPurchaseContract", () => {
  it("全部可选字段有值（覆盖所有 ?? 左分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 100 });
    const res = await createPurchaseContract({
      supplierId: 1, contractName: "采购合同A", contractType: "FRAMEWORK",
      totalAmount: 50000, signDate: "2026-07-01", startDate: "2026-07-01",
      endDate: "2027-06-30", remark: "年度框架", tenantId: "t1",
    });
    expect(res).toEqual({ contractNo: "HT20260709000001", supplierId: 1, contractName: "采购合同A", id: 100 });
  });

  it("全部可选字段缺失（覆盖所有 ?? 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 101 });
    const res = await createPurchaseContract({
      supplierId: 2, contractName: "合同B", tenantId: "t1",
    } as any);
    expect(res.id).toBe(101);
  });
});

describe("purchase-contract.service - updatePurchaseContract", () => {
  it("合同不存在时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updatePurchaseContract("HT1", { tenantId: "t1" } as any)).rejects.toThrow("合同不存在");
  });

  it("没有需要更新的字段时抛错（fields.length === 0）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ contract_no: "HT1" });
    await expect(updatePurchaseContract("HT1", { tenantId: "t1" } as any)).rejects.toThrow("没有需要更新的字段");
  });

  it("成功更新全部字段（8 个 if 均走 true 分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ contract_no: "HT1" });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await updatePurchaseContract("HT1", {
      contractName: "新名称", contractType: "SUPPLEMENT", totalAmount: 60000,
      signDate: "2026-07-02", startDate: "2026-07-02", endDate: "2027-07-01",
      status: "ACTIVE", remark: "更新备注", tenantId: "t1",
    });
    expect(res.contractNo).toBe("HT1");
    expect(res.contractName).toBe("新名称");
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});

describe("purchase-contract.service - deletePurchaseContract", () => {
  it("合同不存在时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(deletePurchaseContract("HT1", "t1")).rejects.toThrow("合同不存在");
  });

  it("成功删除", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ contract_no: "HT1" });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await deletePurchaseContract("HT1", "t1");
    expect(res).toEqual({ contractNo: "HT1" });
  });
});

describe("purchase-contract.service - uploadContractFile", () => {
  it("合同不存在时抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(uploadContractFile("HT1", "https://file.pdf", "t1")).rejects.toThrow("合同不存在");
  });

  it("成功上传文件", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ contract_no: "HT1" });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await uploadContractFile("HT1", "https://file.pdf", "t1");
    expect(res).toEqual({ contractNo: "HT1", fileUrl: "https://file.pdf" });
  });
});
