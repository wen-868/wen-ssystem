/**
 * R101-C6-3-1：数据字典服务（t_platform_dict + t_platform_dict_item）
 *
 * 口径（对应派单卡 §三B② 与验收标准③）：
 * - 四类字典类型是代码常量：unit / category_template / payment_channel / bill_type（卡内逐字）；
 * - 未知 dictType ⇒ AppError 404（读与写两条路径都判）；
 * - 同一请求内 itemCode 重复 ⇒ AppError 400；
 * - 整包替换 = 同一事务内「父表 upsert → DELETE 全子行 → 逐条 INSERT」，重复提交结果一致（幂等）；
 * - 零预置：服务层不写任何种子行，空表读路径返回 items: []；
 * - 不碰 t_platform_config / t_subscription_plan / 任何租户侧表（本单不做"随租户初始化复制"）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
  connQueryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
  connQueryOne: mocks.connQueryOne,
}));

import {
  DICT_TYPES,
  isKnownDictType,
  listDictTypes,
  listDictItems,
  replaceDictItems,
} from "../../../services/platform/platform-dict.service";
import { AppError } from "../../../shared/app-error";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (runner: any) => runner({}));
  mocks.connExecute.mockResolvedValue([{ affectedRows: 1, insertId: 1 }, undefined]);
  mocks.connQueryOne.mockResolvedValue({ id: 7 });
});

describe("C6-3-1 · 四类字典常量", () => {
  it("与派单卡 §三B① 的四类逐字一致，且 isKnownDictType 只认这四类", () => {
    expect(DICT_TYPES.map((t) => t.dictType)).toEqual([
      "unit",
      "category_template",
      "payment_channel",
      "bill_type",
    ]);
    expect(isKnownDictType("unit")).toBe(true);
    expect(isKnownDictType("category")).toBe(false);
    expect(isKnownDictType("pay")).toBe(false);
    expect(isKnownDictType("doc")).toBe(false);
  });
});

describe("C6-3-1 · listDictTypes", () => {
  it("空表 ⇒ items: []（零预置，不由代码兜出四类假行）", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const result = await listDictTypes();
    expect(result).toEqual({ items: [] });
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("t_platform_dict");
    expect(sql).not.toContain("t_platform_config");
  });

  it("有行 ⇒ itemCount 归一为 number，status/remark 原样透出", async () => {
    mocks.query.mockResolvedValueOnce([
      { dictType: "unit", dictName: "计量单位", remark: null, status: "ACTIVE", itemCount: "4" },
    ]);
    const result = await listDictTypes();
    expect(result.items[0]).toEqual({
      dictType: "unit",
      dictName: "计量单位",
      remark: null,
      status: "ACTIVE",
      itemCount: 4,
    });
  });
});

describe("C6-3-1 · listDictItems", () => {
  it("未知 dictType ⇒ 404，且不查库", async () => {
    await expect(listDictItems("nope")).rejects.toMatchObject({
      statusCode: 404,
      message: "未知字典类型：nope",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("合法类型未落库（JOIN 无行）⇒ items: []", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const result = await listDictItems("bill_type");
    expect(result).toEqual({ dictType: "bill_type", items: [] });
  });

  it("按 sort_no 排序的 SQL 口径（ORDER BY sort_no, id）", async () => {
    mocks.query.mockResolvedValueOnce([
      { itemCode: "box", itemName: "箱", sortNo: 1, status: "ACTIVE", remark: null },
      { itemCode: "bottle", itemName: "瓶", sortNo: 2, status: "ACTIVE", remark: "散装" },
    ]);
    const result = await listDictItems("unit");
    expect(result.items.map((i) => i.itemCode)).toEqual(["box", "bottle"]);
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("ORDER BY i.sort_no ASC");
  });
});

describe("C6-3-1 · replaceDictItems（整包替换）", () => {
  it("未知 dictType ⇒ 404，且不开事务、不写库", async () => {
    await expect(replaceDictItems("nope", [])).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("itemCode 重复（含去空格后重复）⇒ 400，且不开事务", async () => {
    await expect(
      replaceDictItems("unit", [
        { itemCode: "bottle", itemName: "瓶" },
        { itemCode: " bottle ", itemName: "瓶（重复）" },
      ])
    ).rejects.toMatchObject({ statusCode: 400, message: "字典项编码重复：bottle" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("整包替换 = 父表 upsert → DELETE 全子行 → 逐条 INSERT（同一事务）", async () => {
    const result = await replaceDictItems("unit", [
      { itemCode: "bottle", itemName: "瓶", sortNo: 1 },
      { itemCode: "box", itemName: "箱", sortNo: 2, remark: "整箱" },
    ]);

    expect(result).toEqual({ dictType: "unit", saved: 2 });

    const sqls = (mocks.connExecute.mock.calls as unknown[][]).map((c) => String(c[1]));
    expect(sqls[0]).toContain("INSERT INTO t_platform_dict");
    expect(sqls[0]).toContain("ON DUPLICATE KEY UPDATE");
    expect(sqls[1]).toContain("DELETE FROM t_platform_dict_item");
    expect(sqls.filter((s) => s.includes("INSERT INTO t_platform_dict_item"))).toHaveLength(2);

    // 未传 status ⇒ 归一为 ACTIVE；未传 remark ⇒ null（不用空串冒充未填写）
    const firstInsertParams = mocks.connExecute.mock.calls[2][2] as unknown[];
    expect(firstInsertParams).toEqual([7, "bottle", "瓶", 1, "ACTIVE", null]);
  });

  it("空数组 ⇒ 仍是「清空该类型」（DELETE 后无 INSERT），幂等且 saved=0", async () => {
    const result = await replaceDictItems("payment_channel", []);
    expect(result).toEqual({ dictType: "payment_channel", saved: 0 });
    const sqls = (mocks.connExecute.mock.calls as unknown[][]).map((c) => String(c[1]));
    expect(sqls.filter((s) => s.includes("INSERT INTO t_platform_dict_item"))).toHaveLength(0);
  });

  it("父表 upsert 用常量 dict_name 补建（bill_type ⇒ 单据类型）", async () => {
    await replaceDictItems("bill_type", [{ itemCode: "sale", itemName: "销售单" }]);
    expect(mocks.connExecute.mock.calls[0][2]).toEqual(["bill_type", "单据类型", "单据类型"]);
  });

  it("父表未取到 id（异常态）⇒ 500 AppError，不静默写子表", async () => {
    mocks.connQueryOne.mockResolvedValueOnce(null);
    await expect(
      replaceDictItems("unit", [{ itemCode: "bottle", itemName: "瓶" }])
    ).rejects.toThrow(AppError);
    const sqls = (mocks.connExecute.mock.calls as unknown[][]).map((c) => String(c[1]));
    expect(sqls.some((s) => s.includes("DELETE FROM t_platform_dict_item"))).toBe(false);
  });
});
