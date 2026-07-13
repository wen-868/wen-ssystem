/**
 * 小程序会员 service 单元测试
 * 被测文件：src/services/miniapp/member.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  getMemberProfile,
  getMemberLevels,
  getPointsRecords,
  getGrowthRecords,
  getMyCoupons,
  receiveCoupon,
  updateUserProfile,
  changePassword,
} from "../../../services/miniapp/member.service";

describe("miniapp/member.service", () => {
  beforeEach(() => vi.resetAllMocks());

  // ===== 测试用 mock 数据 =====
  const mockMember = {
    id: 1,
    name: "张三",
    nickname: "小张",
    avatar: "avatar.jpg",
    mobile: "13800138000",
    gender: 1,
    birthday: "1990-01-01",
    customerType: "RETAIL",
    points: 100,
    growthValue: 500,
    levelCode: "GOLD",
    status: "ACTIVE",
    createdAt: "2026-01-01 00:00:00",
  };

  const mockLevelsDesc = [
    { levelCode: "PLATINUM", levelName: "铂金卡", minGrowth: 1000, discountRate: 85, sortNo: 3 },
    { levelCode: "GOLD", levelName: "金卡", minGrowth: 100, discountRate: 90, sortNo: 2 },
    { levelCode: "SILVER", levelName: "银卡", minGrowth: 0, discountRate: 95, sortNo: 1 },
  ];

  const mockCouponStats = { availableCount: 3, usedCount: 5, expiredCount: 2 };

  describe("getMemberProfile", () => {
    it("应返回会员基本信息和等级信息", async () => {
      // 调用顺序: queryOne(member) -> queryOne(level) -> queryWith(allLevels) -> queryOne(couponStats)
      mocks.queryOneWithTenant
        .mockResolvedValueOnce(mockMember)
        .mockResolvedValueOnce(mockLevelsDesc[2]) // 单条等级查询
        .mockResolvedValueOnce(mockCouponStats);
      mocks.queryWithTenant.mockResolvedValueOnce(mockLevelsDesc);

      const res = await getMemberProfile(1, "t1");
      expect(res.memberId).toBe(1);
      expect(res.nickname).toBe("小张");
      expect(res.points).toBe(100);
      expect(res.growthValue).toBe(500);
      expect(res.level?.levelCode).toBe("GOLD");
      expect(res.nextLevel?.levelCode).toBe("PLATINUM");
      expect(res.upgradeProgress).toBeGreaterThan(0);
      expect(res.couponStats.availableCount).toBe(3);
    });

    it("会员不存在应抛出错误", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce(null);
      await expect(getMemberProfile(999, "t1")).rejects.toThrow("会员不存在");
    });

    it("手机号应脱敏显示", async () => {
      mocks.queryOneWithTenant
        .mockResolvedValueOnce({ ...mockMember, nickname: null, mobile: "13800138000" })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ availableCount: 0, usedCount: 0, expiredCount: 0 });
      mocks.queryWithTenant.mockResolvedValueOnce([]);

      const res = await getMemberProfile(1, "t1");
      expect(res.mobile).toContain("****");
      expect(res.mobile.length).toBe(11);
    });

    it("无昵称时应显示姓名或默认值", async () => {
      mocks.queryOneWithTenant
        .mockResolvedValueOnce({ ...mockMember, nickname: null, name: "张三" })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ availableCount: 0, usedCount: 0, expiredCount: 0 });
      mocks.queryWithTenant.mockResolvedValueOnce([]);

      const res = await getMemberProfile(1, "t1");
      expect(res.nickname).toBe("张三");
    });

    it("无等级配置时level和nextLevel应为null", async () => {
      mocks.queryOneWithTenant
        .mockResolvedValueOnce({ ...mockMember, growthValue: 0, levelCode: null })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ availableCount: 0, usedCount: 0, expiredCount: 0 });
      mocks.queryWithTenant.mockResolvedValueOnce([]);

      const res = await getMemberProfile(1, "t1");
      expect(res.level).toBeNull();
      expect(res.nextLevel).toBeNull();
      expect(res.upgradeProgress).toBe(0);
    });

    it("最高等级时升级进度应为100%且nextLevel为null", async () => {
      mocks.queryOneWithTenant
        .mockResolvedValueOnce({ ...mockMember, growthValue: 2000, levelCode: "PLATINUM" })
        .mockResolvedValueOnce(mockLevelsDesc[0])
        .mockResolvedValueOnce({ availableCount: 0, usedCount: 0, expiredCount: 0 });
      mocks.queryWithTenant.mockResolvedValueOnce(mockLevelsDesc);

      const res = await getMemberProfile(1, "t1");
      expect(res.level?.levelCode).toBe("PLATINUM");
      expect(res.upgradeProgress).toBe(100);
      expect(res.nextLevel).toBeNull();
    });
  });

  describe("getMemberLevels", () => {
    it("应返回等级列表", async () => {
      mocks.queryWithTenant.mockResolvedValue([
        { id: 1, levelCode: "BRONZE", levelName: "铜卡", minPoints: 0, minGrowth: 0, discountRate: 100 },
        { id: 2, levelCode: "SILVER", levelName: "银卡", minPoints: 100, minGrowth: 100, discountRate: 95 },
        { id: 3, levelCode: "GOLD", levelName: "金卡", minPoints: 500, minGrowth: 500, discountRate: 90 },
      ]);

      const res = await getMemberLevels("t1");
      expect(res.length).toBe(3);
      expect(res[0].levelCode).toBe("BRONZE");
      expect(res[2].levelName).toBe("金卡");
    });

    it("空列表应返回空数组", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      const res = await getMemberLevels("t1");
      expect(res).toEqual([]);
    });
  });

  describe("getPointsRecords", () => {
    it("应返回积分记录列表和总数", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([
        { id: 1, type: "EARN", changePoints: 100, balancePoints: 100, sourceType: "ORDER", sourceId: 1, remark: "购物奖励", createdAt: "2026-07-01 10:00:00" },
        { id: 2, type: "CONSUME", changePoints: -50, balancePoints: 50, sourceType: "EXCHANGE", sourceId: 2, remark: "积分抵扣", createdAt: "2026-07-02 14:00:00" },
      ]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 10 });

      const res = await getPointsRecords(1, "t1", 1, 20);
      expect(res.records.length).toBe(2);
      expect(res.total).toBe(10);
      expect(res.page).toBe(1);
      expect(res.pageSize).toBe(20);
    });

    it("支持按类型过滤", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });

      await getPointsRecords(1, "t1", 1, 20, "EARN");
      // 验证查询条件包含 type
      const sqlCall = mocks.queryWithTenant.mock.calls[0][0];
      expect(sqlCall).toContain("type = ?");
    });

    it("type为ALL时不过滤", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });

      await getPointsRecords(1, "t1", 1, 20, "ALL");
      const sqlCall = mocks.queryWithTenant.mock.calls[0][0];
      expect(sqlCall).not.toContain("type = ?");
    });
  });

  describe("getGrowthRecords", () => {
    it("应返回成长值记录列表和总数", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([
        { id: 1, type: "EARN", changeGrowth: 50, balanceGrowth: 50, sourceType: "ORDER", sourceId: 1, remark: "消费成长", createdAt: "2026-07-01" },
      ]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 3 });

      const res = await getGrowthRecords(1, "t1", 1, 20);
      expect(res.records.length).toBe(1);
      expect(res.total).toBe(3);
    });

    it("支持按类型过滤", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });

      await getGrowthRecords(1, "t1", 1, 20, "EARN");
      const sqlCall = mocks.queryWithTenant.mock.calls[0][0];
      expect(sqlCall).toContain("type = ?");
    });
  });

  describe("getMyCoupons", () => {
    it("应返回我的优惠券列表和总数", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([
        { id: 1, templateId: 1, couponName: "满100减10", couponValue: 10, couponType: "FIXED", minPurchase: 100, status: "UNUSED", validEnd: "2026-12-31" },
        { id: 2, templateId: 2, couponName: "9折券", couponValue: 10, couponType: "PERCENT", minPurchase: 50, status: "USED", validEnd: "2026-12-31" },
      ]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 2 });

      const res = await getMyCoupons(1, "t1", 1, 20);
      expect(res.records.length).toBe(2);
      expect(res.total).toBe(2);
    });

    it("支持按状态过滤", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });

      await getMyCoupons(1, "t1", 1, 20, "AVAILABLE");
      const sqlCall = mocks.queryWithTenant.mock.calls[0][0];
      expect(sqlCall).toContain("UNUSED");
      expect(sqlCall).toContain("valid_end");
    });

    it("status为ALL时不过滤", async () => {
      mocks.queryWithTenant.mockResolvedValueOnce([]);
      mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });

      await getMyCoupons(1, "t1", 1, 20);
      const sqlCall = mocks.queryWithTenant.mock.calls[0][0];
      expect(sqlCall).not.toContain("AND status");
    });
  });

  describe("receiveCoupon", () => {
    const mockTemplate = {
      id: 1,
      templateCode: "COUPON_001",
      templateName: "满100减10",
      couponType: "FIXED",
      couponValue: 10,
      minPurchase: 100,
      maxDiscount: 10,
      applicableScope: "ALL",
      applicableIds: null,
      totalQuantity: 100,
      issuedQuantity: 50,
      perLimit: 3,
      validType: "FIXED",
      validStart: "2026-07-01",
      validEnd: "2026-12-31",
      validDays: null,
      status: "ACTIVE",
    };

    it("应成功领取优惠券", async () => {
      mocks.transaction.mockImplementation(async (fn: any) => {
        const mockConn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[mockTemplate]])  // 查询模板
            .mockResolvedValueOnce([[{ count: 0 }]])  // 检查领取数量
            .mockResolvedValueOnce({ insertId: 1, affectedRows: 1 })  // 插入优惠券
            .mockResolvedValueOnce({ affectedRows: 1 }),  // 更新发行数量
        };
        return fn(mockConn);
      });

      const res = await receiveCoupon(1, 1, "t1");
      expect(res.couponNo).toBeDefined();
      expect(res.templateId).toBe(1);
      expect(res.couponName).toBe("满100减10");
      expect(res.couponValue).toBe(10);
    });

    it("优惠券不存在应抛出错误", async () => {
      mocks.transaction.mockImplementation(async (fn: any) => {
        const mockConn = {
          execute: vi.fn().mockResolvedValueOnce([[]]),
        };
        return fn(mockConn);
      });

      await expect(receiveCoupon(1, 999, "t1")).rejects.toThrow("优惠券不存在");
    });

    it("优惠券未激活应抛出错误", async () => {
      mocks.transaction.mockImplementation(async (fn: any) => {
        const mockConn = {
          execute: vi.fn().mockResolvedValueOnce([[{ ...mockTemplate, status: "INACTIVE" }]]),
        };
        return fn(mockConn);
      });

      await expect(receiveCoupon(1, 1, "t1")).rejects.toThrow("优惠券不可领取");
    });

    it("已达发行上限应抛出错误", async () => {
      mocks.transaction.mockImplementation(async (fn: any) => {
        const mockConn = {
          execute: vi.fn().mockResolvedValueOnce([[{ ...mockTemplate, totalQuantity: 100, issuedQuantity: 100 }]]),
        };
        return fn(mockConn);
      });

      await expect(receiveCoupon(1, 1, "t1")).rejects.toThrow("优惠券已领完");
    });

    it("超过每人限领数量应抛出错误", async () => {
      mocks.transaction.mockImplementation(async (fn: any) => {
        const mockConn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[mockTemplate]])
            .mockResolvedValueOnce([[{ count: 3 }]]),
        };
        return fn(mockConn);
      });

      await expect(receiveCoupon(1, 1, "t1")).rejects.toThrow("每人限领3张");
    });

    it("相对有效期(DAYS类型)计算正确", async () => {
      mocks.transaction.mockImplementation(async (fn: any) => {
        const mockConn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[{ ...mockTemplate, validType: "DAYS", validDays: 30, validStart: null, validEnd: null }]])
            .mockResolvedValueOnce([[{ count: 0 }]])
            .mockResolvedValueOnce({ insertId: 2 })
            .mockResolvedValueOnce({ affectedRows: 1 }),
        };
        return fn(mockConn);
      });

      const res = await receiveCoupon(1, 1, "t1");
      expect(res.couponNo).toBeDefined();
      expect(res.validStart).toBeDefined();
      expect(res.validEnd).toBeDefined();
    });
  });

  describe("updateUserProfile", () => {
    it("应更新昵称并返回更新后信息", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
      mocks.queryOneWithTenant.mockResolvedValueOnce({
        id: 1,
        name: "张三",
        nickname: "新昵称",
        avatar: "avatar.jpg",
        mobile: "13800138000",
        gender: 1,
        birthday: "1990-01-01",
        customerType: "RETAIL",
        points: 100,
        growthValue: 500,
      });

      const res = await updateUserProfile(1, "t1", { nickname: "新昵称" });
      expect(res.memberId).toBe(1);
      expect(res.nickname).toBe("新昵称");
    });

    it("应更新头像", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
      mocks.queryOneWithTenant.mockResolvedValueOnce({
        id: 1,
        name: "张三",
        nickname: "小张",
        avatar: "new-avatar.jpg",
        mobile: "",
        gender: 0,
        birthday: "",
        customerType: "RETAIL",
        points: 0,
        growthValue: 0,
      });

      const res = await updateUserProfile(1, "t1", { avatar: "new-avatar.jpg" });
      expect(res.avatar).toBe("new-avatar.jpg");
    });

    it("应更新性别和生日", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });
      mocks.queryOneWithTenant.mockResolvedValueOnce({
        id: 1,
        name: "张三",
        nickname: "小张",
        avatar: "",
        mobile: "",
        gender: 1,
        birthday: "1990-01-01",
        customerType: "RETAIL",
        points: 0,
        growthValue: 0,
      });

      const res = await updateUserProfile(1, "t1", { gender: 1, birthday: "1990-01-01" });
      expect(res.gender).toBe(1);
      expect(res.birthday).toBe("1990-01-01");
    });

    it("空参数应抛出错误", async () => {
      await expect(updateUserProfile(1, "t1", {})).rejects.toThrow("没有需要更新的字段");
    });
  });

  describe("changePassword", () => {
    it("会员不存在应抛出错误", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce(null);
      await expect(changePassword(999, "t1", "oldPass123!", "NewPass123!")).rejects.toThrow("用户不存在");
    });

    it("会员无密码应抛出错误", async () => {
      mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, passwordHash: null });
      await expect(changePassword(1, "t1", "oldPass123!", "NewPass123!")).rejects.toThrow("请先设置密码");
    });
  });
});
