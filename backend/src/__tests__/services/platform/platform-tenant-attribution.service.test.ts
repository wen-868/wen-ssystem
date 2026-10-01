/**
 * S3-144：租户归因唯一写入口（t_tenant_attribution，迁移 189）
 *
 * 口径（对应派单卡 §二 D 与 §四）：
 * - 代理商邀请（AGENT）优先于渠道推广码（PROMO）；
 * - 一租户一条（uk_tenant_attr）⇒ 重复归因 409（含并发 ER_DUP_ENTRY）；
 * - 未带码且未带代理商 ⇒ 不写归因（resolveAttributionTarget 返回 null）；
 * - t_tenant.source 只写既有三取值（MANUAL / SELF_REGISTER / INVITATION），SELF_REGISTER 不被覆盖。
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
  ATTRIBUTION_TYPES,
  TENANT_SOURCES,
  formatDateTime,
  resolveAttributionTarget,
  resolveTenantSource,
  writeTenantAttribution,
} from "../../../services/platform/platform-tenant-attribution.service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("platform-tenant-attribution.service - 归因唯一写入口", () => {
  describe("常量口径", () => {
    it("归因类型与来源取值与迁移 189/016 一致", () => {
      expect([...ATTRIBUTION_TYPES]).toEqual(["AGENT", "PROMO", "REFERRAL"]);
      expect([...TENANT_SOURCES]).toEqual(["MANUAL", "SELF_REGISTER", "INVITATION"]);
    });
  });

  describe("resolveAttributionTarget", () => {
    it("未带推广码且未带代理商 ⇒ 返回 null（不写归因）", async () => {
      expect(await resolveAttributionTarget({})).toBeNull();
      expect(await resolveAttributionTarget({ promoCode: "  ", agentId: null })).toBeNull();
      expect(mocks.queryOne).not.toHaveBeenCalled();
    });

    it("代理商ID非法 ⇒ 400", async () => {
      await expect(resolveAttributionTarget({ agentId: "abc" })).rejects.toThrow("代理商ID不合法");
      expect(mocks.queryOne).not.toHaveBeenCalled();
    });

    it("代理商不存在 ⇒ 400", async () => {
      mocks.queryOne.mockResolvedValueOnce(null);
      await expect(resolveAttributionTarget({ agentId: 3 })).rejects.toThrow("代理商不存在");
    });

    it("代理商存在 ⇒ AGENT 目标", async () => {
      mocks.queryOne.mockResolvedValueOnce({ id: 3 });
      const target = await resolveAttributionTarget({ agentId: 3 });
      expect(target).toEqual({ attributionType: "AGENT", promoCodeId: null, agentId: 3 });
    });

    it("同带代理商与推广码 ⇒ 只解析代理商（AGENT 优先，不再查码）", async () => {
      mocks.queryOne.mockResolvedValueOnce({ id: 5 });
      const target = await resolveAttributionTarget({ agentId: 5, promoCode: "PCABCDEFGH" });
      expect(target?.attributionType).toBe("AGENT");
      expect(mocks.queryOne).toHaveBeenCalledTimes(1);
      expect(String(mocks.queryOne.mock.calls[0][0])).toContain("t_agent");
    });

    it("推广码不存在 ⇒ 400", async () => {
      mocks.queryOne.mockResolvedValueOnce(null);
      await expect(resolveAttributionTarget({ promoCode: "PC00000000" })).rejects.toThrow("推广码不存在");
    });

    it("推广码已停用 ⇒ 400", async () => {
      mocks.queryOne.mockResolvedValueOnce({ id: 9, status: "DISABLED" });
      await expect(resolveAttributionTarget({ promoCode: "PC00000001" })).rejects.toThrow("推广码已停用");
    });

    it("推广码有效 ⇒ PROMO 目标", async () => {
      mocks.queryOne.mockResolvedValueOnce({ id: 9, status: "ACTIVE" });
      const target = await resolveAttributionTarget({ promoCode: " PC00000002 " });
      expect(target).toEqual({ attributionType: "PROMO", promoCodeId: 9, agentId: null });
    });
  });

  describe("resolveTenantSource", () => {
    it("SELF_REGISTER 保持不受影响", () => {
      expect(resolveTenantSource("SELF_REGISTER", "PROMO")).toBe("SELF_REGISTER");
      expect(resolveTenantSource("SELF_REGISTER", "AGENT")).toBe("SELF_REGISTER");
    });

    it("AGENT / PROMO ⇒ INVITATION（既有取值）", () => {
      expect(resolveTenantSource("MANUAL", "PROMO")).toBe("INVITATION");
      expect(resolveTenantSource(null, "AGENT")).toBe("INVITATION");
    });

    it("REFERRAL ⇒ null（不改写来源列）", () => {
      expect(resolveTenantSource("MANUAL", "REFERRAL")).toBeNull();
    });
  });

  describe("writeTenantAttribution", () => {
    it("缺租户ID ⇒ 400", async () => {
      await expect(
        writeTenantAttribution({ tenantId: "  ", attributionType: "PROMO", promoCodeId: 1, agentId: null })
      ).rejects.toThrow("缺少租户ID");
    });

    it("推广码与代理商皆空 ⇒ 400", async () => {
      await expect(
        writeTenantAttribution({ tenantId: "t-1", attributionType: "PROMO", promoCodeId: null, agentId: null })
      ).rejects.toThrow("至少需要推广码或代理商");
    });

    it("该租户已有归因 ⇒ 409（一租户一条）", async () => {
      mocks.queryOne.mockResolvedValueOnce({ id: 1 });
      await expect(
        writeTenantAttribution({ tenantId: "t-1", attributionType: "PROMO", promoCodeId: 1, agentId: null })
      ).rejects.toThrow("已存在归因记录");
    });

    it("租户不存在 ⇒ 404", async () => {
      mocks.queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      await expect(
        writeTenantAttribution({ tenantId: "t-404", attributionType: "PROMO", promoCodeId: 1, agentId: null })
      ).rejects.toThrow("租户不存在");
    });

    it("写入成功：SELF_REGISTER 不被改写（sourceUpdated=false）", async () => {
      mocks.queryOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ source: "SELF_REGISTER" });
      mocks.query.mockResolvedValue({ insertId: 7 });

      const result = await writeTenantAttribution({
        tenantId: "t-1",
        attributionType: "PROMO",
        promoCodeId: 3,
        agentId: null,
      });

      expect(result.id).toBe(7);
      expect(result.source).toBe("SELF_REGISTER");
      expect(result.sourceUpdated).toBe(false);
      expect(mocks.query).toHaveBeenCalledTimes(1);
      expect(String(mocks.query.mock.calls[0][0])).toContain("INSERT INTO t_tenant_attribution");
    });

    it("写入成功：MANUAL + PROMO ⇒ 改写为 INVITATION", async () => {
      mocks.queryOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ source: "MANUAL" });
      mocks.query.mockResolvedValueOnce({ insertId: 8 }).mockResolvedValueOnce({ affectedRows: 1 });

      const result = await writeTenantAttribution({
        tenantId: "t-2",
        attributionType: "PROMO",
        promoCodeId: 4,
        agentId: null,
      });

      expect(result.source).toBe("INVITATION");
      expect(result.sourceUpdated).toBe(true);
      expect(String(mocks.query.mock.calls[1][0])).toContain("UPDATE t_tenant SET source = ?");
      expect(mocks.query.mock.calls[1][1]).toEqual(["INVITATION", "t-2"]);
    });

    it("并发撞唯一键 ER_DUP_ENTRY ⇒ 409 而非 500", async () => {
      mocks.queryOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ source: "MANUAL" });
      const dupError = Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" });
      mocks.query.mockRejectedValueOnce(dupError);

      await expect(
        writeTenantAttribution({ tenantId: "t-3", attributionType: "AGENT", promoCodeId: null, agentId: 9 })
      ).rejects.toThrow("已存在归因记录");
    });
  });

  describe("formatDateTime", () => {
    it("非法时间 ⇒ 400", () => {
      expect(() => formatDateTime("not-a-date")).toThrow("时间格式不正确");
    });

    it("输出 'YYYY-MM-DD HH:mm:ss'", () => {
      expect(formatDateTime(new Date(2026, 9, 2, 8, 5, 6))).toBe("2026-10-02 08:05:06");
    });
  });
});
