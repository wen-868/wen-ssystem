/**
 * R101-C6-3-2a：平台渠道推广码服务（t_promo_code，迁移 188）
 *
 * 口径（对应派单卡 §三① / §四 / 验收标准②）：
 * - 生成规则：`PC` + 8 位去易混大写字母数字；冲突**重试至多 5 次**后 409；
 * - 未知 id ⇒ 404；**已停用再停用 ⇒ 幂等 200 + 说明**（changed=false / alreadyDisabled=true，不重复写库）；
 * - 未知码值查归因 ⇒ 404；
 * - 零涉钱：SQL 只碰 t_promo_code / t_tenant_attribution，**不碰**任何金额、积分、佣金、结算、提现字段。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

import {
  PROMO_CODE_ALPHABET,
  PROMO_CODE_BODY_LENGTH,
  PROMO_CODE_MAX_ATTEMPTS,
  PROMO_CODE_PREFIX,
  PROMO_CODE_STATUSES,
  generatePromoCode,
  isValidPromoCodeFormat,
  listPromoCodes,
  createPromoCode,
  disablePromoCode,
  listAttributionsByCode,
} from "../../../services/platform/platform-promo-code.service";

beforeEach(() => {
  vi.resetAllMocks();
});

/** 固定随机源：始终取字母表第 0 位 ⇒ 码体恒为 "AAAAAAAA"（便于确定性断言） */
const zeroRandom = () => 0;

function promoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    promoCode: "PCAAAAAAAA",
    channelType: "市场渠道",
    channelName: "华东地推",
    ownerAdminId: 7,
    expireAt: null,
    status: "ACTIVE",
    remark: null,
    attributionCount: 0,
    ...overrides,
  };
}

describe("C6-3-2a · 码规则常量（卡 §四 逐字）", () => {
  it("前缀 PC + 8 位；状态只有 ACTIVE/DISABLED；重试上限 5", () => {
    expect(PROMO_CODE_PREFIX).toBe("PC");
    expect(PROMO_CODE_BODY_LENGTH).toBe(8);
    expect([...PROMO_CODE_STATUSES]).toEqual(["ACTIVE", "DISABLED"]);
    expect(PROMO_CODE_MAX_ATTEMPTS).toBe(5);
  });

  it("字母表去易混：不含 I / O / 0 / 1，且全为大写字母数字", () => {
    for (const ch of ["I", "O", "0", "1"]) {
      expect(PROMO_CODE_ALPHABET.includes(ch)).toBe(false);
    }
    expect(PROMO_CODE_ALPHABET).toMatch(/^[A-Z0-9]+$/);
  });

  it("generatePromoCode 形态：PC + 8 位，且对注入的随机源可确定性复现", () => {
    const code = generatePromoCode(zeroRandom);
    expect(code).toBe("PCAAAAAAAA");
    expect(code).toHaveLength(2 + PROMO_CODE_BODY_LENGTH);
    expect(isValidPromoCodeFormat(code)).toBe(true);
  });

  it("isValidPromoCodeFormat：长度/前缀/易混字符三条都拦", () => {
    expect(isValidPromoCodeFormat("PCAAAAAAAA")).toBe(true);
    expect(isValidPromoCodeFormat("pcAAAAAAAA")).toBe(false);
    expect(isValidPromoCodeFormat("PCAAAAAAA")).toBe(false);
    expect(isValidPromoCodeFormat("PCAAAAAAAAA")).toBe(false);
    expect(isValidPromoCodeFormat("PCAAAAAAAI")).toBe(false);
    expect(isValidPromoCodeFormat("PCAAAAAAA0")).toBe(false);
  });
});

describe("C6-3-2a · listPromoCodes（分页 + 关键词 + 状态）", () => {
  it("空表 ⇒ items: []、total 0（零预置，不由代码兜出假行）", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
    const result = await listPromoCodes({});
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });

    const countSql = String(mocks.query.mock.calls[0][0]);
    expect(countSql).toContain("COUNT(*)");
    expect(countSql).toContain("t_promo_code");
    // 零涉钱：不得出现任何金额/佣金/结算/提现表
    for (const word of ["t_settlement", "t_withdraw", "t_profit", "commission", "amount"]) {
      expect(countSql).not.toContain(word);
    }
  });

  it("关键词 + 状态 ⇒ LIKE 三列 + status = ?，参数顺序与分页正确", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([promoRow()]);
    const result = await listPromoCodes({ page: 2, pageSize: 5, keyword: " 华东 ", status: "ACTIVE" });
    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(5);

    const listSql = String(mocks.query.mock.calls[1][0]);
    expect(listSql).toContain("p.promo_code LIKE ?");
    expect(listSql).toContain("p.channel_name LIKE ?");
    expect(listSql).toContain("p.channel_type LIKE ?");
    expect(listSql).toContain("p.status = ?");
    expect(listSql).toContain("LIMIT ? OFFSET ?");
    expect(mocks.query.mock.calls[1][1]).toEqual(["%华东%", "%华东%", "%华东%", "ACTIVE", 5, 5]);
  });

  it("归因数列走 t_tenant_attribution 真实 COUNT（不是前端推算）", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([
      promoRow({ attributionCount: "3" }),
    ]);
    const result = await listPromoCodes({});
    expect(result.items[0].attributionCount).toBe(3);
    expect(String(mocks.query.mock.calls[1][0])).toContain("FROM t_tenant_attribution");
  });

  it("NULL 原样透出（ownerAdminId / expireAt / remark 不折成空串）", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([
      promoRow({ ownerAdminId: null, expireAt: null, remark: null }),
    ]);
    const result = await listPromoCodes({});
    expect(result.items[0]).toMatchObject({ ownerAdminId: null, expireAt: null, remark: null });
  });
});

describe("C6-3-2a · createPromoCode（生成与冲突重试）", () => {
  it("渠道类型/名称为空 ⇒ 400，且不发生任何查询", async () => {
    await expect(
      createPromoCode({ channelType: "  ", channelName: "华东" }, null, zeroRandom)
    ).rejects.toMatchObject({ statusCode: 400, message: "渠道类型不能为空" });
    await expect(
      createPromoCode({ channelType: "市场渠道", channelName: " " }, null, zeroRandom)
    ).rejects.toMatchObject({ statusCode: 400, message: "渠道名称不能为空" });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.queryOne).not.toHaveBeenCalled();
  });

  it("合法 ⇒ INSERT 状态固定 ACTIVE、owner_admin_id 取当前管理员、返回 { id, promoCode }", async () => {
    mocks.queryOne.mockResolvedValueOnce(null); // 码值未占用
    mocks.query.mockResolvedValueOnce({ insertId: 11 });

    const result = await createPromoCode(
      { channelType: "地推", channelName: "华南地推", expireAt: "2026-12-31 23:59:59", remark: "  " },
      88,
      zeroRandom
    );
    expect(result).toEqual({ id: 11, promoCode: "PCAAAAAAAA" });

    const insertSql = String(mocks.query.mock.calls[0][0]);
    expect(insertSql).toContain("INSERT INTO t_promo_code");
    expect(insertSql).toContain("'ACTIVE'");
    expect(mocks.query.mock.calls[0][1]).toEqual([
      "PCAAAAAAAA",
      "地推",
      "华南地推",
      88,
      "2026-12-31 23:59:59",
      null, // 备注空白串 ⇒ NULL（不用空串冒充未填写）
    ]);
  });

  it("首轮冲突、次轮成功 ⇒ 自动重试（不报错）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);
    mocks.query.mockResolvedValueOnce({ insertId: 12 });

    const result = await createPromoCode({ channelType: "地推", channelName: "华东" }, null, zeroRandom);
    expect(result).toEqual({ id: 12, promoCode: "PCAAAAAAAA" });
    expect(mocks.queryOne).toHaveBeenCalledTimes(2);
  });

  it("连续 5 次都冲突 ⇒ 409（卡 §四：重试至多 5 次后 409），且不写入", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1 });
    await expect(
      createPromoCode({ channelType: "地推", channelName: "华东" }, null, zeroRandom)
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.queryOne).toHaveBeenCalledTimes(PROMO_CODE_MAX_ATTEMPTS);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("并发撞唯一键（ER_DUP_ENTRY）⇒ 计入重试而不是落 500", async () => {
    mocks.queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.query
      .mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" }))
      .mockResolvedValueOnce({ insertId: 13 });

    const result = await createPromoCode({ channelType: "地推", channelName: "华东" }, null, zeroRandom);
    expect(result.id).toBe(13);
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });

  it("未取得主键 ⇒ 500（不返回编造的 id）", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    mocks.query.mockResolvedValueOnce({});
    await expect(
      createPromoCode({ channelType: "地推", channelName: "华东" }, null, zeroRandom)
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("C6-3-2a · disablePromoCode（停用与幂等）", () => {
  it("未知 id ⇒ 404，且不 UPDATE", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(disablePromoCode(99)).rejects.toMatchObject({
      statusCode: 404,
      message: "推广码不存在：99",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("已停用 ⇒ 幂等 200 + 说明（changed=false / alreadyDisabled=true），不重复写库", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, status: "DISABLED" });
    const result = await disablePromoCode(5);
    expect(result).toEqual({
      id: 5,
      status: "DISABLED",
      changed: false,
      alreadyDisabled: true,
      message: "该推广码已停用（幂等，无需重复停用）",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("启用中 ⇒ UPDATE 置 DISABLED（changed=true / alreadyDisabled=false）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, status: "ACTIVE" });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });
    const result = await disablePromoCode(5);
    expect(result).toMatchObject({ id: 5, status: "DISABLED", changed: true, alreadyDisabled: false });
    expect(String(mocks.query.mock.calls[0][0])).toContain("UPDATE t_promo_code SET status = 'DISABLED'");
    expect(mocks.query.mock.calls[0][1]).toEqual([5]);
  });
});

describe("C6-3-2a · listAttributionsByCode（只读聚合）", () => {
  it("空码值 ⇒ 400，且不查询", async () => {
    await expect(listAttributionsByCode("   ")).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.queryOne).not.toHaveBeenCalled();
  });

  it("码值不存在 ⇒ 404", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(listAttributionsByCode("PCNOTEXIST")).rejects.toMatchObject({
      statusCode: 404,
      message: "推广码不存在：PCNOTEXIST",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("存在 ⇒ 返回码档案 + 归因行（id/tenantId 归一为 number），不改任何数据", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      id: "3",
      promoCode: "PCAAAAAAAA",
      channelType: "市场渠道",
      channelName: "华东地推",
      status: "ACTIVE",
    });
    mocks.query.mockResolvedValueOnce([
      {
        id: "9",
        tenantId: "t-1",
        attributionType: "PROMO",
        promoCodeId: "3",
        agentId: null,
        attributedAt: "2026-10-01 10:00:00",
      },
    ]);

    const result = await listAttributionsByCode("PCAAAAAAAA");
    expect(result.promoCode).toEqual({
      id: 3,
      promoCode: "PCAAAAAAAA",
      channelType: "市场渠道",
      channelName: "华东地推",
      status: "ACTIVE",
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ id: 9, tenantId: "t-1", promoCodeId: 3, agentId: null });

    const selectSql = String(mocks.query.mock.calls[0][0]);
    expect(selectSql).toContain("FROM t_tenant_attribution");
    expect(selectSql).toContain("WHERE promo_code_id = ?");
    // 只读：本函数不得出现任何写语句
    for (const word of ["INSERT", "UPDATE", "DELETE"]) {
      expect(selectSql.toUpperCase()).not.toContain(word);
    }
  });
});

