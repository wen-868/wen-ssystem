import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/report-permission.service", () => ({
  getMatrix: vi.fn(),
  saveMatrix: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

import * as service from "../../../services/admin/report-permission.service";
import { ok } from "../../../shared/response";
import { getMatrix, saveMatrix } from "../../../controllers/admin/report-permission.controller";

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

describe("report-permission.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getMatrix - 应返回权限矩阵", async () => {
    (service.getMatrix as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getMatrix(req as any, res as any);
    expect(service.getMatrix).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("saveMatrix - 应保存权限矩阵", async () => {
    (service.saveMatrix as any).mockResolvedValue(undefined);
    const req = mockReq({
      body: {
        permissions: [
          { role_id: 1, report_code: "sales_report", store_scope: "" },
          { role_id: 2, report_code: "finance_report", store_scope: "store1" },
        ],
      },
    });
    const res = mockRes();
    await saveMatrix(req as any, res as any);
    expect(service.saveMatrix).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role_id: 1, report_code: "sales_report" }),
        expect.objectContaining({ role_id: 2, report_code: "finance_report" }),
      ])
    );
    expect(ok).toHaveBeenCalled();
  });

  it("saveMatrix - 参数校验失败应抛错", async () => {
    const req = mockReq({ body: { permissions: [] } });
    const res = mockRes();
    await expect(saveMatrix(req as any, res as any)).rejects.toThrow();
    expect(service.saveMatrix).not.toHaveBeenCalled();
  });
});
