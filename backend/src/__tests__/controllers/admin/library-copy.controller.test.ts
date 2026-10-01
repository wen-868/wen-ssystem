/**
 * R101-C6-4-1：租户侧商品库调取控制器单元测试
 *
 * 被测：src/controllers/admin/library-copy.controller.ts
 * 重点（派单卡交付物②与验收标准②）：
 *   · 配额不足（全部被拒）⇒ HTTP 400 + 业务码 "1001"（Q3 裁定；**不能**被 errorHandler 归一成 "400"）
 *   · 部分成功/全成功 ⇒ 200 + ok(逐条结果 + summary)
 *   · 参数越界（pageSize > 50 / 空数组 / > 50 条）⇒ zod 抛错（由 errorHandler 统一转 400），且**不进业务层**
 *   · 未知 id（service 抛 AppError 404）⇒ 控制器不吞错，原样冒泡
 *   · 租户口径来自令牌注入的 req.tenantId（不取 body/query）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../services/admin/library-copy.service", () => ({
  listLibrarySpus: vi.fn(),
  getLibrarySpuPreview: vi.fn(),
  copyLibrarySpus: vi.fn(),
  listMyCallLogs: vi.fn(),
}));

import * as service from "../../../services/admin/library-copy.service";
import {
  listLibrarySpus,
  getLibrarySpu,
  copyLibrarySpus,
  listMyCallLogs,
} from "../../../controllers/admin/library-copy.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t-001",
  user: { id: 7, username: "ajian", realName: "张三" },
  query: {},
  params: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

const CREATED_RESULT = {
  items: [{ librarySpuId: 123, result: "CREATED", spuId: 9001, skuCount: 2 }],
  summary: { created: 1, skipped: 0, rejected: 0 },
};

beforeEach(() => vi.clearAllMocks());

describe("library-copy.controller · POST /api/admin/library/copies", () => {
  it("全部被配额拒绝 ⇒ 400 + 业务码 1001（带 used/limit 与升级指引）", async () => {
    (service.copyLibrarySpus as any).mockResolvedValue({
      items: [{ librarySpuId: 123, result: "REJECTED", reason: "商品配额不足（已用 3 个 / 上限 3 个）" }],
      summary: { created: 0, skipped: 0, rejected: 1 },
    });

    const res = mockRes();
    await copyLibrarySpus(mockReq({ body: { librarySpuIds: [123] } }) as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.code).toBe("1001");
    expect(body.msg).toContain("商品配额不足");
    expect(body.msg).toContain("已用 3 个 / 上限 3 个");
  });

  it("成功 ⇒ 200 + ok(逐条结果 + summary)，且不写 400", async () => {
    (service.copyLibrarySpus as any).mockResolvedValue(CREATED_RESULT);

    const res = mockRes();
    await copyLibrarySpus(mockReq({ body: { librarySpuIds: [123] } }) as any, res as any);

    expect(res.status).not.toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.code).toBe("0");
    expect(body.data).toEqual(CREATED_RESULT);
  });

  it("部分成功（有 CREATED）⇒ 200，逐条结果里保留 REJECTED 的原因", async () => {
    (service.copyLibrarySpus as any).mockResolvedValue({
      items: [
        { librarySpuId: 123, result: "CREATED", spuId: 9001, skuCount: 2 },
        { librarySpuId: 124, result: "REJECTED", reason: "商品配额不足（已用 3 个 / 上限 3 个）" },
      ],
      summary: { created: 1, skipped: 0, rejected: 1 },
    });

    const res = mockRes();
    await copyLibrarySpus(mockReq({ body: { librarySpuIds: [123, 124] } }) as any, res as any);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.items[1].reason).toContain("商品配额不足");
  });

  it("操作人快照取自令牌（realName 优先，回落 username），租户取自 req.tenantId", async () => {
    (service.copyLibrarySpus as any).mockResolvedValue(CREATED_RESULT);

    await copyLibrarySpus(mockReq({ body: { librarySpuIds: [123] } }) as any, mockRes() as any);

    expect(service.copyLibrarySpus).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t-001", operatorId: 7, operatorName: "张三", librarySpuIds: [123] })
    );
  });

  it("空数组 ⇒ zod 抛错且不进业务层", async () => {
    const res = mockRes();
    await expect(copyLibrarySpus(mockReq({ body: { librarySpuIds: [] } }) as any, res as any)).rejects.toThrow();
    expect(service.copyLibrarySpus).not.toHaveBeenCalled();
  });

  it("一次超过 50 条 ⇒ zod 抛错且不进业务层", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => i + 1);
    const res = mockRes();
    await expect(copyLibrarySpus(mockReq({ body: { librarySpuIds: ids } }) as any, res as any)).rejects.toThrow();
    expect(service.copyLibrarySpus).not.toHaveBeenCalled();
  });

  it("未知 id：service 抛 AppError(404) ⇒ 控制器不吞错，原样冒泡", async () => {
    const err = Object.assign(new Error("商品库商品不存在或未上架：999"), { statusCode: 404 });
    (service.copyLibrarySpus as any).mockRejectedValue(err);

    await expect(
      copyLibrarySpus(mockReq({ body: { librarySpuIds: [999] } }) as any, mockRes() as any)
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("library-copy.controller · GET 三条只读端点", () => {
  it("检索：pageSize > 50 ⇒ zod 抛错（显式 400 口径）", async () => {
    await expect(
      listLibrarySpus(mockReq({ query: { page: "1", pageSize: "51" } }) as any, mockRes() as any)
    ).rejects.toThrow();
    expect(service.listLibrarySpus).not.toHaveBeenCalled();
  });

  it("检索：默认分页 + 关键词透传", async () => {
    (service.listLibrarySpus as any).mockResolvedValue({ total: 0, page: 1, pageSize: 20, records: [] });
    const res = mockRes();
    await listLibrarySpus(mockReq({ query: { keyword: "茅台" } }) as any, res as any);

    expect(service.listLibrarySpus).toHaveBeenCalledWith({
      tenantId: "t-001",
      keyword: "茅台",
      barcode: undefined,
      brandId: undefined,
      page: 1,
      pageSize: 20,
    });
    expect(res.json.mock.calls[0][0].code).toBe("0");
  });

  it("预览：service 抛 AppError(404) ⇒ 原样冒泡", async () => {
    (service.getLibrarySpuPreview as any).mockRejectedValue(
      Object.assign(new Error("商品库商品不存在或未上架"), { statusCode: 404 })
    );
    await expect(getLibrarySpu(mockReq({ params: { id: "999" } }) as any, mockRes() as any)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("我的记录：租户口径取 req.tenantId", async () => {
    (service.listMyCallLogs as any).mockResolvedValue({ total: 0, page: 1, pageSize: 20, records: [] });
    const res = mockRes();
    await listMyCallLogs(mockReq() as any, res as any);

    expect(service.listMyCallLogs).toHaveBeenCalledWith({ tenantId: "t-001", page: 1, pageSize: 20 });
    expect(res.json.mock.calls[0][0].code).toBe("0");
  });
});
