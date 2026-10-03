/**
 * 平台商品库 service 单元测试（S3-155 新增）
 * 被测文件：src/services/platform/library.service.ts
 * 覆盖：importSpus 逐条失败文案 —— 撞唯一键 ⇒ 商品库领域化中文；非撞键错误保留原文
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));

import { libraryService } from "../../../services/platform/library.service";

beforeEach(() => vi.clearAllMocks());

describe("platform library.service - importSpus（S3-155 逐条失败文案）", () => {
  const items = [{ name: "五粮液 52度 500ml", specs: "500ml" }];

  it("撞同名同品牌同规格唯一键 ⇒ 商品库领域化中文（不含 Duplicate entry）", async () => {
    const dupSpu = Object.assign(
      new Error("Duplicate entry '五粮液 52度 500ml-1-500ml' for key 'uk_name_brand_specs'"),
      { code: "ER_DUP_ENTRY", errno: 1062 },
    );
    mocks.transaction.mockRejectedValueOnce(dupSpu);

    const res = await libraryService.importSpus(items);

    expect(res.total).toBe(1);
    expect(res.successCount).toBe(0);
    expect(res.failCount).toBe(1);
    expect(res.errors).toEqual([
      { index: 0, name: "五粮液 52度 500ml", reason: "商品库中已存在相同编码或同名同品牌同规格的商品" },
    ]);
    expect(JSON.stringify(res.errors)).not.toContain("Duplicate entry");
  });

  it("撞条码唯一键 ⇒ 统一条码文案（与 S3-154 同口径）", async () => {
    const dupBarcode = Object.assign(
      new Error("Duplicate entry '6901234567890' for key 'uk_barcode'"),
      { code: "ER_DUP_ENTRY", errno: 1062 },
    );
    mocks.transaction.mockRejectedValueOnce(dupBarcode);

    const res = await libraryService.importSpus(items);

    expect(res.errors).toEqual([
      { index: 0, name: "五粮液 52度 500ml", reason: "该条码已被其他商品使用" },
    ]);
    expect(JSON.stringify(res.errors)).not.toContain("Duplicate entry");
  });

  it("非撞键错误保留原始信息（不误吞、不掩盖）", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("Connection lost: The server closed the connection"));

    const res = await libraryService.importSpus(items);

    expect(res.failCount).toBe(1);
    expect(res.errors[0].reason).toBe("Connection lost: The server closed the connection");
  });

  it("缺少商品名称的行仍按原语义跳过（本单改动未破坏主链路）", async () => {
    const res = await libraryService.importSpus([{ name: "" }]);
    expect(res.failCount).toBe(1);
    expect(res.errors[0].reason).toBe("缺少商品名称");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
